import React, { useState, useEffect } from 'react';
import useAppStore from '../store/appStore';
import Modal from '../components/ui/Modal';

const TABS = [
  { key: 'contacts', label: 'Contacts' },
];

const FIELD_TYPES = [
  { value: 'text',    label: 'Text' },
  { value: 'number',  label: 'Number' },
  { value: 'date',    label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select',  label: 'Dropdown' },
];

function ContactsTab() {
  const { attributeDefinitions, fetchAttributeDefinitions, createAttributeDefinition, deleteAttributeDefinition } = useAppStore((s) => ({
    attributeDefinitions: s.attributeDefinitions,
    fetchAttributeDefinitions: s.fetchAttributeDefinitions,
    createAttributeDefinition: s.createAttributeDefinition,
    deleteAttributeDefinition: s.deleteAttributeDefinition,
  }));

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'text', options: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { fetchAttributeDefinitions(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    const name = form.name.trim();
    if (!name) return setFormError('Name is required.');
    if (form.type === 'select') {
      const opts = form.options.split(',').map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) return setFormError('Dropdown requires at least one option.');
    }
    setSaving(true);
    try {
      const payload = { name, type: form.type };
      if (form.type === 'select') {
        payload.options = form.options.split(',').map((o) => o.trim()).filter(Boolean);
      }
      await createAttributeDefinition(payload);
      setShowModal(false);
      setForm({ name: '', type: 'text', options: '' });
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create attribute.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this custom attribute? Existing contact data for this field will remain in the database but won\'t be visible.')) return;
    setDeletingId(id);
    try {
      await deleteAttributeDefinition(id);
    } finally {
      setDeletingId(null);
    }
  };

  const typeLabel = (t) => FIELD_TYPES.find((f) => f.value === t)?.label || t;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#F1F3F9' }}>Custom Attributes</h2>
          <p className="text-sm mt-0.5" style={{ color: '#8B92A5' }}>
            Extra fields you can set on contacts (e.g. City, Plan, Income level).
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm({ name: '', type: 'text', options: '' }); setFormError(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: '#4F7FFF', color: '#fff' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Attribute
        </button>
      </div>

      {/* Standard fields info */}
      <div className="rounded-lg p-4 mb-6" style={{ background: '#1A1F2E', border: '1px solid #252B3B' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#8B92A5' }}>Standard Fields (built-in)</p>
        <div className="flex flex-wrap gap-2">
          {['Email', 'First Name', 'Last Name', 'Company', 'Phone', 'Sex', 'Birthday', 'Status', 'Tags', 'Source', 'Date Added'].map((f) => (
            <span key={f} className="px-2.5 py-1 rounded-md text-xs" style={{ background: '#252B3B', color: '#8B92A5' }}>{f}</span>
          ))}
        </div>
      </div>

      {/* Custom fields table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252B3B' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1A1F2E', borderBottom: '1px solid #252B3B' }}>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B92A5' }}>Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B92A5' }}>Key</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B92A5' }}>Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B92A5' }}>Options</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {attributeDefinitions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: '#8B92A5' }}>
                  No custom attributes yet. Click "Add Attribute" to create one.
                </td>
              </tr>
            ) : (
              attributeDefinitions.map((def) => (
                <tr key={def.id} style={{ borderBottom: '1px solid #252B3B' }}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: '#F1F3F9' }}>{def.name}</td>
                  <td className="px-5 py-3.5">
                    <code className="px-2 py-0.5 rounded text-xs" style={{ background: '#252B3B', color: '#8B92A5' }}>{def.key}</code>
                  </td>
                  <td className="px-5 py-3.5" style={{ color: '#8B92A5' }}>{typeLabel(def.type)}</td>
                  <td className="px-5 py-3.5" style={{ color: '#8B92A5' }}>
                    {def.type === 'select' && Array.isArray(def.options) && def.options.length > 0
                      ? def.options.join(', ')
                      : <span style={{ color: '#4A5060' }}>—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(def.id)}
                      disabled={deletingId === def.id}
                      className="p-1.5 rounded transition-colors hover:bg-red-500/10 disabled:opacity-40"
                      style={{ color: '#EF4444' }}
                      title="Delete attribute"
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Custom Attribute">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>
              Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. City, Plan, Income Level"
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
            {form.name.trim() && (
              <p className="text-xs mt-1" style={{ color: '#8B92A5' }}>
                Key: <code style={{ color: '#4F7FFF' }}>{form.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}</code>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value, options: '' })}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {form.type === 'select' && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>
                Options <span style={{ color: '#EF4444' }}>*</span>
                <span className="ml-1 font-normal" style={{ color: '#4A5060' }}>(comma-separated)</span>
              </label>
              <input
                type="text"
                value={form.options}
                onChange={(e) => setForm({ ...form, options: e.target.value })}
                placeholder="Free, Pro, Enterprise"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
              />
            </div>
          )}

          {formError && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#EF444420', color: '#EF4444' }}>{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#252B3B', color: '#8B92A5' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ background: '#4F7FFF', color: '#fff' }}
            >
              {saving ? 'Creating…' : 'Create Attribute'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState('contacts');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Admin</h1>
        <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>Platform configuration and settings.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: '#1A1F2E' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={
              activeTab === tab.key
                ? { background: '#4F7FFF', color: '#fff' }
                : { color: '#8B92A5' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'contacts' && <ContactsTab />}
    </div>
  );
}
