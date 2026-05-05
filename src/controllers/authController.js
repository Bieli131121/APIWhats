// src/controllers/authController.js
// Autenticação: login, registro de usuários, API Key

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');

/** Login com email e senha. Retorna JWT. */
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await query(
      `SELECT id, name, email, password_hash, role, is_active FROM api_users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta desativada' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    logger.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

/** Cria usuário (somente admin). */
const createUser = async (req, res) => {
  const { name, email, password, role = 'operator' } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `INSERT INTO api_users (name, email, password_hash, api_key, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, api_key`,
      [name, email, passwordHash, apiKey, role]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    if (error.constraint === 'api_users_email_key') {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    logger.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
};

/** Regenera API Key do usuário autenticado. */
const regenerateApiKey = async (req, res) => {
  const newKey = crypto.randomBytes(32).toString('hex');
  await query(
    `UPDATE api_users SET api_key = $1, updated_at = NOW() WHERE id = $2`,
    [newKey, req.user.id]
  );
  res.json({ api_key: newKey });
};

module.exports = { login, createUser, regenerateApiKey };
