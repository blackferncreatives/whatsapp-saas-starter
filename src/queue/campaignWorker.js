require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { sendTemplateMessage } = require('../services/metaApi');
const { markCampaignSendSent, markCampaignSendFailed } = require('../db/queries');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

/**
 * Run this in a separate process: `npm run worker`.
 * Keeping send workers separate from the API process means a slow or
 * rate-limited campaign never blocks your dashboard/API traffic.
 */
const worker = new Worker(
  'campaign-sends',
  async (job) => {
    const { phoneNumberId, accessToken, to, templateName, languageCode, components, campaignId, campaignSendId } = job.data;

    try {
      const result = await sendTemplateMessage({
        accessToken,
        phoneNumberId,
        to,
        templateName,
        languageCode,
        components,
      });

      const messageId = result.messages?.[0]?.id;
      if (campaignSendId) {
        await markCampaignSendSent({ campaignSendId, messageId });
      }
      console.log(`Campaign ${campaignId} -> ${to}: sent (${messageId})`);
      return { messageId };
    } catch (err) {
      const errorDetail = err.response?.data || err.message;
      // Only mark permanently failed on the last attempt — BullMQ will
      // retry per the `attempts`/`backoff` options set when the job was
      // enqueued, and we don't want to record "failed" prematurely.
      if (job.attemptsMade >= job.opts.attempts && campaignSendId) {
        await markCampaignSendFailed({ campaignSendId, error: errorDetail });
      }
      throw err; // rethrow so BullMQ's retry/backoff logic still applies
    }
  },
  {
    connection,
    // Conservative default; tune per tenant based on their number's
    // messaging tier (starts at 250 unique recipients/24h and scales up).
    limiter: { max: 15, duration: 1000 },
    concurrency: 5,
  }
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.response?.data || err.message);
  // TODO: mark campaign_sends row as failed after final retry
});

console.log('Campaign worker started, listening for jobs...');
