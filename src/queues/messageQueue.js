// src/queues/messageQueue.js
// Fila de envio de mensagens via BullMQ com rate limiting

const { Queue, Worker } = require('bullmq');
const { createBullMQConnection } = require('../config/redis');
const { query } = require('../config/database');
const { sendTemplateMessage } = require('../services/evolutionApi');
const logger = require('../utils/logger');

const QUEUE_NAME = 'whatsapp-messages';
const MESSAGES_PER_MINUTE = parseInt(process.env.RATE_LIMIT_MESSAGES_PER_MINUTE || '80');
const MESSAGE_DELAY_MS = parseInt(process.env.MESSAGE_DELAY_MS || '750');

const messageQueue = new Queue(QUEUE_NAME, {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

const buildComponents = (vars = {}) => {
  const components = [];
  if (vars.body?.length) {
    components.push({ type: 'body', parameters: vars.body.map((v) => ({ type: 'text', text: String(v) })) });
  }
  return components;
};

const messageWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { messageId, phone, templateName, language, variables, campaignId } = job.data;

    logger.info(`Fila: processando job ${job.id} | mensagem ${messageId}`);

    const contactCheck = await query(
      `SELECT opted_out, is_blocked FROM contacts WHERE phone = $1`,
      [phone]
    );

    if (contactCheck.rows[0]?.opted_out || contactCheck.rows[0]?.is_blocked) {
      logger.warn(`Fila: pulando ${phone} — opt-out ou bloqueado`);
      await query(
        `UPDATE messages SET status = 'skipped', error_message = 'Contact opted out or blocked' WHERE id = $1`,
        [messageId]
      );
      return { skipped: true };
    }

    const components = buildComponents(variables);
    const result = await sendTemplateMessage(phone, templateName, language, components);

    await query(
      `UPDATE messages SET status = 'sent', meta_message_id = $1, sent_at = NOW(), attempts = $2 WHERE id = $3`,
      [result.wamid, job.attemptsMade + 1, messageId]
    );

    if (campaignId) {
      await query(`UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1`, [campaignId]);
    }

    logger.info(`Fila: mensagem ${messageId} enviada — wamid: ${result.wamid}`);
    return { wamid: result.wamid };
  },
  {
    connection: createBullMQConnection(),
    concurrency: 1,
    limiter: { max: MESSAGES_PER_MINUTE, duration: 60 * 1000 },
  }
);

messageWorker.on('completed', (job) => logger.info(`Fila: job ${job.id} completado`));

messageWorker.on('failed', async (job, error) => {
  logger.error(`Fila: job ${job.id} falhou (tentativa ${job.attemptsMade}): ${error.message}`);

  if (job.attemptsMade >= job.opts.attempts) {
    const { messageId, campaignId } = job.data;
    const metaError = error.response?.data?.error;

    await query(
      `UPDATE messages SET status = 'failed', failed_at = NOW(),
       error_code = $1, error_message = $2, attempts = $3 WHERE id = $4`,
      [metaError?.code?.toString() || 'UNKNOWN', metaError?.message || error.message, job.attemptsMade, messageId]
    ).catch((e) => logger.error('Erro ao atualizar status de falha:', e));

    if (campaignId) {
      await query(`UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1`, [campaignId]).catch(() => {});
    }
  }
});

const enqueueMessage = async (messageData, delayMs = 0) => {
  const job = await messageQueue.add('send-message', messageData, {
    delay: delayMs,
    jobId: `msg-${messageData.messageId}`,
  });
  return job.id;
};

const enqueueCampaign = async (messages) => {
  const jobs = [];
  for (let i = 0; i < messages.length; i++) {
    const delayMs = i * MESSAGE_DELAY_MS;
    const jobId = await enqueueMessage(messages[i], delayMs);
    jobs.push(jobId);
  }
  logger.info(`Fila: ${messages.length} mensagens enfileiradas`);
  return jobs;
};

const getQueueMetrics = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    messageQueue.getWaitingCount(),
    messageQueue.getActiveCount(),
    messageQueue.getCompletedCount(),
    messageQueue.getFailedCount(),
    messageQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
};

module.exports = { messageQueue, enqueueMessage, enqueueCampaign, getQueueMetrics };
