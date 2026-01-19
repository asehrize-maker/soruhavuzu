import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { soruAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import MesajKutusu from '../components/MesajKutusu';

export default function DizgiYonetimi() {
  const navigate = useNavigate();
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;
  const [sorular, setSorular] = useState([]);
  const [bransCounts, setBransCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSoru, setSelectedSoru] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showMesaj, setShowMesaj] = useState(null);
  const [revizeNotu, setRevizeNotu] = useState('');

  useEffect(() => {
    loadSorular();
    loadBransCounts();
  }, []);

  const loadSorular = async () => {
    try {
      const response = await soruAPI.getAll({ brans_id: user.brans_id });
      // Sadece dizgi aşamasındaki soruları göster
      const filtered = (response.data.data || []).filter(s => s.durum === 'dizgi_bekliyor' || s.durum === 'dizgide');
      setSorular(filtered);
    } catch (error) {
      alert('Sorular yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadBransCounts = async () => {
    try {
      const res = await soruAPI.getDizgiBransStats();
      if (res.data && res.data.success) {
        setBransCounts(res.data.data || []);
      }
    } catch (err) {
      console.error('Branş istatistikleri yüklenemedi', err);
    }
  };

  const handleDurumGuncelle = async (soruId, durum) => {
    try {
      const data = { yeni_durum: durum };
      if (durum === 'revize_gerekli' && revizeNotu) {
        data.aciklama = revizeNotu;
      }

      await soruAPI.updateDurum(soruId, data);
      alert('Durum güncellendi!');
      setShowModal(false);
      setSelectedSoru(null);
      setRevizeNotu('');
      await loadSorular();
      loadBransCounts();
    } catch (error) {
      alert(error.response?.data?.error || 'Durum güncellenemedi');
    }
  };

  const openRevizeModal = (soru) => {
    setSelectedSoru(soru);
    setShowModal(true);
  };

  const getDurumBadge = (durum) => {
    const badges = {
      beklemede: 'bg-yellow-100 text-yellow-800',
      dizgi_bekliyor: 'bg-purple-100 text-purple-800',
      dizgide: 'bg-blue-100 text-blue-800',
      tamamlandi: 'bg-green-100 text-green-800',
      revize_gerekli: 'bg-red-100 text-red-800',
      revize_istendi: 'bg-red-100 text-red-800',
    };
    const labels = {
      beklemede: 'Beklemede',
      dizgi_bekliyor: 'Dizgi Bekliyor',
      dizgide: 'Dizgide',
      tamamlandi: 'Tamamlandı',
      revize_gerekli: 'Revize Gerekli',
      revize_istendi: 'Revize İstendi',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badges[durum]}`}>
        {labels[durum]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dizgi Yönetimi</h1>

      {/* Branş bazlı bekleyen soru sayıları */}
      {bransCounts && bransCounts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {bransCounts.filter(b => Number(b.dizgi_bekliyor) > 0).map(b => (
            <div key={b.id} className="px-3 py-1 rounded-full bg-gray-100 text-sm font-semibold flex items-center gap-2">
              <span className="text-gray-700">{b.brans_adi}</span>
              <span className="bg-purple-600 text-white px-2 py-0.5 rounded-full text-xs">{b.dizgi_bekliyor}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : sorular.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Henüz soru yok</h3>
        </div>
      ) : (
        <div className="grid gap-4">
          {sorular.map((soru) => (
            <div key={soru.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg">Soru #{soru.id}</h3>
                    {getDurumBadge(soru.durum)}
                  </div>
                  <div className="text-gray-900 mb-3 text-sm border-l-4 border-gray-100 pl-3 py-1" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                    <span className="font-bold text-amber-600">V{soru.versiyon || 1}</span>
                    <span>Branş: {soru.brans_adi}</span>
                    <span>Oluşturan: {soru.olusturan_ad}</span>
                    {soru.latex_kodu && <span className="text-blue-600">✓ LaTeX</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate(`/sorular/${soru.id}`)}
                    className="btn btn-secondary btn-sm"
                  >
                    Detay
                  </button>

                  <button
                    onClick={() => setShowMesaj(showMesaj === soru.id ? null : soru.id)}
                    className="btn btn-info btn-sm"
                  >
                    💬 Mesaj
                  </button>

                  {soru.durum === 'dizgi_bekliyor' && (
                    <button
                      onClick={() => handleDurumGuncelle(soru.id, 'dizgide')}
                      className="btn btn-primary btn-sm"
                    >
                      Dizgiye Al
                    </button>
                  )}

                  {soru.durum === 'dizgide' && (
                    <>
                      <button
                        onClick={() => handleDurumGuncelle(soru.id, 'tamamlandi')}
                        className="btn btn-success btn-sm"
                      >
                        ✅ Tamamlandı
                      </button>
                      <button
                        onClick={() => openRevizeModal(soru)}
                        className="btn btn-error btn-sm"
                      >
                        Revize İste
                      </button>
                    </>
                  )}

                  {soru.durum === 'revize_gerekli' && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Revize bekleniyor
                      {soru.revize_notu && (
                        <p className="text-xs mt-1">{soru.revize_notu}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {soru.fotograf_url && (
                <img
                  src={soru.fotograf_url}
                  alt="Soru"
                  className="max-w-md rounded border"
                />
              )}

              {/* Mesajlaşma Alanı */}
              {showMesaj === soru.id && (
                <div className="mt-4 border-t pt-4">
                  <div className="h-[400px]">
                    <MesajKutusu
                      soruId={soru.id}
                      soruSahibi={{ ad_soyad: soru.olusturan_ad }}
                      dizgici={{ ad_soyad: user.ad_soyad }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Revize Modal */}
      {showModal && selectedSoru && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">
              Revize Talebi - Soru #{selectedSoru.id}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Revize Notu
                </label>
                <textarea
                  rows="4"
                  className="input"
                  placeholder="Nelerin düzeltilmesi gerektiğini açıklayın..."
                  value={revizeNotu}
                  onChange={(e) => setRevizeNotu(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setRevizeNotu('');
                  }}
                  className="btn btn-secondary"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleDurumGuncelle(selectedSoru.id, 'revize_gerekli')}
                  className="btn btn-error"
                >
                  Revize İste
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
