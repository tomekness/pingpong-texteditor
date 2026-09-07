'use client'

interface WelcomeOverlayProps {
  onStart: () => void
  onNew?: () => void
}

export default function WelcomeOverlay({ onStart, onNew }: WelcomeOverlayProps) {
  return (
    <div className="overlay-backdrop" onClick={onStart}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <div className="overlay-header">
          <img src="/logo.svg" alt="Pingpong" width={36} height={36} />
          <div>
            <h1 className="overlay-title">Pingpong</h1>
            <p className="overlay-sub">Write. Challenge. Revise.</p>
            <p className="overlay-sub2">Collaborative text editing with your LLM opponent</p>
          </div>
        </div>

        <div className="overlay-demo">
          <div className="demo-frame">
            <div className="demo-frame-bar">
              <span className="demo-frame-live">● Opponent live</span>
              <span className="demo-frame-saved">Saved</span>
            </div>
            <div className="demo-frame-body">
              <div className="demo-frame-title">Meeting Notes</div>
              <div className="demo-frame-text">
                <span>The meeting lasted </span>
                <span className="tracked-del">forever and nobody left happy</span>
                {' '}
                <span className="tracked-add">way too long</span>
                <span>. </span>
                <span className="demo-ping-inline">→ Ping: &ldquo;Make it punchy&rdquo;</span>
              </div>
              <div className="demo-frame-chat">
                <div className="demo-fc-row">
                  <span className="demo-fc-label">Ping</span>
                  <span className="demo-fc-text">Make it punchy</span>
                </div>
                <div className="demo-fc-btns">
                  <button className="btn-accept" tabIndex={-1}>✓ Accept all</button>
                  <button className="btn-reject" tabIndex={-1}>✗ Reject all</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="overlay-note">
          <p>No account needed. Share the URL — anyone with the link can edit.</p>
          <p className="overlay-note-warn">Content is automatically deleted after 1 hour of inactivity.</p>
        </div>

        <div className="overlay-footer">
          <div className="overlay-links">
            <a className="overlay-link" href="https://github.com/tomekness/pingpong" target="_blank" rel="noreferrer">GitHub ↗</a>
            <a className="overlay-link" href="https://experiments.tomekness.de" target="_blank" rel="noreferrer">experiments.tomekness.de ↗</a>
          </div>
          <div className="overlay-footer-btns">
            {onNew && (
              <button className="btn-overlay-ghost" onClick={onNew}>
                + New document
              </button>
            )}
            <button className="overlay-start-btn" onClick={onStart}>
              {onNew ? 'Continue →' : 'Start writing →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
