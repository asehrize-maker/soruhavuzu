import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { bildirimAPI } from '../services/api';

export default function Duyurular() {
  const navigate = useNavigate();
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    baslik: '',
    mesaj: '',
    tip: 'duyuru',
    link: ''
  });

  // Admin değilse yönlendir
  if (user?.rol !== 'admin') {
    navigate('/');
    return null;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.baslik.trim() || !formData.mesaj.trim()) {
      alert('Başlık ve mesaj alanları gereklidir');
      return;
    }

    if (!confirm('Bu duyuruyu tüm kullanıcılara göndermek istediğinizden emin misiniz?')) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        baslik: formData.baslik,
        mesaj: formData.mesaj,
        tip: formData.tip,
        link: formData.link || null
      };

      const response = await bildirimAPI.duyuruGonder(payload);
      
      alert(`Duyuru başarıyla gönderildi! ${response.data.data.gonderilen_sayi} kullanıcıya ulaştı.`);
      
      // Formu temizle
      setFormData({
        baslik: '',
        mesaj: '',
        tip: 'duyuru',
        link: ''
      });
    } catch (error) {
      alert(error.response?.data?.error || 'Duyuru gönderilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Duyuru Yönetimi</h1>
        <p className="mt-2 text-gray-600">Tüm kullanıcılara duyuru gönderin</p>
      </div>

      <div className="card">
        <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-blue-900">Bilgilendirme</h4>
              <p className="text-blue-700 mt-1 text-sm">
                Bu formla gönderdiğiniz duyuru, sisteme kayıtlı tüm kullanıcılara bildirim olarak iletilecektir.
                Kullanıcılar bildirimleri başlık kısmındaki zil ikonundan görebilirler.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Duyuru Tipi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duyuru Tipi
            </label>
            <select
              name="tip"
              className="input"
              value={formData.tip}
              onChange={handleChange}
              required
            >
              <option value="duyuru">📢 Duyuru (Mavi)</option>
              <option value="info">ℹ️ Bilgi (Mavi)</option>
              <option value="success">✅ Başarı (Yeşil)</option>
              <option value="warning">⚠️ Uyarı (Sarı)</option>
              <option value="error">❌ Önemli (Kırmızı)</option>
            </select>
          </div>

          {/* Başlık */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Başlık *
            </label>
            <input
              type="text"
              name="baslik"
              className="input"
              placeholder="Örn: Sistemsel Güncelleme Duyurusu"
              value={formData.baslik}
              onChange={handleChange}
              required
              maxLength={100}
            />
            <p className="mt-1 text-sm text-gray-500">
              {formData.baslik.length}/100 karakter
            </p>
          </div>

          {/* Mesaj */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mesaj *
            </label>
            <textarea
              name="mesaj"
              rows="6"
              className="input"
              placeholder="Duyuru içeriğini buraya yazın..."
              value={formData.mesaj}
              onChange={handleChange}
              required
              maxLength={500}
            />
            <p className="mt-1 text-sm text-gray-500">
              {formData.mesaj.length}/500 karakter
            </p>
          </div>

          {/* Link (Opsiyonel) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yönlendirme Linki (Opsiyonel)
            </label>
            <input
              type="text"
              name="link"
              className="input"
              placeholder="Örn: /sorular veya https://example.com"
              value={formData.link}
              onChange={handleChange}
            />
            <p className="mt-1 text-sm text-gray-500">
              Kullanıcılar bildirime tıkladığında bu adrese yönlendirilir
            </p>
          </div>

          {/* Önizleme */}
          {(formData.baslik || formData.mesaj) && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-3">Önizleme</h3>
              <div className={`p-4 rounded-lg border-l-4 ${
                formData.tip === 'duyuru' || formData.tip === 'info' ? 'bg-blue-50 border-blue-500' :
                formData.tip === 'success' ? 'bg-green-50 border-green-500' :
                formData.tip === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                'bg-red-50 border-red-500'
              }`}>
                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    formData.tip === 'duyuru' || formData.tip === 'info' ? 'bg-blue-100' :
                    formData.tip === 'success' ? 'bg-green-100' :
                    formData.tip === 'warning' ? 'bg-yellow-100' :
                    'bg-red-100'
                  }`}>
                    <span className="text-xl">
                      {formData.tip === 'duyuru' ? '📢' :
                       formData.tip === 'info' ? 'ℹ️' :
                       formData.tip === 'success' ? '✅' :
                       formData.tip === 'warning' ? '⚠️' : '❌'}
                    </span>
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {formData.baslik || 'Başlık buraya gelecek'}
                    </h4>
                    <p className="mt-1 text-gray-700 text-sm">
                      {formData.mesaj || 'Mesaj içeriği buraya gelecek'}
                    </p>
                    {formData.link && (
                      <p className="mt-2 text-xs text-gray-500">
                        🔗 Yönlendirilecek: {formData.link}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      Şimdi
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Butonlar */}
          <div className="flex justify-between items-center pt-6 border-t">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn btn-secondary"
              disabled={loading}
            >
              İptal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Gönderiliyor...
                </span>
              ) : (
                '📢 Duyuruyu Gönder'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
