import { Hocuspocus } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'
import { mkdir } from 'fs/promises'
import { createServer } from 'http'
import { createRequire } from 'module'
import * as Y from 'yjs'

const require = createRequire(import.meta.url)

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

await mkdir('/data', { recursive: true })

// ── Hocuspocus WebSocket server ───────────────────────────────────────────────

// Tracks documents that have been user-deleted so onStoreDocument can block
// the SQLite extension from re-persisting them when connections close.
const deletedDocs = new Set()

const server = new Hocuspocus({
  port: 1234,
  quiet: false,

  async onConnect({ documentName }) {
    console.log(`[connect] doc="${documentName}"`)
  },

  async onDisconnect({ documentName }) {
    console.log(`[disconnect] doc="${documentName}"`)
  },

  async onStoreDocument({ documentName }) {
    if (deletedDocs.has(documentName)) {
      throw new Error(`Document "${documentName}" was deleted — skipping persistence`)
    }
  },

  async onLoadDocument({ documentName, document }) {
    const pingMap = document.getMap('pings')
    pingMap.observe((event) => {
      event.keysChanged.forEach((key) => {
        const ping = pingMap.get(key)
        if (ping?.status === 'pending') {
          console.log(`[ping] doc="${documentName}" id="${key}" instruction="${ping.instruction}"`)
          logPing(documentName, key)
          notifyBridge({ documentName, pingId: key, ping })
        }
      })
    })
  },

  async onChange({ documentName }) {
    touchMeta(documentName)
  },

  extensions: [
    new SQLite({ database: '/data/pingpong.sqlite' }),
  ],
})

async function notifyBridge({ documentName, pingId, ping }) {
  const bridgeUrl = process.env.BRIDGE_URL || 'http://bridge:3002'
  try {
    await fetch(`${bridgeUrl}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentName, pingId, ping }),
    })
  } catch (err) {
    console.error('[bridge] Failed to notify bridge:', err.message)
  }
}

server.listen()
console.log(`[server] Hocuspocus running on ws://0.0.0.0:1234`)

// ── HTTP API server (document list / delete) ──────────────────────────────────

const sqlite3 = require('sqlite3')

const DB_PATH = '/data/pingpong.sqlite'
const API_PORT = parseInt(process.env.API_PORT || '1235')

function openDb() {
  return new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE)
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  })
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => err ? reject(err) : resolve())
  })
}

async function logPing(docName, pingId) {
  const db = openDb()
  try {
    await dbRun(db, `CREATE TABLE IF NOT EXISTS ping_log (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_name TEXT, ping_id TEXT, created_at TEXT DEFAULT (datetime('now')))`)
    await dbRun(db, `INSERT INTO ping_log (doc_name, ping_id) VALUES (?, ?)`, [docName, pingId])
  } catch (err) {
    console.error('[ping_log] Failed:', err.message)
  } finally {
    db.close()
  }
}

let metaTableReady = false
async function touchMeta(name) {
  const db = openDb()
  try {
    if (!metaTableReady) {
      await dbRun(db, `CREATE TABLE IF NOT EXISTS document_meta (name TEXT PRIMARY KEY, updated_at TEXT)`)
      metaTableReady = true
    }
    await dbRun(db, `INSERT INTO document_meta (name, updated_at) VALUES (?, datetime('now'))
      ON CONFLICT(name) DO UPDATE SET updated_at = datetime('now')`, [name])
  } catch (err) {
    console.error('[meta] Failed to update timestamp:', err.message)
  } finally {
    db.close()
  }
}

function extractTitle(data, fallback) {
  try {
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, Buffer.isBuffer(data) ? data : Buffer.from(data))
    const title = ydoc.getMap('meta').get('title')
    ydoc.destroy()
    return title || fallback
  } catch {
    return fallback
  }
}

// Initialize meta table (DB created by SQLite extension on first doc write)
async function initMetaTable() {
  try {
    const db = openDb()
    await dbRun(db, `CREATE TABLE IF NOT EXISTS document_meta (name TEXT PRIMARY KEY, updated_at TEXT)`)
    await dbRun(db, `CREATE TABLE IF NOT EXISTS ping_log (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_name TEXT, ping_id TEXT, created_at TEXT DEFAULT (datetime('now')))`)
    metaTableReady = true
    db.close()
    console.log('[api] tables ready')
  } catch (err) {
    console.warn('[api] table init deferred:', err.message)
    setTimeout(initMetaTable, 3000)
  }
}
initMetaTable()

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

  const url = new URL(req.url, 'http://x')

  if (req.method === 'GET' && url.pathname === '/docs') {
    const db = openDb()
    try {
      const rows = await dbAll(db, `
        SELECT d.name, d.data, m.updated_at
        FROM documents d
        LEFT JOIN document_meta m ON d.name = m.name
        ORDER BY COALESCE(m.updated_at, '') DESC, d.rowid DESC
      `)
      const docs = rows.map((row) => ({
        id: row.name,
        title: extractTitle(row.data, row.name),
        updatedAt: row.updated_at ? row.updated_at + 'Z' : null,
      }))
      res.writeHead(200)
      res.end(JSON.stringify(docs))
    } catch (err) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    } finally {
      db.close()
    }
    return
  }

  const match = url.pathname.match(/^\/docs\/(.+)$/)

  if (req.method === 'DELETE' && match) {
    const name = decodeURIComponent(match[1])
    const db = openDb()
    try {
      // Mark deleted FIRST so onStoreDocument blocks re-persistence when connections close
      deletedDocs.add(name)

      // Notify all connected clients so they redirect before being kicked
      const doc = server.documents?.get(name)
      if (doc) {
        try { doc.broadcastStateless(JSON.stringify({ type: 'document-deleted' })) } catch {}
      }

      await dbRun(db, 'DELETE FROM documents WHERE name = ?', [name])
      await dbRun(db, 'DELETE FROM document_meta WHERE name = ?', [name])
      server.closeConnections(name)

      setTimeout(() => deletedDocs.delete(name), 30000)

      res.writeHead(200)
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      deletedDocs.delete(name)
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    } finally {
      db.close()
    }
    return
  }

  // Restore a doc from a Yjs binary snapshot (used after inactivity expiry)
  if (req.method === 'POST' && match) {
    const name = decodeURIComponent(match[1])
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', async () => {
      const data = Buffer.concat(chunks)
      if (!data.length) { res.writeHead(400).end(JSON.stringify({ error: 'Empty body' })); return }
      const db = openDb()
      try {
        await dbRun(db,
          `INSERT INTO documents (name, data) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET data = ?`,
          [name, data, data]
        )
        await touchMeta(name)
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        res.writeHead(500)
        res.end(JSON.stringify({ error: err.message }))
      } finally {
        db.close()
      }
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/admin/stats') {
    if (!ADMIN_PASSWORD) {
      res.writeHead(503).end(JSON.stringify({ error: 'ADMIN_PASSWORD not configured' }))
      return
    }
    if (req.headers['authorization'] !== `Bearer ${ADMIN_PASSWORD}`) {
      res.writeHead(401).end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }
    const db = openDb()
    try {
      const [{ total }]       = await dbAll(db, `SELECT COUNT(*) as total FROM documents`)
      const [{ today }]       = await dbAll(db, `SELECT COUNT(*) as today FROM document_meta WHERE updated_at >= datetime('now', '-1 day')`)
      const [{ week }]        = await dbAll(db, `SELECT COUNT(*) as week  FROM document_meta WHERE updated_at >= datetime('now', '-7 days')`)
      const [{ pingsTotal }]  = await dbAll(db, `SELECT COUNT(*) as pingsTotal FROM ping_log`).catch(() => [{ pingsTotal: 0 }])
      const [{ pingsToday }]  = await dbAll(db, `SELECT COUNT(*) as pingsToday FROM ping_log WHERE created_at >= datetime('now', '-1 day')`).catch(() => [{ pingsToday: 0 }])
      const [{ pingsWeek }]   = await dbAll(db, `SELECT COUNT(*) as pingsWeek  FROM ping_log WHERE created_at >= datetime('now', '-7 days')`).catch(() => [{ pingsWeek: 0 }])
      res.writeHead(200).end(JSON.stringify({
        docs:  { total, today, week, live: server.documents?.size ?? 0 },
        pings: { total: pingsTotal, today: pingsToday, week: pingsWeek },
      }))
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ error: err.message }))
    } finally {
      db.close()
    }
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Not found' }))
}).listen(API_PORT, () => {
  console.log(`[api] HTTP API running on :${API_PORT}`)
})
