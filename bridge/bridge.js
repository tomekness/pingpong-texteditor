import Anthropic from '@anthropic-ai/sdk'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
const HOCUSPOCUS_URL = process.env.HOCUSPOCUS_URL || 'ws://hocuspocus:1234'
const PORT = parseInt(process.env.BRIDGE_PORT || '3002')

// Simple HTTP server (no framework needed)
const server = Deno?.serve ? null : await startServer()

async function startServer() {
  const { createServer } = await import('http')
  const srv = createServer(async (req, res) => {
    if (req.method !== 'POST' || new URL(req.url, 'http://x').pathname !== '/ping') {
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
        // Handle async — don't block response
        handlePing(payload).catch(console.error)
      } catch (err) {
        res.writeHead(400).end(err.message)
      }
    })
  })
  srv.listen(PORT, () => console.log(`[bridge] Listening on :${PORT}`))
  return srv
}

async function handlePing({ documentName, pingId, ping }) {
  console.log(`[ping] doc="${documentName}" id="${pingId}" instruction="${ping.instruction}"`)

  // Connect to the document
  const ydoc = new Y.Doc()
  const provider = new HocuspocusProvider({
    url: HOCUSPOCUS_URL,
    name: documentName,
    document: ydoc,
  })

  await new Promise((resolve) => provider.on('synced', resolve))

  const pingMap = ydoc.getMap('pings')

  // Mark as in-progress
  pingMap.set(pingId, { ...ping, status: 'working' })

  try {
    const revision = await callClaude(ping)

    // Write revision into the document text
    const ytext = ydoc.getText('default')
    applyRevision(ytext, ping, revision)

    // Update ping with Claude's message + done status
    pingMap.set(pingId, {
      ...ping,
      status: 'pending', // stays pending until user accepts
      messages: [
        ...(ping.messages || []),
        { role: 'assistant', text: `Ich habe "${ping.selectedText.slice(0, 40)}…" überarbeitet.` },
      ],
      revision,
    })
  } catch (err) {
    console.error('[ping] Claude error:', err.message)
    pingMap.set(pingId, { ...ping, status: 'error', error: err.message })
  } finally {
    setTimeout(() => provider.destroy(), 2000)
  }
}

async function callClaude(ping) {
  const systemPrompt = `Du bist ein präziser Lektor. Du bearbeitest nur den markierten Textabschnitt.
Antworte NUR mit dem überarbeiteten Text — keine Erklärung, keine Anführungszeichen, kein Präfix.`

  const userMessage = `Kontext des Dokuments:
---
${ping.context}
---

Markierter Abschnitt:
"${ping.selectedText}"

Aufgabe: ${ping.instruction}`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  return response.content[0].text.trim()
}

function applyRevision(ytext, ping, revision) {
  // Replace the selected range with Claude's revision
  // Positions may have shifted — we use the stored from/to as best-effort
  const currentText = ytext.toString()
  const originalText = ping.selectedText

  const idx = currentText.indexOf(originalText)
  if (idx === -1) {
    console.warn('[ping] Could not find original text in document, appending revision')
    return
  }

  ytext.delete(idx, originalText.length)
  ytext.insert(idx, revision)
}

console.log(`[bridge] Pingpong AI bridge ready`)
