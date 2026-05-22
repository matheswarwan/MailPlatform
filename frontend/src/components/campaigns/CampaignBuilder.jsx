import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAppStore from '../../store/appStore';
import Button from '../ui/Button';
import client from '../../api/client';
import BlockCanvas from '../email/BlockCanvas';

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step, currentStep }) {
  const steps = ['Setup', 'Design', 'Review'];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const num = i + 1;
        const isActive = num === currentStep;
        const isDone = num < currentStep;
        return (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: isDone ? '#22C55E' : isActive ? '#4F7FFF' : '#252B3B',
                  color: isDone || isActive ? '#fff' : '#8B92A5',
                }}
              >
                {isDone ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : num}
              </div>
              <span className="text-sm font-medium" style={{ color: isActive ? '#F1F3F9' : '#8B92A5' }}>
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-12 h-px mx-3" style={{ background: num < currentStep ? '#22C55E' : '#252B3B' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Input component ──────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" style={{ color: '#8B92A5' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
      style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
      onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
      onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
    />
  );
}

// ─── Step 1: Setup ────────────────────────────────────────────────────────────
function SetupStep({ form, setForm, segments, verifiedEmails, verifiedDomains, emailTemplates, onLoadTemplate }) {
  const [templateSectionOpen, setTemplateSectionOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const handleLoadTemplate = () => {
    if (!selectedTemplateId) return;
    const tpl = emailTemplates.find((t) => t.id === selectedTemplateId);
    if (tpl) onLoadTemplate(tpl);
  };

  return (
    <div className="space-y-5">
      {/* Start from template (collapsible) */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252B3B' }}>
        <button
          onClick={() => setTemplateSectionOpen(!templateSectionOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
          style={{ background: '#0F1117', color: '#8B92A5' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F3F9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; }}
        >
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{ color: '#4F7FFF' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            Start from an email template <span className="px-1.5 py-0.5 rounded text-xs ml-1" style={{ background: '#1A2744', color: '#4F7FFF' }}>optional</span>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 transition-transform" style={{ transform: templateSectionOpen ? 'rotate(180deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {templateSectionOpen && (
          <div className="px-4 py-4" style={{ background: '#181C27', borderTop: '1px solid #252B3B' }}>
            {emailTemplates.length === 0 ? (
              <p className="text-sm" style={{ color: '#4A5060' }}>No email templates saved yet. Create one in Assets &rarr; Emails.</p>
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: selectedTemplateId ? '#F1F3F9' : '#8B92A5' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                  onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                >
                  <option value="">Select a template…</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleLoadTemplate}
                  disabled={!selectedTemplateId}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#4F7FFF', color: '#fff' }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#3B6EEE'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
                >
                  Load Template
                </button>
              </div>
            )}
            {selectedTemplateId && (
              <p className="mt-2 text-xs" style={{ color: '#EAB308' }}>
                Loading a template will replace any blocks you have already added in the Design step.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="col-span-2">
          <Field label="Campaign Name" required>
            <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Summer Sale 2025" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Subject Line" required>
            <Input value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="e.g. Hey {{first_name}}, don't miss our biggest sale!" />
            <p className="mt-1 text-xs" style={{ color: '#4A5060' }}>
              Tip: use <code style={{ color: '#4F7FFF' }}>{'{{first_name}}'}</code> or any variable — personalisation tokens work in the subject line too.
            </p>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Preview Text">
            <Input value={form.previewText} onChange={(v) => setForm({ ...form, previewText: v })} placeholder="e.g. Up to 50% off — this weekend only" />
          </Field>
        </div>
        <Field label="From Name" required>
          <Input value={form.fromName} onChange={(v) => setForm({ ...form, fromName: v })} placeholder="e.g. Acme Team" />
        </Field>
        <Field label="From Email" required>
          {verifiedEmails.length > 0 ? (
            <select
              value={form.fromEmail}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: form.fromEmail ? '#F1F3F9' : '#8B92A5' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            >
              <option value="">Select a verified sender…</option>
              {verifiedEmails.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
              {verifiedDomains.map((domain) => (
                <option key={`domain:${domain}`} value={`sender@${domain}`}>sender@{domain} (any address on {domain})</option>
              ))}
            </select>
          ) : (
            <>
              <Input value={form.fromEmail} onChange={(v) => setForm({ ...form, fromEmail: v })} placeholder="e.g. hello@acme.com" type="email" />
              <p className="mt-1 text-xs" style={{ color: '#EAB308' }}>
                No verified SES identities found. Verify an email or domain in the AWS SES console before sending.
              </p>
            </>
          )}
        </Field>
        <Field label="Reply-To Email">
          <Input value={form.replyTo} onChange={(v) => setForm({ ...form, replyTo: v })} placeholder="e.g. support@acme.com" type="email" />
        </Field>
        <Field label="Audience Segment" required>
          <select
            value={form.segmentId}
            onChange={(e) => setForm({ ...form, segmentId: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{ background: '#0F1117', border: '1px solid #252B3B', color: form.segmentId ? '#F1F3F9' : '#8B92A5' }}
            onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
            onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
          >
            <option value="">Select a segment…</option>
            {segments.map((seg) => (
              <option key={seg.id || seg._id} value={seg.id || seg._id}>
                {seg.name} {seg.contactCount ? `(${seg.contactCount.toLocaleString()})` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────
function ReviewStep({ form, blocks, segments, onSend, onSchedule, sending, sent, scheduledAt, setScheduledAt }) {
  const seg = segments.find((s) => (s.id || s._id) === form.segmentId);

  const checks = [
    { label: 'Campaign name set', ok: !!form.name },
    { label: 'Subject line set', ok: !!form.subject },
    { label: 'From email set', ok: !!form.fromEmail },
    { label: 'Audience segment selected', ok: !!form.segmentId },
    { label: 'Email has at least one block', ok: blocks.length > 0 },
    { label: 'Unsubscribe link: Auto-injected', ok: true, auto: true },
    { label: 'Preference Centre link: Auto-injected', ok: true, auto: true },
  ];

  const allReady = checks.filter((c) => !c.auto).every((c) => c.ok);

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rounded-xl p-5 space-y-4" style={{ background: '#0F1117', border: '1px solid #252B3B' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Campaign Summary</h3>
        {[
          { label: 'Name', value: form.name || '—' },
          { label: 'Subject', value: form.subject || '—' },
          { label: 'Preview Text', value: form.previewText || '—' },
          { label: 'From', value: form.fromName ? `${form.fromName} <${form.fromEmail}>` : form.fromEmail || '—' },
          { label: 'Reply-To', value: form.replyTo || form.fromEmail || '—' },
          { label: 'Segment', value: seg ? seg.name : '—' },
          { label: 'Email Blocks', value: `${blocks.length} block${blocks.length !== 1 ? 's' : ''}` },
        ].map(({ label, value }) => (
          <div key={label} className="flex gap-3">
            <span className="text-sm w-28 flex-shrink-0" style={{ color: '#8B92A5' }}>{label}</span>
            <span className="text-sm font-medium flex-1 truncate" style={{ color: '#F1F3F9' }}>{value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <div className="rounded-xl p-5 space-y-3" style={{ background: '#0F1117', border: '1px solid #252B3B' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Pre-Send Checklist</h3>
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ background: c.ok ? (c.auto ? '#1A2744' : '#052E16') : '#2D0E0E' }}>
                {c.ok ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke={c.auto ? '#4F7FFF' : '#22C55E'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                )}
              </div>
              <span className="text-sm" style={{ color: c.ok ? '#F1F3F9' : '#EF4444' }}>{c.label}</span>
              {c.auto && (
                <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: '#1A2744', color: '#4F7FFF' }}>auto</span>
              )}
            </div>
          ))}
        </div>

        {sent ? (
          <div className="rounded-xl p-5 flex flex-col items-center gap-2" style={{ background: '#052E16', border: '1px solid #22C55E' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm font-semibold" style={{ color: '#22C55E' }}>Campaign sent successfully!</p>
          </div>
        ) : (
          <div className="rounded-xl p-5 space-y-4" style={{ background: '#0F1117', border: '1px solid #252B3B' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Send Campaign</h3>
            <Button variant="primary" size="md" className="w-full" onClick={onSend} loading={sending} disabled={!allReady || sending}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send Now
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px" style={{ background: '#252B3B' }} />
              <span className="text-xs" style={{ color: '#8B92A5' }}>or schedule</span>
              <div className="flex-1 h-px" style={{ background: '#252B3B' }} />
            </div>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: '#181C27', border: '1px solid #252B3B', color: '#F1F3F9' }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
              />
              <Button variant="secondary" size="md" onClick={onSchedule} disabled={!scheduledAt || !allReady || sending} loading={sending}>
                Schedule
              </Button>
            </div>
            {!allReady && (
              <p className="text-xs" style={{ color: '#EAB308' }}>Complete all required fields before sending.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main CampaignBuilder ─────────────────────────────────────────────────────
export default function CampaignBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    segments, fetchSegments,
    createCampaign, updateCampaign, sendCampaign,
    attributeDefinitions, fetchAttributeDefinitions,
    assets, fetchAssets,
    emailTemplates, fetchEmailTemplates,
  } = useAppStore();

  const [step, setStep] = useState(1);
  const [device, setDevice] = useState('Desktop');
  const [blocks, setBlocks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedId, setSavedId] = useState(id || null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saveError, setSaveError] = useState('');
  const [verifiedEmails, setVerifiedEmails] = useState([]);
  const [verifiedDomains, setVerifiedDomains] = useState([]);

  const [form, setForm] = useState({
    name: '',
    subject: '',
    previewText: '',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    segmentId: '',
  });

  useEffect(() => {
    client.get('/ses/identities').then((res) => {
      setVerifiedEmails(res.data.emails || []);
      setVerifiedDomains(res.data.domains || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchSegments();
    fetchAttributeDefinitions();
    fetchEmailTemplates();
    fetchAssets();
    if (id) {
      client.get(`/campaigns/${id}`).then((res) => {
        const c = res.data.campaign || res.data;
        setForm({
          name: c.name || '',
          subject: c.subject_line || c.subject || '',
          previewText: c.preview_text || c.previewText || '',
          fromName: c.from_name || c.fromName || '',
          fromEmail: c.from_email || c.fromEmail || '',
          replyTo: c.reply_to || c.replyTo || '',
          segmentId: c.segment_id || c.segmentId || '',
        });
        const loadedBlocks = c.template_blocks || c.blocks;
        if (loadedBlocks) setBlocks(loadedBlocks);
      }).catch(() => {});
    }
  }, [id]);

  const handleLoadTemplate = (template) => {
    if (template.blocks) {
      // Re-assign IDs to avoid collisions
      const loaded = template.blocks.map((b) => ({ ...b, id: Date.now() + Math.random() }));
      setBlocks(loaded);
    }
    // Pre-fill subject if template has one and campaign subject is empty
    if (template.subject && !form.subject) {
      setForm((f) => ({ ...f, subject: template.subject }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload = { ...form, blocks };
      if (savedId) {
        await updateCampaign(savedId, payload);
      } else {
        const campaign = await createCampaign(payload);
        setSavedId(campaign.id || campaign._id);
      }
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setSaveError('');
    try {
      let cid = savedId;
      if (!cid) {
        const campaign = await createCampaign({ ...form, blocks });
        cid = campaign.id || campaign._id;
        setSavedId(cid);
      } else {
        await updateCampaign(cid, { ...form, blocks });
      }
      await sendCampaign(cid);
      setSent(true);
    } catch (err) {
      setSaveError(err.response?.data?.message || err.response?.data?.error || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledAt) return;
    setSending(true);
    setSaveError('');
    try {
      let cid = savedId;
      if (!cid) {
        const campaign = await createCampaign({ ...form, blocks });
        cid = campaign.id || campaign._id;
        setSavedId(cid);
      } else {
        await updateCampaign(cid, { ...form, blocks });
      }
      await sendCampaign(cid, scheduledAt);
      setSent(true);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to schedule. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const canProceed = {
    1: form.name && form.subject && form.fromEmail && form.segmentId,
    2: blocks.length > 0,
    3: true,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/campaigns')}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ background: '#181C27', border: '1px solid #252B3B', color: '#8B92A5' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F3F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>
              {id ? 'Edit Campaign' : 'New Campaign'}
            </h2>
            {form.name && <p className="text-sm mt-0.5" style={{ color: '#8B92A5' }}>{form.name}</p>}
          </div>
        </div>
        <StepIndicator step={step} currentStep={step} />
      </div>

      <div className="rounded-2xl p-6" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
        {step === 1 && (
          <SetupStep
            form={form}
            setForm={setForm}
            segments={segments}
            verifiedEmails={verifiedEmails}
            verifiedDomains={verifiedDomains}
            emailTemplates={emailTemplates}
            onLoadTemplate={handleLoadTemplate}
          />
        )}
        {step === 2 && (
          <BlockCanvas
            blocks={blocks}
            setBlocks={setBlocks}
            device={device}
            setDevice={setDevice}
            attributeDefinitions={attributeDefinitions}
            assets={assets}
          />
        )}
        {step === 3 && (
          <ReviewStep
            form={form} blocks={blocks} segments={segments}
            onSend={handleSend} onSchedule={handleSchedule}
            sending={sending} sent={sent}
            scheduledAt={scheduledAt} setScheduledAt={setScheduledAt}
          />
        )}

        {saveError && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: '#2D0E0E', border: '1px solid #EF4444', color: '#EF4444' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {saveError}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-6 border-t" style={{ borderColor: '#252B3B' }}>
          <Button variant="secondary" size="md" onClick={() => step > 1 ? setStep(step - 1) : navigate('/campaigns')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="md" onClick={handleSave} loading={saving}>Save Draft</Button>
            {step < 3 ? (
              <Button variant="primary" size="md" onClick={() => setStep(step + 1)} disabled={!canProceed[step]}>
                Continue
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Button>
            ) : sent ? (
              <Button variant="primary" size="md" onClick={() => navigate('/campaigns')}>View Campaigns</Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
