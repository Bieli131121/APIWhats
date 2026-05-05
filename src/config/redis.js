// src/config/redis.js
// Conexão Redis para BullMQ (use Upstash no Vercel)

const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null, // obrigatório para BullMQ
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis: reconectando (tentativa ${times}, delay ${delay}ms)`);
    return delay;
  },
};

const redis = new Redis(redisConfig);

redis.on('connect', () => logger.info('Redis: conectado'));
redis.on('error', (err) => logger.error('Redis: erro', err));
redis.on('close', () => logger.warn('Redis: conexão fechada'));

// Conexão dedicada para BullMQ (não pode compartilhar)
const createBullMQConnection = () => new Redis(redisConfig);

module.exports = { redis, redisConfig, createBullMQConnection };
