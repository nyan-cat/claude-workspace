# Claude Workspace — Project Context

## What is this
Electron desktop app for managing multiple Claude Code sessions simultaneously.
Workspace config: `workspace.json`. Version: 1.0.4.

## Architecture

### Main process (`main.js`)
- Electron BrowserWindow with `titleBarStyle: 'hidden'` + `titleBarOverlay` (Windows)
- `nodeIntegration: true`, `contextIsolation: false`, no preload.js
- IPC handlers: workspace CRUD, session start/stop/write/resize/rename/move, group create/delete/move, settings, layouts, dialog:selectFolder, app:platform, multi-monitor (displays:get, window:getBounds, window:getContentBounds, window:spanAllMonitors)
- Single instance lock (`app.requestSingleInstanceLock()`)
- Content-Security-Policy set in HTML meta tag

### Session management (`src/session-manager.js`)
- Manages PTY processes via adapter pattern
- Events: `data` (PTY output), `exit` (process ended)
- Checks `claudeSessionExists()` to decide `--session-id` (new) vs `--resume` (existing)

### PTY adapter (`src/adapters/node-process-adapter.js`)
- Uses `node-pty` with ConPTY (Windows 10+)
- New sessions: `claude --session-id <uuid>`
- Existing sessions: `claude --resume <uuid>` (checked via `.jsonl` file existence)
- Claude stores sessions in `~/.claude/projects/<encoded-path>/<session-uuid>.jsonl`
- Path encoding: colon → dash, slash → dash, dot → dash (`D:\projects\foo.bar` → `D--projects-foo-bar`)
- **Important**: `--session-id` on existing session = "already in use" error. Must use `--resume`.
- **Important**: node-pty may need manual rebuild for Electron on Windows (see README)

### Workspace store (`src/workspace-store.js`)
- Reads/writes `workspace.json` (BOM-safe), creates default if missing
- CRUD for groups/sessions, renameSession, moveGroup, moveSession
- Settings, layouts, claudeSessionExists/deleteClaudeSession

### Renderer (`renderer/`)
- `index.html` — layout, modals (create session/group, edit, alert/confirm, settings, help, about)
- `app.js` — all UI logic, xterm.js terminals, IPC, Matrix rain animation
- `styles.css` — full styling, @font-face for bundled fonts
- `icons.js` — loads Lucide SVG icons from node_modules
- `fonts/` — JetBrains Mono, Fira Code, Hack, Matrix Code NFI (woff2)

### Icons
- Lucide icons (MIT, `lucide-static` npm package), SVG with rounded corners
- Loaded at startup via `icons.js`, inserted into DOM as innerHTML

### Data storage
- **All persistent data** in `workspace.json` — settings (font, theme, sidebar width), layouts, session metadata
- **No localStorage** — everything via IPC
- **Session history** managed by Claude Code natively in `~/.claude/projects/`

## UI Design

### Themes
Three themes in `THEMES` object: `dark`, `light`, `matrix`
- **Dark**: desaturated cyan accent `#6bb8b0`, dark backgrounds `#0c1115`
- **Light**: darker cyan accent `#2a8a80`, light backgrounds `#f5f5f0`, dark ANSI colors for contrast
- **Matrix**: pure black `#000000`, bright green `#00ff41`, animated falling katakana rain
- Applied via CSS variables + xterm theme objects, switchable in Settings

### Matrix rain animation
- Full-screen canvas overlay (`position: fixed`, `z-index: 9999`, `pointer-events: none`)
- Grid of stationary characters (katakana + digits), "streams" are brightness waves moving down
- Characters don't move — illusion from gradient moving down and new chars appearing at head
- Head char: appears with fast fade-in, assigned when stream advances to new row
- Trail: quadratic alpha fade (`fade * fade`), 15-45 chars long
- Per-stream brightness variation: 0.15..1.0
- Two-pass rendering: glow layer (larger font, low alpha) + sharp layer
- Matrix Code NFI font (bundled woff2), loaded via `document.fonts.load()` before animation starts
- ~0.2% grid cells mutate per frame (subtle flickering)
- Only active when theme === 'matrix', cleaned up on theme switch

### Layout
- Header — terminal icon logo + workspace name + span-monitors button (140px right margin for Windows title bar buttons)
- Sidebar (left) — groups → sessions → layouts, resizable (min 140px, max 400px, width persisted)
- Sidebar resizer: 6px with negative margins, z-index 5
- Workspace tabs bar — horizontal tabs for all running sessions
- Workspace body — CSS Grid, single row of columns (smart multi-monitor alignment)

### Font system
- All UI uses terminal font (same family and size everywhere)
- CSS variables `--font-ui` and `--font-size-ui`, all sizes in `em`
- Bundled: JetBrains Mono, Fira Code, Hack. System: Cascadia Code, Consolas, Courier New
- Matrix Code NFI: only for rain animation, not in font selector

### Navigation
- **Click** — opens single session (closes others)
- **Ctrl/Cmd+Click** — adds session to workspace
- **Ctrl/Cmd+F4** — hides active session (only in xterm handler)
- **Ctrl+Tab / Ctrl+Shift+Tab** — cycle focus between visible sessions (only in xterm handler, not document level — prevents double-fire)
- **Alt/Option+F4** — close app
- Same click behavior on workspace tabs and sidebar

### Drag-and-drop
- **Groups**: drag group header to reorder in sidebar, saves to workspace.json via `moveGroup`
- **Sessions**: drag session item within or between groups, saves via `moveSession`
- **Workspace columns**: drag session header bar to reorder columns (reorders `visibleSessionIds` Set)
- Visual feedback: `.dragging` (opacity 0.4), `.drag-over` (accent outline)

### Keybinding groups (layouts)
- **Ctrl/Cmd+digit** — save, **Alt/Option+digit** — recall
- Handlers in both xterm and document keydown
- Stored in `workspace.json` under `layouts`
- Sidebar: expandable groups with `Alt+N` / `Option+N` headers
- recallKeybindingGroup calls setActiveSession to sync focus

### Multi-monitor
- **Span all monitors button** in header
- `window:spanAllMonitors` — bounding rect using workArea intersection (respects taskbar)
- `calcGridColumns()` — async, queries displays, calculates column widths per monitor
- Falls back to `repeat(N, 1fr)` on single monitor

### Multi-window workspace
- CSS Grid columns, no gap, barely-visible border between tiles
- Focused session: lighter bg (xterm bg changes dynamically), title bold/bright
- Session header: bold title, same-size working dir, close button (×)
- `updateWorkspaceLayout()` tracks `lastVisibleKey` — skips DOM rebuild if unchanged
- Per-session resize dedup: `lastSentSize` tracks cols,rows

### Session indicators in sidebar
- Gray dot — not running
- Green 70% — running, not in workspace
- Green 100% + glow — running and visible
- Silence progress bar: 5 segments, 1/sec, resets on output
- `updateSilenceBars()` called at end of `renderSidebar()` to prevent flash-to-zero

### Starting overlay
- "Starting..." centered over terminal, hidden on first printable characters via `extractPrintable()` (strips ANSI CSI/OSC including private mode `?` sequences)

### Clipboard
- **Copy**: Ctrl/Cmd+C (with selection), Ctrl/Cmd+Insert, Enter — uses `e.code`
- **Paste**: Ctrl/Cmd+V (`e.code === 'KeyV'`), Shift+Insert, Right Click

### Clickable links (Ctrl+click)
- URLs: regex, opens browser via `shell.openExternal`
- Windows paths: `findWinPaths()` — handles spaces, extensions, multiple per line, trailing punctuation. Lookbehind `(?<![a-zA-Z])` prevents matching `https://` as drive letter
- File paths: opens parent directory if target is file
- Opens via `start "" explorer "path"` for foreground focus

### Dialogs
- Custom alert/confirm modals, Edit Session modal
- All close on Escape (cascading priority)
- Delete blocked if session running

### Session management UI
- **Open dir**: folder icon → `start "" explorer`
- **Edit**: pencil icon → modal
- **Stop**: circle-stop icon
- **Delete**: trash icon, blocked if running
- **New session**: folder picker (OS native dialog)

### Settings
- Font family, font size (10-24px), theme (dark/light/matrix)
- Live preview with syntax highlighting
- Sidebar width persisted on resize

### Help & About
- Help: description left / shortcuts right, platform-aware, includes copy/paste/newline/Ctrl+Tab
- About: version, build date, copyright Denis Sibilev, GitHub link

## Build
- `electron-builder --dir` with `asar: false`, `signAndEditExecutable: false`, `CSC_IDENTITY_AUTO_DISCOVERY=false`
- `publish.cmd` — builds, zips, creates GitHub release (gitignored, contains PAT)
- workspace.json next to exe when packaged
- Preserve existing workspace.json when deploying

## Known issues / Notes
- GPU cache errors on launch when previous instance holds lock — harmless
- `prompt()` doesn't work in Electron — use custom modals
- `--session-id` on existing = "already in use". Must use `--resume`.
- `--resume` only works when cwd matches project directory
- Ctrl+F4 and Ctrl+Tab only in xterm handler (not document) to avoid double-fire
- Canvas `shadowBlur` unreliable in Chromium — glow done via oversized font passes instead
- Path encoding must match Claude's: colon, slash, AND dot → dash
