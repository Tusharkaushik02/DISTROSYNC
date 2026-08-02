const prisma = require('../../config/prisma');
const { redis } = require('../../config/redis');
const crypto = require('crypto');

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Hash a token using SHA-256 (deterministic, for refresh token storage/lookup)
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Scan Redis for all refresh sessions belonging to a user.
 * Pattern: refresh:session:{userId}:*
 */
const findUserSessions = async (userId) => {
  const pattern = `refresh:session:${userId}:*`;
  const keys = [];
  let cursor = '0';

  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...foundKeys);
  } while (cursor !== '0');

  return keys;
};

const refresh = async (refreshToken, ip, userAgent) => {
  if (!refreshToken) {
    throw createError('Refresh token is required', 401);
  }

  const incomingHash = hashToken(refreshToken);
  const allKeys = await redis.keys('refresh:session:*');

  let matchedKey = null;
  let matchedSession = null;

  for (const key of allKeys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const session = JSON.parse(raw);
    if (session.refreshTokenHash === incomingHash) {
      matchedKey = key;
      matchedSession = session;
      break;
    }
  }

  if (!matchedKey || !matchedSession) {
    throw createError('Invalid refresh token', 401);
  }

  if (new Date() > new Date(matchedSession.expiresAt)) {
    await redis.del(matchedKey);
    throw createError('Refresh token has expired. Please login again.', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: matchedSession.userId },
  });

  if (!user) {
    await redis.del(matchedKey);
    throw createError('User not found', 401);
  }

  // TODO: Replace with real JWT generation once implemented
  const newAccessToken = `access_${crypto.randomUUID()}`;
  const newRefreshToken = crypto.randomUUID();

  const newRefreshTokenHash = hashToken(newRefreshToken);
  const now = new Date().toISOString();

  const updatedSession = JSON.stringify({
    ...matchedSession,
    refreshTokenHash: newRefreshTokenHash,
    lastUsedAt: now,
    ip,
    userAgent,
  });

  await redis.set(matchedKey, updatedSession, 'EX', REFRESH_TOKEN_TTL_SECONDS);

  const { passwordHash: _, ...safeUser } = user;

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: safeUser,
  };
};

const logout = async (refreshToken) => {
  if (!refreshToken) {
    throw createError('Refresh token is required', 401);
  }

  const incomingHash = hashToken(refreshToken);
  const allKeys = await redis.keys('refresh:session:*');

  for (const key of allKeys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const session = JSON.parse(raw);
    if (session.refreshTokenHash === incomingHash) {
      await redis.del(key);
      break;
    }
  }

  return { message: 'Logged out successfully' };
};

const logoutAll = async (userId) => {
  if (!userId) {
    throw createError('User ID is required', 400);
  }

  const keys = await findUserSessions(userId);

  if (keys.length > 0) {
    await redis.del(...keys);
  }

  return { message: `Logged out from all ${keys.length} session(s)` };
};

module.exports = {
  refresh,
  logout,
  logoutAll,
  findUserSessions,
};
