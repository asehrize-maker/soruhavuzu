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
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showMesaj, setShowMesaj] = useState(null);
  const [revizeNotu, setRevizeNotu] = useState('');
  const [completeData, setCompleteData] = useState({ notlar: '', finalPng: null });

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
      setShowCompleteModal(false);
      setSelectedSoru(null);
      setRevizeNotu('');
      await loadSorular();
      loadBransCounts();
    } catch (error) {
      alert(error.response?.data?.error || 'Durum güncellenemedi');
    }
  };

  const handleDizgiTamamla = async () => {
    if (!selectedSoru) return;
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append('notlar', completeData.notlar);
      if (completeData.finalPng) {
        fd.append('final_png', completeData.finalPng);
      }

      await soruAPI.dizgiTamamlaWithFile(selectedSoru.id, fd);
      alert('Dizgi başarıyla tamamlandı!');
      setShowCompleteModal(false);
      setSelectedSoru(null);
      setCompleteData({ notlar: '', finalPng: null });
      await loadSorular();
      loadBransCounts();
    } catch (err) {
      alert(err.response?.data?.error || 'Tamamlama işlemi başarısız');
    } finally {
      setLoading(false);
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
        <div className="flex gap-6">
          {/* Left column: stacked sections */}
          <div className="w-1/3 space-y-4 overflow-y-auto max-h-[75vh]">
            <div className="bg-white p-3 rounded shadow-sm">
              <h2 className="font-semibold mb-2">Dizgi Bekleyen</h2>
              <div className="space-y-2">
                {pending.map(soru => (
                  <div key={soru.id} className="p-2 border rounded hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSoru(soru)}>
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">Soru #{soru.id}</div>
                      <div className="text-xs text-gray-500">{soru.brans_adi}</div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1 truncate" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                    {/* Show if a prepared PNG/PDF exists and label it with the source soru id */}
                    {(soru.fotograf_url || soru.dosya_url) && (
                      <div className="mt-2 text-xs text-gray-500">
                        Hazırlanan dosya: Soru #{soru.id} • {soru.fotograf_url ? 'PNG' : ''}{soru.fotograf_url && soru.dosya_url ? ' / ' : ''}{soru.dosya_url ? 'PDF' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm">
              <h2 className="font-semibold mb-2">Dizgide</h2>
              <div className="space-y-2">
                {inProgress.map(soru => (
                  <div key={soru.id} className="p-2 border rounded hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSoru(soru)}>
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">Soru #{soru.id}</div>
                      <div className="text-xs text-gray-500">{soru.brans_adi}</div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1 truncate" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                    {(soru.fotograf_url || soru.dosya_url) && (
                      <div className="mt-2 text-xs text-gray-500">
                        Hazırlanan dosya: Soru #{soru.id} • {soru.fotograf_url ? (<a href={soru.fotograf_url} target="_blank" rel="noreferrer" className="text-blue-600">PNG</a>) : null}{soru.fotograf_url && soru.dosya_url ? ' / ' : ''}{soru.dosya_url ? (<a href={soru.dosya_url} target="_blank" rel="noreferrer" className="text-blue-600">PDF</a>) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm">
              <h2 className="font-semibold mb-2">Tamamlanan</h2>
              <div className="space-y-2">
                {completed.map(soru => (
                  <div key={soru.id} className="p-2 border rounded hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSoru(soru)}>
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">Soru #{soru.id}</div>
                      <div className="text-xs text-gray-500">{soru.brans_adi}</div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1 truncate" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: selected soru details */}
          <div className="w-2/3">
            {selectedSoru ? (
              <div className="card p-4">
                <div className="flex justify-between">
                  <div>
                    <h3 className="text-xl font-bold">Soru #{selectedSoru.id}</h3>
                    <div className="text-sm text-gray-600">Branş: {selectedSoru.brans_adi} • Oluşturan: {selectedSoru.olusturan_ad}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate(`/sorular/${selectedSoru.id}`)} className="btn btn-secondary btn-sm">Detay</button>
                    <button onClick={() => setShowMesaj(showMesaj === selectedSoru.id ? null : selectedSoru.id)} className="btn btn-info btn-sm">💬</button>
                    {selectedSoru.durum === 'dizgi_bekliyor' && <button onClick={() => handleDurumGuncelle(selectedSoru.id, 'dizgide')} className="btn btn-primary btn-sm">Dizgiye Al</button>}
                    {selectedSoru.durum === 'dizgide' && <button onClick={() => setShowCompleteModal(true)} className="btn btn-success btn-sm">✅ Tamamlandı</button>}
                  </div>
                </div>

                <div className="mt-4 text-gray-900" dangerouslySetInnerHTML={{ __html: selectedSoru.soru_metni }} />

                <div className="mt-4">
                  {selectedSoru.fotograf_url && <img src={selectedSoru.fotograf_url} className="max-w-md rounded border" />}
                  {selectedSoru.dosya_url && <div className="mt-2"><a href={selectedSoru.dosya_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">Dosya (PDF/Diğer)</a></div>}
                </div>

                {showMesaj === selectedSoru.id && (
                  <div className="mt-4 border-t pt-4">
                    <div className="h-[400px]">
                      <MesajKutusu
                        soruId={selectedSoru.id}
                        soruSahibi={{ ad_soyad: selectedSoru.olusturan_ad }}
                        dizgici={{ ad_soyad: user.ad_soyad }}
                      />
                    </div>
                  </div>
                )}

                {/* Dosya ekleme alanı for completed */}
                {selectedSoru.durum === 'tamamlandi' && (
                  <div className="mt-4">
                    <label className="btn btn-outline">
                      Dosya Ekle (PNG/PDF)
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const fd = new FormData();
                        if (file.type.startsWith('image/')) fd.append('fotograf', file);
                        else fd.append('dosya', file);
                        try {
                          await soruAPI.dizgiTamamlaWithFile(selectedSoru.id, fd);
                          alert('Dosya yüklendi ve havuza aktarıldı');
                          await loadSorular();
                          loadBransCounts();
                        } catch (err) {
                          alert(err.response?.data?.error || 'Dosya yüklenemedi');
                        }
                      }} />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-white rounded shadow-sm text-gray-500">Sol sütundan bir soru seçin, detaylar burada gözükecek.</div>
            )}
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

      {/* Tamamla Modal */}
      {showCompleteModal && selectedSoru && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">
              Dizgi Tamamla - Soru #{selectedSoru.id}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Final PNG (Seçenekelidir)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                      </svg>
                      <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">PNG Yükle</span></p>
                      <p className="text-xs text-gray-500">{completeData.finalPng ? completeData.finalPng.name : 'PNG dosyası seçiniz'}</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg"
                      onChange={(e) => setCompleteData({ ...completeData, finalPng: e.target.files[0] })}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notlar
                </label>
                <textarea
                  rows="3"
                  className="input"
                  placeholder="Eklemek istediğiniz notlar..."
                  value={completeData.notlar}
                  onChange={(e) => setCompleteData({ ...completeData, notlar: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    setCompleteData({ notlar: '', finalPng: null });
                  }}
                  className="btn btn-secondary"
                >
                  İptal
                </button>
                <button
                  onClick={handleDizgiTamamla}
                  className="btn btn-success"
                >
                  ✅ Tamamla ve Havuza Gönder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
