const axios = require('axios');
const storageService = require('../storage/storage.service');
const config = require('../config/config');
const logger = require('../utils/logger');

class AuthService {
  isPaired() {
    return !!(config.token && config.tenantId);
  }

  /**
   * Exchange pairing code with the cloud backend
   */
  async pairWithCode(pairingCode, overrideCloudUrl = null) {
    const cloudUrl = (overrideCloudUrl || config.cloudUrl).replace(/\/+$/, '');
    const endpoint = `${cloudUrl}/api/v1/connector/pair`;

    logger.info(`[Auth] Attempting to pair with code: ${pairingCode} at ${endpoint}`);

    try {
      const response = await axios.post(endpoint, {
        pairingCode: pairingCode.trim().toUpperCase()
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Pairing failed');
      }

      const { token, tenantId, pairedAt } = response.data.data;

      // Update in-memory config
      config.token = token;
      config.tenantId = tenantId;
      config.pairedAt = pairedAt;
      config.cloudUrl = cloudUrl;

      // Persist to %APPDATA%/DistroSync/config.json
      storageService.saveConfig({
        token,
        tenantId,
        pairedAt,
        cloudUrl,
        cloudWsUrl: cloudUrl.replace(/^http/, 'ws') + '/ws/connector'
      });

      config.cloudWsUrl = cloudUrl.replace(/^http/, 'ws') + '/ws/connector';

      logger.info(`[Auth] Successfully paired connector for tenant: ${tenantId}`);
      return { success: true, tenantId, pairedAt };

    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      logger.error(`[Auth] Pairing failed: ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  unpair() {
    config.token = null;
    config.tenantId = null;
    config.pairedAt = null;
    storageService.clearConfig();
    logger.info('[Auth] Connector unpaired and credentials cleared');
  }
}

const authService = new AuthService();
module.exports = authService;
