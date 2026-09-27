const express = require('express');
const { enqueueCampaign } = require('../queue/campaignQueue');
const {
  upsertContact,
  createCampaignSendRow,
  getAccountByTenant,
  createCampaign,
  listCampaignsByTenant,
  getCampaignForTenant,
  markCampaignStarted,
} = require('../db/queries');

const router = express.Router();

router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await listCampaignsByTenant(req.user.tenantId);
    return res.json({ campaigns });
  } catch (err) {
    console.error('Failed to list campaigns:', err.message);
    return res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

router.post('/campaigns', async (req, res) => {
  const { name, templateName, languageCode } = req.body;

  if (!name || !templateName) {
    return res.status(400).json({ error: 'name and templateName are required' });
  }

  try {
    const campaign = await createCampaign({
      tenantId: req.user.tenantId,
      name,
      templateName,
      languageCode: languageCode || 'en_US',
    });
    return res.status(201).json({ campaign });
  } catch (err) {
    console.error('Failed to create campaign:', err.message);
    return res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * Kicks off a bulk send for an existing draft campaign. The WABA
 * credentials (accessToken/phoneNumberId) come from the account this
 * tenant connected via Embedded Signup — never trust these from the
 * request body, or one tenant could send messages through another
 * tenant's connected number.
 */
router.post('/campaigns/:id/send', async (req, res) => {
  const tenantId = req.user.tenantId;
  const campaignId = req.params.id;
  const { recipients } = req.body; // [{ phone, name, templateComponents }, ...]

  if (!Array.isArray(recipients)) {
    return res.status(400).json({ error: 'recipients[] is required' });
  }

  try {
    const campaign = await getCampaignForTenant({ campaignId, tenantId });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const templateName = req.body.templateName || campaign.template_name;
    const languageCode = req.body.languageCode || campaign.language_code;

    if (!templateName) {
      return res.status(400).json({ error: 'Campaign has no template_name; pass templateName explicitly' });
    }

    const account = await getAccountByTenant(tenantId);
    if (!account) {
      return res.status(409).json({ error: 'No connected WhatsApp account for this tenant' });
    }

    const jobRecipients = [];
    let skippedOptedOut = 0;

    // Sequential to keep this readable; for very large lists, batch
    // these upserts instead of one round-trip per contact.
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      const contact = await upsertContact({
        tenantId,
        phone: recipient.phone,
        name: recipient.name,
      });

      if (contact.opted_out_at) {
        skippedOptedOut += 1;
        continue;
      }

      const sendRow = await createCampaignSendRow({
        campaignId,
        contactId: contact.id,
      });

      jobRecipients.push({
        phone: recipient.phone,
        templateComponents: recipient.templateComponents || [],
        campaignSendId: sendRow.id,
        delayMs: Math.floor(jobRecipients.length / 15) * 1000, // ~15 msg/sec
      });
    }

    const result = await enqueueCampaign({
      campaignId,
      tenantId,
      accountId: account.id,
      accessToken: account.access_token,
      phoneNumberId: account.phone_number_id,
      templateName,
      languageCode,
      recipients: jobRecipients,
    });

    await markCampaignStarted(campaignId);

    return res.json({ status: 'queued', skippedOptedOut, ...result });
  } catch (err) {
    console.error('Failed to enqueue campaign:', err.message);
    return res.status(500).json({ error: 'Failed to queue campaign' });
  }
});

module.exports = router;
