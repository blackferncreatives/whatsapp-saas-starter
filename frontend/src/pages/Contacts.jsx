import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);
    try {
      const data = await api.listContacts();
      setContacts(data.contacts);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await api.createContact({ phone, name: name || undefined });
      setPhone('');
      setName('');
      await loadContacts();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Contacts</h1>
          <p>Everyone you can message, and who's opted out.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="phone">Phone (E.164)</label>
            <input
              id="phone"
              placeholder="+15551234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="name">Name (optional)</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={adding}>
            {adding ? 'Adding...' : 'Add contact'}
          </button>
        </form>
      </div>

      {loading ? (
        <p>Loading contacts...</p>
      ) : contacts.length === 0 ? (
        <div className="empty-state">No contacts yet. Add one above to get started.</div>
      ) : (
        <div className="row-list">
          {contacts.map((c) => (
            <div className="row-item" key={c.id}>
              <div className="row-main">
                <span className="row-title">{c.name || 'Unnamed'}</span>
                <span className="row-sub">{c.phone}</span>
              </div>
              {c.opted_out_at ? (
                <span className="badge badge-disconnected">Opted out</span>
              ) : (
                <span className="badge badge-connected">Opted in</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
