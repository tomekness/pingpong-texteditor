# Pingpong — Plan & Status

Live-Editor für Mensch + AI. Text markieren, Auftrag geben (**ping**) — AI schreibt Revision live zurück (**pong**).

**Deployment:** Docker Compose, Port 4750  
**LLM:** Any OpenAI-compatible API (set via `OPENWEBUI_BASE_URL` in `.env`)

---

## Feature-Status

### Phase 1 — MVP (done)

| Feature | Status | Notizen |
|---------|--------|---------|
| F1 Live Co-Editing | ✅ | Hocuspocus + Yjs, WebSocket, Cursor-Farben (User schwarz, AI blau) |
| F2 Ping-Bubble | ✅ | Text selektieren → Bubble erscheint → Instruction → Enter |
| F2 LLM-Verarbeitung | ✅ | Bridge ruft Open WebUI `/openai/chat/completions` auf |
| F2 Live-Texteinspielung | ✅ | Bridge schreibt direkt in Y.XmlFragment |
| F3 InlineChat (Basis) | ✅ | Zeigt Ping-Instruction + Status, Accept/Reject-Buttons |
| F6 Dokument-Liste | ✅ | Startseite mit Dokumenten-Übersicht, + Neues Dokument |
| F6 SQLite-Persistenz | ✅ | Hocuspocus SQLite Extension |

### Offen / Nächste Schritte

| Feature | Priorität | Notizen |
|---------|-----------|---------|
| F3 Tracked Changes (farbig) | hoch | Claudes Änderungen grün/rot hervorheben, noch nicht implementiert |
| F4 Kommentar-Sidebar | mittel | Für übergreifende Anmerkungen |
| F5 Markdown-Toolbar | mittel | Aktuell nur plain text, TipTap Extensions vorhanden |
| F7 Aufgaben-Queue | niedrig | Mehrere Pings parallel verwalten |
| F10 Slash Commands | niedrig | `/improve`, `/shorten`, `/translate` |
| F11 Dokument-Chat | niedrig | Globaler Chat neben dem Editor |

---

## Architektur

```
Browser
  └─ TipTap Editor (Next.js)
       └─ HocuspocusProvider → WebSocket ──────────────┐
                                                        ▼
                                             Hocuspocus Server :1234
                                             onLoadDocument: pings.observe()
                                                        │
                                         status='pending' erkannt
                                                        │
                                                        ▼
                                              Bridge :3002 /ping
                                                        │
                                        ┌───────────────┘
                                        │  1. LLM API aufrufen
                                        │  2. Revision in Y.XmlFragment schreiben
                                        │  3. Ping-Status → 'answered'
                                        └───────────────┐
                                                        ▼
                                        Hocuspocus propagiert an alle Clients
```

---

## Bekannte Eigenheiten / Lösungen

| Problem | Lösung |
|---------|--------|
| `Server is not a constructor` | Hocuspocus exportiert `Hocuspocus` als Klasse, nicht `Server` |
| Observer-Loop | Observer in `onLoadDocument` (einmalig), nicht in `onChange` |
| Ping re-triggert sich | Bridge setzt Status auf `'answered'`, nicht zurück auf `'pending'` |
| `null` provider in CollaborationCursor | Provider via `useMemo` vor `useEditor` erstellen |
| Open WebUI 400-Fehler | Endpoint ist `/openai/chat/completions`, nicht `/api/v1/chat/completions` |
| Text-Suche in XmlFragment | `constructor.name === 'YXmlText'` + `.toArray()` Traversal (kein `instanceof`) |

---

## Nice-to-have (Phase 2)

- F8 Token-Kontext-Anzeige
- F9 Revisionshistorie (Zeitstrahl)
- F12 Export (md / txt / html)
- Auth (API-Key, wenn außerhalb lokales Netz)
- Streaming-Antwort (Buchstabe für Buchstabe erscheint, wie Tippen)
