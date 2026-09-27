import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE_URL } from '../api/client';
import WhatsAppEmbeddedSignup from '../components/WhatsAppEmbeddedSignup';

const META_APP_ID = import.meta.env.VITE_META_APP_ID;
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID;

export default function Dashboard() {
  const { token } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    try {
      const data = await api.getWhatsappAccount();
      setAccount(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Your WhatsApp connection and a quick look at where things stand.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {loading ? (
          <p>Checking connection...</p>
        ) : account?.connected ? (
          <>
            <span className="badge badge-connected">Connected</span>
            <p style={{ marginTop: 12, fontFamily: 'var(--font-mono)' }}>
              {account.displayPhone || account.phoneNumberId}
            </p>
            <p className="field-hint">
              Connected {new Date(account.connectedAt).toLocaleDateString()}
            </p>
          </>
        ) : (
          <>
            <span className="badge badge-disconnected">Not connected</span>
            <p style={{ margin: '12px 0 16px', color: 'var(--ink-soft)' }}>
              Connect your WhatsApp Business number to start sending campaigns.
            </p>
            {META_APP_ID && META_CONFIG_ID ? (
              <WhatsAppEmbeddedSignup
                appId={META_APP_ID}
                configId={META_CONFIG_ID}
                authToken={token}
                apiBaseUrl={API_BASE_URL}
                onConnected={loadAccount}
                onError={(err) => setError(err.message)}
              />
            ) : (
              <p className="field-hint">
                Set VITE_META_APP_ID and VITE_META_CONFIG_ID in your .env to enable this.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
