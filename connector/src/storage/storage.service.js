const fs = require('fs');
const path = require('path');
const os = require('os');

class StorageService {
  constructor() {
    this.baseDir = this.resolveDataDirectory();
    this.configFile = path.join(this.baseDir, 'config.json');
    this.ensureDirectory();
  }

  resolveDataDirectory() {
    // On Windows, prefer %APPDATA%/DistroSync
    if (process.platform === 'win32' && process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'DistroSync');
    }
    // Cross-platform fallback: ~/.distrosync
    return path.join(os.homedir(), '.distrosync');
  }

  ensureDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getBaseDir() {
    return this.baseDir;
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error(`[Storage] Failed to read ${this.configFile}:`, err.message);
    }
    return {};
  }

  saveConfig(data) {
    try {
      this.ensureDirectory();
      const current = this.loadConfig();
      const updated = { ...current, ...data, updatedAt: new Date().toISOString() };
      fs.writeFileSync(this.configFile, JSON.stringify(updated, null, 2), 'utf8');
      return updated;
    } catch (err) {
      console.error(`[Storage] Failed to save ${this.configFile}:`, err.message);
      throw err;
    }
  }

  clearConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
      }
    } catch (err) {
      console.error(`[Storage] Failed to clear config:`, err.message);
    }
  }
}

const storageService = new StorageService();
module.exports = storageService;
