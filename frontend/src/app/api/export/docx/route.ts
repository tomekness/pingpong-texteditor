import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Paragraph, TextRun, HeadingLevel, Packer,
  AlignmentType, LevelFormat, BorderStyle,
} from 'docx'

export async function POST(req: NextRequest) {
  const { json, title } = await req.json()
  const children = tiptapToDocx(json, title)
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullet',
          levels: [{
            level: 0, format: LevelFormat.BULLET,
            text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
        {
          reference: 'ordered',
          levels: [{
            level: 0, format: LevelFormat.DECIMAL,
            text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    sections: [{ children }],
  })
  const buffer = await Packer.toBuffer(doc)
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment',
    },
  })
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
]

function tiptapToDocx(node: any, title?: string): Paragraph[] {
  const out: Paragraph[] = []
  if (title) {
    out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }))
  }
  return out.concat(nodeToParas(node))
}

function nodeToParas(node: any): Paragraph[] {
  if (!node) return []
  switch (node.type) {
    case 'doc':
      return (node.content || []).flatMap((n: any) => nodeToParas(n))
    case 'paragraph':
      return [new Paragraph({ children: inlineRuns(node.content) })]
    case 'heading': {
      const level = HEADING_LEVELS[(node.attrs?.level ?? 1) - 1] ?? HeadingLevel.HEADING_1
      return [new Paragraph({ heading: level, children: inlineRuns(node.content) })]
    }
    case 'bulletList':
      return (node.content || []).flatMap((item: any) => listItemPara(item, 'bullet'))
    case 'orderedList':
      return (node.content || []).flatMap((item: any) => listItemPara(item, 'ordered'))
    case 'blockquote':
      return (node.content || []).map((n: any) => new Paragraph({
        children: inlineRuns(n.content),
        indent: { left: 720 },
        border: { left: { color: '999999', space: 4, style: BorderStyle.SINGLE, size: 6 } },
      }))
    case 'codeBlock': {
      const text = (node.content || []).map((n: any) => n.text ?? '').join('')
      return [new Paragraph({
        children: [new TextRun({ text, font: 'Courier New', size: 18 })],
      })]
    }
    default:
      return (node.content || []).flatMap((n: any) => nodeToParas(n))
  }
}

function listItemPara(item: any, ref: 'bullet' | 'ordered'): Paragraph[] {
  const firstPara = item.content?.[0]
  return [new Paragraph({
    numbering: { reference: ref, level: 0 },
    children: inlineRuns(firstPara?.content),
  })]
}

function inlineRuns(content: any[]): TextRun[] {
  if (!content?.length) return [new TextRun('')]
  const runs: TextRun[] = []
  for (const node of content) {
    if (node.type !== 'text') continue
    const marks: any[] = node.marks || []
    if (marks.some((m: any) => m.type === 'trackedDelete')) continue
    runs.push(new TextRun({
      text: node.text ?? '',
      bold: marks.some((m: any) => m.type === 'bold'),
      italics: marks.some((m: any) => m.type === 'italic'),
      strike: marks.some((m: any) => m.type === 'strike'),
      font: marks.some((m: any) => m.type === 'code') ? { name: 'Courier New' } : undefined,
    }))
  }
  return runs.length ? runs : [new TextRun('')]
}
