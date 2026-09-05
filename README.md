# 🏓 Pingpong

<img src="assets/logo.svg" width="60" alt="Pingpong Logo"/>

Collaborative real-time editor for human + AI. Highlight text, leave an instruction — the opponent picks it up and writes back live.

**Ping:** select text, type an instruction.  
**Pong:** the revision appears in your editor with tracked changes — accept or reject inline.

## How it works

Visit the app and you land on a fresh document with a unique, unguessable URL. No account, no login.

- Share the URL — anyone with the link can read and edit
- Select text and hover the 🏓 bubble (or press **Tab**) to send an instruction to the Opponent
- Accept or reject each suggested change inline
- Content is automatically removed after **1 hour of inactivity**
- The delete button (top right) removes it immediately

## Stack

| Layer | Technology |
|-------|-----------|
| Editor | [TipTap](https://tiptap.dev) + Yjs (CRDT) |
| Collab backend | [Hocuspocus](https://github.com/ueberdosis/hocuspocus) + SQLite |
| Frontend | Next.js 15 (standalone) |
| AI bridge | Node.js, OpenAI-compatible API |
| Deployment | Docker Compose, port 4750 |

## Setup

```bash
cp .env.example .env
# Fill in your values:
#   OPENWEBUI_API_KEY=...
#   OPENWEBUI_BASE_URL=http://your-host:3000/openai
#   LLM_MODEL=your-model-name

docker compose up -d
```

Open `http://localhost:4750` — you'll be redirected to a new document automatically.

## How a ping works

```
User selects text + types instruction → Enter
        ↓
Ping written into Yjs shared map (pings)
        ↓
Hocuspocus observer detects status='pending'
        ↓
HTTP POST → bridge /ping
        ↓
Bridge calls LLM (OpenAI-compatible API)
        ↓
Bridge writes revision as tracked changes into Y.XmlFragment
        ↓
All connected clients see the change live — accept or reject inline
```

## Project structure

```
├── server/      Hocuspocus WebSocket server (Yjs CRDT + SQLite persistence)
├── bridge/      AI bridge — receives pings, calls LLM, applies revision
├── frontend/    Next.js app (TipTap editor + ping bubble + inline chat)
├── assets/      Logo, icons
└── .env         API keys (gitignored)
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENWEBUI_API_KEY` | — | Bearer token for LLM API |
| `OPENWEBUI_BASE_URL` | — | OpenAI-compatible base URL, e.g. `http://192.168.x.x:3000/openai` |
| `LLM_MODEL` | `gpt-4o-mini` | Model name passed to the API |

## License

MIT
