'use client'

interface WelcomeOverlayProps {
  onStart: () => void
}

export default function WelcomeOverlay({ onStart }: WelcomeOverlayProps) {
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
          <div className="demo-row demo-row--ping">
            <span className="demo-side">You</span>
            <div className="demo-bubble demo-bubble--user">
              <span>The meeting lasted </span>
              <mark className="demo-mark">forever and nobody left happy</mark>
              <span>.</span>
              <span className="demo-instruction">→ &ldquo;Make it punchy&rdquo;</span>
            </div>
          </div>
          <div className="demo-net">🏓</div>
          <div className="demo-row demo-row--pong">
            <span className="demo-side">Opponent</span>
            <div className="demo-bubble demo-bubble--opponent">
              <span>The meeting lasted </span>
              <span className="tracked-del">forever and nobody left happy</span>
              <span> </span>
              <span className="tracked-add">way too long</span>
              <span>.</span>
              <div className="demo-btns">
                <button className="demo-accept" tabIndex={-1}>✓ Accept</button>
                <button className="demo-reject" tabIndex={-1}>✗ Reject</button>
              </div>
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
          <button className="overlay-start-btn" onClick={onStart}>
            Start writing →
          </button>
        </div>
      </div>
    </div>
  )
}
