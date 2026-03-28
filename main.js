const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SessionManager } = require('./src/session-manager');
const { WorkspaceStore } = require('./src/workspace-store');

// Single instance lock — prevent opening same workspace twice
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow;
let sessionManager;
let workspaceStore;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111a20',
      symbolColor: '#8a9aa3',
      height: 40,
    },
    backgroundColor: '#0c1115',
  });

  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  // In packaged app, store workspace.json next to the exe; in dev, next to main.js
  const appRoot = app.isPackaged
    ? path.dirname(process.execPath)
    : __dirname;
  const workspacePath = path.join(appRoot, 'workspace.json');
  workspaceStore = new WorkspaceStore(workspacePath);
  sessionManager = new SessionManager(workspaceStore);

  createWindow();

  // IPC handlers
  ipcMain.handle('workspace:get', () => {
    return workspaceStore.getData();
  });

  ipcMain.handle('session:start', (event, sessionId, cols, rows) => {
    const session = workspaceStore.findSession(sessionId);
    if (!session) return { error: 'Session not found' };
    sessionManager.startSession(session, cols, rows);
    return { ok: true };
  });

  ipcMain.handle('session:stop', (event, sessionId) => {
    sessionManager.stopSession(sessionId);
    return { ok: true };
  });

  ipcMain.handle('session:write', (event, sessionId, data) => {
    sessionManager.writeToSession(sessionId, data);
    return { ok: true };
  });

  ipcMain.handle('session:resize', (event, sessionId, cols, rows) => {
    sessionManager.resizeSession(sessionId, cols, rows);
    return { ok: true };
  });

  ipcMain.handle('session:isRunning', (event, sessionId) => {
    return sessionManager.isRunning(sessionId);
  });

  ipcMain.handle('session:getAllRunning', () => {
    return sessionManager.getAllRunningIds();
  });

  ipcMain.handle('group:create', (event, name) => {
    workspaceStore.addGroup(name);
    return workspaceStore.getData();
  });

  ipcMain.handle('group:delete', (event, groupIndex) => {
    workspaceStore.deleteGroup(groupIndex);
    return workspaceStore.getData();
  });

  ipcMain.handle('session:create', (event, groupIndex, name, workingDirectory) => {
    workspaceStore.addSession(groupIndex, name, workingDirectory);
    return workspaceStore.getData();
  });

  ipcMain.handle('session:delete', (event, sessionId) => {
    sessionManager.stopSession(sessionId);
    workspaceStore.deleteSession(sessionId);
    return workspaceStore.getData();
  });

  ipcMain.handle('session:rename', (event, sessionId, newName) => {
    workspaceStore.renameSession(sessionId, newName);
    return workspaceStore.getData();
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('app:platform', () => {
    return process.platform;
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return workspaceStore.getSettings();
  });

  ipcMain.handle('settings:update', (event, settings) => {
    workspaceStore.updateSettings(settings);
    return workspaceStore.getSettings();
  });

  // Layouts
  ipcMain.handle('layouts:get', () => {
    return workspaceStore.getLayouts();
  });

  ipcMain.handle('layouts:set', (event, key, sessionIds) => {
    workspaceStore.setLayout(key, sessionIds);
    return workspaceStore.getLayouts();
  });

  // Forward session data to renderer
  sessionManager.on('data', (sessionId, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:data', sessionId, data);
    }
  });

  sessionManager.on('exit', (sessionId, code) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:exit', sessionId, code);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (sessionManager) sessionManager.stopAll();
});
