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
  moveGroup: (from, to) => ipcRenderer.invoke('group:move', from, to),
  moveSession: (id, toGroup, toPos) => ipcRenderer.invoke('session:move', id, toGroup, toPos),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  onSessionData: (cb) => ipcRenderer.on('session:data', (e, id, data) => cb(id, data)),
  onSessionExit: (cb) => ipcRenderer.on('session:exit', (e, id, code) => cb(id, code)),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (s) => ipcRenderer.invoke('settings:update', s),
  getLayouts: () => ipcRenderer.invoke('layouts:get'),
  setLayout: (key, ids) => ipcRenderer.invoke('layouts:set', key, ids),
  // Multi-monitor
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  getWindowBounds: () => ipcRenderer.invoke('window:getBounds'),
  getContentBounds: () => ipcRenderer.invoke('window:getContentBounds'),
  spanAllMonitors: () => ipcRenderer.invoke('window:spanAllMonitors'),
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
      black: '#1a1a18', red: '#b82020', green: '#1a7a35', yellow: '#7a6a00',
      blue: '#1a55a0', magenta: '#7a3a9f', cyan: '#0a7a70', white: '#4a4a45',
      brightBlack: '#6a6a65', brightRed: '#d03030', brightGreen: '#2a8a45', brightYellow: '#8a7a10',
      brightBlue: '#2a65b0', brightMagenta: '#8a4aaf', brightCyan: '#1a8a80', brightWhite: '#2a2a25',
    },
    bgFocusedXterm: '#fafaf7',
  },
  matrix: {
    bgPrimary: '#000000', bgSecondary: '#0a0a0a', bgTertiary: '#0f1a0f',
    bgHover: '#0a2a0a', bgActive: '#0a3a0a', bgFocused: '#020802',
    textPrimary: '#00ff41', textSecondary: '#00aa2a', textDim: '#005a15',
    accent: '#00ff41', accentHover: '#33ff66', accentDim: '#00ff4118',
    danger: '#ff3030', success: '#00ff41', border: '#0a2a0a',
    titleBarColor: '#0a0a0a', titleBarSymbol: '#00aa2a',
    xterm: {
      background: '#000000', foreground: '#00ff41', cursor: '#00ff41', cursorAccent: '#000000',
      selectionBackground: '#00ff41', selectionForeground: '#000000',
      black: '#000000', red: '#ff3030', green: '#00ff41', yellow: '#ccff00',
      blue: '#00aaff', magenta: '#aa00ff', cyan: '#00ffaa', white: '#00ff41',
      brightBlack: '#005a15', brightRed: '#ff5050', brightGreen: '#33ff66', brightYellow: '#ddff33',
      brightBlue: '#33bbff', brightMagenta: '#bb33ff', brightCyan: '#33ffbb', brightWhite: '#aaffaa',
    },
    bgFocusedXterm: '#020802',
  },
};

function applyTheme() {
  const t = THEMES[currentSettings.theme] || THEMES.dark;
  document.documentElement.dataset.theme = currentSettings.theme;
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
  updateMatrixRain();
}

// Matrix rain animation
let matrixAnimId = null;

function startMatrixRain() {
  if (matrixAnimId) return;
  const canvas = document.getElementById('matrixCanvas');
  if (!canvas) return;

  // Wait for Matrix font to load before starting
  document.fonts.load("16px 'Matrix Code NFI'").then(() => {
    _startMatrixRainInner(canvas);
  });
}

function _startMatrixRainInner(canvas) {
  if (matrixAnimId) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.add('active');

  const ctx = canvas.getContext('2d');
  const charSet = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFZ';
  const fontSize = 16;
  let cols = Math.floor(canvas.width / fontSize);
  let rows = Math.floor(canvas.height / fontSize);

  // Grid of fixed characters — each cell has a char that only changes occasionally
  let grid = [];
  // Each column has one or more "streams" — a wave of brightness moving down
  let streams = [];

  function initGrid() {
    cols = Math.floor(canvas.width / fontSize);
    rows = Math.floor(canvas.height / fontSize);
    grid = [];
    for (let c = 0; c < cols; c++) {
      grid[c] = [];
      for (let r = 0; r < rows; r++) {
        grid[c][r] = charSet[Math.floor(Math.random() * charSet.length)];
      }
    }
  }

  function initStreams() {
    streams = [];
    for (let c = 0; c < cols; c++) {
      // 1-2 streams per column
      const count = 1 + (Math.random() > 0.7 ? 1 : 0);
      for (let s = 0; s < count; s++) {
        streams.push({
          col: c,
          head: Math.random() * -rows * 2,
          speed: 0.24 + Math.random() * 0.32,
          length: 15 + Math.floor(Math.random() * 30),
          brightness: 0.15 + Math.random() * 0.85, // 0.15..1.0
        });
      }
    }
  }

  initGrid();
  initStreams();

  const onResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initGrid();
    initStreams();
  };
  window.addEventListener('resize', onResize);
  canvas._onResize = onResize;

  let frame = 0;
  function draw() {
    frame++;
    if (frame % 3 !== 0) { matrixAnimId = requestAnimationFrame(draw); return; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontSize + "px 'Matrix Code NFI', monospace";
    ctx.shadowColor = 'none';
    ctx.shadowBlur = 0;

    // Occasionally mutate random grid cells (flickering effect)
    const mutations = Math.floor(cols * rows * 0.002);
    for (let m = 0; m < mutations; m++) {
      const c = Math.floor(Math.random() * cols);
      const r = Math.floor(Math.random() * rows);
      grid[c][r] = charSet[Math.floor(Math.random() * charSet.length)];
    }

    // Collect all visible chars with their alpha
    const visibleChars = [];
    for (const stream of streams) {
      const headRow = Math.floor(stream.head);
      const headFade = stream.head - headRow;
      const b = stream.brightness;

      for (let t = 0; t < stream.length; t++) {
        const row = headRow - t;
        if (row < 0 || row >= rows) continue;

        const char = grid[stream.col][row];
        const x = stream.col * fontSize;
        const y = (row + 1) * fontSize;

        let r = 0, g = 255, bl = 65, a = 0;
        if (t === 0) {
          r = 180; g = 255; bl = 180;
          a = Math.min(1, headFade * 5) * 0.22 * b;
        } else if (t === 1) {
          r = 180; g = 255; bl = 180;
          a = 0.22 * b;
        } else if (t < 4) {
          a = 0.16 * b;
        } else {
          const fade = 1 - t / stream.length;
          a = Math.max(0.003, 0.1 * b * fade * fade);
        }

        if (a > 0.003) visibleChars.push({ char, x, y, r, g, bl, a });
      }

      const prevHead = Math.floor(stream.head);
      stream.head += stream.speed;
      const newHead = Math.floor(stream.head);

      // Only assign new random char when head moves to a new row
      if (newHead > prevHead && newHead >= 0 && newHead < rows) {
        grid[stream.col][newHead] = charSet[Math.floor(Math.random() * charSet.length)];
      }

      // Reset when fully off screen
      if (headRow - stream.length > rows) {
        stream.head = Math.random() * -rows;
        stream.speed = 0.3 + Math.random() * 0.4;
        stream.length = 15 + Math.floor(Math.random() * 30);
        stream.brightness = 0.4 + Math.random() * 0.6;
      }
    }

    // Pass 1: glow — larger, semi-transparent characters offset slightly as soft halo
    const glowSize = fontSize + 6;
    ctx.font = glowSize + "px 'Matrix Code NFI', monospace";
    for (const c of visibleChars) {
      const ga = c.a * 0.3;
      if (ga < 0.005) continue;
      ctx.fillStyle = `rgba(0, 255, 65, ${ga})`;
      ctx.fillText(c.char, c.x - 3, c.y + 1);
    }
    // Pass 1b: second glow layer even larger
    const glowSize2 = fontSize + 12;
    ctx.font = glowSize2 + "px 'Matrix Code NFI', monospace";
    for (const c of visibleChars) {
      const ga = c.a * 0.12;
      if (ga < 0.003) continue;
      ctx.fillStyle = `rgba(0, 255, 65, ${ga})`;
      ctx.fillText(c.char, c.x - 6, c.y + 2);
    }

    // Pass 2: sharp characters
    ctx.font = fontSize + "px 'Matrix Code NFI', monospace";
    for (const c of visibleChars) {
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.bl}, ${c.a})`;
      ctx.fillText(c.char, c.x, c.y);
    }

    matrixAnimId = requestAnimationFrame(draw);
  }

  draw();
}

function stopMatrixRain() {
  const canvas = document.getElementById('matrixCanvas');
  if (canvas) {
    canvas.classList.remove('active');
    if (canvas._onResize) { window.removeEventListener('resize', canvas._onResize); canvas._onResize = null; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (matrixAnimId) { cancelAnimationFrame(matrixAnimId); matrixAnimId = null; }
}

function updateMatrixRain() {
  if (currentSettings.theme === 'matrix') startMatrixRain();
  else stopMatrixRain();
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
  setActiveSession(valid[0]);
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
  document.getElementById('iconSpanMonitors').innerHTML = icons.maximize;
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

    // Group drag-and-drop
    groupEl.draggable = true;
    groupEl.dataset.groupIndex = gi;
    groupEl.addEventListener('dragstart', (e) => {
      if (e.target !== groupEl) return;
      e.dataTransfer.setData('type', 'group');
      e.dataTransfer.setData('groupIndex', gi);
      groupEl.classList.add('dragging');
    });
    groupEl.addEventListener('dragend', () => groupEl.classList.remove('dragging'));
    groupEl.addEventListener('dragover', (e) => {
      const type = e.dataTransfer.types.includes('type') ? 'ok' : null;
      if (type) { e.preventDefault(); groupEl.classList.add('drag-over'); }
    });
    groupEl.addEventListener('dragleave', () => groupEl.classList.remove('drag-over'));
    groupEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      groupEl.classList.remove('drag-over');
      const type = e.dataTransfer.getData('type');
      if (type === 'group') {
        const fromIndex = parseInt(e.dataTransfer.getData('groupIndex'));
        if (fromIndex !== gi) {
          workspace = await api.moveGroup(fromIndex, gi);
          renderSidebar();
        }
      } else if (type === 'session') {
        const sessionId = e.dataTransfer.getData('sessionId');
        workspace = await api.moveSession(sessionId, gi, 0);
        renderSidebar();
      }
    });

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

    group.sessions.forEach((session, si) => {
      const item = document.createElement('div');
      item.className = 'session-item' + (session.id === activeSessionId ? ' active' : '');

      // Session drag-and-drop
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('type', 'session');
        e.dataTransfer.setData('sessionId', session.id);
        e.dataTransfer.setData('fromGroup', gi);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('type')) {
          e.preventDefault();
          e.stopPropagation();
          item.classList.add('drag-over');
        }
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('drag-over');
        const type = e.dataTransfer.getData('type');
        if (type === 'session') {
          const sessionId = e.dataTransfer.getData('sessionId');
          if (sessionId !== session.id) {
            workspace = await api.moveSession(sessionId, gi, si);
            renderSidebar();
          }
        }
      });

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
          <button class="session-btn open-dir" title="Open working directory">${icons.folder}</button>
          <button class="session-btn rename" title="Edit">${icons.pencil}</button>
          <button class="session-btn stop ${isRunning ? 'active' : 'inactive'}" title="${isRunning ? 'Stop' : 'Not running'}">${icons.circleStop}</button>
          <button class="session-btn delete" title="Delete session">${icons.trash2}</button>
        </span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.session-btn')) return;
        if (e.ctrlKey || e.metaKey) addSessionToWorkspace(session);
        else showSingleSession(session);
      });

      item.querySelector('.session-btn.open-dir').addEventListener('click', (e) => {
        e.stopPropagation();
        require('child_process').exec(`start "" explorer "${session.working_directory.replace(/\//g, '\\')}"`);
      });

      item.querySelector('.session-btn.rename').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(session);
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
  renderTabs();
}

// Workspace tabs — show all running sessions
const workspaceTabs = document.getElementById('workspaceTabs');

function renderTabs() {
  // Collect all running sessions
  const runningSessions = [];
  for (const group of workspace.groups) {
    for (const session of group.sessions) {
      if (runningIds.has(session.id)) runningSessions.push(session);
    }
  }

  if (runningSessions.length === 0) {
    workspaceTabs.classList.remove('visible');
    workspaceTabs.innerHTML = '';
    return;
  }

  workspaceTabs.classList.add('visible');
  workspaceTabs.innerHTML = '';

  runningSessions.forEach(session => {
    const isVisible = visibleSessionIds.has(session.id);
    const isActive = session.id === activeSessionId;

    let statusClass = '';
    if (isVisible) statusClass = 'running-visible';
    else statusClass = 'running-hidden';

    const tab = document.createElement('div');
    tab.className = 'workspace-tab' + (isActive ? ' active' : '');
    tab.innerHTML = `
      <span class="tab-status ${statusClass}"></span>
      <span class="tab-name">${escHtml(session.name)}</span>
    `;

    tab.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        addSessionToWorkspace(session);
      } else {
        showSingleSession(session);
      }
    });

    workspaceTabs.appendChild(tab);
  });
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

function cycleFocus(direction) {
  const ids = [...visibleSessionIds];
  if (ids.length <= 1) return;
  const idx = ids.indexOf(activeSessionId);
  const next = (idx + direction + ids.length) % ids.length;
  setActiveSession(ids[next]);
}

function hideActiveSession() {
  if (!activeSessionId || !visibleSessionIds.has(activeSessionId)) return;
  visibleSessionIds.delete(activeSessionId);
  activeSessionId = visibleSessionIds.size > 0 ? [...visibleSessionIds][0] : null;
  renderSidebar();
  updateWorkspaceLayout();
}

let lastVisibleKey = '';

// Calculate grid columns that align sessions to monitor boundaries
async function calcGridColumns(count) {
  if (count <= 1) return '1fr';
  try {
    const displays = await api.getDisplays();
    if (displays.length <= 1) return `repeat(${count}, 1fr)`;

    const contentBounds = await api.getContentBounds();
    // Grid starts after sidebar
    const sidebarW = parseInt(sidebar.style.width) || parseInt(getComputedStyle(sidebar).width) || 230;
    const gridLeft = contentBounds.x + sidebarW;
    const gridRight = contentBounds.x + contentBounds.width;
    const gridWidth = gridRight - gridLeft;

    // Find monitor boundaries within our grid area
    const monitorEdges = [0]; // relative to grid left
    for (const d of displays) {
      const edge = d.bounds.x + d.bounds.width - gridLeft;
      if (edge > 0 && edge < gridWidth) {
        monitorEdges.push(edge);
      }
    }
    monitorEdges.push(gridWidth);
    monitorEdges.sort((a, b) => a - b);

    // Deduplicate edges that are too close
    const zones = [];
    for (let i = 0; i < monitorEdges.length - 1; i++) {
      const w = monitorEdges[i + 1] - monitorEdges[i];
      if (w > 50) zones.push(w);
    }

    if (zones.length < 2 || zones.length > count) return `repeat(${count}, 1fr)`;

    // Distribute sessions across zones proportionally
    const sessionsPerZone = [];
    let remaining = count;
    const totalWidth = zones.reduce((a, b) => a + b, 0);
    for (let i = 0; i < zones.length; i++) {
      if (i === zones.length - 1) {
        sessionsPerZone.push(remaining);
      } else {
        const share = Math.max(1, Math.round(count * zones[i] / totalWidth));
        sessionsPerZone.push(Math.min(share, remaining));
        remaining -= sessionsPerZone[i];
      }
    }

    // Build column widths: each session in a zone gets equal share of that zone's width
    const cols = [];
    for (let z = 0; z < zones.length; z++) {
      const n = sessionsPerZone[z];
      const colW = zones[z] / n;
      for (let i = 0; i < n; i++) cols.push(Math.round(colW) + 'px');
    }
    return cols.join(' ');
  } catch {
    return `repeat(${count}, 1fr)`;
  }
}

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
    workspaceGrid.style.gridTemplateRows = '1fr';

    // Set columns — async but apply immediately with fallback
    workspaceGrid.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
    calcGridColumns(count).then(cols => {
      workspaceGrid.style.gridTemplateColumns = cols;
    });

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
      <button class="session-header-close" title="Hide from workspace">${icons.x}</button>
    </div>
    <div class="terminal-container">
      <div class="starting-overlay">Starting...</div>
    </div>
  `;

  // Workspace column drag-and-drop via header bar
  const headerBar = view.querySelector('.session-header-bar');
  headerBar.draggable = true;
  headerBar.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('type', 'workspace-column');
    e.dataTransfer.setData('sessionId', session.id);
    view.classList.add('dragging');
  });
  headerBar.addEventListener('dragend', () => view.classList.remove('dragging'));
  view.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('type')) {
      e.preventDefault();
      view.classList.add('drag-over');
    }
  });
  view.addEventListener('dragleave', () => view.classList.remove('drag-over'));
  view.addEventListener('drop', (e) => {
    e.preventDefault();
    view.classList.remove('drag-over');
    const type = e.dataTransfer.getData('type');
    if (type === 'workspace-column') {
      const fromId = e.dataTransfer.getData('sessionId');
      if (fromId !== session.id) {
        // Reorder visibleSessionIds
        const ids = [...visibleSessionIds];
        const fromIdx = ids.indexOf(fromId);
        const toIdx = ids.indexOf(session.id);
        if (fromIdx !== -1 && toIdx !== -1) {
          ids.splice(fromIdx, 1);
          ids.splice(toIdx, 0, fromId);
          visibleSessionIds = new Set(ids);
          lastVisibleKey = ''; // force rebuild
          updateWorkspaceLayout();
          renderSidebar();
        }
      }
    }
  });

  view.querySelector('.session-header-close').addEventListener('click', () => {
    visibleSessionIds.delete(session.id);
    if (activeSessionId === session.id) {
      activeSessionId = visibleSessionIds.size > 0 ? [...visibleSessionIds][0] : null;
    }
    renderSidebar();
    updateWorkspaceLayout();
    if (activeSessionId) setActiveSession(activeSessionId);
  });

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
    // Ctrl+Tab / Ctrl+Shift+Tab: cycle focus between visible sessions
    if (e.ctrlKey && e.key === 'Tab') {
      if (e.type === 'keydown') { e.preventDefault(); cycleFocus(e.shiftKey ? -1 : 1); }
      return false;
    }

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
      if ((e.ctrlKey && e.code === 'KeyC') || (e.ctrlKey && e.key === 'Insert') || e.key === 'Enter') {
        e.preventDefault();
        navigator.clipboard.writeText(terminal.getSelection());
        terminal.clearSelection();
        return false;
      }
    }
    // Paste: Ctrl+V, Shift+Insert
    if (e.type === 'keydown') {
      if (((e.ctrlKey || e.metaKey) && e.code === 'KeyV') || (e.shiftKey && e.key === 'Insert')) {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (text) api.writeToSession(session.id, text);
        });
        return false;
      }
    }
    return true;
  });

  // Right-click paste
  view.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    navigator.clipboard.readText().then(text => {
      if (text) api.writeToSession(session.id, text);
    });
  });

  // Ctrl+click links: URLs and file paths
  const urlRegex = /https?:\/\/[^\s)\]>"'`,]+/g;
  const unixPathRegex = /\/(?:home|usr|var|tmp|etc|opt|mnt|media)[/\w.-]+/g;

  function findWinPaths(text) {
    const startRegex = /(?<![a-zA-Z])[A-Z]:[/\\]/gi;
    const results = [];
    let m;
    while ((m = startRegex.exec(text)) !== null) {
      let end = m.index + m[0].length;
      let lastSepEnd = end;
      while (end < text.length) {
        const ch = text[end];
        if (':*?"<>|\n\r\t,;'.includes(ch)) break;
        if (ch === '\\' || ch === '/') lastSepEnd = end + 1;
        end++;
      }
      let finalSeg = text.slice(lastSepEnd, end);
      finalSeg = finalSeg.replace(/[\s.,:;!?)\]}>'"]+$/, '');
      const extMatch = finalSeg.match(/^(.+\.\w{1,10})\b/);
      if (extMatch) {
        finalSeg = extMatch[1];
      } else {
        const spaceIdx = finalSeg.indexOf(' ');
        if (spaceIdx >= 0) finalSeg = finalSeg.slice(0, spaceIdx);
      }
      finalSeg = finalSeg.replace(/[\s.,:;!?)\]}>'"]+$/, '');
      const fullPath = text.slice(m.index, lastSepEnd) + finalSeg;
      if (fullPath.length > 3) {
        results.push({ index: m.index, text: fullPath });
        startRegex.lastIndex = m.index + fullPath.length;
      }
    }
    return results;
  }

  function openLink(type, linkText) {
    if (type === 'url') {
      require('electron').shell.openExternal(linkText);
    } else {
      const fs = require('fs');
      const pathMod = require('path');
      let target = linkText.replace(/\//g, '\\');
      try {
        if (fs.existsSync(target) && fs.statSync(target).isFile()) {
          target = pathMod.dirname(target);
        }
      } catch {}
      require('child_process').exec(`explorer "${target}"`);
    }
  }

  terminal.registerLinkProvider({
    provideLinks(lineNumber, callback) {
      const line = terminal.buffer.active.getLine(lineNumber - 1);
      if (!line) return callback(undefined);
      const text = line.translateToString();
      const links = [];

      function addMatch(index, matchText, type) {
        links.push({
          range: {
            start: { x: index + 1, y: lineNumber },
            end: { x: index + matchText.length, y: lineNumber },
          },
          text: matchText,
          activate(e, lt) {
            if (!e.ctrlKey && !e.metaKey) return;
            openLink(type, lt);
          },
        });
      }

      urlRegex.lastIndex = 0;
      let um;
      while ((um = urlRegex.exec(text)) !== null) addMatch(um.index, um[0], 'url');

      for (const p of findWinPaths(text)) addMatch(p.index, p.text, 'path');

      unixPathRegex.lastIndex = 0;
      let upm;
      while ((upm = unixPathRegex.exec(text)) !== null) addMatch(upm.index, upm[0], 'path');

      callback(links.length > 0 ? links : undefined);
    },
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
      closeEditModal();
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

function openEditModal(session) {
  renameTargetSession = session;
  renameField.value = session.name;
  renameOverlay.classList.add('visible');
  renameField.focus();
  renameField.select();
}

function closeEditModal() {
  renameOverlay.classList.remove('visible');
  renameTargetSession = null;
}

document.getElementById('renameCancel').addEventListener('click', closeEditModal);
renameOverlay.addEventListener('click', (e) => { if (e.target === renameOverlay) closeEditModal(); });

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
  closeEditModal();
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

// Span all monitors button
document.getElementById('btnSpanMonitors').addEventListener('click', async () => {
  await api.spanAllMonitors();
  // Recalculate grid after window resize settles
  lastVisibleKey = '';
  setTimeout(() => updateWorkspaceLayout(), 300);
});

document.getElementById('btnHelp').addEventListener('click', () => {
  document.getElementById('helpTableBody').innerHTML = `
    <tr><td class="help-desc">Open session (closes others)</td><td class="help-key">Click</td></tr>
    <tr><td class="help-desc">Add session to workspace</td><td class="help-key">${mod()} + Click</td></tr>
    <tr><td class="help-desc">Hide active session from workspace</td><td class="help-key">${mod()} + F4</td></tr>
    <tr><td class="help-desc">Save current layout to slot</td><td class="help-key">${mod()} + 0-9</td></tr>
    <tr><td class="help-desc">Recall saved layout</td><td class="help-key">${opt()} + 0-9</td></tr>
    <tr><td class="help-desc">Copy terminal selection</td><td class="help-key">${mod()} + C, &nbsp;${mod()} + Insert, &nbsp;Enter</td></tr>
    <tr><td class="help-desc">Paste into terminal</td><td class="help-key">${mod()} + V, &nbsp;Shift + Insert, &nbsp;Right Click</td></tr>
    <tr><td class="help-desc">Newline without sending</td><td class="help-key">${opt()} + Enter</td></tr>
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
