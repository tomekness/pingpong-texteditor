import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

const API_KEY        = process.env.OPENWEBUI_API_KEY
const BASE_URL       = process.env.OPENWEBUI_BASE_URL
const MODEL          = process.env.LLM_MODEL || 'gpt-4o-mini'
const HOCUSPOCUS_URL = process.env.HOCUSPOCUS_URL || 'ws://hocuspocus:1234'
const PORT           = parseInt(process.env.BRIDGE_PORT || '3002')

// ── HTTP Server ───────────────────────────────────────────────────────────────
const { createServer } = await import('http')
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200).end(JSON.stringify({ ok: true, model: MODEL }))
    return
  }

  if (req.method !== 'POST' || url.pathname !== '/ping') {
    res.writeHead(404).end()
    return
  }

  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body)
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      handlePing(payload).catch(console.error)
    } catch (err) {
      res.writeHead(400).end(err.message)
    }
  })
}).listen(PORT, () => console.log(`[bridge] Listening on :${PORT} — model: ${MODEL}`))

// ── Ping Handler ──────────────────────────────────────────────────────────────
async function handlePing({ documentName, pingId, ping }) {
  console.log(`[ping] doc="${documentName}" id="${pingId}" → "${ping.instruction}"`)

  const ydoc     = new Y.Doc()
  const provider = new HocuspocusProvider({
    url: HOCUSPOCUS_URL,
    name: documentName,
    document: ydoc,
    token: 'internal',
  })

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('sync timeout')), 15_000)
    provider.on('synced', () => { clearTimeout(t); resolve() })
  })

  const pingMap = ydoc.getMap('pings')
  pingMap.set(pingId, { ...ping, status: 'working' })

  try {
    const revision = await callLLM(ping)
    applyRevision(ydoc.getXmlFragment('default'), ping, revision)

    // Status 'answered' (not 'pending') so observer won't re-trigger
    pingMap.set(pingId, {
      ...ping,
      status: 'answered',
      revision,
      messages: [
        ...(ping.messages || []),
        {
          role: 'assistant',
          text: `Überarbeitet: "${ping.selectedText.slice(0, 60)}${ping.selectedText.length > 60 ? '…' : ''}"`,
        },
      ],
    })
    console.log(`[ping] ✓ done — id="${pingId}"`)
  } catch (err) {
    console.error(`[ping] ✗ error — id="${pingId}"`, err.message)
    pingMap.set(pingId, { ...ping, status: 'error', error: err.message })
  } finally {
    setTimeout(() => provider.destroy(), 2000)
  }
}

// ── LLM Call (OpenAI-compatible) ──────────────────────────────────────────────
async function callLLM(ping) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `Du bist ein präziser Lektor. Du bearbeitest nur den markierten Textabschnitt.
Antworte NUR mit dem überarbeiteten Text — keine Erklärung, keine Anführungszeichen, kein Präfix.`,
        },
        {
          role: 'user',
          content: `Kontext:\n---\n${ping.context}\n---\n\nMarkierter Abschnitt:\n"${ping.selectedText}"\n\nAufgabe: ${ping.instruction}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM API ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

// ── Apply Tracked Change in Y.XmlFragment (keeps original + revision visible) ─
function applyRevision(xmlFragment, ping, revision) {
  const target = ping.selectedText

  function walk(el) {
    if (el?.constructor?.name === 'YXmlText') {
      const content = el.toString()
      const idx = content.indexOf(target)
      if (idx !== -1) {
        // Mark original text as to-be-deleted (red strikethrough)
        el.format(idx, target.length, { trackedDelete: true })
        // Insert revision text as to-be-inserted (green) right after
        el.insert(idx + target.length, revision, { trackedInsert: true })
        return true
      }
    } else if (el && typeof el.toArray === 'function') {
      for (const child of el.toArray()) {
        if (walk(child)) return true
      }
    }
    return false
  }

  if (!walk(xmlFragment)) {
    console.warn(`[ping] ⚠ text not found in doc: "${target.slice(0, 60)}"`)
  } else {
    console.log(`[ping] ✎ tracked: "${target.slice(0, 40)}" → "${revision.slice(0, 40)}"`)
  }
}
