const express = require('express');
const {
  exchangeEmbeddedSignupCode,
  getSharedWabaAssets,
} = require('../services/metaApi');
const { upsertWhatsappAccount, getAccountByTenant } = require('../db/queries');

const router = express.Router();

/**
 * Lets the dashboard check whether this tenant has already connected a
 * WhatsApp number, so it can show "Connect" vs "Connected as +1 555...".
 */
router.get('/whatsapp-account', async (req, res) => {
  try {
    const account = await getAccountByTenant(req.user.tenantId);
    if (!account) return res.json({ connected: false });

    return res.json({
      connected: true,
      displayPhone: account.display_phone,
      phoneNumberId: account.phone_number_id,
      connectedAt: account.connected_at,
    });
  } catch (err) {
    console.error('Failed to load WhatsApp account:', err.message);
    return res.status(500).json({ error: 'Failed to load account status' });
  }
});


/**
 * Frontend flow (not shown here, this is the backend half):
 * 1. Your dashboard loads the Facebook JS SDK and launches Embedded
 *    Signup with FB.login(), passing your META_CONFIG_ID.
 * 2. On success, the SDK gives you a `code` in the browser.
 * 3. Your frontend POSTs that code here.
 * 4. You exchange it server-side for a token and store the tenant's
 *    WABA ID + phone_number_id.
 */
router.post('/embedded-signup/callback', async (req, res) => {
  const { code } = req.body;
  const tenantId = req.user.tenantId; // from the verified JWT, not the body

  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const tokenData = await exchangeEmbeddedSignupCode({ code });

    // In a real implementation, Meta also sends the WABA ID via the
    // `WA_EMBEDDED_SIGNUP` message event fired to your frontend during
    // the flow — capture that client-side and pass it along here too.
    const { wabaId } = req.body;

    const assets = await getSharedWabaAssets({
      accessToken: tokenData.access_token,
      wabaId,
    });

    const phoneNumberId = assets?.data?.[0]?.id;
    const displayPhone = assets?.data?.[0]?.display_phone_number;

    await upsertWhatsappAccount({
      tenantId,
      wabaId,
      phoneNumberId,
      displayPhone,
      accessToken: tokenData.access_token,
    });

    return res.json({
      status: 'connected',
      wabaId,
      phoneNumberId,
    });
  } catch (err) {
    console.error('Embedded signup exchange failed:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to complete WhatsApp connection' });
  }
});

module.exports = router;
