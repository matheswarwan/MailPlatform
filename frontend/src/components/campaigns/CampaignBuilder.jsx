import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAppStore from '../../store/appStore';
import Button from '../ui/Button';
import client from '../../api/client';

// ─── Block definitions ────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  {
    type: 'hero',
    label: 'Hero Banner',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
      </svg>
    ),
    defaultContent: { headline: 'Hero Headline', subheadline: 'Your subheadline goes here', bgColor: '#4F7FFF' },
  },
  {
    type: 'text',
    label: 'Text Block',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="17" y1="10" x2="3" y2="10" />
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="14" y1="18" x2="3" y2="18" />
      </svg>
    ),
    defaultContent: { content: 'Add your text here. You can write a message to your audience.' },
  },
  {
    type: 'button',
    label: 'CTA Button',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="8" width="18" height="8" rx="4" />
      </svg>
    ),
    defaultContent: { label: 'Click Here', url: '', bgColor: '#4F7FFF' },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    ),
    defaultContent: {},
  },
  {
    type: 'social',
    label: 'Social Links',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    defaultContent: { twitter: '', linkedin: '', instagram: '' },
  },
  {
    type: 'footer',
    label: 'Footer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 15h18" />
      </svg>
    ),
    defaultContent: { company: 'Company Name', address: '123 Main St, City, Country' },
  },
];

// ─── Block preview renderer ───────────────────────────────────────────────────
function BlockPreview({ block }) {
  const c = block.content || {};
  switch (block.type) {
    case 'hero':
      return (
        <div className="rounded-lg py-8 px-4 text-center" style={{ background: c.bgColor || '#4F7FFF' }}>
          <p className="text-white font-bold text-lg">{c.headline || 'Hero Headline'}</p>
          <p className="text-blue-200 text-sm mt-1">{c.subheadline || 'Your subheadline goes here'}</p>
        </div>
      );
    case 'text':
      return (
        <div className="py-3 px-2 text-sm whitespace-pre-wrap" style={{ color: '#F1F3F9' }}>
          {c.content || 'Add your text here.'}
        </div>
      );
    case 'button':
      return (
        <div className="flex justify-center py-3">
          <div className="px-6 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: c.bgColor || '#4F7FFF' }}>
            {c.label || 'Click Here'}
          </div>
        </div>
      );
    case 'divider':
      return (
        <div className="py-3">
          <div className="h-px w-full" style={{ background: '#252B3B' }} />
        </div>
      );
    case 'social':
      return (
        <div className="flex justify-center gap-3 py-3">
          {['T', 'Li', 'Ig'].map((s) => (
            <div key={s} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#252B3B', color: '#8B92A5' }}>
              {s}
            </div>
          ))}
        </div>
      );
    case 'footer':
      return (
        <div className="py-4 text-center" style={{ background: '#0F1117', borderRadius: 8 }}>
          <p className="text-xs" style={{ color: '#8B92A5' }}>{c.company || 'Company Name'} | Unsubscribe | Preferences</p>
          <p className="text-xs mt-1" style={{ color: '#4B5563' }}>{c.address || '123 Main St, City, Country'}</p>
        </div>
      );
    default:
      return null;
  }
}

// ─── Block editor panel ───────────────────────────────────────────────────────
function BlockEditor({ block, onChange }) {
  const c = block.content || {};

  const update = (key, value) => onChange({ ...block, content: { ...c, [key]: value } });

  const inputStyle = {
    background: '#0F1117',
    border: '1px solid #252B3B',
    color: '#F1F3F9',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  };

  const labelStyle = { color: '#8B92A5', fontSize: 12, marginBottom: 4, display: 'block' };

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Headline</label>
            <input style={inputStyle} value={c.headline || ''} onChange={(e) => update('headline', e.target.value)} placeholder="Hero Headline" />
          </div>
          <div>
            <label style={labelStyle}>Subheadline</label>
            <input style={inputStyle} value={c.subheadline || ''} onChange={(e) => update('subheadline', e.target.value)} placeholder="Your subheadline goes here" />
          </div>
          <div>
            <label style={labelStyle}>Background Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={c.bgColor || '#4F7FFF'} onChange={(e) => update('bgColor', e.target.value)} className="w-9 h-9 rounded cursor-pointer" style={{ background: 'none', border: '1px solid #252B3B', padding: 2 }} />
              <input style={{ ...inputStyle, flex: 1 }} value={c.bgColor || '#4F7FFF'} onChange={(e) => update('bgColor', e.target.value)} placeholder="#4F7FFF" />
            </div>
          </div>
        </div>
      );
    case 'text':
      return (
        <div>
          <label style={labelStyle}>Content</label>
          <textarea
            style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
            value={c.content || ''}
            onChange={(e) => update('content', e.target.value)}
            placeholder="Add your text here..."
          />
        </div>
      );
    case 'button':
      return (
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Button Label</label>
            <input style={inputStyle} value={c.label || ''} onChange={(e) => update('label', e.target.value)} placeholder="Click Here" />
          </div>
          <div>
            <label style={labelStyle}>URL</label>
            <input style={inputStyle} value={c.url || ''} onChange={(e) => update('url', e.target.value)} placeholder="https://yoursite.com/offer" />
          </div>
          <div>
            <label style={labelStyle}>Button Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={c.bgColor || '#4F7FFF'} onChange={(e) => update('bgColor', e.target.value)} className="w-9 h-9 rounded cursor-pointer" style={{ background: 'none', border: '1px solid #252B3B', padding: 2 }} />
              <input style={{ ...inputStyle, flex: 1 }} value={c.bgColor || '#4F7FFF'} onChange={(e) => update('bgColor', e.target.value)} placeholder="#4F7FFF" />
            </div>
          </div>
        </div>
      );
    case 'social':
      return (
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Twitter URL</label>
            <input style={inputStyle} value={c.twitter || ''} onChange={(e) => update('twitter', e.target.value)} placeholder="https://twitter.com/yourhandle" />
          </div>
          <div>
            <label style={labelStyle}>LinkedIn URL</label>
            <input style={inputStyle} value={c.linkedin || ''} onChange={(e) => update('linkedin', e.target.value)} placeholder="https://linkedin.com/company/yourco" />
          </div>
          <div>
            <label style={labelStyle}>Instagram URL</label>
            <input style={inputStyle} value={c.instagram || ''} onChange={(e) => update('instagram', e.target.value)} placeholder="https://instagram.com/yourhandle" />
          </div>
        </div>
      );
    case 'footer':
      return (
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Company Name</label>
            <input style={inputStyle} value={c.company || ''} onChange={(e) => update('company', e.target.value)} placeholder="Company Name" />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={c.address || ''} onChange={(e) => update('address', e.target.value)} placeholder="123 Main St, City, Country" />
          </div>
        </div>
      );
    case 'divider':
      return <p style={{ color: '#8B92A5', fontSize: 13 }}>No editable content for dividers.</p>;
    default:
      return null;
  }
}

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
function SetupStep({ form, setForm, segments }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="col-span-2">
        <Field label="Campaign Name" required>
          <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Summer Sale 2025" />
        </Field>
      </div>
      <div className="col-span-2">
        <Field label="Subject Line" required>
          <Input value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="e.g. Don't miss our biggest sale of the year" />
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
        <Input value={form.fromEmail} onChange={(v) => setForm({ ...form, fromEmail: v })} placeholder="e.g. hello@acme.com" type="email" />
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
  );
}

// ─── Step 2: Design ───────────────────────────────────────────────────────────
function DesignStep({ blocks, setBlocks, device, setDevice }) {
  const [selectedId, setSelectedId] = useState(null);

  const addBlock = (type) => {
    const blockDef = BLOCK_TYPES.find((b) => b.type === type);
    const newBlock = { id: Date.now(), type, label: blockDef.label, content: { ...blockDef.defaultContent } };
    setBlocks([...blocks, newBlock]);
    setSelectedId(newBlock.id);
  };

  const removeBlock = (id) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const moveBlock = (id, dir) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === blocks.length - 1)) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[idx + dir];
    newBlocks[idx + dir] = newBlocks[idx];
    newBlocks[idx] = temp;
    setBlocks(newBlocks);
  };

  const updateBlock = (updated) => {
    setBlocks(blocks.map((b) => (b.id === updated.id ? updated : b)));
  };

  const selectedBlock = blocks.find((b) => b.id === selectedId);

  return (
    <div className="flex gap-4" style={{ height: 520 }}>
      {/* Block palette */}
      <div
        className="w-44 flex-shrink-0 rounded-xl p-3 space-y-2 overflow-y-auto"
        style={{ background: '#0F1117', border: '1px solid #252B3B' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-3" style={{ color: '#8B92A5' }}>
          Blocks
        </p>
        {BLOCK_TYPES.map((b) => (
          <button
            key={b.type}
            onClick={() => addBlock(b.type)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
            style={{ color: '#8B92A5', border: '1px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#181C27';
              e.currentTarget.style.borderColor = '#4F7FFF';
              e.currentTarget.style.color = '#F1F3F9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = '#8B92A5';
            }}
          >
            <span style={{ color: '#4F7FFF' }}>{b.icon}</span>
            {b.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col rounded-xl overflow-hidden" style={{ border: '1px solid #252B3B' }}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ background: '#0F1117', borderColor: '#252B3B' }}
        >
          <p className="text-sm font-medium" style={{ color: '#8B92A5' }}>Email Canvas</p>
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#181C27' }}>
            {['Desktop', 'Mobile'].map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: device === d ? '#4F7FFF' : 'transparent',
                  color: device === d ? '#fff' : '#8B92A5',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4" style={{ background: '#0F1117' }}>
          <div
            className="mx-auto rounded-xl overflow-hidden transition-all duration-300"
            style={{ maxWidth: device === 'Mobile' ? 375 : 600, background: '#181C27', border: '1px solid #252B3B' }}
          >
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                <p className="text-sm" style={{ color: '#252B3B' }}>Add blocks from the left panel</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#252B3B' }}>
                {blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="group relative px-4 py-3 cursor-pointer transition-all"
                    style={{
                      background: selectedId === block.id ? '#1A2744' : 'transparent',
                      outline: selectedId === block.id ? '2px solid #4F7FFF' : 'none',
                      outlineOffset: -2,
                    }}
                    onClick={() => setSelectedId(selectedId === block.id ? null : block.id)}
                    onMouseEnter={(e) => { if (selectedId !== block.id) e.currentTarget.style.background = '#1E2436'; }}
                    onMouseLeave={(e) => { if (selectedId !== block.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <BlockPreview block={block} />

                    <div
                      className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 rounded-lg p-1"
                      style={{ background: '#252B3B' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button onClick={() => moveBlock(block.id, -1)} disabled={idx === 0} className="p-1 rounded transition-colors disabled:opacity-30" style={{ color: '#8B92A5' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F3F9')} onMouseLeave={(e) => (e.currentTarget.style.color = '#8B92A5')} title="Move up">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1} className="p-1 rounded transition-colors disabled:opacity-30" style={{ color: '#8B92A5' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F3F9')} onMouseLeave={(e) => (e.currentTarget.style.color = '#8B92A5')} title="Move down">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      <div className="w-px h-4 mx-0.5" style={{ background: '#1E2436' }} />
                      <button onClick={() => removeBlock(block.id)} className="p-1 rounded transition-colors" style={{ color: '#8B92A5' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')} onMouseLeave={(e) => (e.currentTarget.style.color = '#8B92A5')} title="Delete block">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>

                    {selectedId !== block.id && (
                      <div className="absolute bottom-2 left-2 hidden group-hover:block px-1.5 py-0.5 rounded text-xs" style={{ background: '#252B3B', color: '#8B92A5' }}>
                        {block.label} — click to edit
                      </div>
                    )}
                    {selectedId === block.id && (
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-xs" style={{ background: '#4F7FFF', color: '#fff' }}>
                        Editing
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit panel */}
      <div
        className="w-56 flex-shrink-0 rounded-xl overflow-y-auto"
        style={{ background: '#0F1117', border: '1px solid #252B3B' }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: '#252B3B' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B92A5' }}>
            {selectedBlock ? `Edit: ${selectedBlock.label}` : 'Properties'}
          </p>
        </div>
        <div className="p-4">
          {selectedBlock ? (
            <BlockEditor block={selectedBlock} onChange={updateBlock} />
          ) : (
            <p className="text-xs" style={{ color: '#4B5563' }}>
              Click a block on the canvas to edit its content.
            </p>
          )}
        </div>
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
  const { segments, fetchSegments, createCampaign, updateCampaign, sendCampaign } = useAppStore();

  const [step, setStep] = useState(1);
  const [device, setDevice] = useState('Desktop');
  const [blocks, setBlocks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedId, setSavedId] = useState(id || null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saveError, setSaveError] = useState('');

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
    fetchSegments();
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
        {step === 1 && <SetupStep form={form} setForm={setForm} segments={segments} />}
        {step === 2 && <DesignStep blocks={blocks} setBlocks={setBlocks} device={device} setDevice={setDevice} />}
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
