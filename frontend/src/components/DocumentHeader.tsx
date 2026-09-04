'use client'

interface DocumentHeaderProps {
  docId: string
  connected: boolean
  pings: Record<string, any>
}

export default function DocumentHeader({ docId, connected, pings }: DocumentHeaderProps) {
  const openPings = Object.values(pings).filter((p) => p.status === 'pending').length

  return (
    <div className="doc-header">
      <input
        className="doc-title-input"
        defaultValue={docId === 'new' ? '' : docId}
        placeholder="Document title"
        spellCheck={false}
      />
      <div className="doc-meta-bar">
        <span className={`agent-status ${connected ? 'live' : 'idle'}`}>
          {connected ? '● Claude live' : '○ Claude idle'}
        </span>
        {openPings > 0 && (
          <span className="open-pings">{openPings} open {openPings === 1 ? 'ping' : 'pings'}</span>
        )}
      </div>
    </div>
  )
}
