import { create } from 'zustand';
import client from '../api/client';

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

const storedToken = localStorage.getItem('token');
const storedUser = storedToken ? parseJwt(storedToken) : null;

const useAuthStore = create((set, get) => ({
  token: storedToken || null,
  user: storedUser || null,
  loginError: null,
  loginLoading: false,

  get isAuthenticated() {
    return !!get().token;
  },

  login: async (email, password) => {
    set({ loginLoading: true, loginError: null });
    try {
      const res = await client.post('/auth/login', { email, password });
      const { token } = res.data;
      localStorage.setItem('token', token);
      const user = parseJwt(token);
      set({ token, user, loginLoading: false, loginError: null });
      return true;
    } catch (err) {
      const message =
        err.response?.data?.message || 'Invalid email or password.';
      set({ loginLoading: false, loginError: message });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, loginError: null });
  },
}));

export default useAuthStore;
