// src/controllers/templatesController.js
// Gerenciamento de templates

const { query } = require('../config/database');
const logger = require('../utils/logger');

/** Lista templates locais. */
const listTemplates = async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = '';

  if (status) {
    where = 'WHERE status = $1';
    params.push(status.toUpperCase());
  }

  const result = await query(
    `SELECT * FROM message_templates ${where} ORDER BY created_at DESC`,
    params
  );
  res.json({ templates: result.rows });
};

/** Cadastra template manualmente. */
const createTemplate = async (req, res) => {
  const { name, category, language, body_text, header_type, header_content, footer_text } = req.body;
  try {
    const result = await query(
      `INSERT INTO message_templates (name, category, language, body_text, header_type, header_content, footer_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name, category, language || 'pt_BR', body_text, header_type, header_content, footer_text]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (error) {
    if (error.constraint === 'message_templates_name_key') {
      return res.status(409).json({ error: 'Template com este nome já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar template' });
  }
};

/** Aprova template manualmente (para uso sem Meta). */
const approveTemplate = async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE message_templates SET status = 'APPROVED', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Template não encontrado' });
  res.json({ template: result.rows[0] });
};

module.exports = { listTemplates, createTemplate, approveTemplate };
