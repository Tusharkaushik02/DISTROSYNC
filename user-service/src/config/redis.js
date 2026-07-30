const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const globalForRedis = global;

if (!globalForRedis.redisClient) {
  const client = createClient({
    url: redisUrl,
  });

  client.on('error', (err) => {
    console.error('[Redis Error]', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  globalForRedis.redisClient = client;
}

const redisClient = globalForRedis.redisClient;

// Ensure connection is established safely when client is used
async function connectRedis() {
  if (!redisClient.isOpen && !redisClient.isConnecting) {
    await redisClient.connect();
  }
  return redisClient;
}

// Trigger initial connection asynchronously
connectRedis().catch((err) => {
  console.error('[Redis] Failed initial connection attempt:', err.message);
});

module.exports = redisClient;
module.exports.connectRedis = connectRedis;
