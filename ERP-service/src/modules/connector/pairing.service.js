const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.CONNECTOR_JWT_SECRET || process.env.JWT_SECRET || 'distrosync-tally-connector-secret-key';
const PAIRING_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-memory store for pairing codes: code -> { tenantId, expiresAt, metadata }
const pairingCodes = new Map();

/**
 * Generate a clean, human-readable 6-character pairing code
 */
function generatePairingCode(tenantId, metadata = {}) {
  cleanExpiredCodes();

  const randomChars = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = `DS-${randomChars}`;

  pairingCodes.set(code, {
    tenantId,
    metadata,
    createdAt: Date.now(),
    expiresAt: Date.now() + PAIRING_CODE_TTL_MS
  });

  return {
    code,
    expiresInSeconds: Math.floor(PAIRING_CODE_TTL_MS / 1000),
    expiresAt: new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString()
  };
}

/**
 * Exchange a pairing code for a permanent connector token
 */
function exchangePairingCode(code) {
  cleanExpiredCodes();

  const entry = pairingCodes.get(code.trim().toUpperCase());
  if (!entry) {
    throw new Error('Invalid or expired pairing code');
  }

  if (Date.now() > entry.expiresAt) {
    pairingCodes.delete(code.trim().toUpperCase());
    throw new Error('Pairing code has expired');
  }

  // Consume code (one-time use)
  pairingCodes.delete(code.trim().toUpperCase());

  // Generate persistent connector token (valid for 1 year or until revoked)
  const token = jwt.sign(
    {
      tenantId: entry.tenantId,
      type: 'tally_connector',
      issuedAt: Date.now()
    },
    JWT_SECRET,
    { expiresIn: '365d' }
  );

  return {
    token,
    tenantId: entry.tenantId,
    pairedAt: new Date().toISOString()
  };
}

/**
 * Verify connector JWT token
 */
function verifyConnectorToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'tally_connector') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (err) {
    throw new Error(`Invalid connector token: ${err.message}`);
  }
}

function cleanExpiredCodes() {
  const now = Date.now();
  for (const [code, data] of pairingCodes.entries()) {
    if (now > data.expiresAt) {
      pairingCodes.delete(code);
    }
  }
}

module.exports = {
  generatePairingCode,
  exchangePairingCode,
  verifyConnectorToken
};
