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

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

  const url = new URL(req.url, 'http://x')

  if (req.method === 'GET' && url.pathname === '/docs') {
    const db = openDb()
    try {
      const rows = await dbAll(db, 'SELECT name, data FROM documents ORDER BY rowid DESC')
      const docs = rows.map((row) => ({
        id: row.name,
        title: extractTitle(row.data, row.name),
        updatedAt: null,
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
