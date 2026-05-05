// src/controllers/importController.js
// Importação de contatos via CSV para campanhas agendadas

const { query, getClient } = require('../config/database');
const { enqueueBatch }     = require('../queues/schedulerQueue');
const logger               = require('../utils/logger');
const { v4: uuidv4 }       = require('uuid');

/** Faz parse de CSV simples (sem biblioteca externa). */
const parseCSV = (content) => {
  const lines  = content.trim().split('\n').map((l) => l.replace(/\r/g, ''));
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
  const rows   = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = [];
    let cur = '', inQ = false;
    for (const ch of lines[i] + ',') {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    const row = {};
    header.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }

  return { header, rows };
};

const applyTemplate = (template, vars) => {
  let result = template;
  Object.entries(vars).forEach(([key, val]) => {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'gi'), val);
  });
  return result;
};

/**
 * POST /api/v1/import/csv
 * Body: { campaign_name, csv_content, message_template? }
 */
const importCSV = async (req, res) => {
  const { campaign_name, csv_content, message_template } = req.body;

  if (!campaign_name) return res.status(400).json({ error: 'Informe campaign_name.' });
  if (!csv_content)   return res.status(400).json({ error: 'Informe csv_content.' });

  let parsed;
  try { parsed = parseCSV(csv_content); }
  catch (e) { return res.status(400).json({ error: 'CSV inválido: ' + e.message }); }

  const { header, rows } = parsed;

  if (!header.includes('phone')) {
    return res.status(400).json({
      error: 'O CSV precisa ter uma coluna "phone".',
      colunas_encontradas: header,
      exemplo: 'phone,name\n+5547999990000,João',
    });
  }

  if (!header.includes('text') && !message_template) {
    return res.status(400).json({
      error: 'Informe message_template ou inclua coluna "text" no CSV.',
      exemplo_template: 'Olá {{name}}! Temos uma oferta especial para você.',
    });
  }

  const messages = [];
  const errors   = [];

  for (let i = 0; i < rows.length; i++) {
    const row   = rows[i];
    const phone = row.phone?.replace(/\D/g, '');
    if (!phone || phone.length < 10) { errors.push({ linha: i + 2, phone: row.phone, erro: 'Telefone inválido' }); continue; }

    let text;
    if (header.includes('text') && row.text) text = row.text;
    else if (message_template) text = applyTemplate(message_template, row);
    else { errors.push({ linha: i + 2, phone, erro: 'Sem texto' }); continue; }

    messages.push({ phone, text });
  }

  if (messages.length === 0) {
    return res.status(400).json({ error: 'Nenhuma mensagem válida encontrada.', erros: errors });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const campaignId = uuidv4();
    await client.query(
      `INSERT INTO scheduler_campaigns (id, name, total_count, status) VALUES ($1, $2, $3, 'queued')`,
      [campaignId, campaign_name, messages.length]
    );

    const records = messages.map((m) => ({ id: uuidv4(), campaignId, ...m }));

    for (const m of records) {
      await client.query(
        `INSERT INTO scheduled_messages (id, campaign_id, phone, text, status) VALUES ($1, $2, $3, $4, 'pending')`,
        [m.id, m.campaignId, m.phone, m.text]
      );
    }

    await client.query('COMMIT');

    await enqueueBatch(records.map((m) => ({
      messageId: m.id, phone: m.phone, text: m.text, campaignId,
    })));

    await query(`UPDATE scheduler_campaigns SET status = 'running' WHERE id = $1`, [campaignId]);

    logger.info(`CSV importado: "${campaign_name}" com ${messages.length} mensagens`);
    res.status(201).json({
      success: true,
      campaign_id: campaignId,
      name: campaign_name,
      total_imported: messages.length,
      skipped: rows.length - messages.length,
      errors: errors.slice(0, 10),
      message: `${messages.length} mensagens agendadas.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Erro ao importar CSV:', err);
    res.status(500).json({ error: 'Erro ao importar CSV', details: err.message });
  } finally {
    client.release();
  }
};

/** GET /api/v1/import/template — CSV de exemplo */
const getCSVTemplate = (req, res) => {
  const csv = [
    'phone,name,produto',
    '+5547999990001,João,Plano Pro',
    '+5511988880002,Maria,Plano Basic',
    '+5521977770003,Pedro,Plano Enterprise',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="template-importacao.csv"');
  res.send(csv);
};

module.exports = { importCSV, getCSVTemplate };
