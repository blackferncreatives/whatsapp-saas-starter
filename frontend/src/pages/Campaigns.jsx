import { useEffect, useState } from 'react';
import { api } from '../api/client';

const STATUS_BADGE = {
  draft: 'badge-draft',
  sending: 'badge-sending',
  completed: 'badge-completed',
  failed: 'badge-disconnected',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('en_US');
  const [creating, setCreating] = useState(false);

  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const data = await api.listCampaigns();
      setCampaigns(data.campaigns);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.createCampaign({ name, templateName, languageCode });
      setName('');
      setTemplateName('');
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(campaign) {
    setSendingId(campaign.id);
    setError(null);
    try {
      const { contacts } = await api.listContacts();
      const recipients = contacts
        .filter((c) => !c.opted_out_at)
        .map((c) => ({ phone: c.phone, name: c.name }));

      if (recipients.length === 0) {
        throw new Error('No opted-in contacts to send to yet.');
      }

      await api.sendCampaign(campaign.id, { recipients });
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p>Create a campaign, then send it to your opted-in contacts.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="name">Campaign name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="templateName">Approved template name</label>
            <input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. autumn_sale_promo"
              required
            />
            <span className="field-hint">
              Must match a template already approved in your Meta Business account.
            </span>
          </div>
          <div className="field">
            <label htmlFor="languageCode">Language code</label>
            <input
              id="languageCode"
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create campaign'}
          </button>
        </form>
      </div>

      {loading ? (
        <p>Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">No campaigns yet. Create one above.</div>
      ) : (
        <div className="row-list">
          {campaigns.map((c) => (
            <div className="row-item" key={c.id}>
              <div className="row-main">
                <span className="row-title">
                  {c.name}{' '}
                  <span className={`badge ${STATUS_BADGE[c.status] || 'badge-draft'}`}>{c.status}</span>
                </span>
                <span className="row-sub">{c.template_name}</span>
              </div>

              <div className="stat-group">
                <div className="stat">
                  <div className="stat-value">{c.sent_count}</div>
                  <div className="stat-label">sent</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{c.delivered_count}</div>
                  <div className="stat-label">delivered</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{c.failed_count}</div>
                  <div className="stat-label">failed</div>
                </div>
              </div>

              {c.status === 'draft' && (
                <button
                  className="btn btn-accent"
                  onClick={() => handleSend(c)}
                  disabled={sendingId === c.id}
                >
                  {sendingId === c.id ? 'Sending...' : 'Send to all contacts'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
