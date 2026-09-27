const { pool } = require('./pool');

// --- tenants / users (auth) ----------------------------------------------

async function createTenantWithOwner({ tenantName, email, passwordHash }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: tenantRows } = await client.query(
      `INSERT INTO tenants (name) VALUES ($1) RETURNING *`,
      [tenantName]
    );
    const tenant = tenantRows[0];

    const { rows: userRows } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner') RETURNING *`,
      [tenant.id, email, passwordHash]
    );

    await client.query('COMMIT');
    return { tenant, user: userRows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findUserByEmail(email) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return rows[0] || null;
}

// --- whatsapp_accounts -------------------------------------------------

async function upsertWhatsappAccount({ tenantId, wabaId, phoneNumberId, displayPhone, accessToken }) {
  const { rows } = await pool.query(
    `INSERT INTO whatsapp_accounts (tenant_id, waba_id, phone_number_id, display_phone, access_token, status)
     VALUES ($1, $2, $3, $4, $5, 'connected')
     ON CONFLICT (tenant_id, phone_number_id)
     DO UPDATE SET waba_id = EXCLUDED.waba_id,
                   display_phone = EXCLUDED.display_phone,
                   access_token = EXCLUDED.access_token,
                   status = 'connected'
     RETURNING *`,
    [tenantId, wabaId, phoneNumberId, displayPhone || null, accessToken]
  );
  return rows[0];
}

async function getAccountByTenant(tenantId) {
  const { rows } = await pool.query(
    `SELECT * FROM whatsapp_accounts WHERE tenant_id = $1 AND status = 'connected' LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
}

// --- contacts ------------------------------------------------------------

async function findContactByPhone(phone) {
  const { rows } = await pool.query(`SELECT * FROM contacts WHERE phone = $1`, [phone]);
  return rows[0] || null;
}

async function upsertContact({ tenantId, phone, name }) {
  const { rows } = await pool.query(
    `INSERT INTO contacts (tenant_id, phone, name, opted_in_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (tenant_id, phone)
     DO UPDATE SET name = COALESCE(EXCLUDED.name, contacts.name)
     RETURNING *`,
    [tenantId, phone, name || null]
  );
  return rows[0];
}

async function recordOptOutByPhone(phone) {
  // Opt-outs apply regardless of which tenant's list the contact is on,
  // since the STOP came from that phone number globally.
  await pool.query(
    `UPDATE contacts SET opted_out_at = now() WHERE phone = $1`,
    [phone]
  );
}

async function listContactsByTenant(tenantId) {
  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows;
}

// --- campaigns / campaign_sends ------------------------------------------

async function createCampaign({ tenantId, name, templateName, languageCode }) {
  const { rows } = await pool.query(
    `INSERT INTO campaigns (tenant_id, name, template_name, language_code, status)
     VALUES ($1, $2, $3, $4, 'draft') RETURNING *`,
    [tenantId, name, templateName, languageCode || 'en_US']
  );
  return rows[0];
}

async function listCampaignsByTenant(tenantId) {
  const { rows } = await pool.query(
    `SELECT c.*,
            COUNT(cs.*) FILTER (WHERE cs.status = 'sent')      AS sent_count,
            COUNT(cs.*) FILTER (WHERE cs.status = 'delivered') AS delivered_count,
            COUNT(cs.*) FILTER (WHERE cs.status = 'read')      AS read_count,
            COUNT(cs.*) FILTER (WHERE cs.status = 'failed')    AS failed_count,
            COUNT(cs.*) FILTER (WHERE cs.status = 'queued')    AS queued_count,
            COUNT(cs.*)                                        AS total_count
     FROM campaigns c
     LEFT JOIN campaign_sends cs ON cs.campaign_id = c.id
     WHERE c.tenant_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [tenantId]
  );
  return rows;
}

async function getCampaignForTenant({ campaignId, tenantId }) {
  const { rows } = await pool.query(
    `SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`,
    [campaignId, tenantId]
  );
  return rows[0] || null;
}

async function markCampaignStarted(campaignId) {
  await pool.query(
    `UPDATE campaigns SET status = 'sending', started_at = now() WHERE id = $1`,
    [campaignId]
  );
}

async function createCampaignSendRow({ campaignId, contactId, status = 'queued' }) {
  const { rows } = await pool.query(
    `INSERT INTO campaign_sends (campaign_id, contact_id, status)
     VALUES ($1, $2, $3) RETURNING *`,
    [campaignId, contactId, status]
  );
  return rows[0];
}

async function markCampaignSendSent({ campaignSendId, messageId }) {
  await pool.query(
    `UPDATE campaign_sends SET message_id = $2, status = 'sent', updated_at = now() WHERE id = $1`,
    [campaignSendId, messageId]
  );
}

async function markCampaignSendFailed({ campaignSendId, error }) {
  await pool.query(
    `UPDATE campaign_sends SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`,
    [campaignSendId, String(error).slice(0, 2000)]
  );
}

// Called from the webhook when a status update arrives, keyed by the
// WhatsApp message_id (not campaign_send.id, since that's what Meta sends back).
async function updateCampaignSendStatusByMessageId({ messageId, status }) {
  await pool.query(
    `UPDATE campaign_sends SET status = $2, updated_at = now() WHERE message_id = $1`,
    [messageId, status]
  );
}

module.exports = {
  createTenantWithOwner,
  findUserByEmail,
  upsertWhatsappAccount,
  getAccountByTenant,
  findContactByPhone,
  upsertContact,
  recordOptOutByPhone,
  listContactsByTenant,
  createCampaign,
  listCampaignsByTenant,
  getCampaignForTenant,
  markCampaignStarted,
  createCampaignSendRow,
  markCampaignSendSent,
  markCampaignSendFailed,
  updateCampaignSendStatusByMessageId,
};
