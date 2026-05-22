import React, { useEffect, useState, useCallback } from 'react';
import useAppStore from '../store/appStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

// ── Trigger type config ───────────────────────────────────────────────────────
const TRIGGER_TYPES = [
  { value: 'contact_added',    label: 'Contact Added',      color: '#4F7FFF', bg: '#1A2744' },
  { value: 'tag_added',        label: 'Tag Added',          color: '#A855F7', bg: '#2D1458' },
  { value: 'date_based',       label: 'Date Based',         color: '#EAB308', bg: '#3D2E00' },
  { value: 'campaign_opened',  label: 'Campaign Opened',    color: '#22C55E', bg: '#052E16' },
  { value: 'campaign_clicked', label: 'Campaign Clicked',   color: '#06B6D4', bg: '#0C2830' },
  { value: 'manual',           label: 'Manual Trigger',     color: '#8B92A5', bg: '#252B3B' },
];

function triggerCfg(type) {
  return TRIGGER_TYPES.find((t) => t.value === type) || { label: type || 'Unknown', color: '#8B92A5', bg: '#252B3B' };
}

// ── Step helpers ──────────────────────────────────────────────────────────────
const STEP_ICONS = {
  trigger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  delay: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  condition: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
};

const STEP_COLORS = {
  trigger:   { bg: '#1A2744', color: '#4F7FFF' },
  email:     { bg: '#181C27', color: '#F1F3F9' },
  delay:     { bg: '#1E2436', color: '#8B92A5' },
  condition: { bg: '#2D1458', color: '#A855F7' },
};

function stepLabel(step) {
  if (step.type === 'delay') {
    return `Wait ${step.amount || 1} ${step.unit || 'days'}`;
  }
  return step.label || step.type;
}

function newStep(type) {
  const id = Math.random().toString(36).slice(2);
  if (type === 'email')     return { id, type: 'email', label: 'Send Email', subject: '' };
  if (type === 'delay')     return { id, type: 'delay', amount: 1, unit: 'days', label: 'Wait 1 day' };
  if (type === 'condition') return { id, type: 'condition', label: 'Check Condition' };
  return { id, type, label: type };
}

// ── Automation editor modal ───────────────────────────────────────────────────
function AutomationEditor({ automation, onClose, onSave }) {
  const { emailTemplates, fetchEmailTemplates } = useAppStore();
  const [name, setName] = useState(automation?.name || '');
  const [triggerType, setTriggerType] = useState(automation?.trigger_type || 'contact_added');
  const [steps, setSteps] = useState(() => {
    if (automation?.steps?.length) {
      return automation.steps.map((s, i) => ({ id: s.id || String(i), ...s }));
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchEmailTemplates(); }, []);

  const addStep = (type) => setSteps([...steps, newStep(type)]);

  const removeStep = (id) => setSteps(steps.filter((s) => s.id !== id));

  const moveStep = (id, dir) => {
    const idx = steps.findIndex((s) => s.id === id);
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === steps.length - 1)) return;
    const next = [...steps];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setSteps(next);
  };

  const updateStep = (id, patch) => setSteps(steps.map((s) => s.id === id ? { ...s, ...patch } : s));

  const handleSave = async () => {
    if (!name.trim()) return setError('Name is required.');
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), triggerType, steps });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' };
  const labelStyle = { color: '#8B92A5', fontSize: 12, marginBottom: 4, display: 'block' };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <label style={labelStyle}>Automation Name <span style={{ color: '#EF4444' }}>*</span></label>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome Series"
          onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
      </div>

      {/* Trigger */}
      <div>
        <label style={labelStyle}>Trigger</label>
        <select style={inputStyle} value={triggerType} onChange={(e) => setTriggerType(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')}>
          {TRIGGER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Steps */}
      <div>
        <label style={labelStyle}>Steps</label>
        <div className="space-y-2">
          {/* Trigger step (always first, not removable) */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: '#1A2744', border: '1px solid #252B3B' }}>
            <span style={{ color: '#4F7FFF' }}>{STEP_ICONS.trigger}</span>
            <span className="text-sm font-medium flex-1" style={{ color: '#4F7FFF' }}>
              {triggerCfg(triggerType).label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#252B3B', color: '#8B92A5' }}>Trigger</span>
          </div>

          {steps.map((step, idx) => {
            const cfg = STEP_COLORS[step.type] || STEP_COLORS.email;
            return (
              <div key={step.id} className="rounded-lg" style={{ background: cfg.bg, border: '1px solid #252B3B' }}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span style={{ color: cfg.color }}>{STEP_ICONS[step.type] || STEP_ICONS.email}</span>
                  <div className="flex-1 min-w-0">
                    {step.type === 'email' && (
                      <div className="flex flex-col gap-1.5">
                        <select
                          style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }}
                          value={step.templateId || ''}
                          onChange={(e) => {
                            const tid = e.target.value;
                            const tpl = emailTemplates.find((t) => t.id === tid);
                            updateStep(step.id, {
                              templateId: tid || null,
                              label: tpl ? tpl.name : (step.label || 'Send Email'),
                              subject: tpl?.subject || step.subject || '',
                            });
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                          onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                        >
                          <option value="">— Select email template —</option>
                          {emailTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <input
                          style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }}
                          value={step.subject || ''}
                          onChange={(e) => updateStep(step.id, { subject: e.target.value })}
                          placeholder="Subject line (auto-filled from template)"
                          onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                          onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                        />
                      </div>
                    )}
                    {step.type === 'delay' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#8B92A5' }}>Wait</span>
                        <input
                          type="number" min="1"
                          style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, width: 60 }}
                          value={step.amount || 1}
                          onChange={(e) => updateStep(step.id, { amount: parseInt(e.target.value) || 1 })}
                          onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                          onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                        />
                        <select
                          style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, width: 80 }}
                          value={step.unit || 'days'}
                          onChange={(e) => updateStep(step.id, { unit: e.target.value })}
                          onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                          onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                        >
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                          <option value="weeks">weeks</option>
                        </select>
                      </div>
                    )}
                    {step.type === 'condition' && (
                      <input
                        style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }}
                        value={step.label || ''}
                        onChange={(e) => updateStep(step.id, { label: e.target.value })}
                        placeholder="Condition description"
                        onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                        onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => moveStep(step.id, -1)} disabled={idx === 0}
                      className="p-1 rounded disabled:opacity-30 hover:opacity-70" style={{ color: '#8B92A5' }} title="Move up">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button onClick={() => moveStep(step.id, 1)} disabled={idx === steps.length - 1}
                      className="p-1 rounded disabled:opacity-30 hover:opacity-70" style={{ color: '#8B92A5' }} title="Move down">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    <button onClick={() => removeStep(step.id)}
                      className="p-1 rounded hover:opacity-70" style={{ color: '#EF4444' }} title="Remove">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add step buttons */}
          <div className="flex gap-2 pt-1">
            {[
              { type: 'email', label: 'Email', icon: STEP_ICONS.email },
              { type: 'delay', label: 'Delay', icon: STEP_ICONS.delay },
              { type: 'condition', label: 'Condition', icon: STEP_ICONS.condition },
            ].map(({ type, label, icon }) => (
              <button key={type} onClick={() => addStep(type)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#252B3B', color: '#8B92A5', border: '1px solid #252B3B' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4F7FFF'; e.currentTarget.style.color = '#F1F3F9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; e.currentTarget.style.color = '#8B92A5'; }}>
                {icon}+ {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#EF444420', color: '#EF4444' }}>{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" size="md" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
          {automation ? 'Save Changes' : 'Create Automation'}
        </Button>
      </div>
    </div>
  );
}

// ── Automation card ───────────────────────────────────────────────────────────
function AutomationCard({ automation, onToggle, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async (e) => {
    e.stopPropagation();
    setToggling(true);
    try { await onToggle(automation.id, !automation.is_active); }
    finally { setToggling(false); }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${automation.name}"?`)) return;
    setDeleting(true);
    try { await onDelete(automation.id); }
    finally { setDeleting(false); }
  };

  const steps = automation.steps || [];
  const emailSteps = steps.filter((s) => s.type === 'email').length;
  const cfg = triggerCfg(automation.trigger_type);

  return (
    <div className="rounded-xl transition-all" style={{ background: '#181C27', border: '1px solid #252B3B' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4F7FFF')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#252B3B')}>
      <div className="p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>{automation.name}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: '#8B92A5' }}>{emailSteps} email{emailSteps !== 1 ? 's' : ''}</span>
              <span className="text-xs" style={{ color: '#8B92A5' }}>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); onEdit(automation); }}
              className="p-1.5 rounded-lg transition-colors" style={{ color: '#8B92A5' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1A2744'; e.currentTarget.style.color = '#4F7FFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B92A5'; }}
              title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-40" style={{ color: '#8B92A5' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2D0E0E'; e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B92A5'; }}
              title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            </button>

            {/* Active toggle */}
            <button onClick={handleToggle} disabled={toggling}
              className="relative inline-flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ background: automation.is_active ? '#4F7FFF' : '#252B3B' }}
              title={automation.is_active ? 'Deactivate' : 'Activate'}>
              <span className="inline-block w-4 h-4 bg-white rounded-full transition-transform"
                style={{ transform: automation.is_active ? 'translateX(24px)' : 'translateX(4px)' }} />
            </button>

            <svg viewBox="0 0 24 24" fill="none" stroke="#8B92A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4 transition-transform flex-shrink-0"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Step preview */}
        {!expanded && steps.length > 0 && (
          <div className="flex items-center gap-1 mt-3 overflow-hidden">
            {steps.slice(0, 5).map((step, i) => {
              const c = STEP_COLORS[step.type] || STEP_COLORS.email;
              return (
                <React.Fragment key={step.id || i}>
                  <div className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: c.bg, color: c.color }}>
                    {STEP_ICONS[step.type] || STEP_ICONS.email}
                    <span className="hidden sm:block">{stepLabel(step)}</span>
                  </div>
                  {i < Math.min(steps.length, 5) - 1 && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="2" className="w-3.5 h-3.5">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </React.Fragment>
              );
            })}
            {steps.length > 5 && <span className="text-xs ml-1" style={{ color: '#8B92A5' }}>+{steps.length - 5} more</span>}
          </div>
        )}
      </div>

      {expanded && steps.length > 0 && (
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: '#252B3B' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mt-4 mb-3" style={{ color: '#8B92A5' }}>Steps</p>
          <div className="flex items-center gap-1 flex-wrap">
            {steps.map((step, i) => {
              const c = STEP_COLORS[step.type] || STEP_COLORS.email;
              return (
                <React.Fragment key={step.id || i}>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: c.bg, color: c.color, border: '1px solid #252B3B' }}>
                    <span style={{ color: c.color }}>{STEP_ICONS[step.type] || STEP_ICONS.email}</span>
                    {stepLabel(step)}
                  </div>
                  {i < steps.length - 1 && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Preset templates ──────────────────────────────────────────────────────────
const PRESETS = [
  {
    name: 'Welcome Series',
    triggerType: 'contact_added',
    steps: [
      { id: '1', type: 'email', label: 'Welcome Email', subject: 'Welcome to {{company_name}}!' },
      { id: '2', type: 'delay', amount: 2, unit: 'days' },
      { id: '3', type: 'email', label: 'Getting Started', subject: 'Getting started guide' },
      { id: '4', type: 'delay', amount: 5, unit: 'days' },
      { id: '5', type: 'email', label: 'Success Stories', subject: 'See what others achieved' },
    ],
  },
  {
    name: 'Win-Back Flow',
    triggerType: 'campaign_opened',
    steps: [
      { id: '1', type: 'email', label: 'We Miss You', subject: 'Hey {{first_name}}, we miss you!' },
      { id: '2', type: 'delay', amount: 7, unit: 'days' },
      { id: '3', type: 'email', label: 'Special Offer', subject: 'A special offer just for you' },
    ],
  },
  {
    name: 'Birthday Greeting',
    triggerType: 'date_based',
    steps: [
      { id: '1', type: 'email', label: 'Happy Birthday', subject: 'Happy Birthday {{first_name}}! 🎉' },
    ],
  },
  {
    name: 'Tag-Based Flow',
    triggerType: 'tag_added',
    steps: [
      { id: '1', type: 'email', label: 'Welcome to Segment', subject: "You've been added to our {{tag}} list" },
      { id: '2', type: 'delay', amount: 1, unit: 'days' },
      { id: '3', type: 'email', label: 'Follow-up', subject: 'More info for you' },
    ],
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Automations() {
  const { automations, automationsLoading, fetchAutomations, toggleAutomation, createAutomation, updateAutomation, deleteAutomation } = useAppStore();
  const [editingAutomation, setEditingAutomation] = useState(null); // null = closed, false = new, object = edit
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => { fetchAutomations(); }, []);

  const handleSave = async (data) => {
    if (editingAutomation && editingAutomation.id) {
      await updateAutomation(editingAutomation.id, data);
    } else {
      await createAutomation(data);
    }
  };

  const openNew = () => { setEditingAutomation({}); setShowPresets(true); };
  const openEdit = (automation) => { setEditingAutomation(automation); setShowPresets(false); };
  const closeEditor = () => { setEditingAutomation(null); setShowPresets(false); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Automations</h2>
          <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>
            {automations.length} automation{automations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openNew}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Automation
        </Button>
      </div>

      {/* Automation list */}
      {automationsLoading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="1.5" className="w-16 h-16">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <p className="text-sm" style={{ color: '#8B92A5' }}>No automations yet. Create one to get started.</p>
          <Button variant="primary" size="md" onClick={openNew}>Create Automation</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              onToggle={toggleAutomation}
              onEdit={openEdit}
              onDelete={deleteAutomation}
            />
          ))}
        </div>
      )}

      {/* Preset picker modal */}
      {editingAutomation !== null && showPresets && (
        <Modal isOpen onClose={closeEditor} title="New Automation">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#8B92A5' }}>Start from a preset or build from scratch.</p>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map((p) => {
                const cfg = triggerCfg(p.triggerType);
                return (
                  <button key={p.name}
                    className="text-left p-3 rounded-xl transition-all"
                    style={{ background: '#0F1117', border: '1px solid #252B3B' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4F7FFF')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#252B3B')}
                    onClick={() => { setEditingAutomation({ ...p }); setShowPresets(false); }}>
                    <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>{p.name}</p>
                    <p className="text-xs mt-1" style={{ color: cfg.color }}>{cfg.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#8B92A5' }}>{p.steps.length} steps</p>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" size="md" onClick={closeEditor}>Cancel</Button>
              <Button variant="primary" size="md" onClick={() => setShowPresets(false)}>
                Build from Scratch
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Editor modal */}
      {editingAutomation !== null && !showPresets && (
        <Modal
          isOpen
          onClose={closeEditor}
          title={editingAutomation?.id ? `Edit: ${editingAutomation.name}` : 'New Automation'}
        >
          <AutomationEditor
            automation={editingAutomation?.id ? editingAutomation : (Object.keys(editingAutomation).length ? editingAutomation : null)}
            onClose={closeEditor}
            onSave={handleSave}
          />
        </Modal>
      )}
    </div>
  );
}
