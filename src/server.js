// src/server.js
require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');
const logger  = require('./utils/logger');
const routes  = require('./routes');

const app  = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

// ── Segurança ─────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// ── Body Parser ───────────────────────────────────────────────
app.use((req, res, next) => {
  express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

// ── Logging HTTP ──────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── API Rotas (sempre primeiro) ───────────────────────────────
app.use('/api/v1', routes);

// ── Serve frontend React (static + SPA fallback) ──────────────
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Error handler global ──────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Erro não tratado:', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ── Inicia servidor (não executa no Vercel) ───────────────────
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(`🚀 WhatsApp Evolution API rodando na porta ${PORT}`);
    logger.info(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
  process.on('SIGTERM', async () => {
    const { pool } = require('./config/database');
    await pool.end();
    process.exit(0);
  });
}

module.exports = app;
