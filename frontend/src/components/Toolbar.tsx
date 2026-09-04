'use client'

import { Editor } from '@tiptap/react'

interface ToolbarProps {
  editor: Editor | null
}

export default function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, label: string) => (
    <button
      className={`toolbar-btn ${active ? 'toolbar-btn--active' : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={label}
    >
      {label}
    </button>
  )

  return (
    <div className="toolbar">
      {btn(editor.isActive('bold'),          () => editor.chain().focus().toggleBold().run(),          'B')}
      {btn(editor.isActive('italic'),        () => editor.chain().focus().toggleItalic().run(),        'I')}
      {btn(editor.isActive('strike'),        () => editor.chain().focus().toggleStrike().run(),        'S̶')}
      {btn(editor.isActive('code'),          () => editor.chain().focus().toggleCode().run(),          '<>')}
      <div className="toolbar-sep" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
      {btn(editor.isActive('bulletList'),    () => editor.chain().focus().toggleBulletList().run(),    '•')}
      {btn(editor.isActive('orderedList'),   () => editor.chain().focus().toggleOrderedList().run(),   '1.')}
      {btn(editor.isActive('blockquote'),    () => editor.chain().focus().toggleBlockquote().run(),    '"')}
      <div className="toolbar-sep" />
      {btn(false, () => editor.chain().focus().undo().run(), '↩')}
      {btn(false, () => editor.chain().focus().redo().run(), '↪')}
    </div>
  )
}
