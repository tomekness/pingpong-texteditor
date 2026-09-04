import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// ── InlineChat widget decorations (black block below paragraph) ───────────────

export const inlineChatPluginKey = new PluginKey<DecorationSet>('inlineChat')

export const InlineChatExtension = Extension.create({
  name: 'inlineChat',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: inlineChatPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(inlineChatPluginKey)
            return meta !== undefined ? meta : set.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) { return inlineChatPluginKey.getState(state) },
        },
      }),
    ]
  },
})

export function updateInlineChatDecorations(
  view: any,
  mounts: Array<{ pingId: string; pos: number; el: HTMLDivElement }>
) {
  const { doc } = view.state
  const decos = mounts.flatMap(({ pingId, pos, el }) => {
    try {
      const safePos = Math.max(0, Math.min(pos, doc.content.size - 1))
      const $pos = doc.resolve(safePos)
      const afterBlock = $pos.after(1)
      return [Decoration.widget(afterBlock, el, { key: pingId, side: 1 })]
    } catch {
      return []
    }
  })
  const set = DecorationSet.create(doc, decos)
  view.dispatch(view.state.tr.setMeta(inlineChatPluginKey, set))
}

// ── Ping highlight (inline range decoration while ping is active) ─────────────

export const pingHighlightKey = new PluginKey<DecorationSet>('pingHighlight')

export const PingHighlightExtension = Extension.create({
  name: 'pingHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pingHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(pingHighlightKey)
            return meta !== undefined ? meta : set.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) { return pingHighlightKey.getState(state) },
        },
      }),
    ]
  },
})

export function updatePingHighlights(
  view: any,
  ranges: Array<{ pingId: string; from: number; to: number }>
) {
  const { doc } = view.state
  const decos = ranges.flatMap(({ pingId, from, to }) => {
    try {
      const f = Math.max(0, Math.min(from, doc.content.size))
      const t = Math.max(f, Math.min(to, doc.content.size))
      if (f >= t) return []
      return [Decoration.inline(f, t, { class: 'ping-highlight', 'data-ping': pingId })]
    } catch {
      return []
    }
  })
  const set = DecorationSet.create(doc, decos)
  view.dispatch(view.state.tr.setMeta(pingHighlightKey, set))
}
