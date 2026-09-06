'use client'

import { useState } from 'react'
import * as Y from 'yjs'
import { commitRevision, revertRevision } from '@/lib/trackedChanges'

function wordDiff(a: string, b: string) {
  const wa = a.split(/(\s+)/)
  const wb = b.split(/(\s+)/)
  const m = wa.length, n = wb.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = wa[i-1] === wb[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
  const ops: Array<{ type: 'equal' | 'remove' | 'add'; text: string }> = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wa[i-1] === wb[j-1]) {
      ops.unshift({ type: 'equal', text: wa[i-1] }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({ type: 'add', text: wb[j-1] }); j--
    } else {
      ops.unshift({ type: 'remove', text: wa[i-1] }); i--
    }
  }
  return ops
}

interface InlineChatProps {
  pingId: string
  ping: any
  docId: string
  ydoc: Y.Doc
}

export default function InlineChat({ pingId, ping, docId, ydoc }: InlineChatProps) {
  const [input, setInput] = useState('')

  const sendMessage = () => {
    if (!input.trim()) return
    const pingMap = ydoc.getMap('pings')
    const current = pingMap.get(pingId) as any
    pingMap.set(pingId, {
      ...current,
      messages: [...(current.messages || []), { role: 'user', text: input.trim() }],
    })
    setInput('')
  }

  const acceptPing = () => {
    commitRevision(ydoc)
    const pingMap = ydoc.getMap('pings')
    const current = pingMap.get(pingId) as any
    pingMap.set(pingId, { ...current, status: 'accepted' })
  }

  const rejectPing = () => {
    revertRevision(ydoc)
    const pingMap = ydoc.getMap('pings')
    const current = pingMap.get(pingId) as any
    pingMap.set(pingId, { ...current, status: 'rejected' })
  }

  if (ping.status === 'accepted' || ping.status === 'rejected') return null

  return (
    <div className="inline-chat">
      <div className="inline-chat-messages">
        <div className="chat-msg system">
          <span className="chat-label">Ping</span>
          <span>{ping.instruction}</span>
        </div>
        {(ping.messages || []).map((msg: any, i: number) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <span className="chat-label">{msg.role === 'user' ? 'You' : 'Opponent'}</span>
            <span>{msg.text}</span>
          </div>
        ))}
        {(ping.status === 'pending' || ping.status === 'working') && (
          <div className="chat-msg thinking">Opponent is thinking…</div>
        )}
        {ping.status === 'answered' && ping.revision && (
          <div className="chat-diff">
            <div className="diff-row">
              <span className="diff-label">Changes</span>
              <span>
                {wordDiff(ping.selectedText, ping.revision).map((op, i) =>
                  op.type === 'equal'  ? <span key={i}>{op.text}</span> :
                  op.type === 'remove' ? <span key={i} className="diff-removed">{op.text}</span> :
                                         <span key={i} className="diff-added">{op.text}</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="inline-chat-actions">
        <button className="btn-accept" onClick={acceptPing} title="Apply the suggested revision to the document">✓ Accept all</button>
        <button className="btn-reject" onClick={rejectPing} title="Discard the suggested revision">✗ Reject all</button>
      </div>
      <div className="inline-chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Reply or correction…"
        />
      </div>
    </div>
  )
}
