# Claude Workspace — Project Context

## What is this
Electron desktop app for managing multiple Claude Code sessions simultaneously.
Workspace config: `workspace.json`.

## Architecture

### Main process (`main.js`)
- Electron BrowserWindow with `titleBarStyle: 'hidden'` + `titleBarOverlay` (Windows)
- `nodeIntegration: true`, `contextIsolation: false` — renderer can require() directly
- No preload.js — removed (contextBridge requires contextIsolation)
- IPC handlers for workspace CRUD, session start/stop/write/resize, rename, settings, layouts, dialog:selectFolder, app:platform
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
- Path encoding: `D:\projects\foo` → `D--projects-foo`
- **Important**: `--session-id` on existing session = "already in use" error. Must use `--resume` for existing.
- **Important**: node-pty may need manual rebuild for Electron on Windows:
  - Spectre mitigation disabled in `binding.gyp`
  - winpty target removed (conpty only, Win10+)
  - winpty.gyp patched
  - Rebuild: `node-gyp rebuild --target=<electron-ver> --arch=x64 --dist-url=https://electronjs.org/headers`

### Workspace store (`src/workspace-store.js`)
- Reads/writes `workspace.json` (BOM-safe)
- Creates default workspace.json if missing
- CRUD for groups/sessions, renameSession
- Settings, layouts, claudeSessionExists/deleteClaudeSession

### Renderer (`renderer/`)
- `index.html` — layout, modals (create session/group, rename, alert/confirm, settings, help, about)
- `app.js` — all UI logic, xterm.js terminals, IPC
- `styles.css` — full styling, @font-face for bundled fonts
- `icons.js` — loads Lucide SVG icons from node_modules
- `fonts/` — JetBrains Mono, Fira Code, Hack (woff2)

### Icons
- Lucide icons (MIT, `lucide-static` npm package)
- SVG with `stroke-linecap="round"` and `stroke-linejoin="round"` (rounded corners)
- Loaded at startup via `icons.js`, inserted into DOM as innerHTML

### Data storage
- **All persistent data** in `workspace.json` — settings (font, theme, sidebar width), layouts, session metadata
- **No localStorage** — everything via IPC
- **Session history** managed by Claude Code natively in `~/.claude/projects/`

## UI Design

### Color palette — dark/light theme system
- Themes defined in `THEMES` object in app.js
- Dark theme: desaturated cyan accent `#6bb8b0`, dark backgrounds `#0c1115`
- Light theme: darker cyan accent `#2a8a80`, light backgrounds `#f5f5f0`
- Applied via CSS variables, switchable in Settings
- xterm themes also switch per-theme

### Layout
- Header — terminal icon logo + workspace name
- Sidebar (left) — groups → sessions → layouts, resizable (min 140px, max 400px)
- Sidebar width persisted in workspace.json settings
- Sidebar resizer: 6px with negative margins (invisible but easy to grab), z-index 5
- Workspace (right) — CSS Grid, single row of columns

### Font system
- All UI uses terminal font (same family and size everywhere)
- CSS variables `--font-ui` and `--font-size-ui`, all sizes in `em`
- Bundled: JetBrains Mono, Fira Code, Hack. System: Cascadia Code, Consolas, Courier New

### Navigation
- **Click** — opens single session (closes others)
- **Ctrl/Cmd+Click** — adds session to workspace
- **Ctrl/Cmd+F4** — hides active session (only in xterm handler, not document level)
- **Alt/Option+F4** — close app

### Keybinding groups (layouts)
- **Ctrl/Cmd+digit** — save layout, **Alt/Option+digit** — recall layout
- Handlers in both xterm and document keydown
- Stored in `workspace.json` under `layouts`
- Sidebar shows as expandable groups with `Alt+N` / `Option+N` headers

### Multi-window workspace
- CSS Grid columns, no gap (tiles separated by barely-visible border)
- Focused session: lighter bg, xterm bg changes dynamically, title turns accent color
- `updateWorkspaceLayout()` tracks `lastVisibleKey` — skips DOM rebuild if visible set unchanged
- Per-session resize dedup: `lastSentSize` tracks cols,rows — skips PTY resize if unchanged

### Session indicators in sidebar
- Gray dot — not running
- Green 70% — running, not in workspace
- Green 100% + glow — running and visible
- Silence progress bar: 5 segments, fills 1/sec, resets on PTY output
- `updateSilenceBars()` called at end of `renderSidebar()` to prevent flash-to-zero on re-render

### Starting overlay
- Shows "Starting..." centered over terminal container while Claude boots
- Hidden when first printable characters detected via `extractPrintable()` (strips ANSI CSI/OSC sequences including private mode `?` sequences, then checks for remaining printable chars)
- Terminal receives data under the overlay, so content is ready when overlay disappears

### Clipboard
- **Ctrl/Cmd+C** with selection — copy (without selection = SIGINT)
- **Ctrl/Cmd+Insert** — copy selection
- **Enter** with selection — copy and clear
- Selection rendered with inverted colors (foreground/background swap)

### Dialogs
- **Custom alert/confirm** — styled modal dialogs (native `prompt()`/`alert()` don't work reliably in Electron)
- All modals close on Escape (acts as Cancel)
- Delete session blocked if running — shows "Stop the session before deleting it."

### Session management UI
- **Rename**: pencil icon → modal dialog with pre-filled name
- **Delete**: trash icon, blocked if session running
- **Stop**: circle-stop icon
- **New session**: folder picker button (OS native dialog via `dialog.showOpenDialog`)

### Settings page
- Font family, font size (slider 10-24px), theme (dark/light)
- Live preview with syntax-highlighted code sample
- Syntax classes: `.syn-kw` (blue), `.syn-fn` (cyan), `.syn-str` (green), `.syn-num` (yellow), `.syn-cmt` (dim italic)

### Help & About
- Help: description left / shortcuts right, platform-aware labels (Ctrl/Cmd, Alt/Option), copy shortcuts merged into one row
- About: version 1.0, built 2026-03-28, copyright, GitHub link (opens in browser via shell.openExternal)

### Terminal styling
- xterm scrollbar styled to match theme (6px, transparent track, themed thumb)
- xterm viewport/screen forced to 100% height with inherited background to prevent bottom gap

## Build
- `electron-builder --dir` with `asar: false`, `signAndEditExecutable: false`, `CSC_IDENTITY_AUTO_DISCOVERY=false`
- Output: `dist/win-unpacked/`
- workspace.json created next to exe (`app.isPackaged ? dirname(execPath) : __dirname`)
- When deploying, preserve existing workspace.json in target directory

## Known issues / Notes
- GPU cache errors on launch when previous instance holds lock — harmless
- `prompt()` doesn't work in Electron — use custom modal dialogs
- `--session-id` on existing session = "already in use". Must use `--resume`.
- `--resume` only works when cwd matches the project directory
- Ctrl+F4 only in xterm handler (not document) to avoid double-close
- Single .exe build not feasible with Electron + node-pty native module
