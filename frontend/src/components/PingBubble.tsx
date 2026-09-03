'use client'

import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'

interface PingBubbleProps {
  editor: Editor | null
  docId: string
  ydoc: Y.Doc
}

export default function PingBubble({ editor, docId, ydoc }: PingBubbleProps) {
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null)
  const [instruction, setInstruction] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      if (from === to) { setBubble(null); return }

      // Position bubble near the selection
      const domSelection = window.getSelection()
      if (!domSelection || domSelection.rangeCount === 0) return
      const range = domSelection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const editorRect = editor.view.dom.getBoundingClientRect()

      setBubble({
        top: rect.top - editorRect.top - 8,
        left: rect.right - editorRect.left + 8,
      })
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => { editor.off('selectionUpdate', handleSelectionUpdate) }
  }, [editor])

  useEffect(() => {
    if (bubble) inputRef.current?.focus()
  }, [bubble])

  const sendPing = async () => {
    if (!editor || !instruction.trim()) return
    setSending(true)

    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')

    // Get surrounding context (paragraph before + after)
    const context = editor.getText()

    const pingId = `ping-${Date.now()}`
    const pingMap = ydoc.getMap('pings')
    pingMap.set(pingId, {
      id: pingId,
      instruction: instruction.trim(),
      selectedText,
      from,
      to,
      context,
      status: 'pending',
      messages: [],
      createdAt: new Date().toISOString(),
    })

    setInstruction('')
    setBubble(null)
    setSending(false)
  }

  if (!bubble) return null

  return (
    <div
      className="ping-bubble"
      style={{ top: bubble.top, left: bubble.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="ping-bubble-label">🏓 Ping</div>
      <input
        ref={inputRef}
        className="ping-bubble-input"
        placeholder="Anweisung für Claude…"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') sendPing()
          if (e.key === 'Escape') setBubble(null)
        }}
        disabled={sending}
      />
      {instruction && (
        <button className="ping-send-btn" onClick={sendPing} disabled={sending}>
          {sending ? '…' : '→'}
        </button>
      )}
    </div>
  )
}
