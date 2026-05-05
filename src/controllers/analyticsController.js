// src/controllers/analyticsController.js
// Relatórios e métricas de desempenho das campanhas

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Dashboard geral: resumo de todos os KPIs.
 */
const getDashboard = async (req, res) => {
  const { days = 30 } = req.query;

  try {
    const [
      contactStats,
      messageStats,
      campaignStats,
      topTemplates,
      deliveryTimeline,
    ] = await Promise.all([

      // Totais de contatos
      query(`
        SELECT
          COUNT(*) FILTER (WHERE opted_in = true AND opted_out = false) AS active_contacts,
          COUNT(*) FILTER (WHERE opted_out = true) AS opted_out_contacts,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days') AS new_contacts,
          COUNT(*) AS total_contacts
        FROM contacts
      `),

      // Totais de mensagens no período
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'sent')      AS sent,
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
          COUNT(*) FILTER (WHERE status = 'read')      AS read,
          COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE status IN ('delivered','read'))
            / NULLIF(COUNT(*) FILTER (WHERE status != 'queued'), 0), 1
          ) AS delivery_rate,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'read')
            / NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered','read')), 0), 1
          ) AS read_rate
        FROM messages
        WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      `),

      // Campanhas no período
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'running')   AS running,
          COUNT(*) FILTER (WHERE status = 'draft')     AS draft
        FROM campaigns
        WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      `),

      // Templates mais usados
      query(`
        SELECT t.name, t.category, COUNT(m.id) AS message_count,
               ROUND(100.0 * COUNT(*) FILTER (WHERE m.status = 'delivered') / NULLIF(COUNT(*),0), 1) AS delivery_rate
        FROM messages m
        JOIN message_templates t ON t.id = m.template_id
        WHERE m.created_at >= NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY t.id, t.name, t.category
        ORDER BY message_count DESC
        LIMIT 5
      `),

      // Timeline diária de envios (últimos N dias)
      query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
          COUNT(*) FILTER (WHERE status = 'read') AS read,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed
        FROM messages
        WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),
    ]);

    res.json({
      period_days: parseInt(days),
      contacts: contactStats.rows[0],
      messages: messageStats.rows[0],
      campaigns: campaignStats.rows[0],
      top_templates: topTemplates.rows,
      timeline: deliveryTimeline.rows,
    });
  } catch (error) {
    logger.error('Erro no dashboard:', error);
    res.status(500).json({ error: 'Erro ao gerar dashboard' });
  }
};

/**
 * Relatório detalhado de uma campanha específica.
 * Inclui funil de entrega e análise de erros.
 */
const getCampaignReport = async (req, res) => {
  const { id } = req.params;

  try {
    const [campaign, funnel, errors, hourlyBreakdown] = await Promise.all([

      query(`SELECT c.*, t.name as template_name FROM campaigns c
             LEFT JOIN message_templates t ON t.id = c.template_id
             WHERE c.id = $1`, [id]),

      // Funil de entrega
      query(`
        SELECT
          COUNT(*) AS total_queued,
          COUNT(*) FILTER (WHERE status != 'queued') AS sent_attempts,
          COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent_ok,
          COUNT(*) FILTER (WHERE status IN ('delivered','read')) AS delivered,
          COUNT(*) FILTER (WHERE status = 'read') AS read,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
          ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at)))) AS avg_delivery_seconds
        FROM messages WHERE campaign_id = $1
      `, [id]),

      // Erros mais frequentes
      query(`
        SELECT error_code, error_message, COUNT(*) AS count
        FROM messages
        WHERE campaign_id = $1 AND status = 'failed' AND error_code IS NOT NULL
        GROUP BY error_code, error_message
        ORDER BY count DESC
        LIMIT 10
      `, [id]),

      // Distribuição horária dos envios
      query(`
        SELECT
          EXTRACT(HOUR FROM sent_at)::int AS hour,
          COUNT(*) AS sent,
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered
        FROM messages
        WHERE campaign_id = $1 AND sent_at IS NOT NULL
        GROUP BY EXTRACT(HOUR FROM sent_at)
        ORDER BY hour
      `, [id]),
    ]);

    if (!campaign.rows[0]) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    const f = funnel.rows[0];
    const total = parseInt(f.sent_ok) || 1;

    res.json({
      campaign: campaign.rows[0],
      funnel: {
        ...f,
        sent_rate: parseFloat(((f.sent_ok / (f.total_queued || 1)) * 100).toFixed(1)),
        delivery_rate: parseFloat(((f.delivered / total) * 100).toFixed(1)),
        read_rate: parseFloat(((f.read / (f.delivered || 1)) * 100).toFixed(1)),
        failure_rate: parseFloat(((f.failed / (f.total_queued || 1)) * 100).toFixed(1)),
      },
      top_errors: errors.rows,
      hourly_distribution: hourlyBreakdown.rows,
    });
  } catch (error) {
    logger.error('Erro no relatório de campanha:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
};

/**
 * Taxa de opt-out por período.
 * Monitore isso: taxa alta indica mensagens indesejadas.
 */
const getOptOutReport = async (req, res) => {
  const { days = 30 } = req.query;

  const result = await query(`
    SELECT
      DATE(opted_out_at) AS date,
      COUNT(*) AS opt_outs,
      opted_out_reason
    FROM contacts
    WHERE opted_out = true
      AND opted_out_at >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY DATE(opted_out_at), opted_out_reason
    ORDER BY date DESC
  `);

  const total = await query(`
    SELECT COUNT(*) AS total FROM contacts
    WHERE opted_out = true AND opted_out_at >= NOW() - INTERVAL '${parseInt(days)} days'
  `);

  res.json({
    period_days: parseInt(days),
    total_opt_outs: parseInt(total.rows[0].total),
    by_day: result.rows,
  });
};

module.exports = { getDashboard, getCampaignReport, getOptOutReport };
