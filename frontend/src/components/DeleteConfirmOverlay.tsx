'use client'

interface DeleteConfirmOverlayProps {
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteConfirmOverlay({ onCancel, onConfirm }: DeleteConfirmOverlayProps) {
  return (
    <div className="overlay-backdrop" onClick={onCancel}>
      <div className="overlay-card overlay-card--sm" onClick={e => e.stopPropagation()}>
        <h2 className="overlay-title overlay-title--sm">Delete this document?</h2>
        <p className="overlay-body">
          All content will be permanently removed. This cannot be undone.
        </p>
        <div className="overlay-actions overlay-actions--col">
          <button className="btn-overlay-danger" onClick={onConfirm}>Delete document</button>
          <button className="btn-overlay-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
