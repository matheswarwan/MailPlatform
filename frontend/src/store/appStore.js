import { create } from 'zustand';
import client from '../api/client';

const useAppStore = create((set, get) => ({
  // ── Contacts ──────────────────────────────────────────────────
  contacts: [],
  contactsLoading: false,
  contactsMeta: { total: 0, page: 1, pages: 1 },

  fetchContacts: async (params = {}) => {
    set({ contactsLoading: true });
    try {
      const res = await client.get('/contacts', { params });
      const normalize = (c) => ({
        ...c,
        _id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      });
      set({
        contacts: (res.data.contacts || []).map(normalize),
        contactsMeta: res.data.pagination || { total: 0, page: 1, pages: 1 },
        contactsLoading: false,
      });
    } catch {
      set({ contactsLoading: false });
    }
  },

  importContacts: async (file, segmentId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = segmentId ? `/contacts/import?segmentId=${segmentId}` : '/contacts/import';
    try {
      const res = await client.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  addContact: async (data) => {
    const res = await client.post('/contacts', data);
    const contact = res.data.contact || res.data;
    set((state) => ({ contacts: [contact, ...state.contacts] }));
    return contact;
  },

  updateContact: async (id, data) => {
    const res = await client.put(`/contacts/${id}`, data);
    const updated = res.data.contact || res.data;
    const normalize = (c) => ({ ...c, _id: c.id, firstName: c.first_name, lastName: c.last_name, createdAt: c.created_at, updatedAt: c.updated_at });
    const normalized = normalize(updated);
    set((state) => ({ contacts: state.contacts.map((c) => (c.id === id ? normalized : c)) }));
    return normalized;
  },

  deleteContact: async (id) => {
    await client.delete(`/contacts/${id}`);
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }));
  },

  // ── Campaigns ─────────────────────────────────────────────────
  campaigns: [],
  campaignsLoading: false,

  fetchCampaigns: async () => {
    set({ campaignsLoading: true });
    try {
      const res = await client.get('/campaigns');
      set({ campaigns: res.data.campaigns || [], campaignsLoading: false });
    } catch {
      set({ campaignsLoading: false });
    }
  },

  createCampaign: async (data) => {
    const res = await client.post('/campaigns', data);
    const campaign = res.data.campaign || res.data;
    set((state) => ({ campaigns: [campaign, ...state.campaigns] }));
    return campaign;
  },

  updateCampaign: async (id, data) => {
    const res = await client.put(`/campaigns/${id}`, data);
    const campaign = res.data.campaign || res.data;
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === id ? campaign : c)),
    }));
    return campaign;
  },

  sendCampaign: async (id, scheduledAt = null) => {
    const payload = scheduledAt ? { scheduledAt } : {};
    const res = await client.post(`/campaigns/${id}/send`, payload);
    const campaign = res.data.campaign || res.data;
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === id ? campaign : c)),
    }));
    return campaign;
  },

  deleteCampaign: async (id) => {
    await client.delete(`/campaigns/${id}`);
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
    }));
  },

  copyCampaign: async (id) => {
    const res = await client.get(`/campaigns/${id}`);
    const src = res.data.campaign || res.data;
    const blocks = src.template_blocks || src.blocks || [];
    const payload = {
      name: `Copy of ${src.name}`,
      subjectLine: src.subject_line || src.subject || '',
      previewText: src.preview_text || '',
      fromName: src.from_name || '',
      fromEmail: src.from_email || '',
      replyTo: src.reply_to || '',
      segmentId: src.segment_id || '',
      blocks,
    };
    const createRes = await client.post('/campaigns', payload);
    const campaign = createRes.data.campaign || createRes.data;
    set((state) => ({ campaigns: [campaign, ...state.campaigns] }));
    return campaign;
  },

  // ── Segments ──────────────────────────────────────────────────
  segments: [],
  segmentsLoading: false,

  fetchSegments: async () => {
    set({ segmentsLoading: true });
    try {
      const res = await client.get('/segments');
      set({ segments: res.data.segments || res.data || [], segmentsLoading: false });
    } catch {
      set({ segmentsLoading: false });
    }
  },

  createSegment: async (data) => {
    const res = await client.post('/segments', data);
    const segment = res.data.segment || res.data;
    set((state) => ({ segments: [...state.segments, segment] }));
    return segment;
  },

  // ── Automations ───────────────────────────────────────────────
  automations: [],
  automationsLoading: false,

  fetchAutomations: async () => {
    set({ automationsLoading: true });
    try {
      const res = await client.get('/automations');
      set({ automations: res.data.automations || [], automationsLoading: false });
    } catch {
      set({ automationsLoading: false });
    }
  },

  toggleAutomation: async (id) => {
    const res = await client.patch(`/automations/${id}/toggle`);
    const automation = res.data.automation || res.data;
    set((state) => ({
      automations: state.automations.map((a) => (a.id === id ? { ...a, ...automation } : a)),
    }));
    return automation;
  },

  createAutomation: async (data) => {
    const res = await client.post('/automations', data);
    const automation = res.data.automation || res.data;
    set((state) => ({ automations: [automation, ...state.automations] }));
    return automation;
  },

  updateAutomation: async (id, data) => {
    const res = await client.put(`/automations/${id}`, data);
    const automation = res.data.automation || res.data;
    set((state) => ({
      automations: state.automations.map((a) => (a.id === id ? automation : a)),
    }));
    return automation;
  },

  deleteAutomation: async (id) => {
    await client.delete(`/automations/${id}`);
    set((state) => ({ automations: state.automations.filter((a) => a.id !== id) }));
  },

  // ── Analytics ─────────────────────────────────────────────────
  analytics: null,
  analyticsLoading: false,
  analyticsChart: [],
  campaignAnalytics: [],

  fetchAnalytics: async (period = '30d') => {
    set({ analyticsLoading: true });
    try {
      const [overviewRes, campaignsRes] = await Promise.all([
        client.get('/analytics/overview', { params: { period } }),
        client.get('/analytics/campaigns', { params: { period } }),
      ]);
      set({
        analytics: overviewRes.data.overview || overviewRes.data,
        analyticsChart: overviewRes.data.daily_chart || [],
        campaignAnalytics: campaignsRes.data.campaigns || campaignsRes.data || [],
        analyticsLoading: false,
      });
    } catch {
      set({ analyticsLoading: false });
    }
  },

  // ── Preference Config ─────────────────────────────────────────
  preferenceConfig: null,
  preferenceConfigLoading: false,

  fetchPreferenceConfig: async () => {
    set({ preferenceConfigLoading: true });
    try {
      const res = await client.get('/preferences/config');
      set({ preferenceConfig: res.data.config || res.data, preferenceConfigLoading: false });
    } catch {
      set({ preferenceConfigLoading: false });
    }
  },

  updatePreferenceConfig: async (data) => {
    const res = await client.put('/preferences/config', data);
    const config = res.data.config || res.data;
    set({ preferenceConfig: config });
    return config;
  },

  updateSegment: async (id, data) => {
    const res = await client.put(`/segments/${id}`, data);
    const segment = res.data.segment || res.data;
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? segment : s)),
    }));
    return segment;
  },

  deleteSegment: async (id) => {
    await client.delete('/segments/' + id);
    set((state) => ({
      segments: state.segments.filter((s) => s.id !== id),
    }));
  },

  // ── Contact Attributes ────────────────────────────────────────
  contactFields: [],           // all fields (standard + custom) for segment builder
  attributeDefinitions: [],    // custom field definitions only
  attributesLoading: false,

  fetchContactFields: async () => {
    set({ attributesLoading: true });
    try {
      const res = await client.get('/contact-attributes');
      set({ contactFields: res.data.fields || [], attributesLoading: false });
    } catch {
      set({ attributesLoading: false });
    }
  },

  fetchAttributeDefinitions: async () => {
    try {
      const res = await client.get('/contact-attributes/definitions');
      set({ attributeDefinitions: res.data.definitions || [] });
    } catch {}
  },

  createAttributeDefinition: async (data) => {
    const res = await client.post('/contact-attributes/definitions', data);
    const def = res.data.definition;
    set((state) => ({ attributeDefinitions: [...state.attributeDefinitions, def] }));
    // Also refresh contactFields so the new field appears in segment builder
    const fieldsRes = await client.get('/contact-attributes');
    set({ contactFields: fieldsRes.data.fields || [] });
    return def;
  },

  deleteAttributeDefinition: async (id) => {
    await client.delete(`/contact-attributes/definitions/${id}`);
    set((state) => ({
      attributeDefinitions: state.attributeDefinitions.filter((d) => d.id !== id),
      contactFields: state.contactFields.filter((f) => !f.key.startsWith('custom:') || state.attributeDefinitions.find((d) => d.id !== id && `custom:${d.key}` === f.key)),
    }));
  },

  previewSegment: async (rules) => {
    try {
      const res = await client.post('/segments/preview', { rules });
      return res.data.count || 0;
    } catch {
      return null;
    }
  },

  // ── Assets ────────────────────────────────────────────────────
  assets: [],
  assetsLoading: false,

  fetchAssets: async (type) => {
    set({ assetsLoading: true });
    try {
      const params = type ? { type } : {};
      const res = await client.get('/assets', { params });
      set({ assets: res.data.assets || [], assetsLoading: false });
    } catch {
      set({ assetsLoading: false });
    }
  },

  uploadAsset: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post('/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const asset = res.data.asset;
    set((state) => ({ assets: [asset, ...state.assets] }));
    return asset;
  },

  deleteAsset: async (id) => {
    await client.delete(`/assets/${id}`);
    set((state) => ({ assets: state.assets.filter((a) => a.id !== id) }));
  },

  // ── Email Templates ───────────────────────────────────────────
  emailTemplates: [],
  emailTemplatesLoading: false,

  fetchEmailTemplates: async () => {
    set({ emailTemplatesLoading: true });
    try {
      const res = await client.get('/email-templates');
      set({ emailTemplates: res.data.templates || [], emailTemplatesLoading: false });
    } catch {
      set({ emailTemplatesLoading: false });
    }
  },

  createEmailTemplate: async (data) => {
    const res = await client.post('/email-templates', data);
    const template = res.data.template;
    set((state) => ({ emailTemplates: [template, ...state.emailTemplates] }));
    return template;
  },

  updateEmailTemplate: async (id, data) => {
    const res = await client.put(`/email-templates/${id}`, data);
    const template = res.data.template;
    set((state) => ({
      emailTemplates: state.emailTemplates.map((t) => (t.id === id ? template : t)),
    }));
    return template;
  },

  deleteEmailTemplate: async (id) => {
    await client.delete(`/email-templates/${id}`);
    set((state) => ({
      emailTemplates: state.emailTemplates.filter((t) => t.id !== id),
    }));
  },

  seedEmailPresets: async () => {
    const res = await client.post('/email-templates/seed-presets');
    if ((res.data.created || []).length > 0) {
      const listRes = await client.get('/email-templates');
      set({ emailTemplates: listRes.data.templates || [] });
    }
    return res.data;
  },
}));

export default useAppStore;
