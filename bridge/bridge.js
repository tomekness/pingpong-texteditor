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

  // Guard: verify live ping status is still 'pending' before processing.
  // The server observer can dispatch stale notifications when the document
  // is reloaded from SQLite while a previous bridge run is still in flight.
  const livePing = ydoc.getMap('pings').get(pingId)
  if (!livePing || livePing.status !== 'pending') {
    console.log(`[ping] "${pingId}" status=${livePing?.status ?? 'gone'} — skipping stale dispatch`)
    setTimeout(() => provider.destroy(), 500)
    return
  }

  const pingMap = ydoc.getMap('pings')
  pingMap.set(pingId, { ...ping, status: 'working' })

  try {
    const { revision, explanation } = await callLLM(ping)

    // Transact so tracked changes + status arrive atomically at all clients.
    // For follow-ups, revert INSIDE this transact — the ydoc content is fully
    // populated by now (synced fires before all updates arrive, so reverting
    // immediately after sync sees an empty doc).
    ydoc.transact(() => {
      if (ping.messages && ping.messages.length > 0) {
        revertTrackedChanges(ydoc.getXmlFragment('default'))
      }
      applyRevision(ydoc.getXmlFragment('default'), ping, revision)
      pingMap.set(pingId, {
        ...ping,
        status: 'answered',
        revision,
        messages: [
          ...(ping.messages || []),
          // text = what's shown in chat; revision = what LLM produced (for follow-up context)
          { role: 'assistant', text: explanation || revision, revision },
        ],
      })
    })
    console.log(`[ping] ✓ done — id="${pingId}" explanation="${(explanation || '').slice(0, 60)}"`)
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
      messages: buildMessages(ping),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM API ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw = data.choices[0].message.content.trim()

  // Parse JSON response: {revision, explanation}
  // Normalize line endings; allow \n so y-prosemirror creates proper paragraph splits.
  // Collapse runs of 3+ newlines to 2 to avoid excessive blank paragraphs.
  const sanitize = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  try {
    const parsed = JSON.parse(raw)
    if (parsed.revision && typeof parsed.revision === 'string') {
      return { revision: sanitize(parsed.revision), explanation: (parsed.explanation || '').trim() || null }
    }
  } catch (_) {}

  // Fallback: treat full response as revision with no explanation
  return { revision: sanitize(raw), explanation: null }
}

// ── Build LLM message list (supports follow-up conversation) ─────────────────
function buildMessages(ping) {
  const system = {
    role: 'system',
    content: `You are a precise editor. You only revise the highlighted text passage.
Respond ONLY with a JSON object — no other text before or after:
{"revision": "<the revised text>", "explanation": "<one brief sentence explaining what you changed>"}`,
  }
  const initial = {
    role: 'user',
    content: `Context:\n---\n${ping.context}\n---\n\nSelected passage:\n"${ping.selectedText}"\n\nInstruction: ${ping.instruction}`,
  }

  if (!ping.messages || ping.messages.length === 0) {
    return [system, initial]
  }

  // Follow-up: use revision text (not explanation) for LLM context
  const history = ping.messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.role === 'assistant' ? (m.revision || m.text) : m.text,
  }))
  return [system, initial, ...history]
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

// ── Revert all tracked changes in a Y.XmlFragment (bridge-side) ──────────────
function revertTrackedChanges(xmlFragment) {
  function processNode(el) {
    if (el instanceof Y.XmlText) {
      const delta = el.toDelta()
      const ops = []
      let pos = 0
      for (const op of delta) {
        const len = (op.insert || '').length
        if (op.attributes?.trackedInsert) {
          ops.push({ pos, len, type: 'delete' })
        } else if (op.attributes?.trackedDelete) {
          ops.push({ pos, len, type: 'clean' })
        }
        pos += len
      }
      ops.sort((a, b) => b.pos - a.pos)
      for (const op of ops) {
        if (op.type === 'delete') {
          el.delete(op.pos, op.len)
        } else {
          el.format(op.pos, op.len, { trackedDelete: null })
        }
      }
    } else if (el && typeof el.toArray === 'function') {
      for (const child of el.toArray()) processNode(child)
    }
  }
  processNode(xmlFragment)
}

// ── Accept all tracked changes in a Y.XmlFragment (bridge-side) ─────────────
function acceptTrackedChanges(xmlFragment) {
  function processNode(el) {
    if (el instanceof Y.XmlText) {
      const delta = el.toDelta()
      const ops = []
      let pos = 0
      for (const op of delta) {
        const len = (op.insert || '').length
        if (op.attributes?.trackedDelete) {
          ops.push({ pos, len, type: 'delete' })
        } else if (op.attributes?.trackedInsert) {
          ops.push({ pos, len, type: 'clean' })
        }
        pos += len
      }
      ops.sort((a, b) => b.pos - a.pos)
      for (const op of ops) {
        if (op.type === 'delete') {
          el.delete(op.pos, op.len)
        } else {
          el.format(op.pos, op.len, { trackedInsert: null })
        }
      }
    } else if (el && typeof el.toArray === 'function') {
      for (const child of el.toArray()) processNode(child)
    }
  }
  processNode(xmlFragment)
}

// ── Apply Tracked Change in Y.XmlFragment (word-level diff, per-hunk IDs) ────
function applyRevision(xmlFragment, ping, revision) {
  // Accept any open tracked changes so offsets are clean before applying the new diff.
  acceptTrackedChanges(xmlFragment)

  const target = ping.selectedText

  function findAndApply(el, text, rev) {
    if (el instanceof Y.XmlText) {
      const content = el.toString()
      const idx = content.indexOf(text)
      if (idx !== -1) {
        applyDiffedRevision(el, idx, text, rev)
        return true
      }
    } else if (el && typeof el.toArray === 'function') {
      for (const child of el.toArray()) {
        if (findAndApply(child, text, rev)) return true
      }
    }
    return false
  }

  // Single-paragraph: direct search
  if (findAndApply(xmlFragment, target, revision)) {
    console.log(`[ping] ✎ tracked: "${target.slice(0, 40)}" → "${revision.slice(0, 40)}"`)
    return
  }

  // Trimmed fallback: selectedText may include trailing newlines if the selection
  // extended to a paragraph boundary (textBetween adds '\n' as block separator).
  const trimmedTarget = target.replace(/\n+$/, '')
  if (trimmedTarget !== target && findAndApply(xmlFragment, trimmedTarget, revision)) {
    console.log(`[ping] ✎ tracked (trimmed): "${trimmedTarget.slice(0, 40)}" → "${revision.slice(0, 40)}"`)
    return
  }

  // Multi-paragraph: apply a per-paragraph word diff instead of dumping the
  // entire revision into paragraph 1. Split both sides by \n and diff each pair.
  if (target.includes('\n')) {
    const origParas = target.split('\n').filter(p => p.trim().length > 0)
    if (origParas.length >= 2) {
      const revParas = revision.split('\n').filter(p => p.trim().length > 0)

      // If revision has more paragraphs than original, merge excess into the last
      // revision paragraph so we never have more rev than orig entries to diff.
      while (revParas.length > origParas.length) {
        const extra = revParas.pop()
        if (revParas.length === 0) { revParas.push(extra); break }
        revParas[revParas.length - 1] = revParas[revParas.length - 1] + ' ' + extra
      }

      // Global hunk counter shared across all paragraphs so IDs don't collide.
      let globalHunkCounter = 0
      let pIdx = 0
      let applied = 0

      function markParagraph(el, para) {
        if (el instanceof Y.XmlText) {
          const content = el.toString()
          const idx = content.indexOf(para)
          if (idx !== -1) {
            if (pIdx < revParas.length) {
              globalHunkCounter = applyDiffedRevision(el, idx, para, revParas[pIdx], globalHunkCounter)
            } else {
              // Excess original paragraph with no corresponding revision — delete it.
              el.format(idx, para.length, { trackedDelete: { hunkId: `h${globalHunkCounter++}` } })
            }
            pIdx++
            applied++
            return true
          }
        } else if (el && typeof el.toArray === 'function') {
          for (const child of el.toArray()) {
            if (markParagraph(child, para)) return true
          }
        }
        return false
      }

      for (const para of origParas) markParagraph(xmlFragment, para)

      if (applied > 0) {
        console.log(`[ping] ✎ multi-para tracked: ${applied}/${origParas.length} para(s) ← ${revParas.length} rev para(s)`)
        return
      }
    }
  }

  // Follow-up fallback: previous revision text may still be in the document
  if (ping.revision && findAndApply(xmlFragment, ping.revision, revision)) {
    console.log(`[ping] ✎ follow-up tracked: "${ping.revision.slice(0, 40)}" → "${revision.slice(0, 40)}"`)
    return
  }

  // Empty-paragraph fallback: tracked-change content was lost (e.g. due to a
  // TipTap paragraph-split from a prior newline in revision text). Find the
  // empty XmlText node where the original content was and re-insert it so we
  // can apply the new tracked diff cleanly.
  if (ping.messages?.length > 0) {
    function findEmpty(el) {
      if (el instanceof Y.XmlText && el.toDelta().length === 0) return el
      if (el && typeof el.toArray === 'function') {
        for (const c of el.toArray()) { const r = findEmpty(c); if (r) return r }
      }
      return null
    }
    const emptyText = findEmpty(xmlFragment)
    if (emptyText) {
      emptyText.insert(0, target)
      applyDiffedRevision(emptyText, 0, target, revision)
      console.log(`[ping] ✎ reconstructed tracked changes in empty paragraph`)
      return
    }
  }

  console.warn(`[ping] ⚠ text not found in doc: "${target.slice(0, 60)}"`)
}

// startCounter allows callers to share a global hunk counter across multiple
// paragraphs so IDs don't collide. Returns the next available counter value.
function applyDiffedRevision(el, idx, oldText, newText, startCounter = 0) {
  const ops = wordDiff(oldText, newText)

  // Group consecutive delete/insert ops into hunks
  const hunks = []
  let hunkCounter = startCounter, oldPos = 0, opIdx = 0

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

  return hunkCounter
}
