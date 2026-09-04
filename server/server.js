import { Hocuspocus } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'
import { mkdir } from 'fs/promises'
import { createServer } from 'http'
import { createRequire } from 'module'
import * as Y from 'yjs'

const require = createRequire(import.meta.url)


await mkdir('/data', { recursive: true })

// ── Hocuspocus WebSocket server ───────────────────────────────────────────────

const server = new Hocuspocus({
  port: 1234,
  quiet: false,

  async onConnect({ documentName }) {
    console.log(`[connect] doc="${documentName}"`)
  },

  async onDisconnect({ documentName }) {
    console.log(`[disconnect] doc="${documentName}"`)
  },

  async onLoadDocument({ documentName, document }) {
    const pingMap = document.getMap('pings')
    pingMap.observe((event) => {
      event.keysChanged.forEach((key) => {
        const ping = pingMap.get(key)
        if (ping?.status === 'pending') {
          console.log(`[ping] doc="${documentName}" id="${key}" instruction="${ping.instruction}"`)
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
    metaTableReady = true
    db.close()
    console.log('[api] document_meta table ready')
  } catch (err) {
    console.warn('[api] document_meta init deferred:', err.message)
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
      await dbRun(db, 'DELETE FROM documents WHERE name = ?', [name])
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
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
