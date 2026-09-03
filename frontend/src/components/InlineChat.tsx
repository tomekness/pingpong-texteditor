'use client'

import { useState } from 'react'
import * as Y from 'yjs'

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
    const pingMap = ydoc.getMap('pings')
    const current = pingMap.get(pingId) as any
    pingMap.set(pingId, { ...current, status: 'accepted' })
  }

  const rejectPing = () => {
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
            <span className="chat-label">{msg.role === 'user' ? 'Du' : 'Claude'}</span>
            <span>{msg.text}</span>
          </div>
        ))}
        {ping.status === 'pending' && (
          <div className="chat-msg thinking">Claude schreibt…</div>
        )}
      </div>
      <div className="inline-chat-actions">
        <button className="btn-accept" onClick={acceptPing}>✓ Annehmen</button>
        <button className="btn-reject" onClick={rejectPing}>✗ Ablehnen</button>
      </div>
      <div className="inline-chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Antwort oder Korrektur…"
        />
      </div>
    </div>
  )
}
