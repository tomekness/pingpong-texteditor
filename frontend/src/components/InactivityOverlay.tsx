'use client'

interface InactivityOverlayProps {
  onRestore: () => void
  onFresh: () => void
  restoring?: boolean
  restoreError?: boolean
}

export default function InactivityOverlay({ onRestore, onFresh, restoring, restoreError }: InactivityOverlayProps) {
  return (
    <div className="overlay-backdrop">
      <div className="overlay-card overlay-card--sm">
        <h2 className="overlay-title overlay-title--sm">Session expired</h2>
        <p className="overlay-body">
          You were inactive for over an hour. Your document has been removed from the server.
        </p>
        {restoreError && (
          <p className="overlay-body" style={{ color: '#E74C3C', marginTop: 0 }}>
            Restore failed — check your connection and try again.
          </p>
        )}
        <div className="overlay-actions">
          <button className="btn-overlay-ghost" onClick={onFresh} disabled={restoring}>Start fresh</button>
          <button className="overlay-start-btn" onClick={onRestore} disabled={restoring}>
            {restoring ? 'Restoring…' : 'Restore session →'}
          </button>
        </div>
      </div>
    </div>
  )
}
