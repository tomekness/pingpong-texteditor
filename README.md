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
git clone https://github.com/tomekness/pingpong
cd pingpong

cp .env.example .env
# Fill in your values:
#   LLM_API_KEY=...
#   LLM_BASE_URL=http://your-host:3000/openai
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

## LLM compatibility

The bridge sends a standard OpenAI chat completions request:

```
POST {LLM_BASE_URL}/chat/completions
Authorization: Bearer {LLM_API_KEY}
```

Any provider that speaks this format works. Set `LLM_BASE_URL` to the base path (without `/chat/completions`):

| Provider | `LLM_BASE_URL` | Notes |
|----------|---------------|-------|
| [OpenAI](https://platform.openai.com) | `https://api.openai.com/v1` | GPT-4o, GPT-4o-mini, etc. |
| [OpenWebUI](https://openwebui.com) | `http://your-host:3000/openai` | Self-hosted frontend for Ollama / any backend |
| [Ollama](https://ollama.com) | `http://localhost:11434/v1` | Local models (Llama, Mistral, Qwen, …) |
| [LM Studio](https://lmstudio.ai) | `http://localhost:1234/v1` | Local models with GUI |
| [Groq](https://console.groq.com) | `https://api.groq.com/openai/v1` | Fast inference, Llama / Mixtral |
| [HuggingFace](https://huggingface.co/inference-api) | `https://api-inference.huggingface.co/v1` | Serverless inference for supported models |
| [GWDG](https://www.gwdg.de/ki-services) | see your GWDG dashboard | Academic HPC / AI services (DE) |
| [vLLM](https://docs.vllm.ai) | `http://your-host:8000/v1` | Self-hosted, production-grade |

For providers that don't require authentication, set `LLM_API_KEY=none` (the bridge always sends a Bearer token — some local servers accept any value).

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | — | Bearer token for your LLM API |
| `LLM_BASE_URL` | — | OpenAI-compatible base URL (see table above) |
| `LLM_MODEL` | `gpt-4o-mini` | Model name passed to the API |

## License

MIT
