'use client'

import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'

interface PingBubbleProps {
  editor: Editor | null
  docId: string
  ydoc: Y.Doc
  setPreviewRange: (range: { from: number; to: number } | null) => void
}

export default function PingBubble({ editor, docId, ydoc, setPreviewRange }: PingBubbleProps) {
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null)
  const [active, setActive] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      if (from === to) { setBubble(null); setActive(false); setPreviewRange(null); return }

      const domSelection = window.getSelection()
      if (!domSelection || domSelection.rangeCount === 0) return
      const range = domSelection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const editorRect = editor.view.dom.getBoundingClientRect()

      setBubble({
        top: rect.top - editorRect.top - 8,
        left: rect.right - editorRect.left + 8,
      })
      setActive(false)
    }

    // Tab on the editor DOM focuses the ping input when bubble is visible
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && bubble) {
        e.preventDefault()
        setActive(true)
        const { from, to } = editor.state.selection
        if (from !== to) setPreviewRange({ from, to })
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.view.dom.addEventListener('keydown', handleKeyDown)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.view.dom.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, bubble, setPreviewRange])

  const activate = () => {
    setActive(true)
    if (editor) {
      const { from, to } = editor.state.selection
      if (from !== to) setPreviewRange({ from, to })
    }
  }

  const activateWithFocus = () => {
    setActive(true)
    if (editor) {
      const { from, to } = editor.state.selection
      if (from !== to) setPreviewRange({ from, to })
    }
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const deactivate = () => {
    if (!instruction) { setActive(false); setPreviewRange(null) }
  }

  const sendPing = async () => {
    if (!editor || !instruction.trim()) return
    setSending(true)

    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '\n')
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
    setActive(false)
    setSending(false)
    setPreviewRange(null)
  }

  if (!bubble) return null

  return (
    <div
      className={`ping-bubble ${active ? 'ping-bubble--active' : 'ping-bubble--hint'}`}
      style={{ top: bubble.top, left: bubble.left }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={activateWithFocus}
      onMouseEnter={activate}
      onMouseLeave={deactivate}
    >
      <div className="ping-bubble-label">🏓</div>
      {active ? (
        <>
          <input
            ref={inputRef}
            className="ping-bubble-input"
            placeholder="Instruction for Opponent…"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendPing()
              if (e.key === 'Escape') { setActive(false); setInstruction(''); setPreviewRange(null) }
            }}
            disabled={sending}
          />
          {instruction && (
            <button className="ping-send-btn" onClick={sendPing} disabled={sending} title="Send ping (Enter)">
              {sending ? '…' : '→'}
            </button>
          )}
        </>
      ) : (
        <span className="ping-bubble-hint">Tab or hover</span>
      )}
    </div>
  )
}
