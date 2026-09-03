import { Hocuspocus } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'
import { mkdir } from 'fs/promises'

await mkdir('/data', { recursive: true })

const server = new Hocuspocus({
  port: 1234,
  quiet: false,

  async onConnect({ documentName }) {
    console.log(`[connect] doc="${documentName}"`)
  },

  async onDisconnect({ documentName }) {
    console.log(`[disconnect] doc="${documentName}"`)
  },

  // Set up the ping observer once per document load (not on every change)
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
