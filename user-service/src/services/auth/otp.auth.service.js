const prisma = require('../../config/prisma');
const { redis } = require('../../config/redis');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sendOtp = async (email, purpose) => {
  // Validate required fields
  if (!email || !purpose) {
    throw createError('Email and purpose are required', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError('Invalid email format', 400);
  }

  // Validate purpose
  const validPurposes = ['LOGIN'];
  if (!validPurposes.includes(purpose)) {
    throw createError('Invalid purpose. Allowed values: LOGIN', 400);
  }

  // Find user in database
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  // Generate 6-digit OTP and hash it
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, 10);

  // Create session ID
  const otpSessionId = crypto.randomUUID();
  const redisKey = `otp:session:${otpSessionId}`;

  // Store OTP session in Redis with TTL
  const sessionData = JSON.stringify({
    userId: user.id,
    email,
    otpHash,
    purpose,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });

  await redis.set(redisKey, sessionData, 'EX', OTP_TTL_SECONDS);

  console.log(`[DEV] OTP for ${email}: ${otp}`);

  return { otpSessionId };
};

const verifyOtp = async (otp, otpSessionId) => {
  // Validate OTP
  if (!otp) {
    throw createError('OTP is required', 400);
  }

  if (typeof otp !== 'string' || otp.length !== 6) {
    throw createError('OTP must be a 6-digit string', 400);
  }

  // Validate session ID
  if (!otpSessionId) {
    throw createError('OTP session not found. Please request a new OTP.', 401);
  }

  // Find OTP session in Redis
  const redisKey = `otp:session:${otpSessionId}`;
  const sessionRaw = await redis.get(redisKey);

  if (!sessionRaw) {
    throw createError('OTP session has expired. Please request a new OTP.', 401);
  }

  const session = JSON.parse(sessionRaw);

  // Check max attempts
  if (session.attempts >= MAX_OTP_ATTEMPTS) {
    await redis.del(redisKey);
    throw createError('Too many failed attempts. Please request a new OTP.', 429);
  }

  // Verify OTP against stored hash
  const isValid = await bcrypt.compare(otp, session.otpHash);

  if (!isValid) {
    session.attempts += 1;
    const ttl = await redis.ttl(redisKey);
    if (ttl > 0) {
      await redis.set(redisKey, JSON.stringify(session), 'EX', ttl);
    }
    throw createError('Invalid OTP', 401);
  }

  // OTP verified — delete Redis key
  await redis.del(redisKey);

  return {
    userId: session.userId,
    email: session.email,
    purpose: session.purpose,
    verified: true,
  };
};

module.exports = {
  sendOtp,
  verifyOtp,
};
