import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

const API_KEY        = process.env.LLM_API_KEY || process.env.OPENWEBUI_API_KEY
const BASE_URL       = process.env.LLM_BASE_URL || process.env.OPENWEBUI_BASE_URL
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
          text: `Revised: "${ping.selectedText.slice(0, 60)}${ping.selectedText.length > 60 ? '…' : ''}"`,
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
          content: `You are a precise editor. You only revise the highlighted text passage.
Reply ONLY with the revised text — no explanation, no quotes, no prefix.`,
        },
        {
          role: 'user',
          content: `Context:\n---\n${ping.context}\n---\n\nSelected passage:\n"${ping.selectedText}"\n\nInstruction: ${ping.instruction}`,
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

// ── Word-level diff (LCS) ─────────────────────────────────────────────────────
function wordDiff(oldStr, newStr) {
  const tokenize = s => s.match(/[^\s]+|\s+/g) || []
  const A = tokenize(oldStr), B = tokenize(newStr)
  const m = A.length, n = B.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1])
  const ops = []
  let i = 0, j = 0
  while (i < m || j < n) {
    if (i < m && j < n && A[i] === B[j]) { ops.push({ type: 'equal', text: A[i] }); i++; j++ }
    else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) { ops.push({ type: 'insert', text: B[j] }); j++ }
    else { ops.push({ type: 'delete', text: A[i] }); i++ }
  }
  return ops
}

// ── Apply Tracked Change in Y.XmlFragment (word-level diff, per-hunk IDs) ────
function applyRevision(xmlFragment, ping, revision) {
  const target = ping.selectedText

  function walk(el) {
    if (el instanceof Y.XmlText) {
      const content = el.toString()
      const idx = content.indexOf(target)
      if (idx !== -1) {
        applyDiffedRevision(el, idx, target, revision)
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

function applyDiffedRevision(el, idx, oldText, newText) {
  const ops = wordDiff(oldText, newText)

  // Group consecutive delete/insert ops into hunks
  const hunks = []
  let hunkCounter = 0, oldPos = 0, opIdx = 0

  while (opIdx < ops.length) {
    if (ops[opIdx].type === 'equal') {
      oldPos += ops[opIdx].text.length
      opIdx++
    } else {
      const hunkId = `h${hunkCounter++}`
      const editStart = oldPos
      let deleteText = '', insertText = ''
      while (opIdx < ops.length && ops[opIdx].type !== 'equal') {
        if (ops[opIdx].type === 'delete') { deleteText += ops[opIdx].text; oldPos += ops[opIdx].text.length }
        else { insertText += ops[opIdx].text }
        opIdx++
      }
      hunks.push({ hunkId, editStart, deleteLen: deleteText.length, insertText })
    }
  }

  // Apply right-to-left to preserve positions
  for (let k = hunks.length - 1; k >= 0; k--) {
    const { hunkId, editStart, deleteLen, insertText } = hunks[k]
    const absPos = idx + editStart
    if (insertText) el.insert(absPos + deleteLen, insertText, { trackedInsert: { hunkId } })
    if (deleteLen > 0) el.format(absPos, deleteLen, { trackedDelete: { hunkId } })
  }
}
