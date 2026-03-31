# ELRI Dashboard Redesign — Design

**Date:** 2026-03-31
**Status:** Approved
**Parent:** Subsidiary Legislation Agent Design (2026-03-31)

---

## 1. Goal

Redesign the ELRI (Eswatini Legal Research Interface) dashboard to be search-centric, AI-aware, and trust-forward — with a clean UX that scales as more specialist agents are added, and a visual design that reinforces Eswatini's legal identity.

---

## 2. Files

| File | Change |
|---|---|
| `frontend/app/dashboard/research/page.tsx` | Redesign layout: single column, search-first |
| `frontend/components/chat/ChatInterface.tsx` | Add superscript citations, source highlight, confidence reveal |
| `frontend/components/search/FilterPanel.tsx` | Replace sidebar with filter chips + popover |
| `frontend/components/chat/AgentThinkingPanel.tsx` | Collapse to icon, expandable drawer, unified progress bar |
| `frontend/components/ui/progress-bar.tsx` | New: unified pipeline progress bar |
| `frontend/components/ui/citation-panel.tsx` | New: floating citation side panel |
| `frontend/app/dashboard/layout.tsx` | Add persona toggle (Basic/Advanced) |
| `frontend/tailwind.config.ts` | Add purple as tertiary semantic color |

---

## 3. Layout — Search-First Single Column

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Logo | "Research" breadcrumb | [Basic ▾] | [?]   │
├─────────────────────────────────────────────────────────────┤
│  SEARCH BAR: [🔍 Ask about Eswatini law...]               │
│  Hint: "Try: 'from 2010, employment acts only'"           │
│                                                             │
│  FILTER CHIPS: [× Acts] [× 2010+] [+ Add filter]         │
│  DOMAIN: [All ▾]                                           │
├─────────────────────────────────────────────────────────────┤
│  PROGRESS BAR: ○ Routing ● Retrieving ○ Analyzing ○ Synth │
│  [████████░░░░░░░░░] 45%                                  │
│                                                             │
│  AGENT CARDS (expandable):                                 │
│  ┌─ Statute Agent         ✓ 2.3s  [−] ─────────────────┐  │
│  │  └─ Retrieved 8 chunks (top: 0.87)                  │  │
│  │  └─ Analyzing provisions...                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌─ Constitutional Agent   Running  [−] ───────────────┐  │
│  │  └─ Retrieved 3 chunks                               │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ANSWER:                                                    │
│  Under Eswatini law, section 35(1) of the Employment Act  │
│  allows an employer to terminate on notice[1]...           │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│  SOURCES:                                                   │
│  [1] Employment Act, 1980, s 35(1) — "An employer may..." │
│  [2] Constitution of Eswatini, 2005, s 21                  │
│                                                             │
│  [HIGH CONFIDENCE badge — slides in on completion]         │
└─────────────────────────────────────────────────────────────┘
```

### Key Changes from Current
- FilterPanel sidebar → filter chips + domain dropdown in search area
- AgentThinkingPanel → collapsed to floating icon (bottom-right), expands as slide-over drawer
- 3-column → single column; citation side panel opens on superscript click

---

## 4. Search Bar & Natural Language Filters

**Behavior:**
- User types natural language query
- AI parses structured filters (doc type, year range, ministry, status) from query text
- Detected filters appear as **dismissible chips** below the input
- "+ Add filter" opens a floating popover with full filter options (doc type checkboxes, year range slider, ministry/status selects)
- Domain dropdown sets a session-level default (All, Constitutional Law, Employment & Labour, Immigration, Commercial, Custom)
- Hint text ("Try: 'from 2010, employment acts only'") disappears once user has 3+ chars

**Filter chip interactions:**
- Click × to dismiss individual chip
- Chips update in real-time as AI re-parses query on submit
- Active filters affect which specialist agents are biased in routing

**Mobile:** Search bar stacks vertically, filter chips wrap, "+ Add filter" opens a bottom sheet.

---

## 5. Unified Progress Bar

Four pipeline stages:
1. `Routing` — Router agent analyzes query, decides specialists
2. `Retrieving` — HybridRetriever fetches chunks (all active specialists run in parallel)
3. `Analyzing` — Specialist agents process their chunks
4. `Synthesizing` — Synthesis agent produces final answer

**Visual states per stage:**
- `○` dim = not started
- `●` pulsing primary color = in progress
- `●` solid + green checkmark = completed
- Red × = failed

**Progress percentage:** Based on number of completed stages + partial progress within current stage.

---

## 6. Expandable Agent Cards

Each specialist agent (Statute, Constitutional, Case Law, Comparison, Subsidiary, Synthesis) is represented by a card in the agent panel.

**Collapsed state (default after completion):**
```
┌─ Statute Agent                         ✓ 2.3s  [+] ─────┐
└──────────────────────────────────────────────────────────┘
```
Shows: agent name, total latency, status icon

**Expanded state:**
```
┌─ Statute Agent                         ✓ 2.3s  [−] ─────┐
│  └─ Retrieved 8 chunks (top score: 0.87)                │
│  └─ Analyzing provisions...                               │
│  └─ Formatting response                                  │
└──────────────────────────────────────────────────────────┘
```
Shows: sub-steps with real-time status, chunk count, top score

**During execution:** Cards auto-expand to show sub-step progress. When synthesis starts, specialist cards collapse.

**Click target:** Entire card header is clickable to toggle expand/collapse.

---

## 7. Citation Display

### Inline Superscripts
- Answer text contains superscript markers: `[1]` `[2]` etc.
- Superscripts are styled in primary color, smaller font, slightly elevated
- Single click → opens citation side panel

### Citation Side Panel (Slide-over Drawer)
- Opens from right edge on superscript click
- Shows full citation: act name, year, section number, full excerpt, reranker score
- "Highlight in answer" toggle: when enabled, hovering the citation card highlights the corresponding passage in answer text
- Panel can be pinned open while scrolling through answer

### Sources Section (Below Answer)
- Always-visible section below the answer divider
- Lists all citations in order: `[1] Act Name, Year, s Section — "Excerpt..."`
- Styled as blockquotes with left border accent

### Source Highlight on Hover (Micro-interaction, Priority 1)
- Hovering superscript `[n]` in the answer text:
  - Corresponding passage in the answer gets a subtle `bg-accent-gold-light` background highlight
  - Corresponding card in Sources section pulses once with a soft gold glow

---

## 8. Confidence Reveal (Micro-interaction, Priority 2)

When synthesis completes, the confidence badge animates into view:

- **HIGH:** Green badge (`bg-green-100 text-green-800`) slides in from right, pulses once
- **MEDIUM:** Amber badge (`bg-amber-100 text-amber-800`) slides in from right
- **LOW:** Red badge (`bg-red-100 text-red-800`) slides in with a gentle horizontal shake (3 oscillations, 200ms total) to signal "verify this"

Badge appears below the answer, above the Sources section, with a 300ms delay after the last token to avoid jarring interruption.

---

## 9. Streaming Text (Micro-interaction, Priority 3)

- Tokens appear **word-by-word** with a blinking vertical cursor at the insertion point
- Cursor: thin vertical bar, primary color, 500ms blink interval
- Each word fades in with a 30ms opacity transition
- Superscripts appear only after streaming completes (not during)
- Confidence badge appears 300ms after streaming finishes

---

## 10. Persona Toggle (Basic / Advanced)

Toggle in the header, right side:

| Feature | Basic | Advanced |
|---|---|---|
| Citations | Inline superscripts | Superscripts + full metadata on hover |
| Agent trace | Hidden (icon only) | Expandable drawer |
| Filter chips | Simplified | Full "+ Add filter" popover |
| Answer style | Plain language summaries | Legal terminology + caveats |
| Progress bar | 4-stage dots only | Full bar with percentage |
| Sub-steps | Hidden | Shown in agent cards |

**Silent adaptation (D):**
- If query contains legal jargon ("habeas corpus", "prima facie", case citations) → suggest switching to Advanced (toast notification)
- If user dismisses 3+ times → stop suggesting, remember in localStorage

---

## 11. Domain Presets (Light C)

Session-level dropdown above search bar:

| Domain | Effect |
|---|---|
| All | Default, no prefilters |
| Constitutional Law | doc_type: constitution |
| Employment & Labour | doc_type: act, filters to Employment Act |
| Immigration & Stateless Persons | doc_type: statutory_instrument, SI 45 of 2000 |
| Commercial & Corporate | doc_type: act, filters to Companies Act |
| Custom | Opens + Add filter |

Domain selection prefills filter chips and biases the router toward relevant specialists.

---

## 12. Visual Design System

**Existing palette preserved:**
- Primary: `#1B3A6B` (navy)
- Gold accent: `#C9A227`
- Sidebar: `#0F1D35`

**New: Purple tertiary** (AI / semantic moments):
- Purple: `#7C1A1A` is already in palette as `accent.crimson`
- Add: `purple.600` (`#7C1A1A`) for SUBSIDIARY agent routing badge, SI document chips
- Add: `purple.100` (`#FAEAEA`) for AI-related highlights

**Typography:**
- Sans: Inter (already)
- Serif: Georgia (already)
- No font changes

**Confidence badge colors:**
- HIGH: `bg-green-100 text-green-800` + soft pulse animation
- MEDIUM: `bg-amber-100 text-amber-800`
- LOW: `bg-red-100 text-red-800` + horizontal shake

**Animations:**
- Fade-in for streaming tokens (30ms opacity)
- Slide-in from right for confidence badge (200ms ease-out)
- Pulse/glow for source highlight (primary + gold, 200ms)
- Shake for LOW confidence badge (3 oscillations, 200ms)

---

## 13. Component Inventory

| Component | States |
|---|---|
| `FilterChip` | default, hover, active, removable |
| `ProgressBar` | routing, retrieving, analyzing, synthesizing, complete |
| `AgentCard` | collapsed, expanded, running, completed, failed |
| `CitationSuperscript` | idle, hover (highlight), active (panel open) |
| `CitationPanel` | closed, open, pinned |
| `SourceCard` | default, highlighted (on hover) |
| `ConfidenceBadge` | HIGH (pulse), MEDIUM, LOW (shake) |
| `StreamingCursor` | blinking (during stream), hidden (after) |
| `PersonaToggle` | Basic, Advanced, auto-suggested |

---

## 14. Out of Scope

- Full role-based views (Lawyer/Student/Researcher)
- Persistent user history / session memory
- Mobile-native app (responsive web is sufficient)
- Citation normalization (Step 3 of parent refactoring plan)
- Multi-file agent graph split (Step 2 of parent plan)
