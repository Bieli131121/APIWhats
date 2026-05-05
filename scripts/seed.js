// scripts/seed.js
// Cria o usuário admin inicial
// Execute: node scripts/seed.js

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../src/config/database');
const logger   = require('../src/utils/logger');

async function seed() {
  const client = await pool.connect();
  try {
    const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const name     = process.env.ADMIN_NAME     || 'Administrador';

    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey       = crypto.randomBytes(32).toString('hex');

    await client.query(
      `INSERT INTO api_users (name, email, password_hash, api_key, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [name, email, passwordHash, apiKey]
    );

    logger.info('✅ Usuário admin criado (ou já existia):');
    logger.info(`   Email: ${email}`);
    logger.info(`   Senha: ${password}`);
    logger.info(`   API Key: ${apiKey}`);
    logger.info('   ⚠️  Troque a senha após o primeiro login!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => { logger.error(err); process.exit(1); });
