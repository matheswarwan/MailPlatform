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
      set({
        contacts: res.data.contacts || [],
        contactsMeta: res.data.pagination || { total: 0, page: 1, pages: 1 },
        contactsLoading: false,
      });
    } catch {
      set({ contactsLoading: false });
    }
  },

  importContacts: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await client.post('/contacts/import', formData, {
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

  // ── Analytics ─────────────────────────────────────────────────
  analytics: null,
  analyticsLoading: false,
  campaignAnalytics: [],

  fetchAnalytics: async () => {
    set({ analyticsLoading: true });
    try {
      const [overviewRes, campaignsRes] = await Promise.all([
        client.get('/analytics/overview'),
        client.get('/analytics/campaigns'),
      ]);
      set({
        analytics: overviewRes.data.overview || overviewRes.data,
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
}));

export default useAppStore;
