'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useMemo, useEffect, useState } from 'react'
import DocumentHeader from './DocumentHeader'
import PingBubble from './PingBubble'
import InlineChat from './InlineChat'

const HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:1234'

export default function Editor({ docId }: { docId: string }) {
  const [connected, setConnected] = useState(false)
  const [pings, setPings] = useState<Record<string, any>>({})

  // Create ydoc + provider synchronously so they're ready for useEditor
  const ydoc = useMemo(() => new Y.Doc(), [])
  const provider = useMemo(() => new HocuspocusProvider({
    url: HOCUSPOCUS_URL,
    name: docId,
    document: ydoc,
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
  }), [docId, ydoc])

  // Listen for ping updates
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
        user: { name: 'Du', color: '#1A1A1A' },
      }),
      Placeholder.configure({ placeholder: 'Schreib etwas…' }),
      Typography,
    ],
    editorProps: {
      attributes: { class: 'editor-content' },
    },
  })

  const activeChats = Object.entries(pings).filter(
    ([, ping]) => ping.status === 'pending' || ping.status === 'working' || ping.status === 'error'
  )

  return (
    <div className="editor-wrapper">
      <DocumentHeader docId={docId} connected={connected} pings={pings} />
      <div className="editor-area">
        <PingBubble editor={editor} docId={docId} ydoc={ydoc} />
        <EditorContent editor={editor} />
        {activeChats.map(([pingId, ping]) => (
          <InlineChat key={pingId} pingId={pingId} ping={ping} docId={docId} ydoc={ydoc} />
        ))}
      </div>
    </div>
  )
}
