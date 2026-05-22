import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';

// ─── Block definitions ────────────────────────────────────────────────────────
export const BLOCK_TYPES = [
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
    type: 'image',
    label: 'Image',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    defaultContent: { url: '', alt: '', link: '' },
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
  {
    type: 'mjml',
    label: 'MJML',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
    defaultContent: { code: '<mj-section background-color="#ffffff">\n  <mj-column padding="32px 40px">\n    <mj-text>Your MJML content here</mj-text>\n  </mj-column>\n</mj-section>' },
  },
  {
    type: 'html',
    label: 'HTML',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    defaultContent: { code: '<div style="padding: 32px 40px; background: #ffffff;">\n  <p>Your HTML content here</p>\n</div>' },
  },
];

// ─── Block preview renderer ───────────────────────────────────────────────────
export function BlockPreview({ block }) {
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
    case 'image':
      return c.url ? (
        <div className="py-2 flex justify-center">
          <img src={c.url} alt={c.alt || ''} className="max-w-full rounded" style={{ maxHeight: 200, objectFit: 'contain' }} />
        </div>
      ) : (
        <div className="py-6 flex flex-col items-center justify-center gap-2 rounded-lg" style={{ background: '#0F1117', border: '2px dashed #252B3B' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#4A5060" strokeWidth="1.5" className="w-8 h-8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-xs" style={{ color: '#4A5060' }}>No image set — click to edit</p>
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
    case 'html': {
      const code = c.code || '';
      if (!code.trim()) {
        return (
          <div className="py-4 flex items-center justify-center rounded-lg" style={{ background: '#0F1117', border: '1px dashed #252B3B' }}>
            <span className="text-xs" style={{ color: '#4A5060' }}>Empty HTML block</span>
          </div>
        );
      }
      return (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1E2436' }}>
          <div className="flex items-center gap-2 px-3 py-1" style={{ background: '#1A1F2E', borderBottom: '1px solid #1E2436' }}>
            <span className="text-xs font-bold" style={{ color: '#22C55E' }}>HTML</span>
          </div>
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;}</style></head><body>${code}</body></html>`}
            title="HTML preview"
            className="w-full"
            style={{ border: 'none', background: '#fff', display: 'block', height: 120 }}
            sandbox="allow-same-origin"
            scrolling="no"
          />
        </div>
      );
    }
    case 'mjml': {
      const lines = (c.code || '').split('\n').slice(0, 8);
      return (
        <div className="rounded-lg overflow-hidden" style={{ background: '#0D0F14', border: '1px solid #1E2436' }}>
          <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: '#1A1F2E', borderBottom: '1px solid #1E2436' }}>
            <span className="text-xs font-bold" style={{ color: '#A78BFA' }}>MJML</span>
            <span className="text-xs" style={{ color: '#4A5060' }}>renders server-side on preview</span>
          </div>
          <pre className="px-3 py-2 text-xs overflow-hidden" style={{ color: '#8B92A5', fontFamily: 'monospace', whiteSpace: 'pre', lineHeight: 1.6 }}>
            {lines.join('\n')}{(c.code || '').split('\n').length > 8 ? '\n…' : ''}
          </pre>
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Block editor panel ───────────────────────────────────────────────────────
export function BlockEditor({ block, onChange, onOpenImagePicker }) {
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
    case 'image':
      return (
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Image URL</label>
            <input style={inputStyle} value={c.url || ''} onChange={(e) => update('url', e.target.value)} placeholder="https://example.com/image.jpg" />
          </div>
          {onOpenImagePicker && (
            <button
              onClick={onOpenImagePicker}
              className="w-full py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: '#1A1F2E', border: '1px solid #4F7FFF', color: '#4F7FFF' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1A2744'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1A1F2E'; }}
            >
              Browse Asset Library
            </button>
          )}
          <div>
            <label style={labelStyle}>Alt Text</label>
            <input style={inputStyle} value={c.alt || ''} onChange={(e) => update('alt', e.target.value)} placeholder="Descriptive alt text" />
          </div>
          <div>
            <label style={labelStyle}>Link URL (optional)</label>
            <input style={inputStyle} value={c.link || ''} onChange={(e) => update('link', e.target.value)} placeholder="https://yoursite.com" />
          </div>
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
    case 'mjml':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label style={labelStyle}>MJML Code</label>
            <span style={{ fontSize: 11, color: '#4A5060' }}>
              Paste a full <code style={{ color: '#A78BFA' }}>&lt;mjml&gt;</code> doc or a bare <code style={{ color: '#A78BFA' }}>&lt;mj-section&gt;</code> fragment
            </span>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #252B3B' }}>
            <CodeMirror
              value={c.code || ''}
              height="320px"
              theme={oneDark}
              extensions={[htmlLang()]}
              onChange={(val) => update('code', val)}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true }}
            />
          </div>
        </div>
      );
    case 'html':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label style={labelStyle}>HTML Code</label>
            <span style={{ fontSize: 11, color: '#4A5060' }}>
              Injected via <code style={{ color: '#22C55E' }}>&lt;mj-raw&gt;</code> — use inline styles
            </span>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #252B3B' }}>
            <CodeMirror
              value={c.code || ''}
              height="320px"
              theme={oneDark}
              extensions={[htmlLang()]}
              onChange={(val) => update('code', val)}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true }}
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}

// ─── Variables picker ─────────────────────────────────────────────────────────
export const STANDARD_VARS = [
  { token: '{{first_name}}',      label: 'First Name' },
  { token: '{{last_name}}',       label: 'Last Name' },
  { token: '{{full_name}}',       label: 'Full Name' },
  { token: '{{email}}',           label: 'Email' },
  { token: '{{company}}',         label: 'Company' },
  { token: '{{phone}}',           label: 'Phone' },
  { token: '{{sex}}',             label: 'Sex' },
  { token: '{{birthday}}',        label: 'Birthday' },
  { token: '{{current_year}}',    label: 'Current Year' },
  { token: '{{unsubscribe_url}}', label: 'Unsubscribe URL' },
  { token: '{{preference_url}}',  label: 'Preferences URL' },
];

export function VariablesPicker({ attributeDefinitions = [] }) {
  const [copied, setCopied] = useState(null);

  const copy = (token) => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const allVars = [
    ...STANDARD_VARS,
    ...attributeDefinitions.map((def) => ({
      token: `{{custom.${def.key}}}`,
      label: def.name,
      custom: true,
    })),
  ];

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: '#252B3B' }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8B92A5' }}>
        Variables
      </p>
      <p className="text-xs mb-3" style={{ color: '#4A5060' }}>
        Click to copy, then paste into any text field.
      </p>
      <div className="flex flex-col gap-1">
        {allVars.map(({ token, label, custom }) => (
          <button
            key={token}
            onClick={() => copy(token)}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors w-full"
            style={{
              background: copied === token ? '#052E16' : '#181C27',
              border: `1px solid ${copied === token ? '#22C55E' : '#252B3B'}`,
              color: copied === token ? '#22C55E' : '#8B92A5',
            }}
            title={`Copy ${token}`}
          >
            <span style={{ color: copied === token ? '#22C55E' : custom ? '#A78BFA' : '#4F7FFF', fontFamily: 'monospace' }}>
              {token}
            </span>
            {copied === token ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0 opacity-40">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Image Picker Modal ───────────────────────────────────────────────────────
function ImagePickerModal({ isOpen, onClose, onSelect, assets }) {
  const imageAssets = (assets || []).filter((a) => a.type === 'image');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-xl shadow-2xl" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#252B3B' }}>
          <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>Asset Library — Images</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: '#8B92A5' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#252B3B'; e.currentTarget.style.color = '#F1F3F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B92A5'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto">
          {imageAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="1.5" className="w-12 h-12">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-sm" style={{ color: '#4A5060' }}>No images uploaded yet. Go to Assets to upload images.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {imageAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => { onSelect(asset.url); onClose(); }}
                  className="group rounded-lg overflow-hidden transition-all"
                  style={{ border: '2px solid #252B3B' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4F7FFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; }}
                >
                  <div className="aspect-video bg-[#0F1117] flex items-center justify-center overflow-hidden">
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="px-2 py-1.5" style={{ background: '#0F1117' }}>
                    <p className="text-xs truncate" style={{ color: '#8B92A5' }}>{asset.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BlockCanvas (was DesignStep) ─────────────────────────────────────────────
export default function BlockCanvas({ blocks, setBlocks, device, setDevice, attributeDefinitions, assets }) {
  const [selectedId, setSelectedId] = useState(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

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

  const handleImageSelect = (url) => {
    if (selectedBlock && selectedBlock.type === 'image') {
      updateBlock({ ...selectedBlock, content: { ...selectedBlock.content, url } });
    }
  };

  return (
    <>
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
          className="flex-shrink-0 rounded-xl overflow-y-auto transition-all"
          style={{
            width: ['mjml', 'html'].includes(selectedBlock?.type) ? 520 : 224,
            background: '#0F1117',
            border: '1px solid #252B3B',
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: '#252B3B' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B92A5' }}>
              {selectedBlock ? `Edit: ${selectedBlock.label}` : 'Properties'}
            </p>
          </div>
          <div className="p-4">
            {selectedBlock ? (
              <>
                <BlockEditor
                  block={selectedBlock}
                  onChange={updateBlock}
                  onOpenImagePicker={selectedBlock.type === 'image' ? () => setImagePickerOpen(true) : undefined}
                />
                {['text', 'hero'].includes(selectedBlock.type) && (
                  <VariablesPicker attributeDefinitions={attributeDefinitions} />
                )}
              </>
            ) : (
              <>
                <p className="text-xs" style={{ color: '#4B5563' }}>
                  Click a block on the canvas to edit its content.
                </p>
                <VariablesPicker attributeDefinitions={attributeDefinitions} />
              </>
            )}
          </div>
        </div>
      </div>

      <ImagePickerModal
        isOpen={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={handleImageSelect}
        assets={assets}
      />
    </>
  );
}
