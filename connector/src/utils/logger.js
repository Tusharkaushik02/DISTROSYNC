const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = null;
    this.logFile = null;
  }

  init(storageDir) {
    try {
      this.logDir = path.join(storageDir, 'logs');
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this.logFile = path.join(this.logDir, 'connector.log');
    } catch (err) {
      console.error('Failed to initialize file logger:', err.message);
    }
  }

  format(level, message, meta) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  write(level, message, meta) {
    const formatted = this.format(level, message, meta);
    console.log(formatted);

    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, formatted + '\n', 'utf8');
      } catch (err) {
        // Suppress file write errors to avoid crashing logger
      }
    }
  }

  info(message, meta) {
    this.write('INFO', message, meta);
  }

  warn(message, meta) {
    this.write('WARN', message, meta);
  }

  error(message, meta) {
    this.write('ERROR', message, meta);
  }

  debug(message, meta) {
    if (process.env.DEBUG) {
      this.write('DEBUG', message, meta);
    }
  }
}

const logger = new Logger();
module.exports = logger;
