const express = require('express');
const crypto = require('crypto');
const {
  updateCampaignSendStatusByMessageId,
  recordOptOutByPhone,
} = require('../db/queries');

const router = express.Router();

/**
 * Meta calls GET once, when you register the webhook URL in the App
 * dashboard, to verify you own the endpoint.
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * Verifies the X-Hub-Signature-256 header so you know the payload really
 * came from Meta and wasn't spoofed. Must run BEFORE any body parsing
 * that mutates the raw body — see server.js for the raw-body middleware.
 */
function verifySignature(req, res, next) {
  const signature = req.get('X-Hub-Signature-256');
  if (!signature) return res.sendStatus(401);

  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.META_APP_SECRET_FOR_SIGNATURE)
      .update(req.rawBody)
      .digest('hex');

  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.sendStatus(401);
  next();
}

/**
 * Receives: message status updates (sent/delivered/read/failed) and
 * inbound messages (including STOP/opt-out keywords you must honor).
 */
router.post('/webhook', verifySignature, (req, res) => {
  // Acknowledge immediately — Meta retries if you don't respond within
  // a few seconds. Do the real work asynchronously.
  res.sendStatus(200);

  const entries = req.body.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value;

      // Delivery/read/failed status updates for messages you sent
      if (value.statuses) {
        for (const status of value.statuses) {
          // status.status is one of: sent, delivered, read, failed
          updateCampaignSendStatusByMessageId({
            messageId: status.id,
            status: status.status,
          }).catch((err) => console.error('Failed to persist status update:', err.message));
        }
      }

      // Inbound messages from customers
      if (value.messages) {
        for (const message of value.messages) {
          const from = message.from;
          const text = message.text?.body?.trim().toUpperCase();

          if (text === 'STOP' || text === 'UNSUBSCRIBE') {
            recordOptOutByPhone(from).catch((err) =>
              console.error('Failed to record opt-out:', err.message)
            );
          }
          // TODO: route other inbound messages into your inbox/CRM view
        }
      }
    }
  }
});

module.exports = router;
