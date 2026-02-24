# Super Markdown Mobile Reader

A beautiful, offline-first Markdown reader and editor built for iPhone and iPad. Reading-first (70%), editing when you need it (30%).

**[Live Demo →](#)** · Built with [Speyer UI v3.3.0](https://github.com/adrianspeyer/speyer-ui)

---

## What It Does

Import Markdown documents, read them in a clean serif-typeset view, and make quick edits when needed. Everything stays on your device — no accounts, no cloud, no tracking.

- **Library** — All your documents in one place with search, favorites, and recent/all tabs. Remove documents from Recent without deleting them; remove permanently from All or Favorites. Tabs and search hide automatically when the library is empty for a clean first-run experience
- **Reader** — Beautiful rendered Markdown with table of contents, adjustable font size, serif/sans/mono fonts, narrow/wide layout, light/dark themes, word count, and estimated read time
- **Editor** — One tap to switch to a full editor with a visual formatting toolbar — Bold, Italic, Headings, Links, Images, Lists, Quotes, Code, and Horizontal Rules. Auto-closing pairs (`[`, `(`, `*`, `` ` ``) make mobile editing faster. No Markdown knowledge required
- **Section Editing** — Tap the pencil icon next to any heading in the Table of Contents to edit just that section in a bottom sheet. Perfect for quick fixes on long documents without scrolling through the whole file
- **Find** — Search within documents with highlighted matches, match count, next/previous navigation, and wrap-around. Works in reader mode. Cmd/Ctrl+F shortcut
- **Import** — From files (.md, .txt) with drag-and-drop support, paste from clipboard, or fetch from a URL
- **Offline** — Service worker caches the app shell; IndexedDB stores your documents. Works without internet
- **Share** — Dropdown menu with copy to clipboard, save as file, and native Web Share API (iOS)
- **Onboarding Tour** — First-visit product walkthrough powered by [Speyer Tour v3.0.0](https://github.com/adrianspeyer/speyer-tour). Replay any time from the About dropdown

---

## Quick Start

### Option 1: GitHub Pages

1. Fork this repo
2. Enable GitHub Pages (Settings → Pages → Deploy from `main`)
3. Open on your iPhone/iPad and tap "Add to Home Screen"

### Option 2: Local

```bash
# Any static server works
npx serve .
# or
python3 -m http.server 8000
```

Open `localhost:8000` in Safari → Add to Home Screen.

### Option 3: Drop the files anywhere

The core app is a few files. Put them on any static host:

```
index.html          ← The entire app (single file, ~88KB)
sw.js               ← Service worker for offline
netlify.toml        ← Security headers (Netlify only)
manifest.json       ← PWA manifest
src/                ← Speyer Tour (JS + CSS)
icons/              ← App icons (192, 512, apple-touch-icon, favicon)
```

---

## Editor

The editor includes a visual formatting toolbar so you don't need to write Markdown by hand:

| Button | What it does | Shortcut |
|---|---|---|
| **B** | Bold — wraps selection in `**bold**` | Cmd+B |
| *I* | Italic — wraps selection in `*italic*` | Cmd+I |
| H | Heading — inserts `## Heading` on a new line | |
| 🔗 | Link — smart detection: wraps URLs, or inserts `[text](url)` template | |
| 🖼 | Image — inserts `![alt](url)` | |
| • | Bullet list — prefixes lines with `- ` | |
| 1. | Numbered list — prefixes lines with `1. 2. 3.` | |
| ❝ | Blockquote — prefixes lines with `> ` | |
| `</>` | Code — backticks for inline, triple backticks for multi-line | |
| — | Horizontal rule — inserts `---` | |

The toolbar scrolls horizontally on narrow screens. All buttons work with selected text or insert templates at the cursor.

The find button (🔍) is in the reader header bar — it is available in reading mode only.

### Auto-Closing Pairs

Typing any of these characters automatically inserts the closing match and places the cursor between them:

`[` → `[]` · `(` → `()` · `*` → `**` · `` ` `` → ` `` `` ` · `"` → `""` · `_` → `__`

If you select text first, the pair wraps around your selection.

### Section Editing

From the Table of Contents panel, each heading has a pencil icon. Tapping it opens a bottom sheet with just that section's raw Markdown. Edit, save, and you're back to reading — the section is spliced back into the full document automatically. No need to scroll through the whole file.

### Find in Document

The find bar works in reader mode. Matches are highlighted directly in the rendered text with a yellow background — the current match gets a stronger highlight and the document scrolls to it automatically.

Press Enter to advance, Shift+Enter to go back, Escape to close. The find bar shows a live match count ("3 of 12") with automatic wrap-around.

---

## Library Tabs

| Tab | Shows | Sort | Actions |
|---|---|---|---|
| Recent | Documents you've opened (excludes cleared) | Last opened, newest first | ⭐ Favorite, 🕐 Clear from Recent |
| Favorites | Starred documents only | Last opened | ⭐ Unfavorite, 🗑 Remove |
| All | Every document | Alphabetical by title | ⭐ Favorite, 🗑 Remove |

"Clear from Recent" clears the document's last-opened timestamp — it disappears from the Recent tab but remains in All and Favorites. Remove permanently removes the document.

---

## Design System

Built on [Speyer UI (SUI) v3.3.0](https://github.com/adrianspeyer/speyer-ui) — a lightweight, accessible CSS design system. The app uses SUI components throughout:

| SUI Component | Usage |
|---|---|
| `sui-screen` + `sui-screen-header` + `sui-screen-body` + `sui-screen-footer` | Full-viewport app shell with safe area insets, screen switching via `is-active` |
| `sui-prose` | Reader typography — headings, paragraphs, blockquotes, code, tables, images |
| `sui-mark` + `sui-mark-current` | Find-in-document highlighting with dark mode and print suppression |
| `sui-meta` | Document metadata line with CSS dot separators |
| `sui-toolbar` + `sui-toolbar-btn` + `sui-toolbar-sep` | Editor formatting toolbar with horizontal scroll |
| `sui-btn` family | All buttons (primary, ghost, success, danger, sm, full) |
| `sui-nav` + `sui-tab` | Library tabs (Recent, Favorites, All) |
| `sui-input`, `sui-input-group`, `sui-input-label` | Search, paste textarea, URL input |
| `sui-dialog` (native `<dialog>`) | Import modal, remove confirmation, discard confirmation |
| `sui-sheet` + `SUI.sheet` | Reader settings panel, section editing (bottom sheets) |
| `sui-panel` + `SUI.panel` | Table of contents slide-over (v6.0 — replaces custom TOC panel) |
| `sui-dropdown` + `SUI.dropdown` | Share menu (copy/save/share), About SMMR dropdown with tour replay (v6.2) |
| `sui-segmented` + `sui-segment` | Font, width, theme toggles in settings |
| `sui-dropzone` | File import drag-and-drop area |
| `sui-alert` | Remove and discard confirmation warnings |
| `sui-badge` | Edit mode indicator |
| `sui-divider` | Settings and import panel section breaks |
| `sui-empty` | Empty library state |
| `sui-flex`, `sui-flex-nowrap`, `sui-items-center`, `sui-gap-*` | Layout utilities (v6.0) |
| `SUI.toast` | Notifications (success, error, info, warning) |
| `SUI.theme` | Light/dark toggle and persistence |
| `SUI.copy` | Clipboard with fallback |
| All design tokens | Colors, spacing, radius, shadows, typography, z-index, brand tokens |

### Icons

Uses an inline SVG sprite sheet (36 icons, ~5KB) instead of an external icon library. Zero HTTP requests, guaranteed offline, no `createIcons()` re-rendering needed.

Usage in HTML:
```html
<svg class="icon"><use href="#i-pencil"/></svg>
```

Usage in JS (for dynamic content):
```js
function icon(name, cls) {
  return `<svg class="icon ${cls || ''}"><use href="#i-${name}"/></svg>`;
}
```

Size classes: `.icon` (18px), `.icon-sm` (14px), `.icon-lg` (24px), `.icon-xl` (56px).

---

## Architecture

### Storage

- **IndexedDB** for documents (multi-document, unlimited size, structured data)
- **localStorage** for reader settings (font size, width, font family, theme)
- No external database, no sync, no cloud

### Document Schema

```javascript
{
  id: "uuid",
  title: "Extracted from first H1, or first 30 chars of content",
  markdown: "Raw markdown string",
  preview: "First 150 chars of body text",
  sourceType: "file" | "paste" | "url",
  sourceUrl: "https://..." | null,
  favorite: false,
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp",
  lastOpenedAt: "ISO timestamp | null",
  lastScrollY: 0
}
```

Note: `lastOpenedAt` is set to `null` when a document is removed from Recent. Documents with `null` are filtered out of the Recent tab but remain accessible in All.

### Offline Strategy

| Resource | Strategy |
|---|---|
| App shell (index.html) | Network-first, cache fallback |
| CDN assets (SUI, marked, DOMPurify, fonts) | Stale-while-revalidate |
| Documents | IndexedDB (always available) |

### Rendering

- [marked.js](https://marked.js.org/) v15 for Markdown → HTML (GFM, breaks)
- [DOMPurify](https://github.com/cure53/DOMPurify) v3.2.4 for sanitisation (critical for URL-fetched content)
- SUI `sui-prose` for content typography, with CSS custom property overrides for user-adjustable font family and sizing

### Dependencies

| Dependency | CDN | Size | Purpose |
|---|---|---|---|
| Speyer UI tokens | jsdelivr | 4KB | Design tokens |
| Speyer UI components | jsdelivr | ~65KB | Component classes (includes sui-screen, sui-prose, sui-mark, sui-meta, sui-toolbar, sui-panel, sui-dropdown) |
| Speyer UI JS | jsdelivr | ~26KB | Theme, toast, copy, modal, sheet, dropdown, panel, segmented, accordion, tooltip |
| marked.js v15.0.7 | jsdelivr | 38KB | Markdown parsing |
| DOMPurify v3.2.4 | jsdelivr | 18KB | HTML sanitisation |
| Speyer Tour v3.0.0 | local | ~28KB (JS) + ~18KB (CSS) | Onboarding product tour |
| Newsreader font | Google Fonts | ~25KB | Reading typography |

Zero npm dependencies. Zero build tools.

---

## Reader Settings

| Setting | Options | Default | Persisted |
|---|---|---|---|
| Font size | 14–28px (A−/A+) | 18px | localStorage |
| Line width | Narrow (680px) / Wide (900px) | Narrow | localStorage |
| Font family | Serif (Newsreader) / Sans (Inter) / Mono | Serif | localStorage |
| Theme | Light / Dark | Light | localStorage |
| Scroll position | Per document | 0 | IndexedDB |

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| `Cmd/Ctrl + S` | Editor | Save document |
| `Cmd/Ctrl + B` | Editor | Bold |
| `Cmd/Ctrl + I` | Editor | Italic |
| `Cmd/Ctrl + F` | Reader | Open find bar |
| `Enter` | Find bar | Next match |
| `Shift + Enter` | Find bar | Previous match |
| `Escape` | Find bar | Close find bar |
| `Escape` | Editor | Cancel editing (with confirmation) |
| `Escape` | Reader | Close TOC / settings panel |

---

## iOS PWA Notes

This app is specifically designed around iOS PWA limitations:

- **No File System Access API** — Uses file picker (`<input type="file">`) instead
- **No Web Share Target** — Can't receive shares from other apps; uses import modal instead
- **No background sync** — All storage is local, no sync needed
- **Safe area insets** — SUI `sui-screen-header` and `sui-screen-footer` handle `env(safe-area-inset-*)` for notch/home indicator; bottom sheets also respect safe areas
- **44px touch targets** — All interactive elements meet the minimum via `--sui-touch-target`
- **Add to Home Screen** — Manifest + service worker enable standalone PWA mode

---

## File Structure

```
├── index.html              ← Complete app (HTML + CSS + JS, single file)
├── sw.js                   ← Service worker
├── netlify.toml            ← CSP + security headers (v6.2)
├── manifest.json           ← PWA manifest
├── src/
│   ├── speyer-tour.js      ← Onboarding tour (v3.0.0)
│   └── speyer-tour.css     ← Tour styles
├── icons.svg               ← SVG sprite sheet (standalone reference copy)
├── icon-192.png            ← PWA icon
├── icon-512.png            ← PWA icon (maskable)
├── apple-touch-icon.png    ← iOS home screen
└── README.md
```

---

## What's Not Included (Yet)

These are intentionally out of scope but are natural next-version features:

- Library backup/export (JSON dump of IndexedDB)
- Full-text search inside documents
- Syntax highlighting for code blocks
- Drag-to-reorder favorites
- Document folders/tags
- Line height / letter spacing adjustments
- Strikethrough, footnotes (GFM extensions)
- Duplicate document

---

## Accessibility

- WCAG 2.1 AA via Speyer UI's token system and contrast-tested color pairs
- All interactive elements have `aria-label` or visible text
- Native `<dialog>` for modals (browser-managed focus trap, Escape, backdrop)
- `sui-panel` for TOC (focus trap on mobile, focus restoration, Escape to close)
- All confirmations use styled SUI dialogs — no `window.confirm()` calls
- `prefers-reduced-motion` respected (SUI sets all transitions to 0ms)
- `prefers-color-scheme: dark` auto-detection
- Status communicated by icon + text, never color alone (SUI principle)
- Keyboard navigable (Tab, Enter/Space, Escape)

---

## Changelog

### v6.2 — 2026-02-24 — Security Hardening + Onboarding Tour

**Security (critical):**
- Upgraded DOMPurify 3.0.6 → 3.2.4 (patches CVE-2024-45801 and CVE-2024-47875 — mXSS bypasses)
- Upgraded marked 9.1.6 → 15.0.7 (ReDoS hardening; v15 removes heading IDs by default, eliminating DOM clobbering vector)
- Migrated `marked.setOptions()` → `marked.use()` for v15 API compatibility

**Security (high):**
- Added URL validation (`isAllowedUrl()`) — blocks localhost, private IPs, and non-https protocols (SSRF mitigation)
- Escaped `doc.id` in all `data-*` attributes via `escapeHtml()` (4 instances in library rendering)
- Sanitised error messages — no raw `err.message` exposed in toast notifications
- Fixed CDN paths — added missing `dist/` prefix to all SUI URLs; added `defer` on SUI JS

**Security (infrastructure):**
- Rewrote service worker — origin whitelist (`ALLOWED_CACHE_ORIGINS`) prevents caching of arbitrary cross-origin user-fetched URLs
- Added `netlify.toml` with Content-Security-Policy, X-Content-Type-Options (nosniff), X-Frame-Options (DENY), and Referrer-Policy headers
- Added theme flash fix — inline `<script>` in `<head>` applies dark mode before stylesheets load

**Features:**
- Onboarding tour powered by Speyer Tour v3.0.0 — 6-step first-visit walkthrough with localStorage one-shot
- About dropdown (ℹ️ button) replaces standalone replay button — contains app description + "Replay tour" action. Saves a button slot in the header at 375px
- Added `i-repeat` icon to inline SVG sprite (36 icons total)

- Cache version bumped to smmr-v6.2

### v6.1 — 2025-02-23 — SUI 3.2.0 Upgrade
- Upgraded Speyer UI from 3.1.1 to 3.2.0
- Removed `.sui-screen:not(.is-active)` CSS workaround — replaced with `data-sui-screens` wrapper (SUI 3.2.0 native multi-screen support)
- Restored `sui-modal-close` on dialog X buttons (SUI 3.2.0 detects native `showModal()` and skips SUI teardown)
- SUI 3.2.0 idempotency guards eliminate dropdown double-init issue
- SUI 3.2.0 scoped dropdown click handler replaces global document listener
- Cache version bumped to smmr-v6.1

### v6.0 — 2025-02-23 — SUI 3.1.1 Upgrade
- Upgraded Speyer UI from 2.4.1 to 3.1.1
- Table of contents: custom panel/backdrop replaced with `sui-panel` + `SUI.panel` API (gains focus trap, scroll lock, focus restoration, reduced motion support, ARIA management)
- Share button: custom dropdown replaced with `sui-dropdown` + `SUI.dropdown` API
- Library header layout: inline styles replaced with `sui-flex sui-flex-nowrap sui-items-center sui-gap-2` utilities
- Fixed `--sui-surface-alt` → `--sui-bg-elevated` (token that didn't exist in 3.1.1)
- Removed ~45 lines of custom CSS and ~10 lines of custom JS
- Offline bar: only shows in standalone PWA mode with real connectivity check (prevents false positives on desktop)
- Inline SVG sprite retained (35 icons, ~5KB) for zero-latency offline rendering
- Cache version bumped to smmr-v6.0

### v5.3
- Fixed offline bar false positives on desktop (dual-check: standalone mode + fetch probe)
- Share button: replaced auto-download with dropdown menu (copy, save, share)
- Fixed iPhone layout: theme toggle and import button stacking (now side-by-side)

### v5.2 — 2025-02-16
- Added version shield in app footer for at-a-glance cache verification
- Fixed iOS file picker: `.md` files no longer greyed out (accept attribute uses `*/*` fallback)
- Added changelog to README

### v5.1
- Added icon precaching to service worker
- Updated `start_url` to `/` in manifest
- Fixed `background_color` in manifest

### v5.0 — SUI 2.1.2 Upgrade
- Migrated app shell layout from custom CSS to `sui-screen`, `sui-screen-header`, `sui-screen-body`, `sui-screen-footer`
- Screen switching via `is-active` class (SUI convention)
- Safe area insets now handled by SUI components
- Removed 152 lines / 8KB of custom CSS (cumulative with v4.0)
- Cache version bumped to smmr-v5

### v4.0 — SUI 2.1.0 Upgrade
- Replaced custom reader typography with `sui-prose`
- Replaced find highlight CSS with `sui-mark` / `sui-mark-current`
- Replaced document metadata CSS with `sui-meta`
- Replaced editor toolbar CSS with `sui-toolbar` / `sui-toolbar-btn` / `sui-toolbar-sep`
- Updated theme color to `#2563EB` (SUI blue-primary)

### v3.0 — Initial SUI Migration
- Built on Speyer UI design system (tokens, buttons, dialogs, sheets, tabs, inputs, etc.)
- Single-file PWA architecture
- IndexedDB document storage
- Offline-first with service worker

---

## License

MIT

---

Made in Canada with ❤️
