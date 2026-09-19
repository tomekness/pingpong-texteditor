'use client'

import { Editor } from '@tiptap/react'
import { useState } from 'react'

interface ToolbarProps {
  editor: Editor | null
}

export default function Toolbar({ editor }: ToolbarProps) {
  const [showMore, setShowMore] = useState(false)

  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, label: string, tooltip: string) => (
    <button
      className={`toolbar-btn ${active ? 'toolbar-btn--active' : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={tooltip}
    >
      {label}
    </button>
  )

  const secondaryButtons = (
    <>
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), '"', 'Blockquote')}
      <div className="toolbar-sep" />
      {btn(false, () => editor.chain().focus().undo().run(), '↩', 'Undo')}
      {btn(false, () => editor.chain().focus().redo().run(), '↪', 'Redo')}
    </>
  )

  return (
    <div className="toolbar">
      {btn(editor.isActive('bold'),          () => editor.chain().focus().toggleBold().run(),          'B',  'Bold')}
      {btn(editor.isActive('italic'),        () => editor.chain().focus().toggleItalic().run(),        'I',  'Italic')}
      {btn(editor.isActive('strike'),        () => editor.chain().focus().toggleStrike().run(),        'S̶',  'Strikethrough')}
      {btn(editor.isActive('code'),          () => editor.chain().focus().toggleCode().run(),          '<>', 'Inline code')}
      <div className="toolbar-sep" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1', 'Heading 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', 'Heading 2')}
      {btn(editor.isActive('bulletList'),    () => editor.chain().focus().toggleBulletList().run(),    '•',  'Bullet list')}
      {btn(editor.isActive('orderedList'),   () => editor.chain().focus().toggleOrderedList().run(),   '1.', 'Numbered list')}

      {/* Desktop: always show secondary buttons inline */}
      <div className="toolbar-secondary toolbar-secondary--inline">
        <div className="toolbar-sep" />
        {secondaryButtons}
      </div>

      {/* Mobile: toggle via ··· button */}
      <div className="toolbar-secondary toolbar-secondary--mobile">
        <button
          className={`toolbar-btn toolbar-more-btn ${showMore ? 'toolbar-btn--active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); setShowMore(v => !v) }}
          title="More"
        >
          ···
        </button>
        {showMore && (
          <div className="toolbar-more-panel">
            {secondaryButtons}
          </div>
        )}
      </div>
    </div>
  )
}
