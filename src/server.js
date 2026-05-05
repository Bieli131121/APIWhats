// src/server.js
// Ponto de entrada da aplicação

require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const logger  = require('./utils/logger');
const routes  = require('./routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Segurança ─────────────────────────────────────────────────
app.set('trust proxy', 1); // necessário para rate limit funcionar no Vercel/proxies

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// ── Body Parser ───────────────────────────────────────────────
app.use((req, res, next) => {
  express.json({
    verify: (req, res, buf) => { req.rawBody = buf; },
  })(req, res, next);
});

app.use(express.urlencoded({ extended: true }));

// ── Logging HTTP ──────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Rotas ─────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Rota raiz informativa ─────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Evolution API',
    version: '2.0.0',
    docs: '/api/v1/health',
    endpoints: {
      health:    'GET  /api/v1/health',
      auth:      'POST /api/v1/auth/login',
      contacts:  'GET  /api/v1/contacts',
      campaigns: 'GET  /api/v1/campaigns',
      messages:  'POST /api/v1/messages',
      import:    'POST /api/v1/import/csv',
      whatsapp:  'GET  /api/v1/whatsapp/status',
      qrcode:    'GET  /api/v1/whatsapp/qrcode',
      webhook:   'POST /api/v1/webhook/evolution',
    },
  });
});

// ── Serve frontend React (pasta public/) ──────────────────────
const path = require('path');
const fs   = require('fs');
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// ── 404 API ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    docs: '/api/v1/health',
  });
});

// ── Error handler global ──────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Erro não tratado:', { message: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ── Inicia servidor (não executa no Vercel) ───────────────────
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(`🚀 WhatsApp Evolution API rodando na porta ${PORT}`);
    logger.info(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   Webhook URL: ${process.env.APP_URL}/api/v1/webhook/evolution`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM recebido. Encerrando...');
    const { pool } = require('./config/database');
    await pool.end();
    process.exit(0);
  });
}

module.exports = app;
