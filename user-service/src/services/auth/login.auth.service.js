const prisma = require('../../config/prisma');
const { redis } = require('../../config/redis');
const bcrypt = require('bcrypt');
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

const login = async (email, password, ip, userAgent) => {
  // Validate required fields
  if (!email || !password) {
    throw createError('Email and password are required', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError('Invalid email format', 400);
  }

  // Validate password length
  if (password.length < 8) {
    throw createError('Password must be at least 8 characters', 400);
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw createError('Invalid email or password', 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw createError('Invalid email or password', 401);
  }

  // TODO: Replace with real JWT generation once implemented
  const accessToken = `access_${crypto.randomUUID()}`;
  const refreshToken = crypto.randomUUID();

  // Hash refresh token for secure storage
  const refreshTokenHash = hashToken(refreshToken);

  // Create refresh session in Redis with TTL
  const sessionId = crypto.randomUUID();
  const redisKey = `refresh:session:${user.id}:${sessionId}`;
  const now = new Date().toISOString();

  const sessionData = JSON.stringify({
    refreshTokenHash,
    userId: user.id,
    createdAt: now,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
    lastUsedAt: now,
    ip,
    userAgent,
  });

  await redis.set(redisKey, sessionData, 'EX', REFRESH_TOKEN_TTL_SECONDS);

  // Return user without sensitive fields
  const { passwordHash: _, ...safeUser } = user;

  return {
    accessToken,
    refreshToken,
    user: safeUser,
  };
};

module.exports = {
  login,
  hashToken,
};
