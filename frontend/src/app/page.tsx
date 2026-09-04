'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Doc {
  id: string
  title: string
  updatedAt: string | null
}

function formatDate(s: string | null) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleString(undefined, {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return s
  }
}

export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/docs')
      if (res.ok) setDocs(await res.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  const newDoc = () => {
    const id = `doc-${Date.now().toString(36)}`
    router.push(`/doc/${id}`)
  }

  const deleteDoc = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/docs/${encodeURIComponent(id)}`, { method: 'DELETE' })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <main className="home">
      <div className="home-header">
        <img src="/logo.svg" alt="Pingpong" width={48} height={48} fetchPriority="low" />
        <div>
          <h1>Pingpong</h1>
          <p className="home-tagline">Collaborative text editing with your LLM</p>
        </div>
      </div>
      <div className="doc-list">
        <button onClick={newDoc} className="doc-new">
          + New document
        </button>
        {loading && (
          <div className="doc-loading">Loading…</div>
        )}
        {!loading && docs.length === 0 && (
          <div className="doc-loading">No documents yet</div>
        )}
        {docs.map((doc) => (
          <div key={doc.id} className="doc-item-row">
            <Link href={`/doc/${doc.id}`} className="doc-item">
              <span className="doc-title">{doc.title}</span>
              <span className="doc-meta">{formatDate(doc.updatedAt)}</span>
            </Link>
            <button
              className="doc-delete-btn"
              onClick={(e) => deleteDoc(e, doc.id)}
              title="Delete document"
              aria-label="Delete document"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}
