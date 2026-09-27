const axios = require('axios');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Thin wrapper around the Meta Graph API for WhatsApp Cloud API calls.
 * Every call needs the tenant's phone_number_id and a valid access token.
 * In production, the token is usually your System User token (it can act
 * on behalf of any WABA that has granted your app permission via
 * Embedded Signup) — but some setups instead store a per-tenant token.
 */

function client(accessToken) {
  return axios.create({
    baseURL: GRAPH_BASE,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Send a template message (required for any outbound message outside a
 * 24-hour customer service window, and always required for cold promo sends).
 */
async function sendTemplateMessage({
  accessToken,
  phoneNumberId,
  to,
  templateName,
  languageCode = 'en_US',
  components = [],
}) {
  const api = client(accessToken);
  const { data } = await api.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
  return data;
}

/**
 * Send a free-form text message. Only allowed within the 24-hour window
 * after a customer last messaged the tenant's number.
 */
async function sendTextMessage({ accessToken, phoneNumberId, to, body }) {
  const api = client(accessToken);
  const { data } = await api.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
  return data;
}

/**
 * Submit a new message template for Meta's approval.
 * Approval is required before it can be used for promotional sends.
 */
async function createMessageTemplate({
  accessToken,
  wabaId,
  name,
  category, // MARKETING | UTILITY | AUTHENTICATION
  language = 'en_US',
  components,
}) {
  const api = client(accessToken);
  const { data } = await api.post(`/${wabaId}/message_templates`, {
    name,
    category,
    language,
    components,
  });
  return data;
}

async function listMessageTemplates({ accessToken, wabaId }) {
  const api = client(accessToken);
  const { data } = await api.get(`/${wabaId}/message_templates`);
  return data;
}

/**
 * Exchange the code returned by Embedded Signup for a long-lived token,
 * and fetch which WABA + phone number the tenant just connected.
 */
async function exchangeEmbeddedSignupCode({ code }) {
  const api = client(null); // token exchange doesn't need a bearer token
  const { data } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      code,
    },
  });
  return data; // { access_token, token_type, expires_in }
}

async function getSharedWabaAssets({ accessToken, wabaId }) {
  const api = client(accessToken);
  const { data } = await api.get(`/${wabaId}/phone_numbers`);
  return data;
}

module.exports = {
  sendTemplateMessage,
  sendTextMessage,
  createMessageTemplate,
  listMessageTemplates,
  exchangeEmbeddedSignupCode,
  getSharedWabaAssets,
};
