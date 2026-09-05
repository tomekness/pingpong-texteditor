'use client'

interface InactivityOverlayProps {
  onRestore: () => void
  onFresh: () => void
}

export default function InactivityOverlay({ onRestore, onFresh }: InactivityOverlayProps) {
  return (
    <div className="overlay-backdrop">
      <div className="overlay-card overlay-card--sm">
        <h2 className="overlay-title overlay-title--sm">Session expired</h2>
        <p className="overlay-body">
          You were inactive for over an hour. Your document has been removed from the server.
        </p>
        <div className="overlay-actions">
          <button className="btn-overlay-ghost" onClick={onFresh}>Start fresh</button>
          <button className="overlay-start-btn" onClick={onRestore}>Restore session →</button>
        </div>
      </div>
    </div>
  )
}
