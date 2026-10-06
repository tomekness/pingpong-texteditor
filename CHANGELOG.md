# Changelog

All notable changes to this project will be documented here.

---

## [1.0.0] — 2026-10-06

First stable release.

### Features
- **AI Ping flow** — select text, type an instruction, get a live revision with tracked changes (accept / reject per hunk or all at once)
- **Follow-up pings** — send a second instruction after a pong without losing context
- **Live collaboration** — share the URL, multiple users edit the same document in real time via Yjs + Hocuspocus
- **Ephemeral documents** — no login, no account; each URL is a private unguessable document ID; content auto-deletes after 1 hour of inactivity
- **Restore flow** — if inactivity expiry fires, a local snapshot lets you restore the session on next visit
- **Export** — download as Markdown, plain text, Word (.docx), or PDF
- **Formatting toolbar** — bold, italic, strikethrough, inline code, H1/H2, blockquote, bullet and numbered lists
- **Mobile toolbar** — less-common options collapse behind a ··· overflow button on narrow screens
- **Markdown syntax reveal** — M↓ toggle shows raw Markdown markers around the cursor position
- **Word & character count** — appears bottom-right on text selection
- **Keyboard shortcuts** — Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
- **Admin dashboard** — `/admin` shows aggregate usage stats (docs, pings); password-protected, no document IDs exposed
- **Rate limiting** — protects the API from bulk requests without affecting normal use
- **Security** — no doc enumeration endpoint, CORS restricted, body size cap, SQL injection / XSS hardened

### Stack
- Frontend: Next.js 15 + TipTap + Yjs
- Collab backend: Hocuspocus + SQLite
- AI bridge: Node.js, OpenAI-compatible API
- Deployment: Docker Compose
