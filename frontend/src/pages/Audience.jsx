import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import useAppStore from '../store/appStore';
import Button from '../components/ui/Button';

// ── CSV import helpers ────────────────────────────────────────────────────────

const IMPORT_CONTACT_FIELDS = [
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

// ── Segment builder helpers ───────────────────────────────────────────────────

const SEGMENT_COLORS = ['#4F7FFF', '#22C55E', '#EAB308', '#EF4444', '#A855F7', '#EC4899', '#F97316', '#8B92A5'];

const OPERATOR_LABELS = {
  contains: 'contains',
  not_contains: 'does not contain',
  equals: 'equals',
  not_equals: 'does not equal',
  greater_than: 'is greater than',
  less_than: 'is less than',
  between: 'is between',
  before: 'is before',
  after: 'is after',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  starts_with: 'starts with',
  ends_with: 'ends with',
  within_last_days: 'within last N days',
};

const OPERATORS_BY_TYPE = {
  text: ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
  date: ['before', 'after', 'equals', 'within_last_days'],
  select: ['equals', 'not_equals'],
  tag: ['contains', 'not_contains'],
  boolean: ['equals'],
};

function getOperatorsForField(field) {
  if (!field) return ['equals'];
  return OPERATORS_BY_TYPE[field.type] || OPERATORS_BY_TYPE.text;
}

function RuleValueInput({ rule, field, onChange }) {
  const op = rule.operator;
  if (op === 'is_empty' || op === 'is_not_empty') return null;

  const inputStyle = {
    background: '#0F1117',
    border: '1px solid #252B3B',
    color: '#F1F3F9',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
    minWidth: 0,
  };

  const handleFocus = (e) => (e.target.style.borderColor = '#4F7FFF');
  const handleBlur = (e) => (e.target.style.borderColor = '#252B3B');

  if (!field) return null;

  const type = field.type;

  if (type === 'boolean') {
    return (
      <select
        value={rule.value || 'true'}
        onChange={(e) => onChange({ value: e.target.value })}
        style={inputStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  if (type === 'select') {
    const options = field.options || [];
    return (
      <select
        value={rule.value || ''}
        onChange={(e) => onChange({ value: e.target.value })}
        style={inputStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (type === 'date') {
    if (op === 'within_last_days') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            min="1"
            value={rule.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="30"
            style={{ ...inputStyle, width: 80 }}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          <span style={{ color: '#8B92A5', fontSize: 13 }}>days</span>
        </div>
      );
    }
    return (
      <input
        type="date"
        value={rule.value || ''}
        onChange={(e) => onChange({ value: e.target.value })}
        style={inputStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }

  if (type === 'number') {
    if (op === 'between') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            value={rule.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Min"
            style={{ ...inputStyle, width: 80 }}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          <span style={{ color: '#8B92A5', fontSize: 13 }}>and</span>
          <input
            type="number"
            value={rule.value2 || ''}
            onChange={(e) => onChange({ value2: e.target.value })}
            placeholder="Max"
            style={{ ...inputStyle, width: 80 }}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>
      );
    }
    return (
      <input
        type="number"
        value={rule.value || ''}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="Value"
        style={{ ...inputStyle, width: 120 }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }

  if (type === 'tag') {
    return (
      <input
        type="text"
        value={rule.value || ''}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="enter a tag"
        style={{ ...inputStyle, flex: 1 }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }

  // default: text
  return (
    <input
      type="text"
      value={rule.value || ''}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder="Value"
      style={{ ...inputStyle, flex: 1 }}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

function RuleRow({ rule, index, contactFields, onChange, onRemove }) {
  const standardFields = contactFields.filter((f) => f.group === 'standard' || !f.key.startsWith('custom:'));
  const customFields = contactFields.filter((f) => f.group === 'custom' || f.key.startsWith('custom:'));

  const selectedField = contactFields.find((f) => f.key === rule.field) || contactFields[0];
  const operators = getOperatorsForField(selectedField);

  const selectStyle = {
    background: '#181C27',
    border: '1px solid #252B3B',
    color: '#F1F3F9',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
  };

  const handleFieldChange = (newKey) => {
    const newField = contactFields.find((f) => f.key === newKey);
    const newOps = getOperatorsForField(newField);
    onChange(index, { field: newKey, operator: newOps[0], value: '', value2: '', fieldType: newField?.type });
  };

  const handleOperatorChange = (newOp) => {
    onChange(index, { ...rule, operator: newOp, value: '', value2: '' });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* Field selector */}
      <select
        value={rule.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        style={selectStyle}
        onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
        onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
      >
        {standardFields.length > 0 && (
          <optgroup label="Standard Fields">
            {standardFields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </optgroup>
        )}
        {customFields.length > 0 && (
          <optgroup label="Custom Fields">
            {customFields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Operator selector */}
      <select
        value={rule.operator}
        onChange={(e) => handleOperatorChange(e.target.value)}
        style={selectStyle}
        onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
        onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
      >
        {operators.map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
        ))}
      </select>

      {/* Value input */}
      <RuleValueInput
        rule={rule}
        field={selectedField}
        onChange={(changes) => onChange(index, { ...rule, ...changes })}
      />

      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        style={{ color: '#8B92A5', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, flexShrink: 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#2D0E0E'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; e.currentTarget.style.background = 'none'; }}
        title="Remove rule"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Audience() {
  const {
    segments: storeSegments,
    fetchSegments,
    createSegment,
    updateSegment,
    deleteSegment,
    importContacts,
    contactFields,
    fetchContactFields,
    attributeDefinitions,
    fetchAttributeDefinitions,
    createAttributeDefinition,
    deleteAttributeDefinition,
    previewSegment,
  } = useAppStore();

  // ── Tab state (Attributes | Import) ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState('import');

  // ── Segment builder state ─────────────────────────────────────────────────
  const [selectedSegId, setSelectedSegId] = useState(null);   // editing existing
  const [isCreating, setIsCreating] = useState(false);         // creating new
  const [builderName, setBuilderName] = useState('');
  const [builderColor, setBuilderColor] = useState(SEGMENT_COLORS[0]);
  const [builderRules, setBuilderRules] = useState([]);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderError, setBuilderError] = useState('');
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimer = useRef(null);

  // ── CSV import state ──────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  // ── Attributes state ──────────────────────────────────────────────────────
  const [showAttrForm, setShowAttrForm] = useState(false);
  const [attrForm, setAttrForm] = useState({ name: '', type: 'text', options: '' });
  const [attrSaving, setAttrSaving] = useState(false);
  const [attrError, setAttrError] = useState('');

  useEffect(() => {
    fetchSegments();
    fetchContactFields();
    fetchAttributeDefinitions();
  }, []);

  // ── Preview debounce ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBuilderOpen) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewLoading(true);
    previewTimer.current = setTimeout(async () => {
      const count = await previewSegment(builderRules);
      setPreviewCount(count);
      setPreviewLoading(false);
    }, 600);
    return () => clearTimeout(previewTimer.current);
  }, [builderRules]);

  const isBuilderOpen = isCreating || selectedSegId !== null;

  // ── Open segment for editing ──────────────────────────────────────────────
  const openSegment = (seg) => {
    setSelectedSegId(seg.id);
    setIsCreating(false);
    setBuilderName(seg.name || '');
    setBuilderColor(seg.color || SEGMENT_COLORS[0]);
    setBuilderRules(seg.rules || []);
    setBuilderError('');
    setPreviewCount(null);
  };

  const openNewSegment = () => {
    setSelectedSegId(null);
    setIsCreating(true);
    setBuilderName('');
    setBuilderColor(SEGMENT_COLORS[0]);
    setBuilderRules([]);
    setBuilderError('');
    setPreviewCount(null);
  };

  const closeBuilder = () => {
    setSelectedSegId(null);
    setIsCreating(false);
    setBuilderName('');
    setBuilderColor(SEGMENT_COLORS[0]);
    setBuilderRules([]);
    setBuilderError('');
  };

  // ── Rule editing ──────────────────────────────────────────────────────────
  const defaultField = contactFields[0] || { key: 'email', label: 'Email', type: 'text', group: 'standard' };

  const addRule = () => {
    const field = defaultField;
    const ops = getOperatorsForField(field);
    setBuilderRules((prev) => [
      ...prev,
      { field: field.key, operator: ops[0], value: '', value2: '', fieldType: field.type },
    ]);
  };

  const updateRule = (index, updated) => {
    setBuilderRules((prev) => prev.map((r, i) => (i === index ? updated : r)));
  };

  const removeRule = (index) => {
    setBuilderRules((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Save segment ──────────────────────────────────────────────────────────
  const handleSaveSegment = async () => {
    if (!builderName.trim()) { setBuilderError('Segment name is required.'); return; }
    setBuilderSaving(true);
    setBuilderError('');
    try {
      const payload = { name: builderName.trim(), color: builderColor, rules: builderRules };
      if (isCreating) {
        await createSegment(payload);
      } else {
        await updateSegment(selectedSegId, payload);
      }
      closeBuilder();
    } catch (err) {
      setBuilderError(err.response?.data?.message || 'Failed to save segment.');
    } finally {
      setBuilderSaving(false);
    }
  };

  // ── Delete segment ────────────────────────────────────────────────────────
  const handleDeleteSegment = async (e, seg) => {
    e.stopPropagation();
    if (!window.confirm(`Delete segment "${seg.name}"?`)) return;
    try {
      await deleteSegment(seg.id);
      if (selectedSegId === seg.id) closeBuilder();
    } catch {}
  };

  // ── CSV import ────────────────────────────────────────────────────────────
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
      parsed.headers.forEach((h) => { initialMapping[h] = guessMapping(h); });
      setMapping(initialMapping);
    };
    reader.readAsText(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
  });

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await importContacts(file);
      setImportResult(result);
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

  // ── Attribute CRUD ────────────────────────────────────────────────────────
  const handleSaveAttr = async (e) => {
    e.preventDefault();
    if (!attrForm.name.trim()) { setAttrError('Name is required.'); return; }
    setAttrSaving(true);
    setAttrError('');
    try {
      const payload = {
        name: attrForm.name.trim(),
        type: attrForm.type,
        options: attrForm.type === 'select'
          ? attrForm.options.split(',').map((o) => o.trim()).filter(Boolean)
          : undefined,
      };
      await createAttributeDefinition(payload);
      setAttrForm({ name: '', type: 'text', options: '' });
      setShowAttrForm(false);
    } catch (err) {
      setAttrError(err.response?.data?.message || 'Failed to save attribute.');
    } finally {
      setAttrSaving(false);
    }
  };

  const handleDeleteAttr = async (id) => {
    if (!window.confirm('Delete this custom attribute?')) return;
    try { await deleteAttributeDefinition(id); } catch {}
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const cardStyle = { background: '#181C27', border: '1px solid #252B3B', borderRadius: 12 };
  const inputStyle = {
    background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Audience</h2>
        <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>Manage segments, custom attributes, and import contacts.</p>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* ── Left panel: Segments list ─────────────────────────────────────── */}
        <div style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>Segments</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
            {storeSegments.map((seg) => {
              const isSelected = selectedSegId === seg.id;
              return (
                <div
                  key={seg.id}
                  onClick={() => openSegment(seg)}
                  style={{
                    ...cardStyle,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderColor: isSelected ? '#4F7FFF' : '#252B3B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#4F7FFF55'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#252B3B'; }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color || '#4F7FFF', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-sm font-medium truncate" style={{ color: '#F1F3F9' }}>{seg.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#8B92A5' }}>
                      {seg.contact_count != null ? `${seg.contact_count.toLocaleString()} contacts` : 'No count'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openSegment(seg); }}
                      title="Edit"
                      style={{ color: '#8B92A5', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 5 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#4F7FFF'; e.currentTarget.style.background = '#1A2744'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; e.currentTarget.style.background = 'none'; }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {!seg.is_default && (
                      <button
                        onClick={(e) => handleDeleteSegment(e, seg)}
                        title="Delete"
                        style={{ color: '#8B92A5', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 5 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#2D0E0E'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; e.currentTarget.style.background = 'none'; }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {storeSegments.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: '#8B92A5' }}>No segments yet.</p>
            )}
          </div>

          <button
            onClick={openNewSegment}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
              background: isCreating ? '#4F7FFF22' : 'transparent',
              border: `1px dashed ${isCreating ? '#4F7FFF' : '#252B3B'}`,
              color: '#4F7FFF', fontSize: 13, fontWeight: 600,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#4F7FFF22'; e.currentTarget.style.borderColor = '#4F7FFF'; }}
            onMouseLeave={(e) => { if (!isCreating) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#252B3B'; } }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Segment
          </button>
        </div>

        {/* ── Right panel ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {isBuilderOpen ? (
            /* ── View A: Segment Builder ─────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>
                  {isCreating ? 'New Segment' : 'Edit Segment'}
                </h3>
                <button
                  onClick={closeBuilder}
                  style={{ color: '#8B92A5', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F3F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8B92A5')}
                >
                  Cancel
                </button>
              </div>

              {/* Name + colour row */}
              <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B92A5' }}>Segment Name</label>
                    <input
                      type="text"
                      value={builderName}
                      onChange={(e) => setBuilderName(e.target.value)}
                      placeholder="e.g. High-value subscribers"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                      onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B92A5' }}>Color</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {SEGMENT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setBuilderColor(c)}
                          style={{
                            width: 22, height: 22, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                            outline: builderColor === c ? `3px solid #fff` : '3px solid transparent',
                            outlineOffset: 1,
                          }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules */}
              <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Match ALL of these rules</p>
                  <button
                    onClick={addRule}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#4F7FFF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#4F7FFF22')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Rule
                  </button>
                </div>

                {builderRules.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: '#8B92A5' }}>
                    No rules — this segment will match all active contacts.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {builderRules.map((rule, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: '#0F1117', border: '1px solid #252B3B' }}>
                        <RuleRow
                          rule={rule}
                          index={i}
                          contactFields={contactFields.length > 0 ? contactFields : [{ key: 'email', label: 'Email', type: 'text', group: 'standard' }]}
                          onChange={updateRule}
                          onRemove={removeRule}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#8B92A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="text-sm" style={{ color: '#8B92A5' }}>
                    Estimated audience:{' '}
                    <span style={{ color: '#F1F3F9', fontWeight: 600 }}>
                      {previewLoading ? 'Calculating…' : previewCount === null ? '—' : `~${previewCount.toLocaleString()} contacts`}
                    </span>
                  </span>
                </div>
              </div>

              {builderError && (
                <p className="text-sm" style={{ color: '#EF4444' }}>{builderError}</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="secondary" size="md" onClick={closeBuilder}>Cancel</Button>
                <Button variant="primary" size="md" onClick={handleSaveSegment} loading={builderSaving}>
                  {isCreating ? 'Create Segment' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            /* ── Views B & C: tabbed ─────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #252B3B', paddingBottom: 0 }}>
                {[
                  { id: 'attributes', label: 'Attributes' },
                  { id: 'import', label: 'Import Contacts' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab.id ? '2px solid #4F7FFF' : '2px solid transparent',
                      color: activeTab === tab.id ? '#4F7FFF' : '#8B92A5',
                      cursor: 'pointer',
                      marginBottom: -1,
                    }}
                    onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = '#F1F3F9'; }}
                    onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = '#8B92A5'; }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'attributes' && (
                /* ── View B: Attributes ────────────────────────────────────── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>Custom Attributes</h3>
                    <Button variant="primary" size="sm" onClick={() => setShowAttrForm(true)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Attribute
                    </Button>
                  </div>

                  {/* Note */}
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#1A2744', border: '1px solid #4F7FFF44' }}>
                    <p className="text-xs" style={{ color: '#8B92A5' }}>
                      Custom attributes are stored on each contact and can be used in segment rules and campaign personalisation (e.g. <code style={{ color: '#4F7FFF', background: '#0F1117', padding: '1px 4px', borderRadius: 4 }}>{'{{custom.city}}'}</code>).
                    </p>
                  </div>

                  {/* Add attribute form */}
                  {showAttrForm && (
                    <div style={{ ...cardStyle, padding: 16 }}>
                      <form onSubmit={handleSaveAttr} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B92A5' }}>Name <span style={{ color: '#EF4444' }}>*</span></label>
                            <input
                              type="text"
                              required
                              value={attrForm.name}
                              onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })}
                              placeholder="e.g. City, Annual Revenue"
                              style={inputStyle}
                              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                            />
                          </div>
                          <div style={{ minWidth: 140 }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B92A5' }}>Type</label>
                            <select
                              value={attrForm.type}
                              onChange={(e) => setAttrForm({ ...attrForm, type: e.target.value })}
                              style={{ ...inputStyle, width: 'auto' }}
                              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="boolean">Boolean</option>
                              <option value="select">Select</option>
                            </select>
                          </div>
                          {attrForm.type === 'select' && (
                            <div style={{ flex: 2, minWidth: 200 }}>
                              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B92A5' }}>Options (comma-separated)</label>
                              <input
                                type="text"
                                value={attrForm.options}
                                onChange={(e) => setAttrForm({ ...attrForm, options: e.target.value })}
                                placeholder="Free, Pro, Enterprise"
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                              />
                            </div>
                          )}
                        </div>
                        {attrError && <p className="text-sm" style={{ color: '#EF4444' }}>{attrError}</p>}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Button variant="secondary" size="sm" type="button" onClick={() => { setShowAttrForm(false); setAttrError(''); }}>Cancel</Button>
                          <Button variant="primary" size="sm" type="submit" loading={attrSaving}>Save Attribute</Button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Definitions table */}
                  <div style={{ ...cardStyle, overflow: 'hidden' }}>
                    {attributeDefinitions.length === 0 ? (
                      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                        <p className="text-sm" style={{ color: '#8B92A5' }}>No custom attributes yet. Add one to extend your contact profiles.</p>
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #252B3B' }}>
                            {['Name', 'Key', 'Type', 'Options', 'Actions'].map((h) => (
                              <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#8B92A5', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {attributeDefinitions.map((def, i) => (
                            <tr key={def.id} style={{ borderBottom: i < attributeDefinitions.length - 1 ? '1px solid #252B3B' : 'none' }}>
                              <td style={{ padding: '10px 16px', color: '#F1F3F9', fontWeight: 500 }}>{def.name}</td>
                              <td style={{ padding: '10px 16px' }}>
                                <code style={{ color: '#4F7FFF', background: '#1A2744', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{def.key}</code>
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                <span style={{ background: '#252B3B', color: '#8B92A5', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                                  {def.type}
                                </span>
                              </td>
                              <td style={{ padding: '10px 16px', color: '#8B92A5', fontSize: 12 }}>
                                {def.type === 'select' && Array.isArray(def.options)
                                  ? def.options.join(', ')
                                  : '—'}
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                <button
                                  onClick={() => handleDeleteAttr(def.id)}
                                  style={{ color: '#8B92A5', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#2D0E0E'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#8B92A5'; e.currentTarget.style.background = 'none'; }}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4h6v2" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'import' && (
                /* ── View C: Import (original import UI) ─────────────────── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

                  {importResult && (
                    <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#052E16', border: '1px solid #22C55E' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 flex-shrink-0 mt-0.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <div>
                        <p className="font-semibold" style={{ color: '#22C55E' }}>Import successful!</p>
                        <p className="text-sm mt-1" style={{ color: '#F1F3F9' }}>
                          {importResult.imported ?? importResult.count ?? 0} contacts imported
                          {importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}
                          {importResult.errors > 0 ? `, ${importResult.errors} errors` : ''}.
                        </p>
                      </div>
                    </div>
                  )}

                  {!file && (
                    <div
                      {...getRootProps()}
                      className="rounded-xl p-10 text-center cursor-pointer transition-all"
                      style={{ background: isDragActive ? '#1A2744' : '#181C27', border: `2px dashed ${isDragActive ? '#4F7FFF' : '#252B3B'}` }}
                    >
                      <input {...getInputProps()} />
                      <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: '#1E2436' }}>
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
                      <p className="text-xs mt-3" style={{ color: '#8B92A5' }}>Supported formats: .csv, .xlsx — max 10 MB</p>
                    </div>
                  )}

                  {file && parsedData && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#F1F3F9' }}>{file.name}</p>
                          <p className="text-xs" style={{ color: '#8B92A5' }}>{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>

                      <div className="rounded-xl p-5 space-y-4" style={{ background: '#181C27', border: '1px solid #252B3B' }}>
                        <h4 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Map Columns</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {parsedData.headers.map((header) => (
                            <div key={header} className="flex items-center gap-3">
                              <div className="flex-1 px-3 py-2 rounded-lg text-sm truncate" style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#8B92A5' }}>
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
                                {IMPORT_CONTACT_FIELDS.map((f) => (
                                  <option key={f.key} value={f.key}>{f.label}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {parsedData.rows.length > 0 && (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252B3B' }}>
                          <div className="px-4 py-3 border-b" style={{ background: '#181C27', borderColor: '#252B3B' }}>
                            <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>Preview — first {parsedData.rows.length} rows</p>
                          </div>
                          <div className="overflow-x-auto" style={{ background: '#181C27' }}>
                            <table className="w-full text-sm">
                              <thead>
                                <tr style={{ borderBottom: '1px solid #252B3B' }}>
                                  {parsedData.headers.map((h) => (
                                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: '#8B92A5' }}>{h}</th>
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

                      {importError && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: '#2D0E0E', border: '1px solid #EF4444', color: '#EF4444' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {importError}
                        </div>
                      )}

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
          )}
        </div>
      </div>
    </div>
  );
}
