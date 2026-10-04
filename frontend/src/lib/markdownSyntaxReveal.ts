import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import type { Node as PMNode, MarkType } from '@tiptap/pm/model'

const pluginKey = new PluginKey<DecorationSet>('markdownSyntaxReveal')

function mkSpan(text: string): HTMLSpanElement {
  const el = document.createElement('span')
  el.className = 'md-syntax'
  el.textContent = text
  return el
}

function markRangeInBlock(
  doc: PMNode,
  cursor: number,
  markType: MarkType,
  blockStart: number,
  blockEnd: number
): { from: number; to: number } | null {
  let runFrom = -1
  let runTo = -1
  let result: { from: number; to: number } | null = null

  doc.nodesBetween(blockStart, blockEnd, (node, pos) => {
    if (result) return false
    if (!node.isText) return true

    const hasMark = node.marks.some(m => m.type === markType)
    if (hasMark) {
      if (runFrom === -1) runFrom = pos
      runTo = pos + node.nodeSize
    } else if (runFrom !== -1) {
      if (cursor >= runFrom && cursor <= runTo) {
        result = { from: runFrom, to: runTo }
      }
      runFrom = -1
      runTo = -1
    }
    return true
  })

  if (!result && runFrom !== -1 && cursor >= runFrom && cursor <= runTo) {
    result = { from: runFrom, to: runTo }
  }

  return result
}

function buildDecorations(state: EditorState): DecorationSet {
  const { $head } = state.selection
  const { schema } = state
  const decos: Decoration[] = []

  const parent = $head.parent
  const blockStart = $head.start()
  const blockEnd = $head.end()
  const cursor = $head.pos

  if (parent.type.name === 'heading') {
    const hashes = '#'.repeat(parent.attrs.level || 1) + ' '
    decos.push(Decoration.widget(blockStart, mkSpan(hashes), { side: -1 }))
  }

  if ($head.depth >= 2 && $head.node($head.depth - 1)?.type.name === 'blockquote') {
    decos.push(Decoration.widget(blockStart, mkSpan('> '), { side: -1 }))
  }

  const inlineMarks: Array<{ name: string; open: string; close: string }> = [
    { name: 'bold',   open: '**', close: '**' },
    { name: 'italic', open: '*',  close: '*'  },
    { name: 'code',   open: '`',  close: '`'  },
    { name: 'strike', open: '~~', close: '~~' },
  ]

  for (const { name, open, close } of inlineMarks) {
    const markType = schema.marks[name]
    if (!markType) continue
    const range = markRangeInBlock(state.doc, cursor, markType, blockStart, blockEnd)
    if (!range) continue
    decos.push(Decoration.widget(range.from, mkSpan(open),  { side: -1 }))
    decos.push(Decoration.widget(range.to,   mkSpan(close), { side: 1  }))
  }

  return DecorationSet.create(state.doc, decos)
}

export const MarkdownSyntaxReveal = Extension.create({
  name: 'markdownSyntaxReveal',

  addStorage() {
    return { enabled: false }
  },

  addCommands() {
    return {
      setMarkdownMode:
        (enabled: boolean) =>
        ({ tr, dispatch }: any) => {
          this.storage.enabled = enabled
          if (dispatch) dispatch(tr.setMeta(pluginKey, enabled))
          return true
        },
    } as any
  },

  addProseMirrorPlugins() {
    const ext = this
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(_tr, _old, _prev, newState) {
            if (!ext.storage.enabled) return DecorationSet.empty
            return buildDecorations(newState)
          },
        },
        props: {
          decorations(state) { return this.getState(state) },
        },
      }),
    ]
  },
})
