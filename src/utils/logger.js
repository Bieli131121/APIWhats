// src/utils/logger.js
// Logger centralizado usando Winston

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1';

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    ),
  }),
];

// Arquivo de log apenas fora do Vercel (serverless não tem filesystem persistente)
if (!isVercel) {
  const logDir = path.dirname(process.env.LOG_FILE || 'logs/app.log');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  transports.push(
    new winston.transports.File({
      filename: process.env.LOG_FILE || 'logs/app.log',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
});

module.exports = logger;
