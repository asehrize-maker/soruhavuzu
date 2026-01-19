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
  const [pending, setPending] = useState([]);
  const [inProgress, setInProgress] = useState([]);
  const [completed, setCompleted] = useState([]);
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
      const all = (response.data.data || []);
      setPending(all.filter(s => s.durum === 'dizgi_bekliyor'));
      setInProgress(all.filter(s => s.durum === 'dizgide'));
      setCompleted(all.filter(s => s.durum === 'tamamlandi'));
      setSorular(all);
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <h2 className="font-semibold">Dizgi Bekleyen</h2>
            {pending.map(soru => (
              <div key={soru.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold">Soru #{soru.id}</h4>
                    <div className="text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => navigate(`/sorular/${soru.id}`)} className="btn btn-secondary btn-sm">Detay</button>
                    <button onClick={() => setShowMesaj(showMesaj === soru.id ? null : soru.id)} className="btn btn-info btn-sm">💬</button>
                    <button onClick={() => handleDurumGuncelle(soru.id, 'dizgide')} className="btn btn-primary btn-sm">Dizgiye Al</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold">Dizgide</h2>
            {inProgress.map(soru => (
              <div key={soru.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold">Soru #{soru.id}</h4>
                    <div className="text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => navigate(`/sorular/${soru.id}`)} className="btn btn-secondary btn-sm">Detay</button>
                    <button onClick={() => setShowMesaj(showMesaj === soru.id ? null : soru.id)} className="btn btn-info btn-sm">💬</button>
                    <button onClick={() => handleDurumGuncelle(soru.id, 'tamamlandi')} className="btn btn-success btn-sm">✅ Tamamlandı</button>
                    <button onClick={() => openRevizeModal(soru)} className="btn btn-error btn-sm">Revize İste</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold">Tamamlanan</h2>
            {completed.map(soru => (
              <div key={soru.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold">Soru #{soru.id}</h4>
                    <div className="text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => navigate(`/sorular/${soru.id}`)} className="btn btn-secondary btn-sm">Detay</button>
                    <button onClick={() => setShowMesaj(showMesaj === soru.id ? null : soru.id)} className="btn btn-info btn-sm">💬</button>
                    <label className="btn btn-outline btn-sm">
                      Dosya Ekle
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const fd = new FormData();
                        if (file.type.startsWith('image/')) fd.append('fotograf', file);
                        else fd.append('dosya', file);
                        try {
                          await soruAPI.dizgiTamamlaWithFile(soru.id, fd);
                          alert('Dosya yüklendi ve havuza aktarıldı');
                          await loadSorular();
                          loadBransCounts();
                        } catch (err) {
                          alert(err.response?.data?.error || 'Dosya yüklenemedi');
                        }
                      }} />
                    </label>
                  </div>
                </div>
                {soru.fotograf_url && <img src={soru.fotograf_url} className="max-w-xs mt-2 rounded border" />}
                {soru.dosya_url && <a href={soru.dosya_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">Dosya (PDF/Diğer)</a>}
              </div>
            ))}
          </div>
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
