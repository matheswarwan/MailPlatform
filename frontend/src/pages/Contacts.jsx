import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TagPill({ tag, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: '#1A2744', color: '#4F7FFF' }}
    >
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:opacity-70">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </span>
  );
}

// Evaluate segment rules against a contact (mirrors backend buildSegmentQuery logic)
function contactMatchesSegment(contact, segment) {
  const rules = segment.rules || [];
  if (rules.length === 0) return true; // "All Contacts" segment
  return rules.every(({ field, operator, value }) => {
    if (!field || !operator || value === undefined) return false;
    if (field === 'tag') {
      if (operator === 'contains' || operator === 'equals') return (contact.tags || []).includes(value);
      if (operator === 'not_contains') return !(contact.tags || []).includes(value);
    } else if (field === 'status') {
      if (operator === 'equals') return contact.status === value;
      if (operator === 'not_equals') return contact.status !== value;
    } else if (field === 'email') {
      if (operator === 'contains') return (contact.email || '').toLowerCase().includes(value.toLowerCase());
      if (operator === 'equals') return contact.email === value;
    } else if (field === 'created_at') {
      if (operator === 'after') return new Date(contact.createdAt) > new Date(value);
      if (operator === 'before') return new Date(contact.createdAt) < new Date(value);
    } else if (field === 'source') {
      if (operator === 'equals') return contact.source === value;
    }
    return false;
  });
}

// Mock contacts for demo
const MOCK_CONTACTS = [
  { _id: '1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Chen', tags: ['vip', 'newsletter'], status: 'active', createdAt: '2024-01-15', lastActivity: '2025-05-20' },
  { _id: '2', email: 'bob@acme.com', firstName: 'Bob', lastName: 'Smith', tags: ['newsletter'], status: 'active', createdAt: '2024-03-10', lastActivity: '2025-05-18' },
  { _id: '3', email: 'carol@widgets.co', firstName: 'Carol', lastName: 'Taylor', tags: [], status: 'unsubscribed', createdAt: '2024-02-20', lastActivity: '2025-04-01' },
  { _id: '4', email: 'dan@tech.io', firstName: 'Dan', lastName: 'Lee', tags: ['early-adopter', 'vip'], status: 'active', createdAt: '2023-12-05', lastActivity: '2025-05-21' },
  { _id: '5', email: 'eva@startup.com', firstName: 'Eva', lastName: 'Brown', tags: ['newsletter'], status: 'bounced', createdAt: '2024-04-12', lastActivity: '2025-03-15' },
  { _id: '6', email: 'frank@corp.com', firstName: 'Frank', lastName: 'Wilson', tags: ['vip'], status: 'active', createdAt: '2024-05-01', lastActivity: '2025-05-19' },
  { _id: '7', email: 'grace@mail.com', firstName: 'Grace', lastName: 'Davis', tags: [], status: 'complained', createdAt: '2024-06-10', lastActivity: '2025-02-28' },
  { _id: '8', email: 'henry@example.net', firstName: 'Henry', lastName: 'Martinez', tags: ['newsletter', 'early-adopter'], status: 'active', createdAt: '2024-07-22', lastActivity: '2025-05-15' },
];

const PAGE_SIZE = 10;

export default function Contacts() {
  const navigate = useNavigate();
  const {
    contacts: storeContacts,
    contactsLoading,
    fetchContacts,
    addContact,
    updateContact,
    deleteContact,
    segments,
    fetchSegments,
    attributeDefinitions,
    fetchAttributeDefinitions,
  } = useAppStore();

  useEffect(() => { fetchSegments(); }, []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', firstName: '', lastName: '', tags: '', sex: '', customFields: {} });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [editContact, setEditContact] = useState(null); // contact being edited
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetchContacts({ page, q: search, status: statusFilter !== 'all' ? statusFilter : undefined });
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchAttributeDefinitions();
  }, []);

  const contacts = storeContacts.length > 0 ? storeContacts : MOCK_CONTACTS;

  const filtered = contacts.filter((c) => {
    const matchSearch =
      !search ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      c.lastName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleAll = () => {
    if (selected.length === paginated.length) {
      setSelected([]);
    } else {
      setSelected(paginated.map((c) => c._id));
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await addContact({
        email: addForm.email,
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        tags: addForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        sex: addForm.sex || undefined,
        customFields: Object.keys(addForm.customFields).length > 0 ? addForm.customFields : undefined,
      });
      setShowAddModal(false);
      setAddForm({ email: '', firstName: '', lastName: '', tags: '', sex: '', customFields: {} });
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add contact.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await deleteContact(id);
    } catch {
      // ignore
    }
  };

  const openEdit = (contact) => {
    setEditContact(contact);
    setEditForm({
      email: contact.email || '',
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      company: contact.company || '',
      phone: contact.phone || '',
      sex: contact.sex || '',
      birthday: contact.birthday ? contact.birthday.substring(0, 10) : '',
      status: contact.status || 'active',
      tags: (contact.tags || []).filter((t) => !t.startsWith('seg:')).join(', '),
      customFields: contact.custom_fields ? { ...contact.custom_fields } : {},
    });
    setEditError('');
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      await updateContact(editContact._id || editContact.id, {
        email: editForm.email,
        firstName: editForm.firstName || null,
        lastName: editForm.lastName || null,
        company: editForm.company || null,
        phone: editForm.phone || null,
        sex: editForm.sex || null,
        birthday: editForm.birthday || null,
        status: editForm.status,
        tags: editForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        customFields: Object.keys(editForm.customFields).length > 0 ? editForm.customFields : {},
      });
      setEditContact(null);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save changes.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Contacts</h2>
          <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>
            {filtered.length} contact{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8B92A5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email or name…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{ background: '#181C27', border: '1px solid #252B3B', color: '#F1F3F9' }}
            onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
            onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: '#181C27', border: '1px solid #252B3B', color: '#F1F3F9' }}
          onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
          onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
        >
          {['all', 'active', 'unsubscribed', 'bounced', 'complained'].map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: '#1A2744', border: '1px solid #4F7FFF' }}
        >
          <span className="text-sm font-medium" style={{ color: '#F1F3F9' }}>
            {selected.length} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            <Button variant="secondary" size="sm">Add Tag</Button>
            <Button variant="secondary" size="sm">Remove Tag</Button>
            <Button variant="secondary" size="sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </Button>
            <Button variant="danger" size="sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              Delete
            </Button>
          </div>
          <button
            className="ml-auto text-sm"
            style={{ color: '#8B92A5' }}
            onClick={() => setSelected([])}
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#181C27', border: '1px solid #252B3B' }}
      >
        {contactsLoading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <p className="text-sm" style={{ color: '#8B92A5' }}>No contacts found</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #252B3B' }}>
                  <th className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selected.length === paginated.length && paginated.length > 0}
                      onChange={toggleAll}
                      className="rounded accent-blue-500 cursor-pointer"
                    />
                  </th>
                  {['Email', 'First Name', 'Last Name', 'Tags', 'Status', 'Date Added', 'Last Activity', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#8B92A5' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((contact, idx) => (
                  <React.Fragment key={contact._id}>
                    <tr
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid #252B3B' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1E2436')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = expandedId === contact._id ? '#1E2436' : 'transparent')}
                      onClick={() => setExpandedId(expandedId === contact._id ? null : contact._id)}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(contact._id)}
                          onChange={() => toggleSelect(contact._id)}
                          className="rounded accent-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-medium" style={{ color: '#4F7FFF' }}>
                          {contact.email}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm" style={{ color: '#F1F3F9' }}>
                        {contact.firstName || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm" style={{ color: '#F1F3F9' }}>
                        {contact.lastName || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(() => {
                            const visibleTags = (contact.tags || []).filter((t) => !t.startsWith('seg:'));
                            return visibleTags.length > 0 ? (
                              <>
                                {visibleTags.slice(0, 2).map((tag) => (
                                  <TagPill key={tag} tag={tag} />
                                ))}
                                {visibleTags.length > 2 && (
                                  <span className="text-xs" style={{ color: '#8B92A5' }}>
                                    +{visibleTags.length - 2}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs" style={{ color: '#8B92A5' }}>—</span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge status={contact.status || 'active'} />
                      </td>
                      <td className="px-4 py-3.5 text-sm" style={{ color: '#8B92A5' }}>
                        {formatDate(contact.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-sm" style={{ color: '#8B92A5' }}>
                        {formatDate(contact.lastActivity)}
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(contact)}
                            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                            style={{ color: '#8B92A5' }}
                            title="Edit contact"
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#1A2744'; e.currentTarget.style.color = '#4F7FFF'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B92A5'; }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(contact._id)}
                            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                            style={{ color: '#8B92A5' }}
                            title="Delete contact"
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#2D0E0E'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B92A5'; }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId === contact._id && (() => {
                      const contactSegments = (segments || []).filter((seg) =>
                        contactMatchesSegment(contact, seg)
                      );
                      const visibleTags = (contact.tags || []).filter((t) => !t.startsWith('seg:'));
                      return (
                        <tr style={{ background: '#1E2436', borderBottom: '1px solid #252B3B' }}>
                          <td colSpan={9} className="px-6 py-5">
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8B92A5' }}>Contact Info</p>
                                <div className="space-y-1.5">
                                  <p className="text-sm" style={{ color: '#F1F3F9' }}>{contact.email}</p>
                                  <p className="text-sm" style={{ color: '#8B92A5' }}>
                                    {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8B92A5' }}>Tags</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {visibleTags.length > 0 ? (
                                    visibleTags.map((tag) => <TagPill key={tag} tag={tag} />)
                                  ) : (
                                    <span className="text-sm" style={{ color: '#8B92A5' }}>No tags</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8B92A5' }}>Segments</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {contactSegments.length > 0 ? contactSegments.map((seg) => (
                                    <button
                                      key={seg.id || seg._id}
                                      onClick={(e) => { e.stopPropagation(); navigate(`/audience?segment=${seg.id || seg._id}`); }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-70"
                                      style={{ background: '#1E2436', border: `1px solid ${seg.color || '#4F7FFF'}`, color: seg.color || '#4F7FFF', cursor: 'pointer' }}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color || '#4F7FFF' }} />
                                      {seg.name}
                                    </button>
                                  )) : (
                                    <span className="text-sm" style={{ color: '#8B92A5' }}>None</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8B92A5' }}>Status & Activity</p>
                                <div className="space-y-2">
                                  <Badge status={contact.status || 'active'} />
                                  <p className="text-xs" style={{ color: '#8B92A5' }}>
                                    Added: <span style={{ color: '#F1F3F9' }}>{formatDate(contact.createdAt)}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                            {/* Additional attributes row */}
                            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#252B3B' }}>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8B92A5' }}>Additional Details</p>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                <div>
                                  <span className="text-xs" style={{ color: '#8B92A5' }}>Phone: </span>
                                  <span className="text-xs" style={{ color: contact.phone ? '#F1F3F9' : '#4A5060' }}>{contact.phone || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-xs" style={{ color: '#8B92A5' }}>Company: </span>
                                  <span className="text-xs" style={{ color: contact.company ? '#F1F3F9' : '#4A5060' }}>{contact.company || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-xs" style={{ color: '#8B92A5' }}>Sex: </span>
                                  <span className="text-xs" style={{ color: contact.sex ? '#F1F3F9' : '#4A5060' }}>{contact.sex || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-xs" style={{ color: '#8B92A5' }}>Birthday: </span>
                                  <span className="text-xs" style={{ color: contact.birthday ? '#F1F3F9' : '#4A5060' }}>{contact.birthday || '—'}</span>
                                </div>
                                {(attributeDefinitions || []).map((def) => {
                                  const value = contact.custom_fields?.[def.key];
                                  return (
                                    <div key={def.id}>
                                      <span className="text-xs" style={{ color: '#8B92A5' }}>{def.name}: </span>
                                      <span className="text-xs" style={{ color: value != null ? '#F1F3F9' : '#4A5060' }}>
                                        {value != null ? String(value) : '—'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div
              className="flex items-center justify-between px-5 py-3.5 border-t"
              style={{ borderColor: '#252B3B' }}
            >
              <p className="text-sm" style={{ color: '#8B92A5' }}>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: '#8B92A5', border: '1px solid #252B3B' }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = '#4F7FFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, page - 3),
                  Math.min(totalPages, page + 2)
                ).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors"
                    style={{
                      background: p === page ? '#4F7FFF' : 'transparent',
                      color: p === page ? '#fff' : '#8B92A5',
                      border: '1px solid',
                      borderColor: p === page ? '#4F7FFF' : '#252B3B',
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: '#8B92A5', border: '1px solid #252B3B' }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = '#4F7FFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252B3B'; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Contact Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setAddError(''); setAddForm({ email: '', firstName: '', lastName: '', tags: '', sex: '', customFields: {} }); }} title="Add Contact">
        <form onSubmit={handleAddContact} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Email <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              type="email"
              required
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              placeholder="contact@example.com"
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>First Name</label>
              <input
                type="text"
                value={addForm.firstName}
                onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                placeholder="Alice"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Last Name</label>
              <input
                type="text"
                value={addForm.lastName}
                onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                placeholder="Smith"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Tags</label>
            <input
              type="text"
              value={addForm.tags}
              onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
              placeholder="newsletter, vip (comma-separated)"
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Sex</label>
            <select
              value={addForm.sex}
              onChange={(e) => setAddForm({ ...addForm, sex: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
              onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </div>

          {attributeDefinitions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider pt-1" style={{ color: '#8B92A5', borderTop: '1px solid #252B3B', paddingTop: 12 }}>Custom Fields</p>
              {attributeDefinitions.map((def) => (
                <div key={def.id}>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>{def.name}</label>
                  {def.type === 'text' && (
                    <input
                      type="text"
                      value={addForm.customFields[def.key] || ''}
                      onChange={(e) => setAddForm({ ...addForm, customFields: { ...addForm.customFields, [def.key]: e.target.value } })}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                      onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                      onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                    />
                  )}
                  {def.type === 'number' && (
                    <input
                      type="number"
                      value={addForm.customFields[def.key] || ''}
                      onChange={(e) => setAddForm({ ...addForm, customFields: { ...addForm.customFields, [def.key]: e.target.value } })}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                      onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                      onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                    />
                  )}
                  {def.type === 'date' && (
                    <input
                      type="date"
                      value={addForm.customFields[def.key] || ''}
                      onChange={(e) => setAddForm({ ...addForm, customFields: { ...addForm.customFields, [def.key]: e.target.value } })}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                      onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                      onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                    />
                  )}
                  {def.type === 'boolean' && (
                    <div className="flex items-center gap-2 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={!!addForm.customFields[def.key]}
                        onChange={(e) => setAddForm({ ...addForm, customFields: { ...addForm.customFields, [def.key]: e.target.checked } })}
                        className="rounded accent-blue-500 cursor-pointer w-4 h-4"
                      />
                      <span className="text-sm" style={{ color: '#F1F3F9' }}>{def.name}</span>
                    </div>
                  )}
                  {def.type === 'select' && (
                    <select
                      value={addForm.customFields[def.key] || ''}
                      onChange={(e) => setAddForm({ ...addForm, customFields: { ...addForm.customFields, [def.key]: e.target.value } })}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                      onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                      onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
                    >
                      <option value="">Select…</option>
                      {(def.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {addError && (
            <p className="text-sm" style={{ color: '#EF4444' }}>{addError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="md" type="button" onClick={() => { setShowAddModal(false); setAddError(''); setAddForm({ email: '', firstName: '', lastName: '', tags: '', sex: '', customFields: {} }); }}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={addLoading}>
              Add Contact
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Contact Modal ─────────────────────────────────────── */}
      <Modal isOpen={!!editContact} onClose={() => setEditContact(null)} title="Edit Contact">
        {editContact && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Email <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')}
                onBlur={(e) => (e.target.style.borderColor = '#252B3B')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>First Name</label>
                <input type="text" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Last Name</label>
                <input type="text" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Company</label>
                <input type="text" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Phone</label>
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Sex</label>
                <select value={editForm.sex} onChange={(e) => setEditForm({ ...editForm, sex: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')}>
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Birthday</label>
                <input type="date" value={editForm.birthday} onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')}>
                  <option value="active">Active</option>
                  <option value="unsubscribed">Unsubscribed</option>
                  <option value="bounced">Bounced</option>
                  <option value="complained">Complained</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>Tags</label>
                <input type="text" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="newsletter, vip"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
              </div>
            </div>

            {attributeDefinitions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider pt-1" style={{ color: '#8B92A5', borderTop: '1px solid #252B3B', paddingTop: 12 }}>Custom Fields</p>
                {attributeDefinitions.map((def) => (
                  <div key={def.id}>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B92A5' }}>{def.name}</label>
                    {(def.type === 'text') && (
                      <input type="text" value={editForm.customFields[def.key] || ''}
                        onChange={(e) => setEditForm({ ...editForm, customFields: { ...editForm.customFields, [def.key]: e.target.value } })}
                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                        onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
                    )}
                    {(def.type === 'number') && (
                      <input type="number" value={editForm.customFields[def.key] || ''}
                        onChange={(e) => setEditForm({ ...editForm, customFields: { ...editForm.customFields, [def.key]: e.target.value } })}
                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                        onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
                    )}
                    {(def.type === 'date') && (
                      <input type="date" value={editForm.customFields[def.key] || ''}
                        onChange={(e) => setEditForm({ ...editForm, customFields: { ...editForm.customFields, [def.key]: e.target.value } })}
                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                        onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')} />
                    )}
                    {(def.type === 'boolean') && (
                      <div className="flex items-center gap-2 px-4 py-2.5">
                        <input type="checkbox" checked={!!editForm.customFields[def.key]}
                          onChange={(e) => setEditForm({ ...editForm, customFields: { ...editForm.customFields, [def.key]: e.target.checked } })}
                          className="rounded accent-blue-500 cursor-pointer w-4 h-4" />
                        <span className="text-sm" style={{ color: '#F1F3F9' }}>{def.name}</span>
                      </div>
                    )}
                    {(def.type === 'select') && (
                      <select value={editForm.customFields[def.key] || ''}
                        onChange={(e) => setEditForm({ ...editForm, customFields: { ...editForm.customFields, [def.key]: e.target.value } })}
                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#0F1117', border: '1px solid #252B3B', color: '#F1F3F9' }}
                        onFocus={(e) => (e.target.style.borderColor = '#4F7FFF')} onBlur={(e) => (e.target.style.borderColor = '#252B3B')}>
                        <option value="">Select…</option>
                        {(def.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editError && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#EF444420', color: '#EF4444' }}>{editError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="md" type="button" onClick={() => setEditContact(null)}>Cancel</Button>
              <Button variant="primary" size="md" type="submit" loading={editLoading}>Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
