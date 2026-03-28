const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WorkspaceStore {
  constructor(filePath) {
    this.filePath = filePath;
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
      this.data = JSON.parse(raw);
    } else {
      this.data = {
        name: 'My Workspace',
        groups: [],
      };
      this.save();
    }
    if (!this.data.settings) this.data.settings = {};
    if (!this.data.layouts) this.data.layouts = {};
  }

  getData() {
    return structuredClone(this.data);
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 4), 'utf-8');
  }

  getSessionsDirectory() {
    const dir = this.data.sessions_directory || 'sessions';
    if (path.isAbsolute(dir)) return dir;
    return path.join(path.dirname(this.filePath), dir);
  }

  findSession(sessionId) {
    for (const group of this.data.groups) {
      for (const session of group.sessions) {
        if (session.id === sessionId) return session;
      }
    }
    return null;
  }

  addGroup(name) {
    this.data.groups.push({ name, sessions: [] });
    this.save();
  }

  deleteGroup(groupIndex) {
    if (groupIndex < 0 || groupIndex >= this.data.groups.length) return;
    const group = this.data.groups[groupIndex];
    if (group.sessions.length > 0) return;
    this.data.groups.splice(groupIndex, 1);
    this.save();
  }

  addSession(groupIndex, name, workingDirectory) {
    if (groupIndex < 0 || groupIndex >= this.data.groups.length) return null;
    const session = {
      id: crypto.randomUUID(),
      name,
      working_directory: workingDirectory,
    };
    this.data.groups[groupIndex].sessions.push(session);
    this.save();
    return session;
  }

  renameSession(sessionId, newName) {
    const session = this.findSession(sessionId);
    if (session) {
      session.name = newName;
      this.save();
    }
  }

  deleteSession(sessionId) {
    for (const group of this.data.groups) {
      const idx = group.sessions.findIndex(s => s.id === sessionId);
      if (idx !== -1) {
        group.sessions.splice(idx, 1);
        this.save();
        return true;
      }
    }
    return false;
  }

  // Settings
  getSettings() {
    return { ...this.data.settings };
  }

  updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }

  // Check if a Claude session file exists on disk
  claudeSessionExists(sessionId, workingDirectory) {
    const homedir = require('os').homedir();
    // Claude encodes the path: C:\foo\bar -> C--foo-bar, D:\foo\bar -> D--foo-bar
    const encoded = workingDirectory
      .replace(/\\/g, '/')
      .replace(/\/$/, '')
      .replace(/:/g, '-')
      .replace(/\//g, '-');
    const sessionFile = path.join(homedir, '.claude', 'projects', encoded, `${sessionId}.jsonl`);
    return fs.existsSync(sessionFile);
  }

  deleteClaudeSession(sessionId, workingDirectory) {
    const homedir = require('os').homedir();
    const encoded = workingDirectory
      .replace(/\\/g, '/')
      .replace(/\/$/, '')
      .replace(/:/g, '-')
      .replace(/\//g, '-');
    const sessionFile = path.join(homedir, '.claude', 'projects', encoded, `${sessionId}.jsonl`);
    try { fs.unlinkSync(sessionFile); } catch {}
  }

  // Layouts (keybinding groups)
  getLayouts() {
    return { ...this.data.layouts };
  }

  setLayout(key, sessionIds) {
    this.data.layouts[key] = sessionIds;
    this.save();
  }
}

module.exports = { WorkspaceStore };
