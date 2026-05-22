import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAppStore from '../store/appStore';
import BlockCanvas from '../components/email/BlockCanvas';
import client from '../api/client';

export default function EmailTemplateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    createEmailTemplate,
    updateEmailTemplate,
    fetchAttributeDefinitions,
    attributeDefinitions,
    assets,
    fetchAssets,
    contacts,
    fetchContacts,
  } = useAppStore();

  const [blocks, setBlocks] = useState([]);
  const [device, setDevice] = useState('Desktop');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveCopyStack, setSaveCopyStack] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!!id);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewContactId, setPreviewContactId] = useState('');
  const [previewContactSearch, setPreviewContactSearch] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    subject: '',
  });

  const nameRef = useRef(null);

  useEffect(() => {
    fetchAttributeDefinitions();
    fetchAssets();
    fetchContacts({ limit: 100 });

    if (id) {
      setLoading(true);
      client.get(`/email-templates/${id}`)
        .then((res) => {
          const t = res.data.template;
          setForm({
            name: t.name || '',
            description: t.description || '',
            subject: t.subject || '',
          });
          if (t.blocks) setBlocks(t.blocks);
        })
        .catch((err) => {
          setSaveError(`Failed to load template: ${err.response?.data?.error || err.message}`);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      nameRef.current?.focus();
      setSaveError('Template name is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveCopyStack('');
    try {
      const payload = { ...form, blocks };
      if (id) {
        await updateEmailTemplate(id, payload);
      } else {
        const t = await createEmailTemplate(payload);
        // Redirect to edit URL so subsequent saves go to PUT
        navigate(`/assets/emails/${t.id}/edit`, { replace: true });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save.';
      const stack = err.response?.data?.stack || err.stack || '';
      setSaveError(msg);
      setSaveCopyStack(stack);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewHtml('');
    try {
      const res = await client.post('/email-templates/preview', {
        blocks,
        contactId: previewContactId || null,
      });
      setPreviewHtml(res.data.html || '');
    } catch (err) {
      setPreviewError(err.response?.data?.error || 'Failed to render preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Filtered contacts for picker
  const filteredContacts = (contacts || []).filter((c) => {
    const q = previewContactSearch.toLowerCase();
    if (!q) return true;
    return (c.email || '').toLowerCase().includes(q) ||
      (c.firstName || '').toLowerCase().includes(q) ||
      (c.lastName || '').toLowerCase().includes(q);
  }).slice(0, 20);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4F7FFF', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const inputStyle = {
    background: '#0F1117',
    border: '1px solid #252B3B',
    color: '#F1F3F9',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => navigate('/assets')}
            className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 transition-colors"
            style={{ background: '#181C27', border: '1px solid #252B3B', color: '#8B92A5' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F3F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ color: '#F1F3F9' }}>
              {id ? 'Edit Email Template' : 'New Email Template'}
            </h2>
            {form.name && (
              <p className="text-sm mt-0.5 truncate" style={{ color: '#8B92A5' }}>{form.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {saved && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#22C55E' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </div>
          )}
          {showPreview ? (
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#252B3B', color: '#F1F3F9', border: '1px solid #252B3B' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4F7FFF'; e.currentTarget.style.color = '#4F7FFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; e.currentTarget.style.color = '#F1F3F9'; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Editor
            </button>
          ) : (
            <button
              onClick={() => { setShowPreview(true); setPreviewHtml(''); setPreviewError(''); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#252B3B', color: '#F1F3F9', border: '1px solid #252B3B' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4F7FFF'; e.currentTarget.style.color = '#4F7FFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; e.currentTarget.style.color = '#F1F3F9'; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              Preview
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
            style={{ background: '#4F7FFF', color: '#fff' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#3B6EEE'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                Saving…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                </svg>
                Save Template
              </>
            )}
          </button>
        </div>
      </div>

      {/* Template metadata */}
      <div className="rounded-xl p-5" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B92A5' }}>
              Template Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              ref={nameRef}
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Welcome Email"
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B92A5' }}>
              Description <span style={{ color: '#4A5060' }}>(optional)</span>
            </label>
            <input
              style={inputStyle}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this template"
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B92A5' }}>
              Default Subject <span style={{ color: '#4A5060' }}>(optional)</span>
            </label>
            <input
              style={inputStyle}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Pre-fill campaign subject line"
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
          </div>
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: '#2D0E0E', border: '1px solid #EF4444', color: '#EF4444' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="flex-1">{saveError}</span>
          {saveCopyStack && (
            <button
              onClick={() => navigator.clipboard.writeText(saveCopyStack)}
              className="text-xs underline flex-shrink-0"
            >
              Copy trace
            </button>
          )}
        </div>
      )}

      {showPreview ? (
        /* ── Inline Preview ───────────────────────────────────────── */
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
          {/* Contact picker */}
          <div className="flex items-end gap-4">
            <div className="flex-1 relative">
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B92A5' }}>
                Preview as Contact <span style={{ color: '#4A5060' }}>(optional — uses real field values)</span>
              </label>
              <input
                type="text"
                value={previewContactSearch}
                onChange={(e) => { setPreviewContactSearch(e.target.value); setPreviewContactId(''); }}
                placeholder="Search by email or name…"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => setTimeout(() => (e.target.style.borderColor = '#252B3B'), 150)}
              />
              {previewContactSearch && !previewContactId && (
                <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid #252B3B', background: '#0F1117' }}>
                  {filteredContacts.length === 0 ? (
                    <p className="px-4 py-2 text-sm" style={{ color: '#8B92A5' }}>No contacts found</p>
                  ) : filteredContacts.map((c) => (
                    <button key={c.id || c._id}
                      className="w-full text-left px-4 py-2 text-sm transition-colors"
                      style={{ color: '#F1F3F9' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1E2436')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onMouseDown={() => {
                        setPreviewContactId(c.id || c._id);
                        setPreviewContactSearch(`${c.email}${c.firstName ? ` (${c.firstName}${c.lastName ? ' ' + c.lastName : ''})` : ''}`);
                      }}>
                      <span style={{ color: '#4F7FFF' }}>{c.email}</span>
                      {(c.firstName || c.lastName) && (
                        <span style={{ color: '#8B92A5' }}> · {[c.firstName, c.lastName].filter(Boolean).join(' ')}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {previewContactId && (
                <p className="mt-1 text-xs" style={{ color: '#22C55E' }}>✓ Variables will be replaced with this contact's data</p>
              )}
              {!previewContactId && !previewContactSearch && (
                <p className="mt-1 text-xs" style={{ color: '#4A5060' }}>Leave empty to preview with placeholder values</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {previewHtml && (
                <button
                  onClick={() => navigator.clipboard.writeText(previewHtml)}
                  className="px-3 py-2.5 rounded-lg text-sm transition-colors"
                  style={{ background: '#252B3B', color: '#8B92A5', border: '1px solid #252B3B' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F3F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; }}
                >
                  Copy HTML
                </button>
              )}
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                style={{ background: '#4F7FFF', color: '#fff' }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#3B6EEE'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
              >
                {previewLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    Rendering…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                    Render Preview
                  </>
                )}
              </button>
            </div>
          </div>

          {previewError && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440' }}>{previewError}</p>
          )}

          {/* iframe */}
          {previewHtml ? (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252B3B', height: 700, background: '#fff' }}>
              <iframe
                srcDoc={previewHtml}
                title="Email Preview"
                className="w-full h-full"
                style={{ border: 'none' }}
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            !previewLoading && (
              <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ border: '1px dashed #252B3B' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mb-3" style={{ color: '#4A5060' }}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                <p className="text-sm" style={{ color: '#4A5060' }}>Click "Render Preview" to see the email</p>
              </div>
            )
          )}
        </div>
      ) : (
        /* ── Block Canvas ─────────────────────────────────────────── */
        <div className="rounded-2xl p-5" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
          <BlockCanvas
            blocks={blocks}
            setBlocks={setBlocks}
            device={device}
            setDevice={setDevice}
            attributeDefinitions={attributeDefinitions}
            assets={assets}
          />
        </div>
      )}

      {/* Bottom save bar */}
      {!showPreview && (
        <div className="flex items-center justify-between px-5 py-3 rounded-xl" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
          <p className="text-xs" style={{ color: '#4A5060' }}>
            {blocks.length} block{blocks.length !== 1 ? 's' : ''} in template
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
            style={{ background: '#4F7FFF', color: '#fff' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#3B6EEE'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      )}
    </div>
  );
}
