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
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    : 'ws://localhost/ws'

const INACTIVITY_MS = 60 * 60 * 1000

const GUEST_ADJECTIVES = ['Swift', 'Quiet', 'Bold', 'Bright', 'Sharp', 'Calm', 'Quick', 'Keen']
const GUEST_NOUNS = ['Panda', 'Fox', 'Owl', 'Wolf', 'Lynx', 'Bear', 'Hawk', 'Deer']
const GUEST_COLORS = ['#3B6FD4', '#E74C3C', '#27AE60', '#8E44AD', '#E67E22', '#16A085', '#C0392B', '#2980B9']

function getSessionUser() {
  const key = 'pingpong_guest'
  try {
    const stored = sessionStorage.getItem(key)
    if (stored) return JSON.parse(stored)
    const name = `${GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)]} ${GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)]}`
    const color = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)]
    const user = { name, color }
    sessionStorage.setItem(key, JSON.stringify(user))
    return user
  } catch {
    return { name: 'Guest', color: '#3B6FD4' }
  }
}

export default function Editor({ docId }: { docId: string }) {
  const [connected, setConnected] = useState(false)
  const [pings, setPings] = useState<Record<string, any>>({})
  const [title, setTitle] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('offline')
  const [copied, setCopied] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showNewConfirm, setShowNewConfirm] = useState(false)
  const [showInactivity, setShowInactivity] = useState(false)

  const [timerMsg, setTimerMsg] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const timerMsgRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const activeChatsRef = useRef<Array<[string, any]>>([])
  const snapshotRef = useRef<ArrayBuffer | null>(null)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inactivityFiredRef = useRef(false)
  const resetTimerRef = useRef<(() => void) | null>(null)
  const [showSave, setShowSave] = useState(false)
  const [showCopyLink, setShowCopyLink] = useState(false)
  const [previewRange, setPreviewRange] = useState<{ from: number; to: number } | null>(null)

  const ydoc = useMemo(() => new Y.Doc(), [])
  const provider = useMemo(() => new HocuspocusProvider({
    url: HOCUSPOCUS_URL,
    name: docId,
    document: ydoc,
    token: 'anonymous',
    onConnect: () => { setConnected(true); setSaveStatus('saved') },
    onDisconnect: () => { setConnected(false); setSaveStatus('offline') },
  }), [docId, ydoc])

  useEffect(() => {
    if (!sessionStorage.getItem(`welcomed-${docId}`)) setShowWelcome(true)
  }, [docId])

  // Inactivity timer — deletes doc from server after 1 hour of no user interaction
  useEffect(() => {
    const fire = async () => {
      if (inactivityFiredRef.current) return
      inactivityFiredRef.current = true
      const arr = Y.encodeStateAsUpdate(ydoc)
      snapshotRef.current = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
      provider.disconnect()
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

    resetTimerRef.current = reset

    const events = ['keydown', 'mousemove', 'click', 'wheel', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(inactivityTimerRef.current)
    }
  }, [docId, ydoc, provider])

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && showWelcome) {
        sessionStorage.setItem(`welcomed-${docId}`, '1')
        setShowWelcome(false)
        return
      }
      if (e.key !== 'Escape') return
      if (showDeleteConfirm) { setShowDeleteConfirm(false); return }
      if (showNewConfirm) { setShowNewConfirm(false); return }
      if (showWelcome) { setShowWelcome(false); return }
      if (showSave) { setShowSave(false); return }
      if (showCopyLink) { setShowCopyLink(false); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showDeleteConfirm, showNewConfirm, showWelcome, showSave, showCopyLink, docId])

  useEffect(() => {
    const pingMap = ydoc.getMap('pings')
    const update = () => setPings(Object.fromEntries(pingMap.entries()))
    pingMap.observe(update)
    return () => {
      pingMap.unobserve(update)
      provider.destroy()
    }
  }, [ydoc, provider])

  useEffect(() => {
    const handleStateless = ({ payload }: { payload: string }) => {
      try {
        const msg = JSON.parse(payload)
        if (msg.type === 'document-deleted') window.location.href = '/'
      } catch {}
    }
    provider.on('stateless', handleStateless)
    return () => { provider.off('stateless', handleStateless) }
  }, [provider])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: getSessionUser(),
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
  activeChatsRef.current = activeChats

  const refreshDecorations = useCallback((view: any) => {
    const chats = activeChatsRef.current
    const mounts = chats
      .map(([pingId, ping]) => ({ pingId, pos: ping.to ?? 0, el: mountsRef.current.get(pingId) }))
      .filter((m): m is { pingId: string; pos: number; el: HTMLDivElement } => !!m.el)
    updateInlineChatDecorations(view, mounts)
  }, [])

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
    refreshDecorations(editor.view)
  }, [editor, pings, refreshDecorations])

  useEffect(() => {
    if (!editor) return
    const handleUpdate = ({ editor: e }: any) => refreshDecorations(e.view)
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor, refreshDecorations])

  useEffect(() => {
    if (!editor) return
    const ranges = activeChats
      .filter(([, p]) => p.from != null && p.to != null)
      .map(([pingId, p]) => ({ pingId, from: p.from, to: p.to }))
    if (previewRange) {
      ranges.push({ pingId: 'ping-preview', from: previewRange.from, to: previewRange.to })
    }
    updatePingHighlights(editor.view, ranges)
  }, [editor, pings, previewRange])

  const openPings = Object.values(pings).filter((p) => p.status === 'pending').length

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setTitle(v)
    ydoc.getMap('meta').set('title', v)
  }, [ydoc])

  const showTimerReset = useCallback(() => {
    setTimerMsg(true)
    clearTimeout(timerMsgRef.current)
    timerMsgRef.current = setTimeout(() => setTimerMsg(false), 2000)
  }, [])

  const handleTopbarRefresh = useCallback(() => {
    resetTimerRef.current?.()
    showTimerReset()
  }, [showTimerReset])

  const handleRefreshTimer = useCallback(async () => {
    inactivityFiredRef.current = false
    setShowInactivity(false)
    showTimerReset()
    const arr = Y.encodeStateAsUpdate(ydoc)
    const buf = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
    try {
      await fetch(`/api/docs/${encodeURIComponent(docId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buf,
      })
    } catch {}
    resetTimerRef.current?.()
  }, [docId, ydoc, showTimerReset])

  const handleDownload = useCallback(async (format: 'txt' | 'md' | 'docx' | 'pdf') => {
    if (!editor) return
    setShowSave(false)
    const name = (title || 'document').replace(/[^a-z0-9äöüÄÖÜß]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'document'

    if (format === 'txt') {
      const text = editor.getText({ blockSeparator: '\n\n' })
      triggerDownload(new Blob([text], { type: 'text/plain' }), `${name}.txt`)
    } else if (format === 'md') {
      const md = jsonToMd(editor.getJSON())
      triggerDownload(new Blob([md], { type: 'text/markdown' }), `${name}.md`)
    } else if (format === 'docx') {
      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: editor.getJSON(), title }),
      })
      const blob = await res.blob()
      triggerDownload(blob, `${name}.docx`)
    } else if (format === 'pdf') {
      window.print()
    }
  }, [editor, title])

  const copyLink = useCallback(() => {
    setShowCopyLink(true)
  }, [])

  const handleCopyLinkBtn = useCallback(() => {
    const url = window.location.href
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {
        setCopied(false)
      })
    } else {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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

  const saveLabel = timerMsg ? 'Timer reset ✓' :
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved'  ? 'Saved'   : 'Offline'

  const saveStatusClass = timerMsg ? 'saved' : saveStatus

  return (
    <>
      <div className="topbar">
        <button className="topbar-logo-btn" onClick={() => setShowWelcome(true)} title="About Pingpong">
          <img src="/logo.svg" alt="Pingpong" width={28} height={28} fetchPriority="low" />
        </button>
        <button className="topbar-new-btn" onClick={() => setShowNewConfirm(true)} title="New document">
          + New
        </button>
        <div className="topbar-meta">
          <span className={`agent-status ${connected ? 'live' : 'idle'}`}>
            {connected ? '● Opponent live' : '○ Opponent offline'}
          </span>
          {openPings > 0 && (
            <span className="open-pings">{openPings} open {openPings === 1 ? 'ping' : 'pings'}</span>
          )}
        </div>
        <div className="topbar-actions">
          <span className={`save-indicator save-indicator--${saveStatusClass}`}>{saveLabel}</span>
          <button
            className="topbar-icon-btn"
            onClick={handleTopbarRefresh}
            title="Reset inactivity timer"
            aria-label="Reset inactivity timer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            className="topbar-icon-btn"
            onClick={() => setShowSave(true)}
            title="Save document"
            aria-label="Save document"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            className="topbar-icon-btn"
            onClick={copyLink}
            title="Copy link"
            aria-label="Copy link"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
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
          <PingBubble editor={editor} docId={docId} ydoc={ydoc} setPreviewRange={setPreviewRange} />
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

      {showWelcome && (
        <WelcomeOverlay
          onStart={dismissWelcome}
          onNew={() => { setShowWelcome(false); setShowNewConfirm(true) }}
        />
      )}
      {showDeleteConfirm && (
        <DeleteConfirmOverlay
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      {showNewConfirm && (
        <div className="overlay-backdrop" onClick={() => setShowNewConfirm(false)}>
          <div className="overlay-card overlay-card--sm" onClick={e => e.stopPropagation()}>
            <h2 className="overlay-title overlay-title--sm">New document</h2>
            <p className="overlay-body">Your current document remains open until it expires after 1 hour of inactivity.</p>
            <div className="overlay-actions overlay-actions--col">
              <button className="overlay-start-btn" onClick={() => { setShowNewConfirm(false); window.open('/', '_blank') }}>Open in new tab →</button>
              <button className="overlay-start-btn overlay-start-btn--secondary" onClick={() => { setShowNewConfirm(false); window.location.href = '/' }}>Replace current document</button>
              <button className="btn-overlay-ghost" onClick={() => setShowNewConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showInactivity && (
        <InactivityOverlay
          onRestore={handleRestore}
          onFresh={() => { window.location.href = '/' }}
        />
      )}
      {showSave && (
        <div className="overlay-backdrop" onClick={() => setShowSave(false)}>
          <div className="overlay-card overlay-card--sm" onClick={e => e.stopPropagation()}>
            <h2 className="overlay-title overlay-title--sm">Save document</h2>
            <p className="overlay-body">Choose a format to download your document.</p>
            <div className="overlay-actions overlay-actions--col">
              <button className="overlay-start-btn" onClick={() => handleDownload('md')}>Markdown (.md)</button>
              <button className="overlay-start-btn overlay-start-btn--secondary" onClick={() => handleDownload('txt')}>Plain text (.txt)</button>
              <button className="overlay-start-btn overlay-start-btn--secondary" onClick={() => handleDownload('docx')}>Word document (.docx)</button>
              <button className="overlay-start-btn overlay-start-btn--secondary" onClick={() => handleDownload('pdf')}>PDF</button>
              <button className="btn-overlay-ghost" onClick={() => setShowSave(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showCopyLink && (
        <div className="overlay-backdrop" onClick={() => setShowCopyLink(false)}>
          <div className="overlay-card overlay-card--sm" onClick={e => e.stopPropagation()}>
            <h2 className="overlay-title overlay-title--sm">Share this document</h2>
            <p className="overlay-sub2" style={{ marginBottom: 16 }}>
              Anyone with this link can open and edit the document. No login required.
            </p>
            <div className="copy-link-row">
              <input
                className="copy-link-input"
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? window.location.href : ''}
                onFocus={e => e.target.select()}
              />
              <button
                className="overlay-start-btn copy-link-btn"
                onClick={handleCopyLinkBtn}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button className="btn-overlay-ghost" style={{ marginTop: 16, width: '100%' }} onClick={() => setShowCopyLink(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Export helpers ────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function jsonToMd(node: any, listPrefix = ''): string {
  if (!node) return ''
  switch (node.type) {
    case 'doc':
      return (node.content || []).map((n: any) => jsonToMd(n)).filter(Boolean).join('\n\n').trim()
    case 'paragraph':
      if (!node.content?.length) return ''
      return (node.content || []).map((n: any) => jsonToMd(n)).join('')
    case 'heading': {
      const level = node.attrs?.level || 1
      const text = (node.content || []).map((n: any) => jsonToMd(n)).join('')
      return '#'.repeat(level) + ' ' + text
    }
    case 'bulletList':
      return (node.content || []).map((n: any) => '- ' + listItemText(n)).join('\n')
    case 'orderedList':
      return (node.content || []).map((n: any, i: number) => `${i + 1}. ` + listItemText(n)).join('\n')
    case 'listItem':
      return (node.content || []).map((n: any) => jsonToMd(n)).join('\n')
    case 'codeBlock': {
      const lang = node.attrs?.language || ''
      const text = (node.content || []).map((n: any) => n.text || '').join('')
      return '```' + lang + '\n' + text + '\n```'
    }
    case 'blockquote':
      return (node.content || []).map((n: any) => '> ' + jsonToMd(n)).join('\n')
    case 'hardBreak':
      return '  \n'
    case 'text': {
      const marks: any[] = node.marks || []
      if (marks.some((m: any) => m.type === 'trackedDelete')) return ''
      let t: string = node.text || ''
      for (const m of marks) {
        if (m.type === 'bold') t = `**${t}**`
        else if (m.type === 'italic') t = `*${t}*`
        else if (m.type === 'code') t = `\`${t}\``
        else if (m.type === 'strike') t = `~~${t}~~`
      }
      return t
    }
    default:
      return (node.content || []).map((n: any) => jsonToMd(n)).join('')
  }
}

function listItemText(node: any): string {
  return (node.content || []).map((n: any) => jsonToMd(n)).join('').trim()
}
