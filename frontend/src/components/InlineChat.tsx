'use client'

import { useState } from 'react'
import * as Y from 'yjs'
import { commitRevision, revertRevision } from '@/lib/trackedChanges'

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
      status: 'pending',
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

  const isWorking = ping.status === 'pending' || ping.status === 'working'
  const statusLabel = ping.status === 'pending' ? 'Sending request…' : ping.status === 'working' ? 'AI is revising…' : null

  return (
    <div className="inline-chat">
      <div className="inline-chat-header">
        <span className="inline-chat-phase">{ping.status === 'answered' ? 'Revision ready' : ping.status === 'error' ? 'Error' : 'In progress'}</span>
      </div>
      <div className="inline-chat-messages">
        <div className="chat-msg system">
          <span className="chat-label">Ping</span>
          <span>{ping.instruction}</span>
        </div>
        {(ping.messages || []).map((msg: any, i: number) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <span className="chat-label">{msg.role === 'user' ? 'You' : 'AI'}</span>
            <span className="chat-msg-text">{msg.text}</span>
          </div>
        ))}
        {isWorking && statusLabel && (
          <div className="chat-msg thinking">
            <span className="chat-thinking-dot" />
            {statusLabel}
          </div>
        )}
        {ping.status === 'error' && (
          <div className="chat-msg error">
            <span className="chat-label">Error</span>
            <span>{ping.error || 'Something went wrong.'}</span>
          </div>
        )}
      </div>
      {ping.status === 'answered' && (
        <div className="inline-chat-actions">
          <button className="btn-accept" onClick={acceptPing} title="Apply the suggested revision to the document">✓ Accept</button>
          <button className="btn-reject" onClick={rejectPing} title="Discard the suggested revision">✗ Reject</button>
        </div>
      )}
      <div className="inline-chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={ping.status === 'answered' ? 'Accept or reject before requesting another change' : 'Add a note…'}
          disabled={isWorking || ping.status === 'answered'}
        />
      </div>
    </div>
  )
}
