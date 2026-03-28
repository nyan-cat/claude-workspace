const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');
const { ipcRenderer } = require('electron');
const icons = require('./icons');

// Platform detection
let isMac = false;
ipcRenderer.invoke('app:platform').then(p => { isMac = p === 'darwin'; });
const mod = () => isMac ? 'Cmd' : 'Ctrl';
const opt = () => isMac ? 'Option' : 'Alt';

// API wrapper
const api = {
  getWorkspace: () => ipcRenderer.invoke('workspace:get'),
  startSession: (id, cols, rows) => ipcRenderer.invoke('session:start', id, cols, rows),
  stopSession: (id) => ipcRenderer.invoke('session:stop', id),
  writeToSession: (id, data) => ipcRenderer.invoke('session:write', id, data),
  resizeSession: (id, cols, rows) => ipcRenderer.invoke('session:resize', id, cols, rows),
  isRunning: (id) => ipcRenderer.invoke('session:isRunning', id),
  getAllRunning: () => ipcRenderer.invoke('session:getAllRunning'),
  createGroup: (name) => ipcRenderer.invoke('group:create', name),
  deleteGroup: (gi) => ipcRenderer.invoke('group:delete', gi),
  createSession: (gi, name, dir) => ipcRenderer.invoke('session:create', gi, name, dir),
  deleteSession: (id) => ipcRenderer.invoke('session:delete', id),
  renameSession: (id, name) => ipcRenderer.invoke('session:rename', id, name),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  onSessionData: (cb) => ipcRenderer.on('session:data', (e, id, data) => cb(id, data)),
  onSessionExit: (cb) => ipcRenderer.on('session:exit', (e, id, code) => cb(id, code)),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (s) => ipcRenderer.invoke('settings:update', s),
  getLayouts: () => ipcRenderer.invoke('layouts:get'),
  setLayout: (key, ids) => ipcRenderer.invoke('layouts:set', key, ids),
};

// Settings
const DEFAULT_SETTINGS = {
  fontFamily: 'JetBrains Mono',
  fontSize: 14,
  theme: 'dark',
};

let currentSettings = { ...DEFAULT_SETTINGS };

const THEMES = {
  dark: {
    bgPrimary: '#0c1115', bgSecondary: '#111a20', bgTertiary: '#18242b',
    bgHover: '#1e2e36', bgActive: '#263a44', bgFocused: '#0f1519',
    textPrimary: '#d4dde2', textSecondary: '#8a9aa3', textDim: '#4e6068',
    accent: '#6bb8b0', accentHover: '#7dcdc4', accentDim: '#4a9e9618',
    danger: '#c0504d', success: '#5ab87a', border: '#1a2830',
    titleBarColor: '#111a20', titleBarSymbol: '#8a9aa3',
    xterm: {
      background: '#0c1115', foreground: '#d4dde2', cursor: '#6bb8b0', cursorAccent: '#0c1115',
      selectionBackground: '#d4dde2', selectionForeground: '#0c1115',
      black: '#111a20', red: '#c0504d', green: '#5ab87a', yellow: '#c9a84c',
      blue: '#5a9bcf', magenta: '#9a7dbf', cyan: '#6bb8b0', white: '#d4dde2',
      brightBlack: '#4e6068', brightRed: '#d4605c', brightGreen: '#6dcc8e', brightYellow: '#d9bc6a',
      brightBlue: '#72b0e0', brightMagenta: '#b094d4', brightCyan: '#7dcdc4', brightWhite: '#edf2f5',
    },
    bgFocusedXterm: '#0f1519',
  },
  light: {
    bgPrimary: '#f5f5f0', bgSecondary: '#eaeae5', bgTertiary: '#ddddd8',
    bgHover: '#d0d0cb', bgActive: '#c4c4bf', bgFocused: '#fafaf7',
    textPrimary: '#1a1a18', textSecondary: '#5a5a55', textDim: '#9a9a95',
    accent: '#2a8a80', accentHover: '#1e6e65', accentDim: '#2a8a8018',
    danger: '#c0504d', success: '#3a8a5a', border: '#d0d0cb',
    titleBarColor: '#eaeae5', titleBarSymbol: '#5a5a55',
    xterm: {
      background: '#f5f5f0', foreground: '#1a1a18', cursor: '#2a8a80', cursorAccent: '#f5f5f0',
      selectionBackground: '#1a1a18', selectionForeground: '#f5f5f0',
      black: '#1a1a18', red: '#c0504d', green: '#3a8a5a', yellow: '#8a7a30',
      blue: '#3a6a9f', magenta: '#7a5a9f', cyan: '#2a8a80', white: '#f5f5f0',
      brightBlack: '#9a9a95', brightRed: '#d4605c', brightGreen: '#4a9a6a', brightYellow: '#9a8a40',
      brightBlue: '#4a7abf', brightMagenta: '#8a6aaf', brightCyan: '#3a9a90', brightWhite: '#ffffff',
    },
    bgFocusedXterm: '#fafaf7',
  },
};

function applyTheme() {
  const t = THEMES[currentSettings.theme] || THEMES.dark;
  const r = document.documentElement.style;
  r.setProperty('--bg-primary', t.bgPrimary);
  r.setProperty('--bg-secondary', t.bgSecondary);
  r.setProperty('--bg-tertiary', t.bgTertiary);
  r.setProperty('--bg-hover', t.bgHover);
  r.setProperty('--bg-active', t.bgActive);
  r.setProperty('--bg-focused', t.bgFocused);
  r.setProperty('--text-primary', t.textPrimary);
  r.setProperty('--text-secondary', t.textSecondary);
  r.setProperty('--text-dim', t.textDim);
  r.setProperty('--accent', t.accent);
  r.setProperty('--accent-hover', t.accentHover);
  r.setProperty('--accent-dim', t.accentDim);
  r.setProperty('--danger', t.danger);
  r.setProperty('--success', t.success);
  // Update session tile border color
  document.querySelectorAll('.session-view').forEach(el => {
    el.style.borderColor = t.border;
  });
}

function applyCssFont() {
  document.documentElement.style.setProperty('--font-mono', `'${currentSettings.fontFamily}', monospace`);
  document.documentElement.style.setProperty('--font-ui', `'${currentSettings.fontFamily}', monospace`);
  document.documentElement.style.setProperty('--font-size-ui', currentSettings.fontSize + 'px');
}

function currentXtermTheme() {
  return (THEMES[currentSettings.theme] || THEMES.dark).xterm;
}

// State
let workspace = null;
let activeSessionId = null;
let visibleSessionIds = new Set();
let sessionViews = {};
let runningIds = new Set();
let collapsedGroups = new Set();

// Keybinding groups
let keybindingGroups = {};

function saveKeybindingGroup(key) {
  keybindingGroups[key] = [...visibleSessionIds];
  api.setLayout(key, keybindingGroups[key]);
  renderSidebar();
}

function recallKeybindingGroup(key) {
  const ids = keybindingGroups[key];
  if (!ids || ids.length === 0) return;
  const valid = ids.filter(id => findSessionById(id));
  if (valid.length === 0) return;
  visibleSessionIds.clear();
  valid.forEach(id => {
    visibleSessionIds.add(id);
    const session = findSessionById(id);
    if (session) ensureSessionView(session);
  });
  activeSessionId = valid[0];
  renderSidebar();
  updateWorkspaceLayout();
}

// Silence tracking
let lastOutputTime = {};
let silenceTick = null;

function startSilenceTicker() {
  if (silenceTick) return;
  silenceTick = setInterval(() => updateSilenceBars(), 1000);
}

function updateSilenceBars() {
  const now = Date.now();
  document.querySelectorAll('.session-progress').forEach(bar => {
    const id = bar.dataset.sessionId;
    if (!id || !runningIds.has(id)) return;
    const elapsed = lastOutputTime[id] ? Math.floor((now - lastOutputTime[id]) / 1000) : 0;
    const filled = Math.min(elapsed, 5);
    bar.querySelectorAll('.session-progress-seg').forEach((seg, i) => {
      seg.classList.toggle('filled', i < filled);
    });
  });
}

startSilenceTicker();

// DOM references
const sidebarGroups = document.getElementById('sidebarGroups');
const workspaceEl = document.getElementById('workspace');
const workspaceEmpty = document.getElementById('workspaceEmpty');
const workspaceGrid = document.getElementById('workspaceGrid');
const workspaceName = document.getElementById('workspaceName');
const btnNewGroup = document.getElementById('btnNewGroup');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalForm = document.getElementById('modalForm');
const modalFieldName = document.getElementById('modalFieldName');
const modalFieldDir = document.getElementById('modalFieldDir');
const modalDirGroup = document.getElementById('modalDirGroup');
const modalCancel = document.getElementById('modalCancel');
const btnBrowseDir = document.getElementById('btnBrowseDir');

let modalMode = null;
let modalGroupIndex = null;

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Init
async function init() {
  // Set static icons
  document.getElementById('logoIcon').innerHTML = icons.terminal;
  document.getElementById('iconPlus').innerHTML = icons.plus;
  document.getElementById('iconHelp').innerHTML = icons.helpCircle;
  document.getElementById('iconInfo').innerHTML = icons.info;
  document.getElementById('iconSettings').innerHTML = icons.settings;
  document.getElementById('emptyIcon').innerHTML = icons.terminal;
  document.getElementById('aboutIcon').innerHTML = icons.terminal;
  document.getElementById('iconBrowse').innerHTML = icons.folderOpen;

  workspace = await api.getWorkspace();
  workspaceName.textContent = workspace.name;

  const savedSettings = await api.getSettings();
  currentSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
  applyCssFont();
  applyTheme();
  if (currentSettings.sidebarWidth) {
    sidebar.style.width = currentSettings.sidebarWidth + 'px';
  }

  keybindingGroups = await api.getLayouts() || {};

  const running = await api.getAllRunning();
  runningIds = new Set(running);

  renderSidebar();
  updateWorkspaceLayout();
}

// Sidebar rendering
function renderSidebar() {
  sidebarGroups.innerHTML = '';

  workspace.groups.forEach((group, gi) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'group';
    const isCollapsed = collapsedGroups.has(gi);

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <span class="group-arrow ${isCollapsed ? 'collapsed' : ''}">${isCollapsed ? icons.chevronRight : icons.chevronDown}</span>
      <span class="group-name">${escHtml(group.name)}</span>
      <span class="group-actions">
        <button class="group-btn add" title="New Session">${icons.plus}</button>
        ${group.sessions.length === 0 ? `<button class="group-btn delete" title="Delete Group">${icons.x}</button>` : ''}
      </span>
    `;

    header.addEventListener('click', (e) => {
      if (e.target.closest('.group-btn')) return;
      if (isCollapsed) collapsedGroups.delete(gi); else collapsedGroups.add(gi);
      renderSidebar();
    });

    header.querySelector('.group-btn.add').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal('session', gi);
    });

    const delBtn = header.querySelector('.group-btn.delete');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        workspace = await api.deleteGroup(gi);
        renderSidebar();
      });
    }

    groupEl.appendChild(header);

    const sessionsEl = document.createElement('div');
    sessionsEl.className = 'group-sessions' + (isCollapsed ? ' collapsed' : '');

    group.sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'session-item' + (session.id === activeSessionId ? ' active' : '');

      const isRunning = runningIds.has(session.id);
      const isVisible = visibleSessionIds.has(session.id);
      let statusClass = '';
      if (isRunning && isVisible) statusClass = 'running-visible';
      else if (isRunning) statusClass = 'running-hidden';

      const progressHtml = isRunning
        ? `<span class="session-progress" data-session-id="${session.id}">${'<span class="session-progress-seg"></span>'.repeat(5)}</span>`
        : '';

      item.innerHTML = `
        <span class="session-status ${statusClass}"></span>
        <span class="session-name">${escHtml(session.name)}</span>
        ${progressHtml}
        <span class="session-actions">
          <button class="session-btn rename" title="Rename">${icons.pencil}</button>
          <button class="session-btn stop ${isRunning ? 'active' : 'inactive'}" title="${isRunning ? 'Stop' : 'Not running'}">${icons.circleStop}</button>
          <button class="session-btn delete" title="Delete session">${icons.trash2}</button>
        </span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.session-btn')) return;
        if (e.ctrlKey || e.metaKey) addSessionToWorkspace(session);
        else showSingleSession(session);
      });

      item.querySelector('.session-btn.rename').addEventListener('click', (e) => {
        e.stopPropagation();
        openRenameModal(session);
      });

      item.querySelector('.session-btn.stop').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isRunning) {
          await api.stopSession(session.id);
          runningIds.delete(session.id);
          renderSidebar();
        }
      });

      item.querySelector('.session-btn.delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (runningIds.has(session.id)) {
          showAlert('Stop the session before deleting it.');
          return;
        }
        if (!await showConfirm(`Delete session "${session.name}"?`)) return;
        visibleSessionIds.delete(session.id);
        workspace = await api.deleteSession(session.id);
        removeSessionView(session.id);
        if (activeSessionId === session.id) activeSessionId = null;
        renderSidebar();
        updateWorkspaceLayout();
      });

      sessionsEl.appendChild(item);
    });

    groupEl.appendChild(sessionsEl);
    sidebarGroups.appendChild(groupEl);
  });

  // Keybinding groups
  const usedSlots = Object.entries(keybindingGroups).filter(([, ids]) => ids && ids.length > 0);
  if (usedSlots.length > 0) {
    const kbSection = document.createElement('div');
    kbSection.className = 'keybinding-section';

    usedSlots.sort((a, b) => a[0].localeCompare(b[0]));
    usedSlots.forEach(([key, ids]) => {
      const validIds = ids.filter(id => findSessionById(id));
      if (validIds.length === 0) return;

      const isCurrent = validIds.length === visibleSessionIds.size &&
        validIds.every(id => visibleSessionIds.has(id));

      const kbGroup = document.createElement('div');
      kbGroup.className = 'kb-group';

      const kbHeader = document.createElement('div');
      kbHeader.className = 'kb-group-header' + (isCurrent ? ' current' : '');
      kbHeader.innerHTML = `<span class="kb-group-key">${opt()}+${key}</span>`;
      kbHeader.addEventListener('click', () => recallKeybindingGroup(key));
      kbGroup.appendChild(kbHeader);

      const list = document.createElement('div');
      list.className = 'kb-group-sessions';
      validIds.forEach(id => {
        const s = findSessionById(id);
        if (!s) return;
        const item = document.createElement('div');
        item.className = 'kb-session-item';
        item.textContent = s.name;
        list.appendChild(item);
      });
      kbGroup.appendChild(list);
      kbSection.appendChild(kbGroup);
    });

    sidebarGroups.appendChild(kbSection);
  }

  // Immediately fill silence bars so they don't flash to 0
  updateSilenceBars();
}

function showSingleSession(session) {
  visibleSessionIds.clear();
  visibleSessionIds.add(session.id);
  activeSessionId = session.id;
  ensureSessionView(session);
  renderSidebar();
  updateWorkspaceLayout();
}

function addSessionToWorkspace(session) {
  if (visibleSessionIds.has(session.id)) { setActiveSession(session.id); return; }
  visibleSessionIds.add(session.id);
  activeSessionId = session.id;
  ensureSessionView(session);
  renderSidebar();
  updateWorkspaceLayout();
}

function setActiveSession(sessionId) {
  activeSessionId = sessionId;
  const t = THEMES[currentSettings.theme] || THEMES.dark;
  Object.entries(sessionViews).forEach(([id, entry]) => {
    const isFocused = id === sessionId;
    entry.element.classList.toggle('focused', isFocused);
    entry.terminal.options.theme = {
      ...entry.terminal.options.theme,
      background: isFocused ? t.bgFocusedXterm : t.xterm.background,
    };
  });
  if (sessionViews[sessionId]) sessionViews[sessionId].terminal.focus();
  renderSidebar();
}

function findSessionById(id) {
  for (const group of workspace.groups) {
    for (const s of group.sessions) { if (s.id === id) return s; }
  }
  return null;
}

function hideActiveSession() {
  if (!activeSessionId || !visibleSessionIds.has(activeSessionId)) return;
  visibleSessionIds.delete(activeSessionId);
  activeSessionId = visibleSessionIds.size > 0 ? [...visibleSessionIds][0] : null;
  renderSidebar();
  updateWorkspaceLayout();
}

let lastVisibleKey = ''; // track visible set to avoid unnecessary DOM rebuilds

function updateWorkspaceLayout() {
  const count = visibleSessionIds.size;
  if (count === 0) {
    workspaceEmpty.style.display = 'flex';
    workspaceGrid.style.display = 'none';
    lastVisibleKey = '';
    return;
  }

  const newKey = [...visibleSessionIds].join(',');
  const layoutChanged = newKey !== lastVisibleKey;
  lastVisibleKey = newKey;

  if (layoutChanged) {
    workspaceEmpty.style.display = 'none';
    workspaceGrid.style.display = 'grid';
    workspaceGrid.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
    workspaceGrid.style.gridTemplateRows = '1fr';

    Object.values(sessionViews).forEach(entry => {
      if (entry.element.parentNode === workspaceGrid) workspaceGrid.removeChild(entry.element);
      entry.element.classList.remove('visible');
    });

    for (const id of visibleSessionIds) {
      const entry = sessionViews[id];
      if (entry) {
        workspaceGrid.appendChild(entry.element);
        entry.element.classList.add('visible');
        entry.element.classList.toggle('focused', id === activeSessionId);
        if (!entry.opened) { entry.terminal.open(entry.termContainer); entry.opened = true; }
      }
    }

    // Fit all after grid settles (only when layout actually changed)
    requestAnimationFrame(() => { requestAnimationFrame(() => { requestAnimationFrame(() => {
      for (const id of visibleSessionIds) {
        const entry = sessionViews[id];
        if (entry) { fitTerminal(entry); startSessionIfNeeded(entry); }
      }
    }); }); });
  } else {
    // Layout didn't change — just update focus styling, start sessions if needed
    for (const id of visibleSessionIds) {
      const entry = sessionViews[id];
      if (entry) {
        entry.element.classList.toggle('focused', id === activeSessionId);
        startSessionIfNeeded(entry);
      }
    }
  }
}

function startSessionIfNeeded(entry) {
  const id = entry.session.id;
  if (!entry.started && !runningIds.has(id)) {
    entry.starting = true;
    const overlay = entry.element.querySelector('.starting-overlay');
    if (overlay) overlay.style.display = 'flex';
    api.startSession(id, entry.terminal.cols, entry.terminal.rows).then(() => {
      runningIds.add(id);
      entry.started = true;
      renderSidebar();
    });
  } else if (runningIds.has(id)) {
    entry.started = true;
    api.resizeSession(id, entry.terminal.cols, entry.terminal.rows);
  }
}

function fitTerminal(entry) {
  if (!entry || !entry.opened) return;
  try { entry.fitAddon.fit(); } catch (e) {}
}

function fitAllVisible() {
  for (const id of visibleSessionIds) {
    const entry = sessionViews[id];
    if (entry) fitTerminal(entry);
  }
}

const resizeTimers = {};
const lastSentSize = {}; // sessionId -> 'cols,rows'
function debouncedResizeSync(sessionId, cols, rows) {
  clearTimeout(resizeTimers[sessionId]);
  resizeTimers[sessionId] = setTimeout(() => {
    const key = `${cols},${rows}`;
    if (lastSentSize[sessionId] === key) return; // No change
    lastSentSize[sessionId] = key;
    if (runningIds.has(sessionId)) api.resizeSession(sessionId, cols, rows);
  }, 150);
}

function ensureSessionView(session) {
  if (sessionViews[session.id]) return sessionViews[session.id];
  return createSessionView(session);
}

function createSessionView(session) {
  if (sessionViews[session.id]) return sessionViews[session.id];

  const view = document.createElement('div');
  view.className = 'session-view';
  view.dataset.sessionId = session.id;
  view.innerHTML = `
    <div class="session-header-bar">
      <span class="session-header-title">${escHtml(session.name)}</span>
      <span class="session-header-dir">${escHtml(session.working_directory)}</span>
    </div>
    <div class="terminal-container">
      <div class="starting-overlay">Starting...</div>
    </div>
  `;

  const termContainer = view.querySelector('.terminal-container');
  const terminal = new Terminal({
    theme: currentXtermTheme(),
    fontFamily: `'${currentSettings.fontFamily}', monospace`,
    fontSize: currentSettings.fontSize,
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 10000,
    convertEol: false,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  terminal.attachCustomKeyEventHandler((e) => {
    // Ctrl/Cmd+F4
    if ((e.ctrlKey || e.metaKey) && e.key === 'F4') {
      if (e.type === 'keydown') { e.preventDefault(); hideActiveSession(); }
      return false;
    }
    if (e.altKey && e.key === 'F4') return false;

    const digit = e.key >= '0' && e.key <= '9' ? e.key : null;
    // Ctrl/Cmd+digit: save layout
    if (digit && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      if (e.type === 'keydown') saveKeybindingGroup(digit);
      return false;
    }
    // Alt/Option+digit: recall layout
    if (digit && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (e.type === 'keydown') recallKeybindingGroup(digit);
      return false;
    }
    // Copy selection: Ctrl+C, Ctrl+Insert, Enter
    if (e.type === 'keydown' && terminal.hasSelection()) {
      if ((e.ctrlKey && e.key === 'c') || (e.ctrlKey && e.key === 'Insert') || e.key === 'Enter') {
        e.preventDefault();
        navigator.clipboard.writeText(terminal.getSelection());
        terminal.clearSelection();
        return false;
      }
    }
    return true;
  });

  terminal.onData((data) => { api.writeToSession(session.id, data); });
  terminal.onResize(({ cols, rows }) => { debouncedResizeSync(session.id, cols, rows); });

  view.addEventListener('mousedown', () => {
    if (activeSessionId !== session.id) setActiveSession(session.id);
  });

  const resizeObserver = new ResizeObserver(() => {
    if (view.classList.contains('visible')) fitTerminal(entry);
  });
  resizeObserver.observe(termContainer);

  const entry = {
    element: view, terminal, fitAddon, termContainer, resizeObserver,
    started: false, opened: false, session,
  };
  sessionViews[session.id] = entry;
  return entry;
}

function removeSessionView(sessionId) {
  const entry = sessionViews[sessionId];
  if (entry) {
    entry.resizeObserver.disconnect();
    entry.terminal.dispose();
    entry.element.remove();
    delete sessionViews[sessionId];
  }
}

function applyThemeToAllTerminals() {
  const t = THEMES[currentSettings.theme] || THEMES.dark;
  Object.entries(sessionViews).forEach(([id, entry]) => {
    const isFocused = id === activeSessionId;
    entry.terminal.options.theme = {
      ...t.xterm,
      background: isFocused ? t.bgFocusedXterm : t.xterm.background,
    };
    entry.element.style.borderColor = t.border;
  });
}

// PTY events
// Strip ANSI escapes and control chars, return only printable text
function extractPrintable(str) {
  return str
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')   // CSI sequences (including ? for private modes)
    .replace(/\x1b\[[0-9;?]*[hluq]/g, '')      // CSI mode set/reset
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC sequences
    .replace(/\x1b[><=>()][^\x1b]*/g, '')      // other ESC sequences
    .replace(/\x1b\[[\x20-\x3f]*[\x40-\x7e]/g, '') // catch remaining CSI
    .replace(/\x1b./g, '')                     // any remaining 2-char escapes
    .replace(/[\x00-\x1f\x7f]/g, '');          // control chars
}

api.onSessionData((sessionId, data) => {
  const entry = sessionViews[sessionId];
  if (entry && entry.opened) {
    entry.terminal.write(data);
    if (entry.starting) {
      const printable = extractPrintable(data);
      if (printable.length > 0) {
        const overlay = entry.element.querySelector('.starting-overlay');
        if (overlay) overlay.style.display = 'none';
        entry.starting = false;
      }
    }
  }
  lastOutputTime[sessionId] = Date.now();
});

api.onSessionExit((sessionId, code) => {
  runningIds.delete(sessionId);
  const entry = sessionViews[sessionId];
  if (entry && entry.opened) {
    entry.terminal.write(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
    entry.started = false;
  }
  renderSidebar();
});

window.addEventListener('resize', debounce(() => fitAllVisible(), 50));

// Modal
function openModal(mode, groupIndex) {
  modalMode = mode;
  modalGroupIndex = groupIndex;
  if (mode === 'session') {
    modalTitle.textContent = 'New Session';
    modalDirGroup.style.display = 'block';
    modalFieldDir.required = true;
  } else {
    modalTitle.textContent = 'New Group';
    modalDirGroup.style.display = 'none';
    modalFieldDir.required = false;
  }
  modalFieldName.value = '';
  modalFieldDir.value = '';
  modalOverlay.classList.add('visible');
  modalFieldName.focus();
}

function closeModal() {
  modalOverlay.classList.remove('visible');
  modalMode = null;
  modalGroupIndex = null;
}

modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

modalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = modalFieldName.value.trim();
  if (modalMode === 'group') {
    workspace = await api.createGroup(name);
    renderSidebar();
  } else if (modalMode === 'session') {
    const dir = modalFieldDir.value.trim();
    workspace = await api.createSession(modalGroupIndex, name, dir);
    renderSidebar();
  }
  closeModal();
});

btnBrowseDir.addEventListener('click', async () => {
  const dir = await api.selectFolder();
  if (dir) modalFieldDir.value = dir;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close topmost visible modal
    if (alertOverlay.classList.contains('visible')) {
      alertOverlay.classList.remove('visible');
      // Resolve confirm as false if pending
      const noBtn = document.getElementById('confirmNo');
      if (noBtn) noBtn.click();
      else { const okBtn = document.getElementById('alertOk'); if (okBtn) okBtn.click(); }
    } else if (renameOverlay.classList.contains('visible')) {
      closeRenameModal();
    } else if (settingsOverlay.classList.contains('visible')) {
      closeSettings();
    } else if (helpOverlay.classList.contains('visible')) {
      helpOverlay.classList.remove('visible');
    } else if (aboutOverlay.classList.contains('visible')) {
      aboutOverlay.classList.remove('visible');
    } else if (modalOverlay.classList.contains('visible')) {
      closeModal();
    }
  }
  const digit = e.key >= '0' && e.key <= '9' ? e.key : null;
  if (digit) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault(); saveKeybindingGroup(digit);
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault(); recallKeybindingGroup(digit);
    }
  }
});

btnNewGroup.addEventListener('click', () => openModal('group'));

// Sidebar resize
const sidebarResizer = document.getElementById('sidebarResizer');
const sidebar = document.getElementById('sidebar');
let isResizing = false;

sidebarResizer.addEventListener('mousedown', (e) => {
  isResizing = true; sidebarResizer.classList.add('active');
  document.body.style.cursor = 'col-resize'; e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  sidebar.style.width = Math.max(140, Math.min(400, e.clientX)) + 'px';
});
document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false; sidebarResizer.classList.remove('active'); document.body.style.cursor = '';
    api.updateSettings({ sidebarWidth: parseInt(sidebar.style.width) });
  }
});

// Custom alert/confirm
const alertOverlay = document.getElementById('alertOverlay');
const alertMessage = document.getElementById('alertMessage');
const alertButtons = document.getElementById('alertButtons');

function showAlert(message) {
  return new Promise(resolve => {
    alertMessage.textContent = message;
    alertButtons.innerHTML = '<button class="btn btn-primary" id="alertOk">OK</button>';
    alertOverlay.classList.add('visible');
    document.getElementById('alertOk').addEventListener('click', () => {
      alertOverlay.classList.remove('visible');
      resolve();
    });
  });
}

function showConfirm(message) {
  return new Promise(resolve => {
    alertMessage.textContent = message;
    alertButtons.innerHTML = `
      <button class="btn btn-cancel" id="confirmNo">Cancel</button>
      <button class="btn btn-primary" id="confirmYes">OK</button>
    `;
    alertOverlay.classList.add('visible');
    document.getElementById('confirmNo').addEventListener('click', () => {
      alertOverlay.classList.remove('visible');
      resolve(false);
    });
    document.getElementById('confirmYes').addEventListener('click', () => {
      alertOverlay.classList.remove('visible');
      resolve(true);
    });
  });
}

// Rename modal
const renameOverlay = document.getElementById('renameOverlay');
const renameForm = document.getElementById('renameForm');
const renameField = document.getElementById('renameField');
let renameTargetSession = null;

function openRenameModal(session) {
  renameTargetSession = session;
  renameField.value = session.name;
  renameOverlay.classList.add('visible');
  renameField.focus();
  renameField.select();
}

function closeRenameModal() {
  renameOverlay.classList.remove('visible');
  renameTargetSession = null;
}

document.getElementById('renameCancel').addEventListener('click', closeRenameModal);
renameOverlay.addEventListener('click', (e) => { if (e.target === renameOverlay) closeRenameModal(); });

renameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!renameTargetSession) return;
  const newName = renameField.value.trim();
  if (newName) {
    workspace = await api.renameSession(renameTargetSession.id, newName);
    const entry = sessionViews[renameTargetSession.id];
    if (entry) {
      entry.element.querySelector('.session-header-title').textContent = newName;
      entry.session.name = newName;
    }
    renderSidebar();
  }
  closeRenameModal();
});

// Settings UI
const btnSettings = document.getElementById('btnSettings');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsFont = document.getElementById('settingsFont');
const settingsFontSize = document.getElementById('settingsFontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
const fontPreviewBody = document.getElementById('fontPreviewBody');
const settingsCancel = document.getElementById('settingsCancel');
const settingsApply = document.getElementById('settingsApply');
const settingsTheme = document.getElementById('settingsTheme');

let pendingSettings = null;

function openSettings() {
  pendingSettings = { ...currentSettings };
  settingsFont.value = pendingSettings.fontFamily;
  settingsFontSize.value = pendingSettings.fontSize;
  fontSizeValue.textContent = pendingSettings.fontSize + 'px';
  settingsTheme.value = pendingSettings.theme || 'dark';
  updateFontPreview();
  settingsOverlay.classList.add('visible');
}

function closeSettings() { settingsOverlay.classList.remove('visible'); pendingSettings = null; }

function updateFontPreview() {
  if (!pendingSettings) return;
  fontPreviewBody.style.fontFamily = `'${pendingSettings.fontFamily}', monospace`;
  fontPreviewBody.style.fontSize = pendingSettings.fontSize + 'px';
}

function applySettingsToAllTerminals() {
  Object.values(sessionViews).forEach(entry => {
    entry.terminal.options.fontFamily = `'${currentSettings.fontFamily}', monospace`;
    entry.terminal.options.fontSize = currentSettings.fontSize;
    if (entry.opened) fitTerminal(entry);
  });
}

btnSettings.addEventListener('click', openSettings);
settingsFont.addEventListener('change', () => { pendingSettings.fontFamily = settingsFont.value; updateFontPreview(); });
settingsFontSize.addEventListener('input', () => {
  pendingSettings.fontSize = parseInt(settingsFontSize.value);
  fontSizeValue.textContent = pendingSettings.fontSize + 'px';
  updateFontPreview();
});
settingsTheme.addEventListener('change', () => { pendingSettings.theme = settingsTheme.value; });
settingsCancel.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });

settingsApply.addEventListener('click', () => {
  currentSettings = { ...pendingSettings };
  api.updateSettings(currentSettings);
  applyCssFont();
  applyTheme();
  applyThemeToAllTerminals();
  applySettingsToAllTerminals();
  closeSettings();
});

// Help & About
const helpOverlay = document.getElementById('helpOverlay');
const aboutOverlay = document.getElementById('aboutOverlay');
const { shell } = require('electron');

document.getElementById('btnHelp').addEventListener('click', () => {
  document.getElementById('helpTableBody').innerHTML = `
    <tr><td class="help-desc">Open session (closes others)</td><td class="help-key">Click</td></tr>
    <tr><td class="help-desc">Add session to workspace</td><td class="help-key">${mod()} + Click</td></tr>
    <tr><td class="help-desc">Hide active session from workspace</td><td class="help-key">${mod()} + F4</td></tr>
    <tr><td class="help-desc">Save current layout to slot</td><td class="help-key">${mod()} + 0-9</td></tr>
    <tr><td class="help-desc">Recall saved layout</td><td class="help-key">${opt()} + 0-9</td></tr>
    <tr><td class="help-desc">Copy terminal selection</td><td class="help-key">${mod()} + C, &nbsp;${mod()} + Insert, &nbsp;Enter</td></tr>
    <tr><td class="help-desc">Close application</td><td class="help-key">${opt()} + F4</td></tr>
  `;
  helpOverlay.classList.add('visible');
});
document.getElementById('helpClose').addEventListener('click', () => { helpOverlay.classList.remove('visible'); });
helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) helpOverlay.classList.remove('visible'); });

document.getElementById('btnAbout').addEventListener('click', () => { aboutOverlay.classList.add('visible'); });
document.getElementById('aboutClose').addEventListener('click', () => { aboutOverlay.classList.remove('visible'); });
aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) aboutOverlay.classList.remove('visible'); });
document.getElementById('aboutGithub').addEventListener('click', (e) => {
  e.preventDefault(); shell.openExternal('https://github.com/nyan-cat/claude-workspace');
});

// Utils
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
