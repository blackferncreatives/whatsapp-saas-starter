import { useEffect, useRef, useState } from 'react';

/**
 * WhatsAppEmbeddedSignup
 *
 * Drop this into your onboarding/settings page to let a tenant connect
 * their own WhatsApp Business number to your platform.
 *
 * Flow:
 * 1. Loads the Facebook JS SDK once.
 * 2. Listens for a `message` event Meta posts to the window during the
 *    signup popup — this carries the WABA ID and phone_number_id BEFORE
 *    the popup closes, so capture it here rather than trying to derive
 *    it after the fact.
 * 3. On button click, calls FB.login() configured for Embedded Signup.
 *    On success, response.authResponse.code is sent to your backend
 *    (`POST /api/embedded-signup/callback`) along with the tenantId and
 *    the wabaId captured from the message event.
 *
 * Required props:
 * - appId: your Meta App ID (same as META_APP_ID on the backend)
 * - configId: your Embedded Signup configuration ID (META_CONFIG_ID)
 * - authToken: the logged-in user's JWT from your /api/auth/login or
 *   /api/auth/signup response — the backend derives the tenant from this,
 *   so it no longer needs to be passed separately
 * - apiBaseUrl: base URL of your backend (e.g. https://api.yourapp.com)
 *
 * Optional props:
 * - onConnected(result): called with the backend's response once the
 *   number is successfully connected
 * - onError(error): called if signup or the backend exchange fails
 */
export default function WhatsAppEmbeddedSignup({
  appId,
  configId,
  authToken,
  apiBaseUrl,
  onConnected,
  onError,
}) {
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | exchanging | connected | error
  const capturedWabaData = useRef(null);

  // Load the Facebook JS SDK once.
  useEffect(() => {
    if (window.FB) {
      setSdkReady(true);
      return;
    }

    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: 'v20.0',
      });
      setSdkReady(true);
    };

    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [appId]);

  // Capture the WABA ID / phone_number_id Meta posts during the flow.
  useEffect(() => {
    function handleMessage(event) {
      if (!event.origin.endsWith('facebook.com')) return;

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          capturedWabaData.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
            businessId: data.data?.business_id,
          };
        }
      } catch {
        // Not a JSON message we care about; ignore.
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function handleConnectClick() {
    if (!sdkReady || !window.FB) return;
    setStatus('connecting');
    capturedWabaData.current = null;

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;

        if (!code) {
          setStatus('error');
          onError?.(new Error('WhatsApp signup was cancelled or did not return a code'));
          return;
        }

        setStatus('exchanging');

        // FB.login's callback must be a plain (non-async) function — the
        // SDK's own internal validation rejects an async function passed
        // directly here. Do the actual async work in an inner IIFE instead.
        (async () => {
          try {
            const res = await fetch(`${apiBaseUrl}/api/embedded-signup/callback`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                code,
                wabaId: capturedWabaData.current?.wabaId,
              }),
            });

            if (!res.ok) {
              throw new Error(`Backend exchange failed with status ${res.status}`);
            }

            const result = await res.json();
            setStatus('connected');
            onConnected?.(result);
          } catch (err) {
            setStatus('error');
            onError?.(err);
          }
        })();
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      }
    );
  }

  const labels = {
    idle: 'Connect WhatsApp Business number',
    connecting: 'Waiting for Facebook...',
    exchanging: 'Finishing connection...',
    connected: 'Connected',
    error: 'Try again',
  };

  return (
    <button
      onClick={handleConnectClick}
      disabled={!sdkReady || status === 'connecting' || status === 'exchanging'}
      style={{
        padding: '10px 18px',
        borderRadius: 8,
        border: 'none',
        background: status === 'connected' ? '#25D366' : '#111827',
        color: '#fff',
        fontWeight: 600,
        cursor: sdkReady ? 'pointer' : 'not-allowed',
        opacity: sdkReady ? 1 : 0.6,
      }}
    >
      {labels[status]}
    </button>
  );
}
