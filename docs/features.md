# Feature List

Status: `[ ]` planned · `[~]` in progress · `[x]` done

---

## MVP — Phase 1

### F1 · Live Co-Editing ✓ specced
- [ ] Two participants only: user + Claude (multi-user → nice to have later)
- [ ] User cursor: black
- [ ] Claude cursor: blue, label "Claude"
- [ ] Editor background: #F5F0E8 (warm paper), text: #1A1A1A
- [ ] Yjs CRDT handles sync (via Hocuspocus)

### F2 · Text Selection → Ping → Auto Claude Call ✓ specced
- [ ] User selects text
- [ ] Small 🏓 icon appears at top-right corner of selection
- [ ] Right-click on selection also triggers the bubble
- [ ] Bubble (popover) appears near selection — instruction input inside
- [ ] User types instruction, hits Enter → ping fires automatically
- [ ] Claude receives: selected text + instruction + surrounding paragraph context
- [ ] Claude writes revision back live via DirectConnection (no extra step)
- [ ] Bubble closes, tracked change appears in place of selection

### F3 · Tracked Changes + Inline Chat ✓ specced
**Tracked Changes**
- [ ] Claude's edits highlighted — muted tones on warm paper background
  - Added text: soft sage green underline (#8BAF8B or similar, not bright)
  - Removed text: soft muted red strikethrough (#C47B7B or similar)
- [ ] Accept / Reject per ping (one click takes or reverts the whole ping's changes)
- [ ] "Accept all" as secondary option

**Inline Chat Box (per ping)**
- [ ] After a ping, a chat box appears below the affected text section
- [ ] Slightly indented to the right (visual connection to the section above)
- [ ] Dark background (#1A1A1A or #111), light text — contrasts with warm paper
- [ ] Used for: Claude asking clarifying questions, user pushing back, iterating
- [ ] Each ping has its own chat thread
- [ ] Stays visible until ping is accepted or rejected

### F4 · Comment Sidebar
→ **removed from MVP** — inline chat per ping covers this use case
→ nice-to-have for later (global document-level notes)

### F4b · Formatting Toolbar ✓ specced
- [ ] Minimal, hidden by default — no visible toolbar cluttering the UI
- [ ] Small `¶` icon appears on hover at left margin of current line
- [ ] Hover over icon expands formatting options inline:
  - Bold, Italic, Strikethrough
  - H1, H2, H3
  - Bullet list, Numbered list
  - Inline code, Blockquote
- [ ] Styling matches warm paper theme — muted, not distracting

### F5 · Markdown Support ✓ specced
- [ ] WYSIWYG editing (TipTap)
- [ ] Markdown shortcuts work while typing:
  - `**text**` → bold, `_text_` → italic, `~~text~~` → strikethrough
  - `# ` → H1, `## ` → H2, `### ` → H3
  - `- ` or `* ` → bullet list, `1. ` → numbered list
  - `` ` `` → inline code, ```` ``` ```` → code block
- [ ] Export as `.md` file

### F6 · Document Management ✓ specced
**Document Header (top of editor, like Notion/HedgeDoc)**
- [ ] Editable title at the very top of the document
- [ ] Status bar below title, subtle — shows at a glance:
  - 🟢 / ⚫ Claude live / idle
  - Pending pings count (e.g. "2 open pings")
  - Last saved timestamp
  - Word count
- [ ] Status bar styled to match warm paper theme — small, unobtrusive

**Document List (home screen)**
- [ ] List of all documents, newest first
- [ ] Each entry shows: title, last edited, open ping count
- [ ] Create new document
- [ ] Open existing document
- [ ] Delete document (with confirmation)

---

## Phase 2 — After MVP

### F7 · Task Queue
- [ ] Multiple open tasks visible in sidebar
- [ ] Status per task: pending / in progress / done
- [ ] Claude works through queue sequentially

### F8 · Context Window Indicator
- [ ] Token counter showing how much of the document Claude currently "sees"
- [ ] Warning when document approaches context limit

### F9 · Revision History
- [ ] Timeline of all document versions
- [ ] Jump back to any point in time
- [ ] Indicator: "Claude edited here"

### F10 · Slash Commands
- [ ] `/improve` — improve selected text
- [ ] `/shorten` — shorten selected text
- [ ] `/translate en` — translate to English
- [ ] `/translate de` — translate to German
- [ ] `/explain` — Claude explains selection in sidebar
- [ ] `/tone formal` / `/tone casual` — adjust tone

### F11 · Document Chat
- [ ] Chat panel alongside editor
- [ ] Discuss the document with Claude without direct edits
- [ ] Claude can suggest changes from chat → appear as tracked changes

### F12 · Export Options
- [ ] Export as Markdown (`.md`)
- [ ] Export as plain text (`.txt`)
- [ ] Export as HTML
- [ ] Option: include / exclude comments in export

---

## Later / Nice to Have

- [ ] Auth / user accounts
- [ ] Shareable links (read-only or editable)
- [ ] Multiple Claude models selectable per task (Sonnet / Opus)
- [ ] Custom system prompt per document ("always respond in formal German")
- [ ] Keyboard shortcut cheat sheet
