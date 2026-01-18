import { create } from 'zustand';
import { authAPI } from '../services/api';

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

const useAuthStore = create((set) => ({
  user: safeJsonParse(localStorage.getItem('user')),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.login(credentials);
      const { token, user } = response.data;
      if (!token || !user) {
        throw new Error('Sunucudan beklenen oturum bilgisi gelmedi');
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({ user, token, isAuthenticated: true, loading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Giriş başarısız';
      set({ error: errorMessage, loading: false });
      return { success: false, error: errorMessage };
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.register(data);
      const { token, user } = response.data;
      if (!token || !user) {
        throw new Error('Sunucudan beklenen oturum bilgisi gelmedi');
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({ user, token, isAuthenticated: true, loading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Kayıt başarısız';
      set({ error: errorMessage, loading: false });
      return { success: false, error: errorMessage };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    set({ user: userData });
  },
}));

export default useAuthStore;
