/**
 * Local file-backed cache for tracking sent vouchers.
 *
 * Prevents duplicate Tally entries when the same ERP order is retried.
 * Stored at %APPDATA%/DistroSync/sent-vouchers.json
 */

const fs = require('fs');
const path = require('path');
const storageService = require('./storage.service');
const logger = require('../utils/logger');

class VoucherCache {
  constructor() {
    this.cacheFile = path.join(storageService.getBaseDir(), 'sent-vouchers.json');
    this.cache = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      logger.error(`[VoucherCache] Failed to load cache: ${err.message}`);
    }
    return {};
  }

  _save() {
    try {
      storageService.ensureDirectory();
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (err) {
      logger.error(`[VoucherCache] Failed to save cache: ${err.message}`);
    }
  }

  /**
   * Check whether a voucher with this reference has already been sent to Tally.
   *
   * @param {string} reference - ERP order UUID or other unique identifier
   * @returns {boolean}
   */
  hasSent(reference) {
    if (!reference) return false;
    return !!this.cache[reference];
  }

  /**
   * Record that a voucher was successfully sent.
   *
   * @param {string} reference         - ERP order UUID
   * @param {string} tallyVoucherNumber - Tally-assigned voucher number
   * @param {string} [action]           - e.g. 'CREATE_SALES_VOUCHER'
   */
  markSent(reference, tallyVoucherNumber, action = '') {
    if (!reference) return;
    this.cache[reference] = {
      tallyVoucherNumber,
      action,
      sentAt: new Date().toISOString()
    };
    this._save();
  }

  /**
   * Get the cached status of a reference.
   *
   * @param {string} reference
   * @returns {{ tallyVoucherNumber: string, sentAt: string, action: string } | null}
   */
  getStatus(reference) {
    return this.cache[reference] || null;
  }

  /**
   * Remove a reference from the cache (useful for reversals or corrections).
   *
   * @param {string} reference
   */
  remove(reference) {
    if (reference && this.cache[reference]) {
      delete this.cache[reference];
      this._save();
    }
  }

  /**
   * Get total number of cached entries.
   */
  size() {
    return Object.keys(this.cache).length;
  }
}

const voucherCache = new VoucherCache();
module.exports = voucherCache;
