# Pingpong — Kollaborativer AI-Editor

Live-Editor für Mensch + Claude. Text markieren, Auftrag geben (**ping**) — Claude schreibt die Revision live zurück (**pong**).

**Ziel:** Kein HedgeDoc-Ersatz, kein Wiki — dedizierter Co-Writing-Space für Textsessions mit Claude.  
**Deployment:** Docker Compose auf X280 (lokales Netzwerk / localhost)

---

## Feature List

### Kern-Features (must have)

**F1 — Live Co-Editing**
Claude und User schreiben gleichzeitig im selben Dokument. Claudes Cursor ist farbig markiert und mit "Claude" beschriftet, genau wie ein zweiter Mensch im Google Doc.

**F2 — Text markieren → Auftrag kommentieren → Claude arbeitet automatisch**
Das zentrale Feature:
- User markiert einen Textbereich
- Klickt "Task" (Button oder Shortcut `Cmd+Shift+K`)
- Tippt Anweisung: "zu steif, lockerer" / "kürzen" / "übersetze auf Englisch"
- Claude bekommt automatisch: markierten Text + Anweisung + Kontext (Absatz davor/danach)
- Claude schreibt Revision direkt ins Dokument — live sichtbar
- Kein extra Schritt, kein Copy-Paste

**F3 — Tracked Changes (Accept / Reject)**
Claudes Änderungen erscheinen farbig hervorgehoben (grün = neu, rot = gelöscht).
User kann jede Änderung einzeln annehmen oder ablehnen — mit einem Klick.

**F4 — Kommentar-Sidebar**
Allgemeine Kommentare neben dem Dokument, beide sehen live. Für übergreifende Anmerkungen die keinen spezifischen Textabschnitt betreffen.

**F5 — Markdown-Support**
Editor versteht und rendert Markdown (Headings, Bold, Listen, Code-Blöcke). Export als `.md`-Datei.

**F6 — Dokument-Verwaltung**
Einfache Liste aller Dokumente. Neues Dokument anlegen, Titel vergeben, öffnen. Kein komplexes Dateisystem — eine SQLite-Datenbank reicht.

---

### Vorgeschlagene Zusatz-Features

**F7 — Aufgaben-Queue**
Wenn mehrere Markierungen + Tasks gleichzeitig offen sind, arbeitet Claude sie der Reihe nach ab. User sieht welche Tasks noch offen / in Bearbeitung / erledigt sind.

**F8 — Kontext-Fenster-Anzeige**
Kleiner Indikator zeigt wie viel Dokument-Kontext Claude aktuell "sieht" (Token-Zähler). Bei langen Docs wichtig um zu wissen ob Claude den Anfang noch kennt.

**F9 — Revisionshistorie**
Zeitstrahl der alle Versionen des Dokuments speichert. User kann zu jedem Zeitpunkt zurückspringen. Ähnlich dem HedgeDoc-Revisions-Feature, aber mit "Claude hat hier editiert"-Markierung.

**F10 — Slash Commands im Editor**
User tippt `/` im Editor → Menü erscheint:
- `/improve` — markierten Text verbessern
- `/shorten` — kürzen
- `/translate en` — übersetzen
- `/explain` — Claude erklärt den markierten Begriff/Abschnitt in der Sidebar
- `/tone formal` — Ton anpassen

**F11 — Dokument-Chat**
Neben dem Editor ein Chat-Fenster. User kann mit Claude über das gesamte Dokument reden ohne direkt reinzuschreiben. Claude kann von dort aus auch Änderungen vorschlagen die dann als Tracked Changes erscheinen.

**F12 — Export-Optionen**
- Markdown (`.md`)
- Plain Text (`.txt`)
- HTML (für Copy in andere Tools)
- Mit oder ohne Kommentare im Export

---

## Technischer Stack

```
Frontend:   Next.js + TipTap 3 + Yjs
            → TipTap: WYSIWYG Markdown-Editor
            → Yjs: Realtime CRDT (Conflict-free sync)

Backend:    Hocuspocus (Yjs WebSocket Server)
            → SQLite Extension (Persistenz, kein Postgres nötig)
            → DirectConnection API (Claude schreibt serverseitig rein)
            → onChange Hook (erkennt neue Claude-Tasks automatisch)

AI-Bridge:  Node.js Service (bridge/)
            → POST /ping empfängt Task + Markierung + Kontext
            → Ruft Claude API (@anthropic-ai/sdk) auf
            → Schreibt Pong (Ergebnis) via DirectConnection zurück

Hosting:    Docker Compose (X280, localhost / lokales Netz)
```

---

## Architektur

```
Browser (User)
  └─ TipTap Editor (React)
       ├─ Yjs Provider → WebSocket ──────────────────┐
       └─ Task-Annotation bei Markierung             │
                                                     ▼
                                          Hocuspocus Server
                                          (Port 1234, SQLite)
                                               │
                              onChange-Hook erkennt neuen Task
                                               │
                                               ▼
                                         AI-Bridge Service
                                         (Port 3002)
                                               │
                              ┌────────────────┘
                              │  1. Liest: markierten Text + Kontext
                              │  2. Ruft Claude API auf
                              │  3. Schreibt Ergebnis via DirectConnection
                              └────────────────┐
                                               │
                                               ▼
                                    Hocuspocus propagiert
                                    Änderung an alle Clients
                                               │
                                               ▼
                                    Browser zeigt Tracked Change
                                    (farbig, accept/reject)
```

---

## Docker Compose Setup

```yaml
services:
  hocuspocus:
    image: node:22-alpine
    working_dir: /app
    volumes: [./server:/app, ./data:/data]
    command: node server.js
    ports: ["1234:1234"]

  frontend:
    build: ./frontend
    ports: ["3001:3001"]
    environment:
      - HOCUSPOCUS_URL=ws://hocuspocus:1234
      - BRIDGE_URL=http://bridge:3002

  bridge:
    build: ./bridge
    ports: ["3002:3002"]
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - HOCUSPOCUS_URL=ws://hocuspocus:1234
```

Zugriff lokal: `http://localhost:3001`  
Im Netz: `http://[X280-IP]:3001`

---

## Phasenplan

| Phase | Was | Aufwand |
|-------|-----|---------|
| 1 | Hocuspocus Server + SQLite + einfaches TipTap-Frontend | 0.5 Tage |
| 2 | Task-Annotation Feature (markieren → kommentieren) | 0.5 Tage |
| 3 | AI-Bridge + Claude API Integration | 0.5 Tage |
| 4 | Tracked Changes (farbige Darstellung, accept/reject) | 1 Tag |
| 5 | Kommentar-Sidebar + Dokument-Liste | 0.5 Tage |
| 6 | Polish, Docker Compose, lokales Deployment | 0.5 Tage |
| **Gesamt** | **MVP mit F1-F6** | **~3-4 Tage** |

Slash Commands (F10) und Dokument-Chat (F11) kommen in Phase 2 nach dem MVP.

---

## Offene Entscheidungen

- [ ] Auth? Nur lokal auf X280 → kein Login nötig. Wenn im Netz: einfacher API-Key reicht.
- [ ] Welche Claude Model? Sonnet 4.6 für Tasks (schnell + günstig), Opus für komplexe Rewrites optional.
- [ ] Tracked Changes: eigene Implementierung oder TipTap Cloud Extension? → Eigene, TipTap Cloud ist paid.
