import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import * as Y from 'yjs'
import { XmlText } from 'yjs'

// ── TipTap mark extensions ────────────────────────────────────────────────────

export const TrackedDelete = Mark.create({
  name: 'trackedDelete',
  addAttributes() {
    return {
      hunkId: {
        default: null,
        parseHTML: el => el.getAttribute('data-hunk') || null,
        renderHTML: attrs => attrs.hunkId ? { 'data-hunk': attrs.hunkId } : {},
      },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes({ class: 'tracked-del' }, HTMLAttributes), 0]
  },
  parseHTML() { return [{ tag: 'del.tracked-del' }] },
})

export const TrackedInsert = Mark.create({
  name: 'trackedInsert',
  addAttributes() {
    return {
      hunkId: {
        default: null,
        parseHTML: el => el.getAttribute('data-hunk') || null,
        renderHTML: attrs => attrs.hunkId ? { 'data-hunk': attrs.hunkId } : {},
      },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes({ class: 'tracked-add' }, HTMLAttributes), 0]
  },
  parseHTML() { return [{ tag: 'ins.tracked-add' }] },
})

// ── Hunk-level button widgets ─────────────────────────────────────────────────

const hunkButtonsKey = new PluginKey<DecorationSet>('trackedHunkButtons')

export const TrackedChangesHunkButtons = Extension.create<{ ydoc: Y.Doc | null }>({
  name: 'trackedChangesHunkButtons',

  addOptions() {
    return { ydoc: null }
  },

  addProseMirrorPlugins() {
    const getYdoc = () => this.options.ydoc
    const widgetCache = new Map<string, HTMLElement>()

    return [
      new Plugin({
        key: hunkButtonsKey,
        props: {
          decorations(state) {
            const { doc, schema } = state
            const delType = schema.marks.trackedDelete
            const insType = schema.marks.trackedInsert
            if (!delType && !insType) return DecorationSet.empty

            const hunks = new Map<string, { to: number }>()

            doc.descendants((node, pos) => {
              if (!node.isText) return
              const mark =
                (delType && node.marks.find(m => m.type === delType)) ||
                (insType && node.marks.find(m => m.type === insType))
              if (!mark) return
              const hunkId = mark.attrs.hunkId as string | null
              if (!hunkId) return
              const end = pos + node.nodeSize
              const cur = hunks.get(hunkId)
              hunks.set(hunkId, { to: cur ? Math.max(cur.to, end) : end })
            })

            // Evict stale cached widgets
            for (const key of widgetCache.keys()) {
              if (!hunks.has(key)) widgetCache.delete(key)
            }

            const decos: Decoration[] = []
            for (const [hunkId, { to }] of hunks) {
              let el = widgetCache.get(hunkId)
              if (!el) {
                el = document.createElement('span')
                el.className = 'hunk-actions'
                el.contentEditable = 'false'

                const accept = document.createElement('button')
                accept.className = 'hunk-btn hunk-accept'
                accept.textContent = '✓'
                accept.title = 'Accept change'
                accept.addEventListener('mousedown', e => {
                  e.preventDefault()
                  e.stopPropagation()
                  const ydoc = getYdoc()
                  if (ydoc) commitHunk(ydoc, hunkId)
                })

                const reject = document.createElement('button')
                reject.className = 'hunk-btn hunk-reject'
                reject.textContent = '✗'
                reject.title = 'Reject change'
                reject.addEventListener('mousedown', e => {
                  e.preventDefault()
                  e.stopPropagation()
                  const ydoc = getYdoc()
                  if (ydoc) revertHunk(ydoc, hunkId)
                })

                el.appendChild(accept)
                el.appendChild(reject)
                widgetCache.set(hunkId, el)
              }
              decos.push(Decoration.widget(to, el, { key: hunkId, side: 1 }))
            }

            return DecorationSet.create(doc, decos)
          },
        },
      }),
    ]
  },
})

// ── Accept / Reject helpers ───────────────────────────────────────────────────

type Delta = Array<{ insert: string; attributes?: Record<string, any> }>

function hunkIdOf(val: any): string | null {
  if (!val) return null
  if (typeof val === 'object') return (val as any).hunkId ?? null
  return null
}

function processTextNode(el: any, accept: boolean, targetHunkId?: string) {
  const delta = el.toDelta() as Delta
  const ops: Array<{ pos: number; len: number; type: 'delete' | 'clean'; attr: string }> = []
  let pos = 0

  for (const op of delta) {
    const len = (op.insert || '').length
    const delAttr = op.attributes?.trackedDelete
    const insAttr = op.attributes?.trackedInsert
    const matchDel = delAttr && (!targetHunkId || hunkIdOf(delAttr) === targetHunkId)
    const matchIns = insAttr && (!targetHunkId || hunkIdOf(insAttr) === targetHunkId)

    if (accept) {
      if (matchDel) ops.push({ pos, len, type: 'delete', attr: 'trackedDelete' })
      else if (matchIns) ops.push({ pos, len, type: 'clean', attr: 'trackedInsert' })
    } else {
      if (matchIns) ops.push({ pos, len, type: 'delete', attr: 'trackedInsert' })
      else if (matchDel) ops.push({ pos, len, type: 'clean', attr: 'trackedDelete' })
    }
    pos += len
  }

  ops.sort((a, b) => b.pos - a.pos)

  for (const op of ops) {
    if (op.type === 'delete') {
      el.delete(op.pos, op.len)
    } else {
      el.format(op.pos, op.len, { [op.attr]: null })
    }
  }
}

function walkAndProcess(el: any, accept: boolean, hunkId?: string) {
  if (el instanceof XmlText) {
    processTextNode(el, accept, hunkId)
  } else if (el && typeof el.toArray === 'function') {
    for (const child of el.toArray()) {
      walkAndProcess(child, accept, hunkId)
    }
  }
}

export function commitRevision(ydoc: Y.Doc) {
  walkAndProcess(ydoc.getXmlFragment('default'), true)
}

export function revertRevision(ydoc: Y.Doc) {
  walkAndProcess(ydoc.getXmlFragment('default'), false)
}

export function commitHunk(ydoc: Y.Doc, hunkId: string) {
  walkAndProcess(ydoc.getXmlFragment('default'), true, hunkId)
}

export function revertHunk(ydoc: Y.Doc, hunkId: string) {
  walkAndProcess(ydoc.getXmlFragment('default'), false, hunkId)
}
