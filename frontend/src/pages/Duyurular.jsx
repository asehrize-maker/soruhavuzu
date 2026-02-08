import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { bildirimAPI, userAPI } from '../services/api';
import {
  MegaphoneIcon,
  BellIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

export default function Duyurular() {
  const navigate = useNavigate();
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;

  const [activeTab, setActiveTab] = useState('bildirim'); // 'bildirim' or 'popup'
  const [loading, setLoading] = useState(false);

  // Standard Notification Form
  const [notificationData, setNotificationData] = useState({
    baslik: '',
    mesaj: '',
    tip: 'duyuru',
    link: ''
  });

  // Popup/Dashboard Alert Settings
  const [popupSettings, setPopupSettings] = useState([]);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupMessage, setPopupMessage] = useState(null);

  // Admin veya Koordinatör değilse yönlendir
  if (user?.rol !== 'admin' && user?.rol !== 'koordinator') {
    navigate('/');
    return null;
  }

  useEffect(() => {
    if (activeTab === 'popup') {
      fetchPopupSettings();
    }
  }, [activeTab]);

  const fetchPopupSettings = async () => {
    setPopupLoading(true);
    try {
      const res = await userAPI.getSettings();
      if (res.data.success) {
        // Only target panel_duyuru keys
        const filtered = res.data.data.filter(s => s.anahtar.startsWith('panel_duyuru_'));
        setPopupSettings(filtered);
      }
    } catch (error) {
      console.error('Popup ayarları yüklenemedi:', error);
    } finally {
      setPopupLoading(false);
    }
  };

  const handleNotificationChange = (e) => {
    setNotificationData({
      ...notificationData,
      [e.target.name]: e.target.value
    });
  };

  const handlePopupSettingChange = (anahtar, deger) => {
    setPopupSettings(prev => prev.map(s =>
      s.anahtar === anahtar ? { ...s, deger } : s
    ));
  };

  const handleNotificationSubmit = async (e) => {
    e.preventDefault();
    if (!notificationData.baslik.trim() || !notificationData.mesaj.trim()) {
      alert('Başlık ve mesaj alanları gereklidir');
      return;
    }
    if (!confirm('Bu duyuruyu tüm kullanıcılara bildirim olarak göndermek istediğinizden emin misiniz?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await bildirimAPI.duyuruGonder({
        ...notificationData,
        link: notificationData.link || null
      });
      alert(`Duyuru başarıyla gönderildi! ${response.data.data.gonderilen_sayi} kullanıcıya ulaştı.`);
      setNotificationData({ baslik: '', mesaj: '', tip: 'duyuru', link: '' });
    } catch (error) {
      alert(error.response?.data?.error || 'Duyuru gönderilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handlePopupSubmit = async (e) => {
    e.preventDefault();
    setPopupLoading(true);
    setPopupMessage(null);
    try {
      const res = await userAPI.updateSettings({ ayarlar: popupSettings });
      if (res.data.success) {
        setPopupMessage({ type: 'success', text: 'Panel duyurusu güncellendi.' });
        setTimeout(() => setPopupMessage(null), 3000);
      }
    } catch (error) {
      setPopupMessage({ type: 'error', text: 'Hata oluştu.' });
    } finally {
      setPopupLoading(false);
    }
  };

  const getPopupValue = (key) => popupSettings.find(s => s.anahtar === key)?.deger || '';

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Duyuru Yönetimi</h1>
          <p className="mt-2 text-gray-500 font-medium">Sistem geneline veya kullanıcı bildirimlerine müdahale edin.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveTab('bildirim')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'bildirim' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <BellIcon className="w-5 h-5" />
            Anlık Bildirim Gönder
          </button>
          {user?.rol === 'admin' && (
            <button
              onClick={() => setActiveTab('popup')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'popup' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <ComputerDesktopIcon className="w-5 h-5" />
              Panel Giriş Duyurusu
            </button>
          )}
        </div>
      </div>

      {activeTab === 'bildirim' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORM */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <form onSubmit={handleNotificationSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Duyuru Tipi</label>
                    <select
                      name="tip"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={notificationData.tip}
                      onChange={handleNotificationChange}
                    >
                      <option value="duyuru">📢 Genel Duyuru</option>
                      <option value="success">✅ Başarılı İşlem</option>
                      <option value="warning">⚠️ Kritik Uyarı</option>
                      <option value="error">❌ Hata / Önemli</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Başlık</label>
                    <input
                      type="text"
                      name="baslik"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="Örn: Sunucu Bakımı"
                      value={notificationData.baslik}
                      onChange={handleNotificationChange}
                      maxLength={100}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Duyuru Mesajı</label>
                  <textarea
                    name="mesaj"
                    rows="6"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Duyuru içeriğini buraya yazın..."
                    value={notificationData.mesaj}
                    onChange={handleNotificationChange}
                    maxLength={500}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Yönlendirme Linki (Opsiyonel)</label>
                  <input
                    type="text"
                    name="link"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Örn: /sorular veya https://google.com"
                    value={notificationData.link}
                    onChange={handleNotificationChange}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg hover:shadow-blue-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <MegaphoneIcon className="w-5 h-5" />}
                  Bildirimleri Gönder
                </button>
              </form>
            </div>
          </div>

          {/* PREVIEW */}
          <div className="space-y-6">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Canlı Önizleme</h4>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-start gap-4">
              <div className={`p-3 rounded-2xl flex-shrink-0 ${notificationData.tip === 'duyuru' ? 'bg-blue-100 text-blue-600' :
                notificationData.tip === 'success' ? 'bg-green-100 text-green-600' :
                  notificationData.tip === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                }`}>
                {notificationData.tip === 'duyuru' && <MegaphoneIcon className="w-6 h-6" />}
                {notificationData.tip === 'success' && <CheckCircleIcon className="w-6 h-6" />}
                {notificationData.tip === 'warning' && <ExclamationTriangleIcon className="w-6 h-6" />}
                {notificationData.tip === 'error' && <XCircleIcon className="w-6 h-6" />}
              </div>
              <div className="flex-1 space-y-1">
                <h5 className="font-black text-gray-900 leading-tight">{notificationData.baslik || 'Başlık'}</h5>
                <p className="text-sm text-gray-500 leading-relaxed">{notificationData.mesaj || 'Mesaj içeriği burada görünecek...'}</p>
                {notificationData.link && <p className="text-[10px] text-blue-500 font-bold font-mono truncate">{notificationData.link}</p>}
              </div>
            </div>


          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              {popupLoading ? (
                <div className="flex justify-center p-12"><ArrowPathIcon className="w-8 h-8 animate-spin text-gray-300" /></div>
              ) : (
                <form onSubmit={handlePopupSubmit} className="space-y-8">
                  {popupMessage && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${popupMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                      <CheckCircleIcon className="w-5 h-5" />
                      <span className="font-bold text-sm">{popupMessage.text}</span>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div>
                        <h4 className="font-black text-gray-800 text-sm uppercase tracking-widest leading-none">Duyuru Durumu</h4>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Kullanıcı paneline girişte duyuruyu göster</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePopupSettingChange('panel_duyuru_aktif', getPopupValue('panel_duyuru_aktif') === 'true' ? 'false' : 'true')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${getPopupValue('panel_duyuru_aktif') === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${getPopupValue('panel_duyuru_aktif') === 'true' ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Görünüm Türü</label>
                        <select
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          value={getPopupValue('panel_duyuru_tip')}
                          onChange={(e) => handlePopupSettingChange('panel_duyuru_tip', e.target.value)}
                        >
                          <option value="info">🔵 Bilgi (Soft Mavi)</option>
                          <option value="success">🟢 Başarı (Soft Yeşil)</option>
                          <option value="warning">🟠 Uyarı (Soft Turuncu)</option>
                          <option value="error">🔴 Acil (Soft Kırmızı)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Başlık</label>
                        <input
                          type="text"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          value={getPopupValue('panel_duyuru_baslik')}
                          onChange={(e) => handlePopupSettingChange('panel_duyuru_baslik', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Mesaj İçeriği</label>
                      <textarea
                        rows="4"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={getPopupValue('panel_duyuru_mesaj')}
                        onChange={(e) => handlePopupSettingChange('panel_duyuru_mesaj', e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={popupLoading}
                    className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {popupLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CloudArrowUpIcon className="w-5 h-5" />}
                    Ayarları Güncelle & Yayınla
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Panel Önizlemesi</h4>
            <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-gray-200 opacity-80">
              <div className={`p-5 rounded-2xl border ${getPopupValue('panel_duyuru_tip') === 'info' ? 'bg-blue-50 border-blue-100 text-blue-800' :
                getPopupValue('panel_duyuru_tip') === 'success' ? 'bg-green-50 border-green-100 text-green-800' :
                  getPopupValue('panel_duyuru_tip') === 'warning' ? 'bg-orange-50 border-orange-100 text-orange-800' :
                    'bg-red-50 border-red-100 text-red-800'
                }`}>
                <h5 className="font-black flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5" />
                  {getPopupValue('panel_duyuru_baslik') || 'Başlık'}
                </h5>
                <p className="text-sm mt-1 font-medium leading-relaxed opacity-90">
                  {getPopupValue('panel_duyuru_mesaj') || 'Henüz bir mesaj girilmedi...'}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
