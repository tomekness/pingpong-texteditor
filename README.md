# 🏓 Pingpong

<img src="assets/logo.svg" width="60" alt="Pingpong Logo"/>

Collaborative real-time editor for human + AI. Highlight text, leave an instruction — the AI picks it up automatically and writes back live.

**Ping:** select text, type an instruction.  
**Pong:** the revision appears in your editor immediately.

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

Open `http://localhost:4750`.

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
Bridge writes revision into Y.XmlFragment via Hocuspocus
        ↓
All connected clients see the change live
```

## Project structure

```
├── server/      Hocuspocus WebSocket server (Yjs CRDT + SQLite persistence)
├── bridge/      AI bridge — receives pings, calls LLM, applies revision
├── frontend/    Next.js app (TipTap editor + ping bubble + inline chat)
├── assets/      Logo, icons
├── docs/        Feature specs
└── .env         API keys (gitignored)
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENWEBUI_API_KEY` | — | Bearer token for LLM API |
| `OPENWEBUI_BASE_URL` | `http://tmkpi4:3000/openai` | OpenAI-compatible base URL |
| `LLM_MODEL` | `qwen3-30b-a3b-instruct-2507` | Model name |
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | `ws://localhost:1234` | WebSocket URL (browser-side) |

## License

MIT
