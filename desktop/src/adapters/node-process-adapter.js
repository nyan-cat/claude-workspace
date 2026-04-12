const { EventEmitter } = require('events');
const pty = require('node-pty');

/**
 * Adapter that runs Claude Code via node-pty (ConPTY on Windows).
 * New sessions: --session-id <uuid>
 * Existing sessions: --resume <uuid>
 */
class NodeProcessAdapter extends EventEmitter {
  constructor(workingDirectory, sessionId, resume) {
    super();
    this.workingDirectory = workingDirectory;
    this.sessionId = sessionId;
    this.resume = resume;
    this.ptyProcess = null;
  }

  start(cols = 120, rows = 30) {
    const claudeArgs = this.resume
      ? `claude --resume ${this.sessionId}`
      : `claude --session-id ${this.sessionId}`;
    const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
    const args = process.platform === 'win32' ? ['/c', claudeArgs] : ['-c', claudeArgs];

    this.ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: this.workingDirectory,
      env: { ...process.env, TERM: 'xterm-256color' },
      useConpty: true,
    });

    this.ptyProcess.onData((data) => {
      this.emit('data', data);
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.ptyProcess = null;
      this.emit('exit', exitCode);
    });
  }

  stop() {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }

  write(data) {
    if (this.ptyProcess) {
      this.ptyProcess.write(data);
    }
  }

  resize(cols, rows) {
    if (this.ptyProcess) {
      try { this.ptyProcess.resize(cols, rows); } catch (e) {}
    }
  }

  isRunning() {
    return this.ptyProcess !== null;
  }
}

module.exports = { NodeProcessAdapter };
