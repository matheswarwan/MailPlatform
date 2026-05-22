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
        contacts: res.data.contacts || res.data,
        contactsMeta: res.data.meta || { total: 0, page: 1, pages: 1 },
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
    set((state) => ({ contacts: [res.data, ...state.contacts] }));
    return res.data;
  },

  deleteContact: async (id) => {
    await client.delete(`/contacts/${id}`);
    set((state) => ({ contacts: state.contacts.filter((c) => c._id !== id) }));
  },

  // ── Campaigns ─────────────────────────────────────────────────
  campaigns: [],
  campaignsLoading: false,

  fetchCampaigns: async () => {
    set({ campaignsLoading: true });
    try {
      const res = await client.get('/campaigns');
      set({ campaigns: res.data, campaignsLoading: false });
    } catch {
      set({ campaignsLoading: false });
    }
  },

  createCampaign: async (data) => {
    const res = await client.post('/campaigns', data);
    set((state) => ({ campaigns: [res.data, ...state.campaigns] }));
    return res.data;
  },

  updateCampaign: async (id, data) => {
    const res = await client.put(`/campaigns/${id}`, data);
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c._id === id ? res.data : c)),
    }));
    return res.data;
  },

  sendCampaign: async (id, scheduledAt = null) => {
    const payload = scheduledAt ? { scheduledAt } : {};
    const res = await client.post(`/campaigns/${id}/send`, payload);
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c._id === id ? res.data : c)),
    }));
    return res.data;
  },

  deleteCampaign: async (id) => {
    await client.delete(`/campaigns/${id}`);
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c._id !== id),
    }));
  },

  // ── Segments ──────────────────────────────────────────────────
  segments: [],
  segmentsLoading: false,

  fetchSegments: async () => {
    set({ segmentsLoading: true });
    try {
      const res = await client.get('/segments');
      set({ segments: res.data, segmentsLoading: false });
    } catch {
      set({ segmentsLoading: false });
    }
  },

  createSegment: async (data) => {
    const res = await client.post('/segments', data);
    set((state) => ({ segments: [...state.segments, res.data] }));
    return res.data;
  },

  // ── Automations ───────────────────────────────────────────────
  automations: [],
  automationsLoading: false,

  fetchAutomations: async () => {
    set({ automationsLoading: true });
    try {
      const res = await client.get('/automations');
      set({ automations: res.data, automationsLoading: false });
    } catch {
      set({ automationsLoading: false });
    }
  },

  toggleAutomation: async (id, active) => {
    const res = await client.patch(`/automations/${id}`, { active });
    set((state) => ({
      automations: state.automations.map((a) => (a._id === id ? res.data : a)),
    }));
    return res.data;
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
        analytics: overviewRes.data,
        campaignAnalytics: campaignsRes.data,
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
      const res = await client.get('/preference-config');
      set({ preferenceConfig: res.data, preferenceConfigLoading: false });
    } catch {
      set({ preferenceConfigLoading: false });
    }
  },

  updatePreferenceConfig: async (data) => {
    const res = await client.put('/preference-config', data);
    set({ preferenceConfig: res.data });
    return res.data;
  },
}));

export default useAppStore;
