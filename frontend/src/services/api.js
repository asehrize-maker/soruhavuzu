import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - token ekle
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - hata yönetimi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Kullanıcı API
export const userAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Ekip API
export const ekipAPI = {
  getAll: () => api.get('/ekipler'),
  getById: (id) => api.get(`/ekipler/${id}`),
  create: (data) => api.post('/ekipler', data),
  update: (id, data) => api.put(`/ekipler/${id}`, data),
  delete: (id) => api.delete(`/ekipler/${id}`),
};

// Branş API
export const bransAPI = {
  getAll: (ekipId) => api.get('/branslar', { params: { ekip_id: ekipId } }),
  getById: (id) => api.get(`/branslar/${id}`),
  create: (data) => api.post('/branslar', data),
  update: (id, data) => api.put(`/branslar/${id}`, data),
  delete: (id) => api.delete(`/branslar/${id}`),
};

// Soru API
export const soruAPI = {
  getAll: (params) => api.get('/sorular', { params }),
  getById: (id) => api.get(`/sorular/${id}`),
  create: (formData) => api.post('/sorular', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => api.put(`/sorular/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`/sorular/${id}`),
  dizgiAl: (id) => api.post(`/sorular/${id}/dizgi-al`),
  dizgiTamamla: (id, data) => api.post(`/sorular/${id}/dizgi-tamamla`, data),
  getStats: () => api.get('/sorular/stats/genel'),
};
