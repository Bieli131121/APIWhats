// src/controllers/contactsController.js
// CRUD de contatos com opt-in obrigatório (LGPD/GDPR)

const { query } = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/** Cadastra contato com consentimento documentado. */
const createContact = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { phone, name, email, opted_in, opted_in_source, opted_in_confirmation, custom_data, tags } = req.body;

  if (!opted_in) {
    return res.status(400).json({
      error: 'Consentimento obrigatório',
      message: 'O campo opted_in deve ser true. Não cadastre contatos sem consentimento explícito.',
    });
  }

  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    const result = await query(
      `INSERT INTO contacts (
        phone, name, email,
        opted_in, opted_in_at, opted_in_source, opted_in_ip,
        opted_in_user_agent, opted_in_confirmation,
        custom_data, tags
      ) VALUES ($1,$2,$3,$4,NOW(),$5,$6,$7,$8,$9,$10)
      ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        opted_in = EXCLUDED.opted_in,
        opted_in_at = CASE WHEN contacts.opted_in = false THEN NOW() ELSE contacts.opted_in_at END,
        opted_in_source = EXCLUDED.opted_in_source,
        opted_in_confirmation = EXCLUDED.opted_in_confirmation,
        opted_out = false,
        opted_out_at = NULL,
        updated_at = NOW()
      RETURNING id, phone, name, opted_in, opted_in_at, opted_in_source`,
      [phone, name, email, true, opted_in_source, ip, userAgent, opted_in_confirmation,
       JSON.stringify(custom_data || {}), tags || []]
    );

    const contact = result.rows[0];

    await query(
      `INSERT INTO consent_audit_log (contact_id, action, source, details, performed_by)
       VALUES ($1, 'OPT_IN', $2, $3, $4)`,
      [contact.id, opted_in_source, opted_in_confirmation, req.user?.id || null]
    );

    logger.info(`Contato ${phone} cadastrado com opt-in`);
    res.status(201).json({ success: true, contact });
  } catch (error) {
    logger.error('Erro ao criar contato:', error);
    res.status(500).json({ error: 'Erro ao cadastrar contato' });
  }
};

/** Importação em lote (máx 5000 contatos). */
const importContacts = async (req, res) => {
  const { contacts, source } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Lista de contatos inválida' });
  }
  if (contacts.length > 5000) {
    return res.status(400).json({ error: 'Máximo 5000 contatos por importação' });
  }

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const c of contacts) {
    if (!c.phone || !c.opted_in) { results.skipped++; continue; }
    try {
      await query(
        `INSERT INTO contacts (phone, name, email, opted_in, opted_in_at, opted_in_source)
         VALUES ($1,$2,$3,true,NOW(),$4)
         ON CONFLICT (phone) DO NOTHING`,
        [c.phone, c.name, c.email, source || 'bulk_import']
      );
      results.imported++;
    } catch (e) {
      results.errors.push({ phone: c.phone, error: e.message });
    }
  }

  logger.info(`Import: ${results.imported} importados, ${results.skipped} pulados`);
  res.json(results);
};

/** Opt-out manual. */
const optOut = async (req, res) => {
  const { phone } = req.params;
  const { reason } = req.body;

  try {
    const result = await query(
      `UPDATE contacts
       SET opted_out = true, opted_out_at = NOW(),
           opted_out_reason = $1, updated_at = NOW()
       WHERE phone = $2
       RETURNING id, phone`,
      [reason || 'api_request', phone]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Contato não encontrado' });

    await query(
      `INSERT INTO consent_audit_log (contact_id, action, source, details, performed_by)
       VALUES ($1, 'OPT_OUT', 'api', $2, $3)`,
      [result.rows[0].id, reason || 'api_request', req.user?.id || null]
    );

    logger.info(`Opt-out: ${phone}`);
    res.json({ success: true, message: 'Contato removido da lista de envios' });
  } catch (error) {
    logger.error('Erro ao processar opt-out:', error);
    res.status(500).json({ error: 'Erro ao processar opt-out' });
  }
};

/** Lista contatos com filtros e paginação. */
const listContacts = async (req, res) => {
  const { page = 1, limit = 50, opted_in, tag, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];
  let i = 1;

  if (opted_in !== undefined) { conditions.push(`opted_in = $${i++}`); params.push(opted_in === 'true'); }
  if (tag) { conditions.push(`$${i++} = ANY(tags)`); params.push(tag); }
  if (search) {
    conditions.push(`(phone ILIKE $${i} OR name ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countResult, dataResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM contacts ${where}`, params),
      query(
        `SELECT id, phone, name, email, opted_in, opted_in_at, opted_in_source,
                opted_out, opted_out_at, tags, created_at
         FROM contacts ${where}
         ORDER BY created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, parseInt(limit), offset]
      ),
    ]);

    res.json({
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      contacts: dataResult.rows,
    });
  } catch (error) {
    logger.error('Erro ao listar contatos:', error);
    res.status(500).json({ error: 'Erro ao buscar contatos' });
  }
};

module.exports = { createContact, importContacts, optOut, listContacts };
