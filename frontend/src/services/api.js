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
  getConfig: () => api.get('/auth/config'), // Yeni public endpoint
  me: () => api.get('/auth/me'),
};

// Kullanıcı API
export const userAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  adminCreate: (data) => api.post('/users/admin-create', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getOnline: () => api.get('/users/online'),
  getLoginLogs: () => api.get('/users/logs/login'),
  getActivityLogs: () => api.get('/users/logs/activity'),
  getAgendaStats: () => api.get('/users/stats/agenda'),
  getSettings: () => api.get('/users/settings/all'),
  updateSettings: (data) => api.put('/users/settings/update', data),
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
  getKazanims: (id) => api.get(`/branslar/${id}/kazanimlar`),
  importKazanims: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/branslar/${id}/kazanim-import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
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
  updateDurum: (id, data) => api.put(`/sorular/${id}/durum`, data),
  dizgiAl: (id) => api.post(`/sorular/${id}/dizgi-al`),
  dizgiTamamla: (id, data) => api.post(`/sorular/${id}/dizgi-tamamla`, data),
  dizgiTamamlaWithFile: (id, formData) => api.post(`/sorular/${id}/dizgi-tamamla`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getStats: (params) => api.get('/sorular/stats/genel', { params }),
  getDetayliStats: () => api.get('/sorular/stats/detayli'),
  getDizgiBransStats: () => api.get('/sorular/stats/dizgi-brans'),
  getIncelemeBransStats: () => api.get('/sorular/stats/inceleme-brans'),
  getIncelemeDetayliStats: () => api.get('/sorular/stats/inceleme-detayli'),
  getRapor: (params) => api.get('/sorular/rapor', { params }),
  getYedek: () => api.get('/sorular/yedek'),
  getComments: (id) => api.get(`/sorular/${id}/yorumlar`),
  addComment: (id, text) => api.post(`/sorular/${id}/yorum`, { yorum_metni: text }),
  getHistory: (id) => api.get(`/sorular/${id}/gecmis`),
  addRevizeNot: (id, data) => api.post(`/sorular/${id}/revize-not`, data),
  getRevizeNotlari: (id) => api.get(`/sorular/${id}/revize-notlari`),
  deleteRevizeNot: (id, notId) => api.delete(`/sorular/${id}/revize-not/${notId}`),
  uploadFinal: (id, formData) => api.put(`/sorular/${id}/final-upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  adminCleanup: (data) => api.post('/sorular/admin-cleanup', data),
};

// Bildirim API
export const bildirimAPI = {
  getAll: () => api.get('/bildirimler'),
  getOkunmamisSayisi: () => api.get('/bildirimler/okunmamis-sayisi'),
  markAsRead: (id) => api.put(`/bildirimler/${id}/okundu`),
  markAllAsRead: () => api.put('/bildirimler/hepsini-okundu-isaretle'),
  duyuruGonder: (data) => api.post('/bildirimler/duyuru', data),
};

// Mesaj API (Soru bazlı)
export const mesajAPI = {
  getBySoruId: (soruId) => api.get(`/mesajlar/soru/${soruId}`),
  send: (data) => api.post('/mesajlar', data),
  delete: (id) => api.delete(`/mesajlar/${id}`),
};

// Kullanıcı Mesaj API (Kişiler arası)
export const kullaniciMesajAPI = {
  getKullanicilar: () => api.get('/kullanici-mesajlar/kullanicilar'),
  getKonusmalar: () => api.get('/kullanici-mesajlar/konusmalar'),
  getKonusma: (kullaniciId) => api.get(`/kullanici-mesajlar/konusma/${kullaniciId}`),
  send: (data) => api.post('/kullanici-mesajlar/gonder', data),
  delete: (id) => api.delete(`/kullanici-mesajlar/${id}`),
  getOkunmamisSayisi: () => api.get('/kullanici-mesajlar/okunmamis-sayisi'),
};

// Deneme API
export const denemeAPI = {
  createPlan: (data) => api.post('/denemeler/plan', data),
  getAll: (params) => api.get('/denemeler', { params }),
  upload: (id, formData) => api.post(`/denemeler/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAgenda: () => api.get('/denemeler/ajanda'),
};
