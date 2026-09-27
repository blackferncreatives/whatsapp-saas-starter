const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// One queue for all tenants; each job carries its own tenant/account info
// so a worker can apply per-tenant rate limits.
const campaignQueue = new Queue('campaign-sends', { connection });

/**
 * Enqueues one job per recipient rather than one job for the whole
 * campaign — this makes retries, rate limiting, and per-recipient status
 * tracking far simpler.
 */
async function enqueueCampaign({ campaignId, tenantId, accountId, accessToken, phoneNumberId, templateName, languageCode, recipients }) {
  const jobs = recipients.map((recipient) => ({
    name: 'send-message',
    data: {
      campaignId,
      tenantId,
      accountId,
      accessToken,
      phoneNumberId,
      templateName,
      languageCode,
      to: recipient.phone,
      components: recipient.templateComponents || [],
      campaignSendId: recipient.campaignSendId,
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      // Stagger sends slightly to respect Meta's per-second throughput
      // limits, which scale with the tenant's phone number quality tier.
      delay: recipient.delayMs || 0,
    },
  }));

  await campaignQueue.addBulk(jobs);
  return { queued: jobs.length };
}

module.exports = { campaignQueue, enqueueCampaign };
