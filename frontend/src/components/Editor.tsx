'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import PingBubble from './PingBubble'
import InlineChat from './InlineChat'
import Toolbar from './Toolbar'
import WelcomeOverlay from './WelcomeOverlay'
import DeleteConfirmOverlay from './DeleteConfirmOverlay'
import InactivityOverlay from './InactivityOverlay'
import { InlineChatExtension, updateInlineChatDecorations, PingHighlightExtension, updatePingHighlights } from '@/lib/inlineChatPlugin'
import { TrackedDelete, TrackedInsert, TrackedChangesHunkButtons } from '@/lib/trackedChanges'

const HOCUSPOCUS_URL =
  typeof window !== 'undefined'
    ? `ws://${window.location.host}/ws`
    : 'ws://localhost/ws'

const INACTIVITY_MS = 3 * 60 * 1000 // 3 min (set to 60 * 60 * 1000 for production)

export default function Editor({ docId }: { docId: string }) {
  const [connected, setConnected] = useState(false)
  const [pings, setPings] = useState<Record<string, any>>({})
  const [title, setTitle] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('offline')
  const [copied, setCopied] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem(`welcomed-${docId}`)
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showInactivity, setShowInactivity] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const snapshotRef = useRef<ArrayBuffer | null>(null)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inactivityFiredRef = useRef(false)

  const ydoc = useMemo(() => new Y.Doc(), [])
  const provider = useMemo(() => new HocuspocusProvider({
    url: HOCUSPOCUS_URL,
    name: docId,
    document: ydoc,
    token: 'anonymous',
    onConnect: () => { setConnected(true); setSaveStatus('saved') },
    onDisconnect: () => { setConnected(false); setSaveStatus('offline') },
  }), [docId, ydoc])

  // Inactivity timer — deletes doc from server after 1 hour of no user interaction
  useEffect(() => {
    const fire = async () => {
      if (inactivityFiredRef.current) return
      inactivityFiredRef.current = true
      const arr = Y.encodeStateAsUpdate(ydoc)
      snapshotRef.current = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
      try {
        await fetch(`/api/docs/${encodeURIComponent(docId)}`, { method: 'DELETE' })
      } catch {}
      setShowInactivity(true)
    }

    const reset = () => {
      if (inactivityFiredRef.current) return
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = setTimeout(fire, INACTIVITY_MS)
    }

    const events = ['keydown', 'mousemove', 'click', 'wheel', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(inactivityTimerRef.current)
    }
  }, [docId, ydoc])

  // Sync title from/to Yjs meta map
  useEffect(() => {
    const metaMap = ydoc.getMap('meta')
    const update = () => {
      const t = metaMap.get('title') as string | undefined
      setTitle(t && t.length > 0 ? t : null)
    }
    update()
    metaMap.observe(update)
    return () => metaMap.unobserve(update)
  }, [ydoc])

  // Save status flicker on document updates
  useEffect(() => {
    if (!connected) return
    const update = () => {
      setSaveStatus('saving')
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveStatus('saved'), 800)
    }
    ydoc.on('update', update)
    return () => {
      ydoc.off('update', update)
      clearTimeout(saveTimerRef.current)
    }
  }, [ydoc, connected])

  useEffect(() => {
    const pingMap = ydoc.getMap('pings')
    const update = () => setPings(Object.fromEntries(pingMap.entries()))
    pingMap.observe(update)
    return () => {
      pingMap.unobserve(update)
      provider.destroy()
    }
  }, [ydoc, provider])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: 'You', color: '#1A1A1A' },
      }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Typography,
      TrackedDelete,
      TrackedInsert,
      TrackedChangesHunkButtons.configure({ ydoc }),
      InlineChatExtension,
      PingHighlightExtension,
    ],
    editorProps: {
      attributes: { class: 'editor-content' },
    },
  })

  const activeChats = Object.entries(pings).filter(
    ([, ping]) => ping.status !== 'accepted' && ping.status !== 'rejected'
  )

  useEffect(() => {
    if (!editor) return
    const activeIds = new Set(activeChats.map(([id]) => id))
    for (const id of mountsRef.current.keys()) {
      if (!activeIds.has(id)) mountsRef.current.delete(id)
    }
    for (const [pingId] of activeChats) {
      if (!mountsRef.current.has(pingId)) {
        mountsRef.current.set(pingId, document.createElement('div'))
      }
    }
    const mounts = activeChats.map(([pingId, ping]) => ({
      pingId,
      pos: ping.to ?? 0,
      el: mountsRef.current.get(pingId)!,
    }))
    updateInlineChatDecorations(editor.view, mounts)
  }, [editor, pings])

  useEffect(() => {
    if (!editor) return
    const ranges = activeChats
      .filter(([, p]) => p.from != null && p.to != null)
      .map(([pingId, p]) => ({ pingId, from: p.from, to: p.to }))
    updatePingHighlights(editor.view, ranges)
  }, [editor, pings])

  const openPings = Object.values(pings).filter((p) => p.status === 'pending').length

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setTitle(v)
    ydoc.getMap('meta').set('title', v)
  }, [ydoc])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [])

  const dismissWelcome = useCallback(() => {
    sessionStorage.setItem(`welcomed-${docId}`, '1')
    setShowWelcome(false)
  }, [docId])

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await fetch(`/api/docs/${encodeURIComponent(docId)}`, { method: 'DELETE' })
    } catch {}
    window.location.href = '/'
  }, [docId])

  const handleRestore = useCallback(async () => {
    if (snapshotRef.current) {
      try {
        await fetch(`/api/docs/${encodeURIComponent(docId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: snapshotRef.current,
        })
      } catch {}
    }
    window.location.reload()
  }, [docId])

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved'  ? 'Saved'   : 'Offline'

  return (
    <>
      <div className="topbar">
        <div className="topbar-logo">
          <img src="/logo.svg" alt="Pingpong" width={28} height={28} fetchPriority="low" />
        </div>
        <div className="topbar-meta">
          <span className={`agent-status ${connected ? 'live' : 'idle'}`}>
            {connected ? '● Opponent live' : '○ Opponent offline'}
          </span>
          {openPings > 0 && (
            <span className="open-pings">{openPings} open {openPings === 1 ? 'ping' : 'pings'}</span>
          )}
        </div>
        <div className="topbar-actions">
          <span className={`save-indicator save-indicator--${saveStatus}`}>{saveLabel}</span>
          <button
            className="topbar-icon-btn"
            onClick={copyLink}
            title={copied ? 'Copied!' : 'Copy link'}
            aria-label="Copy link"
          >
            {copied ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
          <button
            className="topbar-icon-btn topbar-icon-btn--delete"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete document"
            aria-label="Delete document"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="editor-wrapper">
        <input
          className="doc-title-input"
          value={title ?? ''}
          onChange={handleTitleChange}
          placeholder="Document title"
          spellCheck={false}
        />
        <div className="editor-area">
          <PingBubble editor={editor} docId={docId} ydoc={ydoc} />
          <EditorContent editor={editor} />
        </div>
      </div>

      <Toolbar editor={editor} />

      {activeChats.map(([pingId, ping]) => {
        const el = mountsRef.current.get(pingId)
        if (!el) return null
        return createPortal(
          <InlineChat key={pingId} pingId={pingId} ping={ping} docId={docId} ydoc={ydoc} />,
          el
        )
      })}

      {showWelcome && <WelcomeOverlay onStart={dismissWelcome} />}
      {showDeleteConfirm && (
        <DeleteConfirmOverlay
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      {showInactivity && (
        <InactivityOverlay
          onRestore={handleRestore}
          onFresh={() => { window.location.href = '/' }}
        />
      )}
    </>
  )
}
