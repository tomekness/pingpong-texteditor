import Editor from '@/components/Editor'

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Editor docId={id} />
}
