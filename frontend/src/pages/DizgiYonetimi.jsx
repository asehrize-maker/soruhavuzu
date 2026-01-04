import { useState, useEffect } from 'react';
import { soruAPI } from '../services/api';
import useAuthStore from '../store/authStore';

export default function DizgiYonetimi() {
  const { user } = useAuthStore();
  const [sorular, setSorular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSoru, setSelectedSoru] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [revizeNotu, setRevizeNotu] = useState('');

  useEffect(() => {
    loadSorular();
  }, []);

  const loadSorular = async () => {
    try {
      const response = await soruAPI.getAll({ brans_id: user.brans_id });
      setSorular(response.data.data);
    } catch (error) {
      alert('Sorular yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleDurumGuncelle = async (soruId, durum) => {
    try {
      const data = { durum };
      if (durum === 'revize_gerekli' && revizeNotu) {
        data.revize_notu = revizeNotu;
      }

      await soruAPI.updateDurum(soruId, data);
      alert('Durum güncellendi!');
      setShowModal(false);
      setSelectedSoru(null);
      setRevizeNotu('');
      loadSorular();
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
      dizgide: 'bg-blue-100 text-blue-800',
      tamamlandi: 'bg-green-100 text-green-800',
      revize_gerekli: 'bg-red-100 text-red-800',
    };
    const labels = {
      beklemede: 'Beklemede',
      dizgide: 'Dizgide',
      tamamlandi: 'Tamamlandı',
      revize_gerekli: 'Revize Gerekli',
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
                  <p className="text-gray-700 mb-2">{soru.soru_metni}</p>
                  <div className="text-sm text-gray-500">
                    <p>Branş: {soru.brans_adi}</p>
                    <p>Oluşturan: {soru.olusturan_ad}</p>
                    {soru.latex_kodu && (
                      <p className="text-blue-600">✓ LaTeX kodu mevcut</p>
                    )}
                    {soru.fotograf_url && (
                      <p className="text-green-600">✓ Fotoğraf mevcut</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {soru.durum === 'beklemede' && (
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
                        Tamamlandı
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
