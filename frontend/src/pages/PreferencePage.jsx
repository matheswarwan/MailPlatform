import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

// Use plain axios (no auth headers needed — this is a public page)
const publicClient = axios.create({ baseURL: '/api' });

export default function PreferencePage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // 'expired' | 'invalid' | 'server'
  const [config, setConfig] = useState(null);
  const [contact, setContact] = useState(null);
  const [prefs, setPrefs] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await publicClient.get(`/p/${token}`);
        setConfig(res.data.config || {});
        setContact(res.data.contact || {});
        // Initialize prefs from current subscriptions
        const initial = {};
        (res.data.config?.subscriptionTypes || []).forEach((t) => {
          initial[t.name] = res.data.contact?.subscriptions?.[t.name] ?? t.defaultOptIn ?? true;
        });
        setPrefs(initial);
      } catch (err) {
        const status = err.response?.status;
        if (status === 410) setError('expired');
        else if (status === 404) setError('invalid');
        else setError('server');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await publicClient.post(`/p/${token}`, { preferences: prefs });
      setSaved(true);
    } catch {
      // show generic error
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    setSaving(true);
    try {
      await publicClient.post(`/p/${token}`, { unsubscribeAll: true });
      setUnsubscribed(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const brandColor = config?.brandColor || '#4F7FFF';
  const headline = config?.headline || 'Manage Your Email Preferences';
  const description = config?.description || 'Choose the types of emails you would like to receive from us.';
  const subscriptionTypes = config?.subscriptionTypes || [
    { name: 'Marketing Emails', defaultOptIn: true },
    { name: 'Product Updates', defaultOptIn: true },
    { name: 'Newsletter', defaultOptIn: false },
  ];

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1117' }}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <p style={{ color: '#8B92A5' }}>Loading your preferences…</p>
        </div>
      </div>
    );
  }

  // ── Error states ─────────────────────────────────────────────────────────────
  if (error) {
    const messages = {
      expired: {
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
        title: 'Link Expired',
        body: 'This preference link has expired. Please contact us or request a new link.',
        color: '#EAB308',
      },
      invalid: {
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
        title: 'Invalid Link',
        body: 'This link is invalid or has already been used. Please contact us for assistance.',
        color: '#EF4444',
      },
      server: {
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        title: 'Something Went Wrong',
        body: 'We could not load your preferences. Please try again later.',
        color: '#EF4444',
      },
    };

    const m = messages[error];
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1117' }}>
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <div className="flex justify-center mb-4" style={{ color: m.color }}>
            {m.icon}
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F3F9' }}>{m.title}</h2>
          <p className="text-sm" style={{ color: '#8B92A5' }}>{m.body}</p>
        </div>
      </div>
    );
  }

  // ── Unsubscribed confirmation ────────────────────────────────────────────────
  if (unsubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1117' }}>
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F3F9' }}>You've been unsubscribed</h2>
          <p className="text-sm" style={{ color: '#8B92A5' }}>
            You will no longer receive any emails from us. If this was a mistake, please contact us.
          </p>
        </div>
      </div>
    );
  }

  // ── Saved confirmation ───────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1117' }}>
        <div
          className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: '#fff' }}
        >
          {/* Branded header */}
          <div className="px-8 py-8 text-center" style={{ background: brandColor }}>
            {config?.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-10 mx-auto mb-3 object-contain" />
            ) : null}
            <h1 className="text-xl font-bold text-white">Preferences Saved!</h1>
          </div>

          <div className="px-8 py-8 text-center">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-4"
              style={{ background: '#f0fdf4' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: '#111' }}>
              Your preferences have been updated
            </h2>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              We've saved your email preferences. Changes may take up to 24 hours to take effect.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main preference page ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1117' }}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#fff' }}
      >
        {/* Branded header */}
        <div className="px-8 py-8 text-center" style={{ background: brandColor }}>
          {config?.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-10 mx-auto mb-3 object-contain" />
          ) : (
            <div
              className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center text-white font-bold"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              M
            </div>
          )}
          <h1 className="text-xl font-bold text-white">{headline}</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {description}
          </p>
          {contact?.email && (
            <p
              className="mt-3 text-xs px-3 py-1.5 rounded-full inline-block"
              style={{ background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.9)' }}
            >
              {contact.email}
            </p>
          )}
        </div>

        {/* Subscription types */}
        <div className="px-6 py-6 space-y-3" style={{ background: '#f9fafb' }}>
          {subscriptionTypes.map((type, i) => {
            const isOn = prefs[type.name] ?? type.defaultOptIn ?? true;
            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-4 rounded-xl bg-white shadow-sm cursor-pointer"
                style={{ border: '1px solid #e5e7eb' }}
                onClick={() => setPrefs({ ...prefs, [type.name]: !isOn })}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#111' }}>{type.name}</p>
                  {type.description && (
                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{type.description}</p>
                  )}
                </div>
                <button
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4"
                  style={{ background: isOn ? brandColor : '#d1d5db' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPrefs({ ...prefs, [type.name]: !isOn });
                  }}
                >
                  <span
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{ left: isOn ? '23px' : '4px' }}
                  />
                </button>
              </div>
            );
          })}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-2 transition-opacity"
            style={{ background: brandColor, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
            <span className="text-xs" style={{ color: '#9ca3af' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
          </div>

          {/* Unsubscribe all */}
          <button
            onClick={handleUnsubscribeAll}
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background: '#fff',
              color: '#ef4444',
              border: '1px solid #fecaca',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            Unsubscribe from all emails
          </button>

          <p className="text-xs text-center pb-2" style={{ color: '#9ca3af' }}>
            You can change your preferences at any time using this link.
          </p>
        </div>
      </div>
    </div>
  );
}
