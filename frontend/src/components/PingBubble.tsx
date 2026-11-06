'use client'

import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'

const TOPBAR_H = 48
const TOOLBAR_H = 60

const SLASH_COMMANDS = [
  { id: 'grammar',   label: 'Grammar & Spelling', hint: '/grammar' },
  { id: 'translate', label: 'Translate',           hint: '/translate [language]' },
]

function getFilteredCommands(instr: string) {
  if (!instr.startsWith('/')) return []
  const word = instr.slice(1).split(' ')[0].toLowerCase()
  return SLASH_COMMANDS.filter(c => c.id.startsWith(word))
}

function resolveSlashCommand(instr: string): { commandType: string; instruction: string } | null {
  const m = instr.trim().match(/^\/(\w+)(?:\s+(.+))?$/)
  if (!m) return null
  const cmd = m[1].toLowerCase()
  const param = m[2]?.trim()
  if ('grammar'.startsWith(cmd)) return { commandType: 'grammar', instruction: 'Fix all grammar and spelling errors.' }
  if ('translate'.startsWith(cmd)) return { commandType: 'translate', instruction: `Translate to ${param || 'English'}.` }
  return null
}

interface PingBubbleProps {
  editor: Editor | null
  docId: string
  ydoc: Y.Doc
  setPreviewRange: (range: { from: number; to: number } | null) => void
  hasOpenHunks?: boolean
}

export default function PingBubble({ editor, docId, ydoc, setPreviewRange, hasOpenHunks = false }: PingBubbleProps) {
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null)
  const [active, setActive] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [sending, setSending] = useState(false)
  const [slashMenuIndex, setSlashMenuIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingFocusRef = useRef(false)

  useEffect(() => {
    if (!editor) return

    // Clamp a viewport-coordinate top so the bubble stays in the visible area.
    // If the position lands in the lower half of the viewport (e.g. after Cmd+A),
    // snap to vertical center instead of hugging the bottom.
    const clamp = (viewportTop: number) => {
      const mid = window.innerHeight / 2
      if (viewportTop > mid) return mid
      return Math.max(TOPBAR_H + 16, Math.min(viewportTop, window.innerHeight - TOOLBAR_H - 40))
    }

    // Position bubble using ProseMirror coords — returns false if it fails
    const positionFromPM = (): boolean => {
      const { to } = editor.state.selection
      const editorRect = editor.view.dom.getBoundingClientRect()
      try {
        const safePos = Math.max(1, Math.min(to - 1, editor.state.doc.content.size - 1))
        const coords = editor.view.coordsAtPos(safePos)
        setBubble({ top: clamp(coords.top) - editorRect.top - 8, left: coords.right - editorRect.left + 8 })
        return true
      } catch {
        return false
      }
    }

    // Fallback: position bubble using the browser DOM selection rect
    const positionFromDOM = (): boolean => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (!rect.width && !rect.height) return false
      const editorRect = editor.view.dom.getBoundingClientRect()
      setBubble({ top: clamp(rect.top) - editorRect.top - 8, left: rect.right - editorRect.left + 8 })
      return true
    }

    // Fires for all in-editor selections (keyboard, mouse, Cmd+A)
    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      if (from === to) { setBubble(null); setActive(false); setPreviewRange(null); return }
      if (!positionFromPM()) positionFromDOM()
      setActive(false)
    }

    // Fires for drags that START outside the editor (PM never sees the mousedown)
    const handleDocSelectionChange = () => {
      const { from, to } = editor.state.selection
      if (from !== to) return  // PM already handles this via selectionUpdate

      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const editorDom = editor.view.dom
      const range = sel.getRangeAt(0)

      if (sel.isCollapsed) {
        if (editorDom.contains(range.startContainer)) { setBubble(null); setPreviewRange(null) }
        return
      }

      // Only care if the selection reaches into the editor content
      if (!editorDom.contains(range.startContainer) && !editorDom.contains(range.endContainer)) return

      positionFromDOM()
      setActive(false)
    }

    // Tab opens the ping input when the bubble is showing
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && bubble) {
        e.preventDefault()
        pendingFocusRef.current = true  // guard blur before setTimeout focus fires
        setActive(true)
        const { from, to } = editor.state.selection
        if (from !== to) setPreviewRange({ from, to })
        setTimeout(() => {
          inputRef.current?.focus()
          pendingFocusRef.current = false
        }, 0)
      }
    }

    // Hide bubble when editor loses focus, unless focus is moving to the ping input
    const handleBlur = ({ event }: { event: FocusEvent }) => {
      if (pendingFocusRef.current) return  // Tab just fired; input will receive focus momentarily
      if (inputRef.current && event?.relatedTarget === inputRef.current) return
      setBubble(null)
      setActive(false)
      setPreviewRange(null)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('blur', handleBlur)
    document.addEventListener('selectionchange', handleDocSelectionChange)
    editor.view.dom.addEventListener('keydown', handleKeyDown)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('blur', handleBlur)
      document.removeEventListener('selectionchange', handleDocSelectionChange)
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
    if (!editor || !instruction.trim() || hasOpenHunks) return
    setSending(true)

    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '\n', '\n').replace(/\n+$/, '')
    const context = editor.getText()

    const slashResolved = resolveSlashCommand(instruction)
    const finalInstruction = slashResolved?.instruction ?? instruction.trim()
    const commandType = slashResolved?.commandType ?? null

    const pingId = `ping-${Date.now()}`
    const pingMap = ydoc.getMap('pings')
    pingMap.set(pingId, {
      id: pingId,
      instruction: finalInstruction,
      ...(commandType ? { commandType } : {}),
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

  const filteredCommands = getFilteredCommands(instruction)
  const selectCommand = (cmd: typeof SLASH_COMMANDS[0]) => {
    setInstruction(cmd.id === 'grammar' ? '/grammar' : '/translate ')
    setSlashMenuIndex(0)
    setTimeout(() => inputRef.current?.focus(), 0)
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
        hasOpenHunks ? (
          <span className="ping-bubble-blocked">Accept or reject changes first</span>
        ) : (
          <div className="ping-input-wrap">
            {filteredCommands.length > 0 && (
              <div className="slash-menu">
                {filteredCommands.map((cmd, i) => (
                  <div
                    key={cmd.id}
                    className={`slash-menu-item${i === slashMenuIndex ? ' slash-menu-item--active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); selectCommand(cmd) }}
                  >
                    <span className="slash-menu-label">{cmd.label}</span>
                    <span className="slash-menu-hint">{cmd.hint}</span>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              className="ping-bubble-input"
              placeholder="Instruction for Opponent…"
              value={instruction}
              onChange={(e) => { setInstruction(e.target.value); setSlashMenuIndex(0) }}
              onKeyDown={(e) => {
                if (filteredCommands.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSlashMenuIndex(i => (i + 1) % filteredCommands.length); return }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSlashMenuIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length); return }
                  if (e.key === 'Tab') { e.preventDefault(); selectCommand(filteredCommands[slashMenuIndex]); return }
                }
                if (e.key === 'Enter') sendPing()
                if (e.key === 'Escape') { setActive(false); setInstruction(''); setPreviewRange(null) }
              }}
              onBlur={(e) => {
                const bubbleEl = e.currentTarget.closest('.ping-bubble')
                if (bubbleEl?.contains(e.relatedTarget as Node)) return
                setBubble(null); setActive(false); setPreviewRange(null)
              }}
              disabled={sending}
            />
            {instruction && (
              <button className="ping-send-btn" onClick={sendPing} disabled={sending} title="Send ping (Enter)">
                {sending ? '…' : '→'}
              </button>
            )}
          </div>
        )
      ) : (
        <span className="ping-bubble-hint">Tab or hover</span>
      )}
    </div>
  )
}
