import React, { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSearchParams } from 'react-router-dom';
import useAppStore from '../store/appStore';
import Button from '../components/ui/Button';
import client from '../api/client';

const DEFAULT_SEGMENTS = [
  { _id: 'all', name: 'All Customers', color: '#4F7FFF', contactCount: null },
  { _id: 'newsletter', name: 'Newsletter Subscribers', color: '#22C55E', contactCount: null },
  { _id: 'early', name: 'Early Adopters', color: '#EAB308', contactCount: null },
  { _id: 'inactive', name: 'Inactive 90 Days', color: '#8B92A5', contactCount: null },
  { _id: 'vip', name: 'VIP / High Spend', color: '#A855F7', contactCount: null },
];

const CONTACT_FIELDS = [
  { key: 'email', label: 'Email Address' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'tags', label: 'Tags (comma-separated)' },
  { key: '_skip', label: '— Skip this column —' },
];

function parseCSV(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1, 6).map((line) =>
    line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
  );
  return { headers, rows };
}

function guessMapping(header) {
  const h = header.toLowerCase();
  if (h.includes('email')) return 'email';
  if (h.includes('first') || h === 'firstname') return 'firstName';
  if (h.includes('last') || h === 'lastname') return 'lastName';
  if (h.includes('phone')) return 'phone';
  if (h.includes('tag')) return 'tags';
  return '_skip';
}

export default function Audience() {
  const { segments: storeSegments, fetchSegments, createSegment, importContacts } = useAppStore();
  const [searchParams] = useSearchParams();
  const [importSegmentId, setImportSegmentId] = useState('');
  const [newSegName, setNewSegName] = useState('');
  const [creatingSegment, setCreatingSegment] = useState(false);
  const [showSegmentInput, setShowSegmentInput] = useState(false);

  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentContacts, setSegmentContacts] = useState([]);
  const [segmentContactsLoading, setSegmentContactsLoading] = useState(false);

  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    fetchSegments();
  }, []);

  // Auto-select segment from ?segment=<id> query param (e.g. navigated from Contacts page)
  const preselectedSegmentId = searchParams.get('segment');
  useEffect(() => {
    if (!preselectedSegmentId || storeSegments.length === 0) return;
    const seg = storeSegments.find((s) => s.id === preselectedSegmentId);
    if (seg) handleSegmentClick(seg);
  }, [preselectedSegmentId, storeSegments.length]);

  const handleSegmentClick = async (seg) => {
    if (selectedSegment?.id === seg.id) {
      setSelectedSegment(null);
      setSegmentContacts([]);
      return;
    }
    setSelectedSegment(seg);
    setSegmentContactsLoading(true);
    try {
      const res = await client.get(`/segments/${seg.id}/contacts`);
      setSegmentContacts(res.data.contacts || []);
    } catch {
      setSegmentContacts([]);
    } finally {
      setSegmentContactsLoading(false);
    }
  };

  const segments = storeSegments.length > 0 ? storeSegments : DEFAULT_SEGMENTS;

  const onDrop = useCallback((accepted) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    setImportResult(null);
    setImportError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      setParsedData(parsed);
      const initialMapping = {};
      parsed.headers.forEach((h) => {
        initialMapping[h] = guessMapping(h);
      });
      setMapping(initialMapping);
    };
    reader.readAsText(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
  });

  const handleCreateSegment = async () => {
    if (!newSegName.trim()) return;
    setCreatingSegment(true);
    try {
      await createSegment({ name: newSegName.trim() });
      setNewSegName('');
      setShowSegmentInput(false);
    } catch {
      // ignore
    } finally {
      setCreatingSegment(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await importContacts(file, importSegmentId || null);
      setImportResult(result.summary ?? result);
      setFile(null);
      setParsedData(null);
      setMapping({});
    } catch (err) {
      setImportError(err.response?.data?.message || 'Import failed. Please check your file and try again.');
    } finally {
      setImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData(null);
    setMapping({});
    setImportResult(null);
    setImportError('');
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left: Segments */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>Segments</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowSegmentInput(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </Button>
        </div>

        {showSegmentInput && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: '#181C27', border: '1px solid #4F7FFF' }}
          >
            <input
              autoFocus
              value={newSegName}
              onChange={(e) => setNewSegName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSegment()}
              placeholder="Segment name…"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleCreateSegment} loading={creatingSegment} className="flex-1">
                Create
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowSegmentInput(false); setNewSegName(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {segments.map((seg) => {
            const isSelected = selectedSegment?.id === seg.id;
            return (
              <div
                key={seg.id || seg._id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer"
                style={{
                  background: isSelected ? '#1A2744' : '#181C27',
                  border: `1px solid ${isSelected ? '#4F7FFF' : '#252B3B'}`,
                }}
                onClick={() => handleSegmentClick(seg)}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#4F7FFF'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#252B3B'; }}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: seg.color || '#4F7FFF' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#F1F3F9' }}>{seg.name}</p>
                  {(seg.contact_count !== undefined || seg.contactCount !== undefined) && (
                    <p className="text-xs mt-0.5" style={{ color: '#8B92A5' }}>
                      {(seg.contact_count ?? seg.contactCount ?? 0).toLocaleString()} contacts
                    </p>
                  )}
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#4F7FFF' : '#8B92A5'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Segment contacts or Import */}
      <div className="flex-1 space-y-5">
        {selectedSegment ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>{selectedSegment.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#8B92A5' }}>{segmentContacts.length} contacts</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedSegment(null); setSegmentContacts([]); }}>
                ✕ Close
              </Button>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252B3B' }}>
              {segmentContactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
              ) : segmentContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <p className="text-sm" style={{ color: '#8B92A5' }}>No contacts in this segment yet.</p>
                  <p className="text-xs" style={{ color: '#4B5563' }}>Import contacts and select this segment to add them.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #252B3B', background: '#181C27' }}>
                      {['Email', 'First Name', 'Last Name', 'Status'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B92A5' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody style={{ background: '#181C27' }}>
                    {segmentContacts.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: i < segmentContacts.length - 1 ? '1px solid #252B3B' : 'none' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#4F7FFF' }}>{c.email}</td>
                        <td className="px-4 py-3" style={{ color: '#F1F3F9' }}>{c.first_name || '—'}</td>
                        <td className="px-4 py-3" style={{ color: '#F1F3F9' }}>{c.last_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#052E16', color: '#22C55E' }}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
        <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>Import Contacts</h3>
          {file && (
            <button
              onClick={clearFile}
              className="text-sm"
              style={{ color: '#8B92A5' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F3F9')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8B92A5')}
            >
              Clear
            </button>
          )}
        </div>

        {/* Success */}
        {importResult && (
          <div
            className="rounded-xl p-5 flex items-start gap-4"
            style={{ background: '#052E16', border: '1px solid #22C55E' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 flex-shrink-0 mt-0.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>
              <p className="font-semibold" style={{ color: '#22C55E' }}>Import successful!</p>
              <p className="text-sm mt-1" style={{ color: '#F1F3F9' }}>
                {importResult.imported ?? 0} contacts imported
                {importResult.updated > 0 ? `, ${importResult.updated} updated` : ''}
                {importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}.
              </p>
            </div>
          </div>
        )}

        {/* Dropzone */}
        {!file && (
          <div
            {...getRootProps()}
            className="rounded-xl p-10 text-center cursor-pointer transition-all"
            style={{
              background: isDragActive ? '#1A2744' : '#181C27',
              border: `2px dashed ${isDragActive ? '#4F7FFF' : '#252B3B'}`,
            }}
          >
            <input {...getInputProps()} />
            <div
              className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: '#1E2436' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: '#F1F3F9' }}>
              {isDragActive ? 'Drop your file here' : 'Drag & drop your CSV or XLSX file'}
            </p>
            <p className="text-sm" style={{ color: '#8B92A5' }}>
              or <span style={{ color: '#4F7FFF' }}>browse to upload</span>
            </p>
            <p className="text-xs mt-3" style={{ color: '#8B92A5' }}>
              Supported formats: .csv, .xlsx — max 10 MB
            </p>
          </div>
        )}

        {/* File info + mapping */}
        {file && parsedData && (
          <div className="space-y-4">
            {/* File info */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#181C27', border: '1px solid #252B3B' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#F1F3F9' }}>{file.name}</p>
                <p className="text-xs" style={{ color: '#8B92A5' }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            {/* Column mapping */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: '#181C27', border: '1px solid #252B3B' }}
            >
              <h4 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Map Columns</h4>
              <div className="grid grid-cols-2 gap-3">
                {parsedData.headers.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <div
                      className="flex-1 px-3 py-2 rounded-lg text-sm truncate"
                      style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#8B92A5' }}
                    >
                      {header}
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#8B92A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                    <select
                      value={mapping[header] || '_skip'}
                      onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                      onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                      onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                    >
                      {CONTACT_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            {parsedData.rows.length > 0 && (
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid #252B3B' }}
              >
                <div className="px-4 py-3 border-b" style={{ background: '#181C27', borderColor: '#252B3B' }}>
                  <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>
                    Preview — first {parsedData.rows.length} rows
                  </p>
                </div>
                <div className="overflow-x-auto" style={{ background: '#181C27' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #252B3B' }}>
                        {parsedData.headers.map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: '#8B92A5' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.rows.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: ri < parsedData.rows.length - 1 ? '1px solid #252B3B' : 'none' }}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2.5 text-xs truncate max-w-xs" style={{ color: '#F1F3F9' }}>
                              {cell || <span style={{ color: '#252B3B' }}>empty</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error */}
            {importError && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{ background: '#2D0E0E', border: '1px solid #EF4444', color: '#EF4444' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {importError}
              </div>
            )}

            {/* Segment selector */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>
                Import into segment <span style={{ color: '#4B5563' }}>(optional)</span>
              </label>
              <select
                value={importSegmentId}
                onChange={(e) => setImportSegmentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0F1117', border: '1px solid #252B3B', color: importSegmentId ? '#F1F3F9' : '#8B92A5' }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
              >
                <option value="">No segment — add to all contacts only</option>
                {storeSegments.map((seg) => (
                  <option key={seg.id || seg._id} value={seg.id || seg._id}>{seg.name}</option>
                ))}
              </select>
            </div>

            {/* Import button */}
            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={handleImport} loading={importing}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Import Contacts
              </Button>
            </div>
          </div>
        )}
        </div>
        )}
      </div>
    </div>
  );
}
