import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import client from '../api/client';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TYPE_BADGE = {
  image: { label: 'Image', bg: '#0C2444', color: '#4F7FFF' },
  pdf: { label: 'PDF', bg: '#2D1810', color: '#F97316' },
  html: { label: 'HTML', bg: '#0D2B1A', color: '#22C55E' },
  other: { label: 'File', bg: '#1A1A2E', color: '#8B92A5' },
};

// ─── File asset card ──────────────────────────────────────────────────────────
function AssetCard({ asset, onDelete, onPreview }) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const badge = TYPE_BADGE[asset.type] || TYPE_BADGE.other;

  const copyUrl = () => {
    navigator.clipboard.writeText(asset.url || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(asset.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
    >
      {/* Thumbnail / preview area */}
      <div
        className="aspect-video flex items-center justify-center overflow-hidden cursor-pointer relative group"
        style={{ background: '#0F1117' }}
        onClick={() => onPreview(asset)}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#4F7FFF', color: '#fff' }}>
            {asset.type === 'image' ? 'View' : 'Open'}
          </span>
        </div>
        {asset.type === 'image' ? (
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : asset.type === 'pdf' ? (
          <div className="flex flex-col items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="text-xs" style={{ color: '#F97316' }}>PDF</span>
          </div>
        ) : asset.type === 'html' ? (
          <div className="flex flex-col items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span className="text-xs" style={{ color: '#22C55E' }}>HTML</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8B92A5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <span className="text-xs" style={{ color: '#8B92A5' }}>File</span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight truncate flex-1" style={{ color: '#F1F3F9' }} title={asset.name}>
            {asset.name}
          </p>
          <span className="px-1.5 py-0.5 rounded text-xs flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: '#4A5060' }}>{formatBytes(asset.size_bytes)}</span>
          <span className="text-xs" style={{ color: '#4A5060' }}>{formatDate(asset.created_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={copyUrl}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: copied ? '#052E16' : '#1A1F2E',
              border: `1px solid ${copied ? '#22C55E' : '#252B3B'}`,
              color: copied ? '#22C55E' : '#8B92A5',
            }}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy URL
              </>
            )}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: '#2D0E0E', border: '1px solid #EF4444', color: '#EF4444' }}
              >
                {deleting ? '...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: '#1A1F2E', border: '1px solid #252B3B', color: '#8B92A5' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: '#1A1F2E', border: '1px solid #252B3B', color: '#8B92A5' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; e.currentTarget.style.color = '#8B92A5'; }}
              title="Delete"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Email template card ──────────────────────────────────────────────────────
function TemplateCard({ template, onDelete, onPreview }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(template.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
      onClick={(e) => { if (!e.target.closest('button')) onPreview(template); }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4F7FFF'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#F1F3F9' }}>{template.name}</p>
          {template.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#8B92A5' }}>{template.description}</p>
          )}
          {template.subject && (
            <p className="text-xs mt-1 truncate" style={{ color: '#4A5060' }}>
              <span style={{ color: '#4F7FFF' }}>Subject:</span> {template.subject}
            </p>
          )}
        </div>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{ background: '#1A1F2E' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: '#4A5060' }}>
        <span>{template.block_count ?? 0} block{(template.block_count ?? 0) !== 1 ? 's' : ''}</span>
        <span>&bull;</span>
        <span>Updated {formatDate(template.updated_at)}</span>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: '#252B3B' }}>
        <button
          onClick={() => navigate(`/assets/emails/${template.id}/edit`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: '#1A2744', border: '1px solid #4F7FFF', color: '#4F7FFF' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1E3060'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#1A2744'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: '#2D0E0E', border: '1px solid #EF4444', color: '#EF4444' }}
            >
              {deleting ? '...' : 'Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1.5 rounded-lg text-xs"
              style={{ background: '#1A1F2E', border: '1px solid #252B3B', color: '#8B92A5' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
            style={{ background: '#1A1F2E', border: '1px solid #252B3B', color: '#8B92A5' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; e.currentTarget.style.color = '#8B92A5'; }}
            title="Delete template"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Asset preview modal (image lightbox) ────────────────────────────────────
function AssetPreviewModal({ asset, onClose }) {
  if (!asset) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full rounded-2xl overflow-hidden"
        style={{ background: '#181C27', border: '1px solid #252B3B' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #252B3B' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold truncate" style={{ color: '#F1F3F9' }}>{asset.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: TYPE_BADGE[asset.type]?.bg || '#1A1F2E', color: TYPE_BADGE[asset.type]?.color || '#8B92A5' }}>
              {TYPE_BADGE[asset.type]?.label || 'File'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: '#1A1F2E', border: '1px solid #252B3B', color: '#8B92A5' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F3F9'; e.currentTarget.style.borderColor = '#4F7FFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; e.currentTarget.style.borderColor = '#252B3B'; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open in new tab
            </a>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ color: '#8B92A5' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#252B3B'; e.currentTarget.style.color = '#F1F3F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B92A5'; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex items-center justify-center" style={{ minHeight: 300, maxHeight: '75vh' }}>
          {asset.type === 'image' ? (
            <img
              src={asset.url}
              alt={asset.name}
              className="max-w-full rounded-lg object-contain"
              style={{ maxHeight: '65vh' }}
            />
          ) : asset.type === 'html' ? (
            <iframe
              src={asset.url}
              title={asset.name}
              className="w-full rounded-lg"
              style={{ height: '65vh', border: '1px solid #252B3B', background: '#fff' }}
              sandbox="allow-same-origin allow-scripts"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-10">
              <svg viewBox="0 0 24 24" fill="none" stroke={TYPE_BADGE[asset.type]?.color || '#8B92A5'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              <p className="text-sm" style={{ color: '#8B92A5' }}>{formatBytes(asset.size_bytes)} · {formatDate(asset.created_at)}</p>
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: '#4F7FFF', color: '#fff' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#3B6EEE'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
              >
                Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Template preview modal ───────────────────────────────────────────────────
function TemplatePreviewModal({ template, onClose, onEdit }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!template) return;
    setLoading(true);
    setError('');
    // Fetch full template then render preview
    client.get(`/email-templates/${template.id}`)
      .then((res) => {
        const blocks = res.data.template?.blocks || [];
        return client.post('/email-templates/preview', { blocks });
      })
      .then((res) => setHtml(res.data.html || ''))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [template?.id]);

  if (!template) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#181C27', border: '1px solid #252B3B', maxWidth: 780, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #252B3B' }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#F1F3F9' }}>{template.name}</p>
            {template.subject && (
              <p className="text-xs mt-0.5" style={{ color: '#8B92A5' }}>
                <span style={{ color: '#4F7FFF' }}>Subject:</span> {template.subject}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#4F7FFF', color: '#fff' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#3B6EEE'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ color: '#8B92A5' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#252B3B'; e.currentTarget.style.color = '#F1F3F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B92A5'; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4F7FFF', borderTopColor: 'transparent' }} />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full py-20">
              <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
            </div>
          ) : html ? (
            <iframe
              srcDoc={html}
              title={template.name}
              className="w-full h-full"
              style={{ border: 'none', minHeight: 500 }}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full py-20">
              <p className="text-sm" style={{ color: '#4A5060' }}>No content to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────
function UploadZone({ onUpload, uploading }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  };

  return (
    <div
      className="rounded-xl flex flex-col items-center justify-center gap-3 py-10 px-6 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? '#4F7FFF' : '#252B3B'}`,
        background: dragging ? '#1A2744' : '#181C27',
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,text/html"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4F7FFF', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8B92A5' }}>Uploading…</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{ background: '#1A2744' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>Drop a file here or click to upload</p>
            <p className="text-xs mt-1" style={{ color: '#4A5060' }}>Supports images, PDFs, and HTML files — up to 50 MB</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Assets page ─────────────────────────────────────────────────────────
export default function Assets() {
  const navigate = useNavigate();
  const {
    assets, assetsLoading, fetchAssets, uploadAsset, deleteAsset,
    emailTemplates, emailTemplatesLoading, fetchEmailTemplates, deleteEmailTemplate, seedEmailPresets,
  } = useAppStore();

  const [tab, setTab] = useState('files');
  const [fileFilter, setFileFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewAsset, setPreviewAsset] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const handleAssetPreview = (asset) => {
    if (asset.type === 'pdf') {
      window.open(asset.url, '_blank', 'noopener,noreferrer');
    } else {
      setPreviewAsset(asset);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchEmailTemplates();
  }, []);

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadError('');
    try {
      await uploadAsset(file);
      setFileFilter('all');
      await fetchAssets();
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
      setUploadError(`Upload failed: ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  const filteredAssets = fileFilter === 'all'
    ? assets
    : assets.filter((a) => a.type === fileFilter);

  const FILE_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'image', label: 'Images' },
    { key: 'pdf', label: 'PDFs' },
    { key: 'html', label: 'HTML' },
    { key: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Assets</h1>
          <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>
            Manage uploaded files and reusable email templates
          </p>
        </div>
        {tab === 'emails' && (
          <button
            onClick={() => navigate('/assets/emails/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: '#4F7FFF', color: '#fff' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#3B6EEE'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Email Template
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
        {[
          { key: 'files', label: 'Files', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
            </svg>
          )},
          { key: 'emails', label: 'Emails', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
          )},
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t.key ? '#4F7FFF' : 'transparent',
              color: tab === t.key ? '#fff' : '#8B92A5',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Files tab */}
      {tab === 'files' && (
        <div className="space-y-5">
          <UploadZone onUpload={handleUpload} uploading={uploading} />

          {uploadError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: '#2D0E0E', border: '1px solid #EF4444', color: '#EF4444' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {uploadError}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(uploadError);
                }}
                className="ml-auto text-xs underline"
              >
                Copy
              </button>
            </div>
          )}

          {/* Filter pills */}
          <div className="flex items-center gap-2">
            {FILE_FILTERS.map((f) => {
              const count = f.key === 'all' ? assets.length : assets.filter((a) => a.type === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFileFilter(f.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: fileFilter === f.key ? '#4F7FFF' : '#181C27',
                    border: `1px solid ${fileFilter === f.key ? '#4F7FFF' : '#252B3B'}`,
                    color: fileFilter === f.key ? '#fff' : '#8B92A5',
                  }}
                >
                  {f.label} <span style={{ opacity: 0.7 }}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Asset grid */}
          {assetsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4F7FFF', borderTopColor: 'transparent' }} />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl" style={{ border: '1px solid #252B3B' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
              </svg>
              <p className="text-sm" style={{ color: '#4A5060' }}>
                {fileFilter === 'all' ? 'No files uploaded yet' : `No ${fileFilter} files`}
              </p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onDelete={deleteAsset} onPreview={handleAssetPreview} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Asset preview modal */}
      <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />

      {/* Template preview modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onEdit={() => { navigate(`/assets/emails/${previewTemplate.id}/edit`); setPreviewTemplate(null); }}
      />

      {/* Emails tab */}
      {tab === 'emails' && (
        <div className="space-y-4">
          {emailTemplatesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4F7FFF', borderTopColor: 'transparent' }} />
            </div>
          ) : emailTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl" style={{ border: '1px solid #252B3B' }}>
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl" style={{ background: '#1A1F2E' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: '#F1F3F9' }}>No email templates yet</p>
                <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>Start from a pre-built template or create your own</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => { setSeeding(true); try { await seedEmailPresets(); } finally { setSeeding(false); } }}
                  disabled={seeding}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: '#252B3B', color: '#F1F3F9', border: '1px solid #252B3B' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4F7FFF'; e.currentTarget.style.color = '#4F7FFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; e.currentTarget.style.color = '#F1F3F9'; }}
                >
                  {seeding ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />Loading…</>
                  ) : (
                    <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Load Starter Templates</>
                  )}
                </button>
                <button
                  onClick={() => navigate('/assets/emails/new')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: '#4F7FFF', color: '#fff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#3B6EEE'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#4F7FFF'; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create from Scratch
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {emailTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} onDelete={deleteEmailTemplate} onPreview={setPreviewTemplate} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
