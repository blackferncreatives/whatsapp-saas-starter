const express = require('express');
const { listContactsByTenant, upsertContact } = require('../db/queries');

const router = express.Router();

router.get('/contacts', async (req, res) => {
  try {
    const contacts = await listContactsByTenant(req.user.tenantId);
    return res.json({ contacts });
  } catch (err) {
    console.error('Failed to list contacts:', err.message);
    return res.status(500).json({ error: 'Failed to load contacts' });
  }
});

router.post('/contacts', async (req, res) => {
  const { phone, name } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'phone is required (E.164 format, e.g. +15551234567)' });
  }

  try {
    const contact = await upsertContact({ tenantId: req.user.tenantId, phone, name });
    return res.status(201).json({ contact });
  } catch (err) {
    console.error('Failed to create contact:', err.message);
    return res.status(500).json({ error: 'Failed to create contact' });
  }
});

module.exports = router;
