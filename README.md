# 🏓 Pingpong

<img src="assets/logo.svg" width="60" alt="Pingpong Logo"/>

Collaborative real-time editor for human + AI. Highlight text, leave an instruction — Claude picks it up automatically and writes back live.

**Ping:** you select text and send an instruction.  
**Pong:** Claude's revision appears in your editor, tracked and ready to accept or reject.

## What it is

A focused co-writing tool, not a wiki or note app. Open a document, write together with Claude, see every change live.

- Claude's cursor appears in your editor with a name label
- Select text → add instruction → Claude rewrites it automatically (`ping`)
- Changes appear as tracked diffs — accept or reject per change (`pong`)
- Comment sidebar for general back-and-forth

## Stack

| Layer | Technology |
|-------|-----------|
| Editor | [TipTap 3](https://tiptap.dev) + Yjs |
| Collab backend | [Hocuspocus](https://github.com/ueberdosis/hocuspocus) + SQLite |
| Frontend | Next.js 15 + Tailwind CSS |
| AI bridge | Node.js + Anthropic SDK |
| Deployment | Docker Compose |

## Getting Started

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

docker compose up -d
```

Open `http://localhost:3001` in your browser.

## Development

```bash
# Run services individually
cd server && npm install && npm run dev
cd frontend && npm install && npm run dev
cd bridge && npm install && npm run dev
```

## How a ping works

```
User selects text + writes instruction
        ↓
POST /ping { docId, selection, instruction, context }
        ↓
Claude API processes the task
        ↓
DirectConnection writes result into Yjs document
        ↓
User sees change live — tracked, accept / reject
```

## Project Structure

```
├── server/      Hocuspocus WebSocket server (Yjs CRDT + SQLite)
├── frontend/    Next.js app (TipTap editor, UI)
├── bridge/      AI bridge — handles /ping, calls Claude, writes pong back
├── assets/      Logo, icons
├── docs/        Feature specs, architecture notes
└── data/        SQLite database (gitignored)
```

## Features

See [docs/features.md](docs/features.md) for the full feature list and status.

## License

MIT
