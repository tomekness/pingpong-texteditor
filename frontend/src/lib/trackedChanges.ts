import { Mark } from '@tiptap/core'
import * as Y from 'yjs'
import { XmlText } from 'yjs'

// ── TipTap mark extensions ────────────────────────────────────────────────────

export const TrackedDelete = Mark.create({
  name: 'trackedDelete',
  renderHTML() { return ['del', { class: 'tracked-del' }, 0] },
  parseHTML() { return [{ tag: 'del.tracked-del' }] },
})

export const TrackedInsert = Mark.create({
  name: 'trackedInsert',
  renderHTML() { return ['ins', { class: 'tracked-add' }, 0] },
  parseHTML() { return [{ tag: 'ins.tracked-add' }] },
})

// ── Accept / Reject helpers ───────────────────────────────────────────────────

type Delta = Array<{ insert: string; attributes?: Record<string, any> }>

function processTextNode(el: any, accept: boolean) {
  const delta = el.toDelta() as Delta
  const ops: Array<{ pos: number; len: number; type: 'delete' | 'clean'; attr: string }> = []
  let pos = 0

  for (const op of delta) {
    const len = (op.insert || '').length
    if (accept) {
      if (op.attributes?.trackedDelete) ops.push({ pos, len, type: 'delete', attr: 'trackedDelete' })
      else if (op.attributes?.trackedInsert) ops.push({ pos, len, type: 'clean', attr: 'trackedInsert' })
    } else {
      if (op.attributes?.trackedInsert) ops.push({ pos, len, type: 'delete', attr: 'trackedInsert' })
      else if (op.attributes?.trackedDelete) ops.push({ pos, len, type: 'clean', attr: 'trackedDelete' })
    }
    pos += len
  }

  // Process in reverse position order so earlier deletions don't shift later indices
  ops.sort((a, b) => b.pos - a.pos)

  for (const op of ops) {
    if (op.type === 'delete') {
      el.delete(op.pos, op.len)
    } else {
      el.format(op.pos, op.len, { [op.attr]: null })
    }
  }
}

function walkAndProcess(el: any, accept: boolean) {
  if (el instanceof XmlText) {
    processTextNode(el, accept)
  } else if (el && typeof el.toArray === 'function') {
    for (const child of el.toArray()) {
      walkAndProcess(child, accept)
    }
  }
}

export function commitRevision(ydoc: Y.Doc) {
  walkAndProcess(ydoc.getXmlFragment('default'), true)
}

export function revertRevision(ydoc: Y.Doc) {
  walkAndProcess(ydoc.getXmlFragment('default'), false)
}
