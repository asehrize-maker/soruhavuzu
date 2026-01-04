import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI } from '../services/api';

export default function SoruDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [soru, setSoru] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dizgiNotu, setDizgiNotu] = useState('');

  useEffect(() => {
    loadSoru();
  }, [id]);

  const loadSoru = async () => {
    try {
      const response = await soruAPI.getById(id);
      setSoru(response.data.data);
    } catch (error) {
      alert('Soru yüklenemedi');
      navigate('/sorular');
    } finally {
      setLoading(false);
    }
  };

  const handleDizgiTamamla = async () => {
    try {
      await soruAPI.dizgiTamamla(id, { notlar: dizgiNotu });
      alert('Dizgi tamamlandı!');
      loadSoru();
    } catch (error) {
      alert(error.response?.data?.error || 'Dizgi tamamlama başarısız');
    }
  };

  const handleSil = async () => {
    if (!confirm('Bu soruyu silmek istediğinizden emin misiniz?')) return;
    
    try {
      await soruAPI.delete(id);
      alert('Soru silindi');
      navigate('/sorular');
    } catch (error) {
      alert(error.response?.data?.error || 'Silme işlemi başarısız');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!soru) return null;

  const getDurumBadge = (durum) => {
    const badges = {
      beklemede: 'badge badge-warning',
      dizgide: 'badge badge-info',
      tamamlandi: 'badge badge-success',
    };
    const labels = {
      beklemede: 'Beklemede',
      dizgide: 'Dizgide',
      tamamlandi: 'Tamamlandı',
    };
    return <span className={badges[durum]}>{labels[durum]}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Soru Detayı</h1>
          <p className="mt-2 text-gray-600">Soru #{soru.id}</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => navigate('/sorular')} className="btn btn-secondary">
            Geri
          </button>
          {(user?.rol === 'admin' || soru.olusturan_kullanici_id === user?.id) && (
            <button onClick={handleSil} className="btn btn-danger">
              Sil
            </button>
          )}
        </div>
      </div>

      {/* Soru Bilgileri */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getDurumBadge(soru.durum)}
            {soru.zorluk_seviyesi && (
              <span className="badge bg-gray-100 text-gray-800">
                {soru.zorluk_seviyesi}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {new Date(soru.olusturulma_tarihi).toLocaleString('tr-TR')}
          </p>
        </div>

        <div className="prose max-w-none">
          <h3 className="text-xl font-semibold mb-3">Soru Metni</h3>
          <p className="text-gray-900 whitespace-pre-wrap">{soru.soru_metni}</p>
        </div>

        {soru.fotograf_url && (
          <div className="mt-6">
            <h4 className="text-lg font-medium mb-3">Fotoğraf</h4>
            <img
              src={soru.fotograf_url}
              alt="Soru fotoğrafı"
              className="max-w-full h-auto rounded-lg shadow-md"
            />
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Branş:</span>
              <span className="ml-2 font-medium">{soru.brans_adi}</span>
            </div>
            <div>
              <span className="text-gray-500">Ekip:</span>
              <span className="ml-2 font-medium">{soru.ekip_adi}</span>
            </div>
            <div>
              <span className="text-gray-500">Oluşturan:</span>
              <span className="ml-2 font-medium">{soru.olusturan_ad}</span>
              {soru.olusturan_email && (
                <span className="ml-1 text-gray-400">({soru.olusturan_email})</span>
              )}
            </div>
            {soru.dizgici_ad && (
              <div>
                <span className="text-gray-500">Dizgici:</span>
                <span className="ml-2 font-medium">{soru.dizgici_ad}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dizgi İşlemleri */}
      {user?.rol === 'dizgici' && soru.durum === 'dizgide' && soru.dizgici_id === user.id && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Dizgi Tamamla</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notlar (Opsiyonel)
              </label>
              <textarea
                rows="4"
                className="input"
                placeholder="Dizgi hakkında notlar..."
                value={dizgiNotu}
                onChange={(e) => setDizgiNotu(e.target.value)}
              />
            </div>
            <button onClick={handleDizgiTamamla} className="btn btn-primary">
              Dizgiyi Tamamla
            </button>
          </div>
        </div>
      )}

      {/* Dizgi Geçmişi */}
      {soru.dizgi_gecmisi && soru.dizgi_gecmisi.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Dizgi Geçmişi</h3>
          <div className="space-y-3">
            {soru.dizgi_gecmisi.map((gecmis) => (
              <div key={gecmis.id} className="border-l-4 border-primary-500 pl-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{gecmis.dizgici_ad}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(gecmis.tamamlanma_tarihi).toLocaleString('tr-TR')}
                  </span>
                </div>
                {gecmis.notlar && (
                  <p className="mt-1 text-sm text-gray-600">{gecmis.notlar}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
