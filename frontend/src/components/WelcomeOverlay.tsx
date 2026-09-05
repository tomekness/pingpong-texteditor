'use client'

interface WelcomeOverlayProps {
  onStart: () => void
}

export default function WelcomeOverlay({ onStart }: WelcomeOverlayProps) {
  return (
    <div className="overlay-backdrop" onClick={onStart}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <img className="overlay-logo" src="/logo.svg" alt="Pingpong" width={40} height={40} />
        <h1 className="overlay-title">Pingpong</h1>
        <p className="overlay-sub">Collaborative text editing with your LLM opponent</p>

        <ol className="overlay-steps">
          <li>Write or paste text in the editor</li>
          <li>Select a passage — a ping bubble appears to the right. Hover or press <kbd>Tab</kbd> to send an instruction to the Opponent</li>
          <li>Review tracked changes inline — accept or reject each suggestion</li>
          <li>Copy the URL to share this document with anyone</li>
        </ol>

        <p className="overlay-note">
          No account needed. Content is automatically removed after 1 hour of inactivity.
        </p>

        <div className="overlay-footer">
          <a
            className="overlay-link"
            href="https://github.com/tomekness/pingpong"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
          <button className="overlay-start-btn" onClick={onStart}>
            Start writing →
          </button>
        </div>
      </div>
    </div>
  )
}
