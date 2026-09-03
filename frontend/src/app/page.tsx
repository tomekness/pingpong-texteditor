import Link from 'next/link'

// Placeholder doc list — will be fetched from server later
const DEMO_DOCS = [
  { id: 'welcome', title: 'Welcome to Pingpong', updated: 'just now' },
]

export default function Home() {
  return (
    <main className="home">
      <div className="home-header">
        <img src="/logo.svg" alt="Pingpong" width={36} height={36} />
        <h1>Pingpong</h1>
      </div>
      <div className="doc-list">
        {DEMO_DOCS.map((doc) => (
          <Link key={doc.id} href={`/doc/${doc.id}`} className="doc-item">
            <span className="doc-title">{doc.title}</span>
            <span className="doc-meta">{doc.updated}</span>
          </Link>
        ))}
        <Link href="/doc/new" className="doc-item doc-new">
          + Neues Dokument
        </Link>
      </div>
    </main>
  )
}
