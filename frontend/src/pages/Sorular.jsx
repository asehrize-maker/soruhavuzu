import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';

export default function Sorular() {
  const { user } = useAuthStore();
  const [sorular, setSorular] = useState([]);
  const [branslar, setBranslar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    durum: '',
    brans_id: '',
  });

  useEffect(() => {
    loadBranslar();
    loadSorular();
  }, [filters]);

  const loadBranslar = async () => {
    try {
      const response = await bransAPI.getAll();
      setBranslar(response.data.data);
    } catch (error) {
      console.error('Branşlar yüklenemedi:', error);
    }
  };

  const loadSorular = async () => {
    setLoading(true);
    try {
      const response = await soruAPI.getAll(filters);
      setSorular(response.data.data);
    } catch (error) {
      console.error('Sorular yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDizgiAl = async (id) => {
    try {
      await soruAPI.dizgiAl(id);
      loadSorular();
    } catch (error) {
      alert(error.response?.data?.error || 'Dizgiye alma başarısız');
    }
  };

  const getDurumBadge = (durum) => {
    const badges = {
      beklemede: 'badge badge-warning',
      dizgide: 'badge badge-info',
      tamamlandi: 'badge badge-success',
      revize_gerekli: 'badge badge-error',
    };
    const labels = {
      beklemede: 'Beklemede',
      dizgide: 'Dizgide',
      tamamlandi: 'Tamamlandı',
      revize_gerekli: 'Revize Gerekli',
    };
    return <span className={badges[durum]}>{labels[durum]}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Sorular</h1>
        {(user?.rol === 'admin' || user?.rol === 'soru_yazici') && (
          <Link to="/sorular/yeni" className="btn btn-primary">
            + Yeni Soru Ekle
          </Link>
        )}
      </div>

      {/* Filtreler */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
            <select
              className="input"
              value={filters.durum}
              onChange={(e) => setFilters({ ...filters, durum: e.target.value })}
            >
              <option value="">Tümü</option>
              <option value="beklemede">Beklemede</option>
              <option value="dizgide">Dizgide</option>
              <option value="tamamlandi">Tamamlandı</option>
              <option value="revize_gerekli">Revize Gerekli</option>
            </select>
          </div>

          {user?.rol === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branş</label>
              <select
                className="input"
                value={filters.brans_id}
                onChange={(e) => setFilters({ ...filters, brans_id: e.target.value })}
              >
                <option value="">Tümü</option>
                {branslar.map((brans) => (
                  <option key={brans.id} value={brans.id}>
                    {brans.brans_adi} ({brans.ekip_adi})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Sorular Listesi */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : sorular.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Soru bulunamadı</h3>
          <p className="mt-1 text-sm text-gray-500">Henüz hiç soru eklenmemiş.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorular.map((soru) => (
            <div key={soru.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getDurumBadge(soru.durum)}
                    <span className="text-sm text-gray-500">
                      {soru.brans_adi} • {soru.ekip_adi}
                    </span>
                    {soru.zorluk_seviyesi && (
                      <span className="text-sm text-gray-500">
                        Zorluk: {soru.zorluk_seviyesi}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-900 line-clamp-2 mb-2">{soru.soru_metni}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Yazan: {soru.olusturan_ad}</span>
                    {soru.dizgici_ad && <span>Dizgici: {soru.dizgici_ad}</span>}
                    <span>{new Date(soru.olusturulma_tarihi).toLocaleDateString('tr-TR')}</span>
                    {soru.fotograf_url && (
                      <span className="text-primary-600">📷 Fotoğraf var</span>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex items-center space-x-2">
                  <Link
                    to={`/sorular/${soru.id}`}
                    className="btn btn-secondary text-sm"
                  >
                    Detay
                  </Link>
                  
                  {user?.rol === 'dizgici' && soru.durum === 'beklemede' && (
                    <button
                      onClick={() => handleDizgiAl(soru.id)}
                      className="btn btn-primary text-sm"
                    >
                      Dizgiye Al
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
