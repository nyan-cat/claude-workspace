# Claude Workspace — Project Context

## What is this
Electron desktop app for managing multiple Claude Code sessions simultaneously.
Workspace config: `workspace.json`.

## Architecture

### Main process (`main.js`)
- Electron BrowserWindow with `titleBarStyle: 'hidden'` + `titleBarOverlay` (Windows)
- `nodeIntegration: true`, `contextIsolation: false`, no preload.js
- IPC handlers for workspace CRUD, session start/stop/write/resize, rename, settings, layouts, dialog:selectFolder, app:platform, multi-monitor (displays:get, window:getBounds, window:getContentBounds, window:spanAllMonitors)
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
- Path encoding: `D:\projects\foo` → `D--projects-foo` (colon becomes dash, not removed)
- **Important**: `--session-id` on existing session = "already in use" error. Must use `--resume`.
- **Important**: node-pty may need manual rebuild for Electron on Windows (see README)

### Workspace store (`src/workspace-store.js`)
- Reads/writes `workspace.json` (BOM-safe)
- Creates default workspace.json if missing
- CRUD for groups/sessions, renameSession
- Settings, layouts, claudeSessionExists/deleteClaudeSession
- Path encoding for Claude session detection: colon → dash, slash → dash

### Renderer (`renderer/`)
- `index.html` — layout, modals (create session/group, rename, alert/confirm, settings, help, about)
- `app.js` — all UI logic, xterm.js terminals, IPC
- `styles.css` — full styling, @font-face for bundled fonts
- `icons.js` — loads Lucide SVG icons from node_modules
- `fonts/` — JetBrains Mono, Fira Code, Hack (woff2)

### Icons
- Lucide icons (MIT, `lucide-static` npm package)
- SVG with rounded corners (stroke-linecap/linejoin round)
- Loaded at startup via `icons.js`, inserted into DOM as innerHTML

### Data storage
- **All persistent data** in `workspace.json` — settings (font, theme, sidebar width), layouts, session metadata
- **No localStorage** — everything via IPC
- **Session history** managed by Claude Code natively in `~/.claude/projects/`

## UI Design

### Color palette — dark/light theme system
- Themes defined in `THEMES` object in app.js with full xterm theme per-mode
- Dark theme: desaturated cyan accent `#6bb8b0`, dark backgrounds `#0c1115`
- Light theme: darker cyan accent `#2a8a80`, light backgrounds `#f5f5f0`
- Applied via CSS variables, switchable in Settings

### Layout
- Header — terminal icon logo + workspace name + span-monitors button (right side, 140px margin from window controls)
- Sidebar (left) — groups → sessions → layouts, resizable (min 140px, max 400px, width persisted)
- Sidebar resizer: 6px with negative margins (invisible but easy to grab), z-index 5
- Workspace tabs bar — horizontal tabs for all running sessions, above workspace grid
- Workspace body — CSS Grid, single row of columns (smart multi-monitor alignment)

### Font system
- All UI uses terminal font (same family and size everywhere)
- CSS variables `--font-ui` and `--font-size-ui`, all sizes in `em`
- Bundled: JetBrains Mono, Fira Code, Hack. System: Cascadia Code, Consolas, Courier New

### Navigation
- **Click** — opens single session (closes others)
- **Ctrl/Cmd+Click** — adds session to workspace
- **Ctrl/Cmd+F4** — hides active session (only in xterm handler, not document level)
- **Alt/Option+F4** — close app
- Same click behavior on workspace tabs and sidebar

### Keybinding groups (layouts)
- **Ctrl/Cmd+digit** — save layout, **Alt/Option+digit** — recall layout
- Handlers in both xterm and document keydown
- Stored in `workspace.json` under `layouts`
- Sidebar shows as expandable groups with `Alt+N` / `Option+N` headers
- recallKeybindingGroup calls setActiveSession to sync focus

### Multi-monitor
- **Span all monitors button** in header (maximize icon)
- `window:spanAllMonitors` IPC — calculates bounding rect using workArea intersection (respects taskbar)
- `calcGridColumns()` — async function that queries displays and content bounds, calculates column widths so each session fits within one monitor
- Falls back to `repeat(N, 1fr)` on single monitor or errors

### Multi-window workspace
- CSS Grid columns, no gap (tiles separated by barely-visible border)
- Focused session: lighter bg, xterm bg changes dynamically, title bold/bright
- Session header: bold title, same-size working dir, close button (×) on right
- `updateWorkspaceLayout()` tracks `lastVisibleKey` — skips DOM rebuild if visible set unchanged
- Per-session resize dedup: `lastSentSize` tracks cols,rows — skips PTY resize if unchanged

### Workspace tabs bar
- Shows all running sessions as horizontal tabs above workspace
- Each tab: status dot + name, same click/Ctrl+click behavior as sidebar
- Hidden when no sessions running

### Session indicators in sidebar
- Gray dot — not running
- Green 70% — running, not in workspace
- Green 100% + glow — running and visible
- Silence progress bar: 5 segments, fills 1/sec, resets on output
- `updateSilenceBars()` called at end of `renderSidebar()` to prevent flash-to-zero

### Starting overlay
- Shows "Starting..." centered over terminal container while Claude boots
- Hidden when first printable characters detected via `extractPrintable()` (strips all ANSI CSI/OSC sequences including private mode `?` sequences)

### Clipboard
- **Copy**: Ctrl/Cmd+C (with selection), Ctrl/Cmd+Insert, Enter — uses `e.code` for layout-independent detection
- **Paste**: Ctrl/Cmd+V (`e.code === 'KeyV'`), Shift+Insert, Right Click
- Selection rendered with inverted colors

### Clickable links (Ctrl+click)
- URLs: regex detection, opens browser via `shell.openExternal`
- Windows paths: custom `findWinPaths()` parser — handles spaces in names, file extensions, multiple paths per line, trailing punctuation trimming
- Unix paths: regex for /home, /usr, etc.
- File paths: if target is a file, opens parent directory
- Activated only on Ctrl/Cmd+click
- Windows Explorer opened via `start "" explorer "path"` for foreground focus

### Dialogs
- **Custom alert/confirm** — styled modal dialogs (`prompt()`/`alert()` unreliable in Electron)
- **Rename** — modal with pre-filled name
- All modals close on Escape (cascading priority check)
- Delete session blocked if running

### Session management UI
- **Open dir**: folder icon → opens working directory in Explorer (via `start "" explorer`)
- **Rename**: pencil icon → modal dialog
- **Stop**: circle-stop icon
- **Delete**: trash icon, blocked if running
- **New session**: folder picker button (OS native dialog)

### Settings page
- Font family, font size (slider 10-24px), theme (dark/light)
- Live preview with syntax-highlighted code sample
- Sidebar width persisted on resize mouseup

### Help & About
- Help: description left / shortcuts right, platform-aware (Ctrl/Cmd, Alt/Option), includes copy/paste/newline
- About: version 1.0.2, built 2026-03-28, copyright Denis Sibilev, GitHub link

## Build
- `electron-builder --dir` with `asar: false`, `signAndEditExecutable: false`, `CSC_IDENTITY_AUTO_DISCOVERY=false`
- Output: `dist/win-unpacked/`
- `publish.cmd` — builds, zips, creates GitHub release (contains PAT token, gitignored)
- workspace.json created next to exe (`app.isPackaged ? dirname(execPath) : __dirname`)
- When deploying, preserve existing workspace.json in target directory
- **Never commit .zip artifacts to git** (causes huge push times)

## Known issues / Notes
- GPU cache errors on launch when previous instance holds lock — harmless
- `prompt()` doesn't work in Electron — use custom modal dialogs
- `--session-id` on existing session = "already in use". Must use `--resume`.
- `--resume` only works when cwd matches the project directory
- Ctrl+F4 only in xterm handler (not document) to avoid double-close
- Single .exe build not feasible with Electron + node-pty native module
- publish.cmd contains GitHub PAT — gitignored, never commit
