// src/queues/schedulerQueue.js
// Fila de disparo com intervalo fixo entre mensagens (scheduler)

const { Queue, Worker } = require('bullmq');
const { createBullMQConnection } = require('../config/redis');
const { query } = require('../config/database');
const { sendText } = require('../services/evolutionApi');
const logger = require('../utils/logger');

const QUEUE_NAME = 'whatsapp-scheduler';
const INTERVAL_MS     = parseInt(process.env.MESSAGE_INTERVAL_MS || '300000'); // 5 min
const SEND_HOUR_START = parseInt(process.env.SEND_HOUR_START || '8');
const SEND_HOUR_END   = parseInt(process.env.SEND_HOUR_END   || '20');

const schedulerQueue = new Queue(QUEUE_NAME, {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

const schedulerWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { messageId, phone, text, campaignId } = job.data;

    logger.info(`Scheduler: job ${job.id} | mensagem ${messageId} | ${phone}`);

    const hour = new Date().getHours();

    if (hour < SEND_HOUR_START || hour >= SEND_HOUR_END) {
      const nextStart = new Date();
      if (hour >= SEND_HOUR_END) nextStart.setDate(nextStart.getDate() + 1);
      nextStart.setHours(SEND_HOUR_START, 0, 0, 0);
      const delayUntilWindow = nextStart.getTime() - Date.now();
      logger.info(`Scheduler: fora do horário (${hour}h). Reagendando em ${Math.round(delayUntilWindow / 60000)} min`);
      throw Object.assign(new Error(`FORA_HORARIO`), { delay: delayUntilWindow });
    }

    const msgResult = await query(
      `SELECT status, phone, text FROM scheduled_messages WHERE id = $1`,
      [messageId]
    );

    const msg = msgResult.rows[0];
    if (!msg) return { skipped: true, reason: 'not_found' };
    if (msg.status !== 'pending') return { skipped: true, reason: msg.status };

    await query(`UPDATE scheduled_messages SET status = 'sending', started_at = NOW() WHERE id = $1`, [messageId]);

    const result = await sendText(phone, text);

    await query(
      `UPDATE scheduled_messages SET status = 'sent', evolution_message_id = $1, sent_at = NOW() WHERE id = $2`,
      [result.messageId, messageId]
    );

    if (campaignId) {
      await query(`UPDATE scheduler_campaigns SET sent_count = sent_count + 1 WHERE id = $1`, [campaignId]);
    }

    logger.info(`Scheduler: mensagem ${messageId} enviada — evolution id: ${result.messageId}`);
    return { sent: true, evolutionId: result.messageId };
  },
  { connection: createBullMQConnection(), concurrency: 1 }
);

schedulerWorker.on('completed', (job, result) => {
  if (!result?.skipped) logger.info(`✅ Scheduler job ${job.id} completado`);
});

schedulerWorker.on('failed', async (job, error) => {
  logger.error(`❌ Scheduler job ${job.id} falhou: ${error.message}`);

  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    const { messageId, campaignId } = job.data;
    await query(
      `UPDATE scheduled_messages SET status = 'failed', failed_at = NOW(), error_message = $1 WHERE id = $2`,
      [error.message, messageId]
    ).catch(() => {});
    if (campaignId) {
      await query(`UPDATE scheduler_campaigns SET failed_count = failed_count + 1 WHERE id = $1`, [campaignId]).catch(() => {});
    }
  }
});

const calculateNextDelay = async (campaignId = null) => {
  const result = await query(
    `SELECT MAX(scheduled_for) as last_scheduled
     FROM scheduled_messages
     WHERE status IN ('pending', 'sending')
     ${campaignId ? 'AND campaign_id = $1' : ''}`,
    campaignId ? [campaignId] : []
  );

  const lastScheduled = result.rows[0]?.last_scheduled;
  if (!lastScheduled) return 0;

  const nextTs = new Date(lastScheduled).getTime() + INTERVAL_MS;
  return Math.max(0, nextTs - Date.now());
};

const enqueueMessage = async ({ messageId, phone, text, campaignId, delayMs = 0 }) => {
  const scheduledAt = new Date(Date.now() + delayMs);

  await query(`UPDATE scheduled_messages SET scheduled_for = $1 WHERE id = $2`, [scheduledAt, messageId]);

  const job = await schedulerQueue.add(
    'send-message',
    { messageId, phone, text, campaignId },
    { delay: delayMs, jobId: `msg-${messageId}` }
  );

  logger.info(`Scheduler enfileirado: job ${job.id} | delay ${Math.round(delayMs / 60000)} min`);
  return { jobId: job.id, scheduledAt };
};

const enqueueBatch = async (messages) => {
  const jobs = [];
  let currentDelay = await calculateNextDelay();

  for (const msg of messages) {
    const job = await enqueueMessage({ ...msg, delayMs: currentDelay });
    jobs.push(job);
    currentDelay += INTERVAL_MS;
  }

  logger.info(`Scheduler batch: ${messages.length} mensagens | duração est. ${Math.round(currentDelay / 60000)} min`);
  return jobs;
};

const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    schedulerQueue.getWaitingCount(),
    schedulerQueue.getActiveCount(),
    schedulerQueue.getCompletedCount(),
    schedulerQueue.getFailedCount(),
    schedulerQueue.getDelayedCount(),
  ]);

  return {
    waiting, active, completed, failed, delayed,
    interval_minutes: INTERVAL_MS / 60000,
    estimated_completion_minutes: (waiting + delayed) * (INTERVAL_MS / 60000),
  };
};

const cancelCampaignJobs = async (campaignId) => {
  const result = await query(
    `SELECT id FROM scheduled_messages WHERE campaign_id = $1 AND status = 'pending'`,
    [campaignId]
  );

  let cancelled = 0;
  for (const row of result.rows) {
    const job = await schedulerQueue.getJob(`msg-${row.id}`);
    if (job) { await job.remove(); cancelled++; }
  }

  await query(
    `UPDATE scheduled_messages SET status = 'cancelled' WHERE campaign_id = $1 AND status = 'pending'`,
    [campaignId]
  );

  return cancelled;
};

module.exports = {
  schedulerQueue, enqueueMessage, enqueueBatch,
  calculateNextDelay, getQueueStats, cancelCampaignJobs, INTERVAL_MS,
};
