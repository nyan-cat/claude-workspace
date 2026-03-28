const { EventEmitter } = require('events');
const { NodeProcessAdapter } = require('./adapters/node-process-adapter');

class SessionManager extends EventEmitter {
  constructor(workspaceStore) {
    super();
    this.workspaceStore = workspaceStore;
    this.adapters = new Map();
  }

  startSession(sessionInfo, cols, rows) {
    const { id, working_directory } = sessionInfo;

    if (this.adapters.has(id) && this.adapters.get(id).isRunning()) {
      return;
    }

    const resume = this.workspaceStore.claudeSessionExists(id, working_directory);
    const adapter = new NodeProcessAdapter(working_directory, id, resume);

    adapter.on('data', (data) => {
      this.emit('data', id, data);
    });

    adapter.on('exit', (code) => {
      this.adapters.delete(id);
      this.emit('exit', id, code);
    });

    adapter.start(cols, rows);
    this.adapters.set(id, adapter);
  }

  stopSession(sessionId) {
    const adapter = this.adapters.get(sessionId);
    if (adapter) {
      adapter.stop();
      this.adapters.delete(sessionId);
    }
  }

  writeToSession(sessionId, data) {
    const adapter = this.adapters.get(sessionId);
    if (adapter && adapter.isRunning()) {
      adapter.write(data);
    }
  }

  resizeSession(sessionId, cols, rows) {
    const adapter = this.adapters.get(sessionId);
    if (adapter && adapter.isRunning()) {
      adapter.resize(cols, rows);
    }
  }

  isRunning(sessionId) {
    const adapter = this.adapters.get(sessionId);
    return adapter ? adapter.isRunning() : false;
  }

  getAllRunningIds() {
    return Array.from(this.adapters.keys()).filter(id => this.adapters.get(id).isRunning());
  }

  stopAll() {
    for (const [id, adapter] of this.adapters) {
      adapter.stop();
    }
    this.adapters.clear();
  }
}

module.exports = { SessionManager };
