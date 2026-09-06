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
          <div className="demo-step">
            <div className="demo-step-label">Select text and ping</div>
            <div className="demo-doc">
              <span>The meeting lasted </span>
              <mark className="demo-mark">forever and nobody left happy</mark>
              <span>.</span>
              <div className="demo-ping-tip">→ &ldquo;Make it punchy&rdquo;</div>
            </div>
          </div>
          <div className="demo-net">🏓</div>
          <div className="demo-step">
            <div className="demo-step-label">Opponent revises inline</div>
            <div className="demo-doc">
              <span>The meeting lasted </span>
              <span className="tracked-del">forever and nobody left happy</span>
              <span> </span>
              <span className="tracked-add">way too long</span>
              <span>.</span>
              <span className="hunk-actions" style={{ userSelect: 'none' }}>
                <button className="hunk-btn hunk-accept" tabIndex={-1}>✓</button>
                <button className="hunk-btn hunk-reject" tabIndex={-1}>✗</button>
              </span>
            </div>
          </div>
        </div>

        <p className="overlay-note">
          No account needed. Share the URL — anyone with the link can edit. Content is removed after 1 hour of inactivity.
        </p>

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
