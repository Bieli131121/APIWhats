// src/middlewares/auth.js
// Autenticação: aceita JWT (Bearer) ou API Key (X-API-Key)

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    let user = null;

    // JWT via Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, name, email, role, is_active FROM api_users WHERE id = $1',
        [decoded.id]
      );
      user = result.rows[0];
    }

    // API Key via X-API-Key
    const apiKey = req.headers['x-api-key'];
    if (!user && apiKey) {
      const result = await query(
        'SELECT id, name, email, role, is_active FROM api_users WHERE api_key = $1',
        [apiKey]
      );
      user = result.rows[0];
    }

    if (!user) {
      return res.status(401).json({
        error: 'Não autorizado',
        message: 'Token JWT ou API Key inválido ou ausente',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta desativada' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    logger.error('Erro no middleware de auth:', error);
    res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Requer permissão de administrador.' });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
