const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function getToken() {
  return localStorage.getItem('authToken');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload, auth: false }),

  getWhatsappAccount: () => request('/api/whatsapp-account'),

  listContacts: () => request('/api/contacts'),
  createContact: (payload) => request('/api/contacts', { method: 'POST', body: payload }),

  listCampaigns: () => request('/api/campaigns'),
  createCampaign: (payload) => request('/api/campaigns', { method: 'POST', body: payload }),
  sendCampaign: (id, payload) =>
    request(`/api/campaigns/${id}/send`, { method: 'POST', body: payload }),
};

export { API_BASE_URL, getToken };
