'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useEffect, useRef, useState } from 'react'
import DocumentHeader from './DocumentHeader'
import PingBubble from './PingBubble'
import InlineChat from './InlineChat'

const HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:1234'

interface EditorProps {
  docId: string
}

export default function Editor({ docId }: EditorProps) {
  const ydoc = useRef<Y.Doc>(new Y.Doc())
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const [connected, setConnected] = useState(false)
  const [pings, setPings] = useState<Record<string, any>>({})

  useEffect(() => {
    const provider = new HocuspocusProvider({
      url: HOCUSPOCUS_URL,
      name: docId,
      document: ydoc.current,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    })
    providerRef.current = provider

    // Listen for ping updates from Claude
    const pingMap = ydoc.current.getMap('pings')
    const updatePings = () => setPings(Object.fromEntries(pingMap.entries()))
    pingMap.observe(updatePings)

    return () => {
      pingMap.unobserve(updatePings)
      provider.destroy()
    }
  }, [docId])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc.current }),
      CollaborationCursor.configure({
        provider: providerRef.current!,
        user: { name: 'Du', color: '#1A1A1A' },
      }),
      Placeholder.configure({ placeholder: 'Schreib etwas…' }),
      Typography,
    ],
    editorProps: {
      attributes: { class: 'editor-content' },
    },
  })

  // Active inline chats (pings that have messages)
  const activeChats = Object.entries(pings).filter(
    ([, ping]) => ping.status === 'pending' || ping.status === 'done'
  )

  return (
    <div className="editor-wrapper">
      <DocumentHeader docId={docId} connected={connected} pings={pings} />
      <div className="editor-area">
        <PingBubble editor={editor} docId={docId} ydoc={ydoc.current} />
        <EditorContent editor={editor} />
        {activeChats.map(([pingId, ping]) => (
          <InlineChat
            key={pingId}
            pingId={pingId}
            ping={ping}
            docId={docId}
            ydoc={ydoc.current}
          />
        ))}
      </div>
    </div>
  )
}
