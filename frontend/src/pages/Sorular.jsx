import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import { getDurumBadge, generateExportHtml } from '../utils/helpers';

export default function Sorular({ scope }) {
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const isTakipModu = queryParams.get('takip') === '1';
  const urlDurum = queryParams.get('durum');

  const [sorular, setSorular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branslar, setBranslar] = useState([]);
  const [filters, setFilters] = useState({
    durum: urlDurum || ((user?.rol === 'admin' && !isTakipModu) ? '' : (isTakipModu ? '' : (scope === 'brans' ? '' : 'tamamlandi'))),
    brans_id: '',
  });

  // reset filter when switching modes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      durum: urlDurum || (isTakipModu ? '' : (scope === 'brans' ? '' : 'tamamlandi'))
    }));
  }, [isTakipModu, scope, urlDurum]);

  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState(queryParams.get('tab') || 'taslaklar'); // 'taslaklar' or 'dizgi_sonrasi'

  useEffect(() => {
    if (!user) return;

    const loadBranslar = async () => {
      if (user.rol !== 'admin') return;
      try {
        const response = await bransAPI.getAll();
        setBranslar(response.data.data || []);
      } catch (error) {
        console.error('Branşlar yüklenemedi:', error);
      }
    };

    loadBranslar();
  }, [user?.id, user?.rol]);

  useEffect(() => {
    if (!user) return;

    const loadSorular = async () => {
      setLoading(true);
      try {
        const params = {
          durum: filters.durum || undefined,
          brans_id: filters.brans_id || undefined,
          scope: scope || undefined
        };
        const response = await soruAPI.getAll(params);
        let data = response.data.data || [];

        // Branş Havuzu için Sekme Bazlı Filtreleme
        if (scope === 'brans') {
          if (activeTab === 'taslaklar') {
            // "Süreçteki Sorularım" sekmesi: Taslak (beklemede), inceleme, revize, dizgi aşamasındaki tüm soruları göster
            data = data.filter(s =>
              // Açıkça belirtilen durumlar:
              ['beklemede', 'inceleme_bekliyor', 'incelemede', 'alan_incelemede', 'dil_incelemede', 'revize_istendi', 'revize_gerekli', 'dizgi_bekliyor', 'dizgide'].includes(s.durum)
            );
          } else {
            // "Onaylanacaklar" sekmesi: Dizgi ve İnceleme aşamalarından dönen, öğretmenin nihai onayını bekleyenler
            data = data.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam'].includes(s.durum));
          }
        }

        // Frontend kısıtlamaları
        if (effectiveRole === 'dizgici' && authUser?.rol !== 'admin') {
          data = data.filter(s => ['dizgi_bekliyor', 'dizgide'].includes(s.durum));
        }

        setSorular(data);
      } catch (error) {
        console.error('Sorular yüklenemedi:', error);
        setSorular([]);
      } finally {
        setLoading(false);
      }
    };

    loadSorular();
  }, [user?.id, effectiveRole, filters.durum, filters.brans_id, scope, activeTab]);

  const handleSil = async (id) => {
    if (window.confirm('Bu soruyu kalıcı olarak silmek istediğinize emin misiniz?')) {
      try {
        await soruAPI.delete(id);
        setSorular(sorular.filter(s => s.id !== id));
      } catch (err) {
        console.error('Silme hatası:', err);
        alert('Silme işlemi başarısız oldu.');
      }
    }
  };

  const handleDizgiAl = async (soruId) => {
    try {
      await soruAPI.dizgiAl(soruId);
      const response = await soruAPI.getAll({
        durum: filters.durum || undefined,
        brans_id: filters.brans_id || undefined,
        scope: scope || undefined
      });
      setSorular(response.data.data || []);
    } catch (error) {
      alert(error.response?.data?.error || 'Soru dizgiye alınamadı');
    }
  };

  const handleUpdateStatusIndividual = async (id, status) => {
    try {
      setLoading(true);
      await soruAPI.updateDurum(id, { yeni_durum: status });
      const response = await soruAPI.getAll({
        scope,
        brans_id: filters.brans_id || undefined,
        durum: filters.durum || undefined
      });
      setSorular(response.data.data || []);
      alert(`✅ Soru durumu '${status}' olarak güncellendi.`);
    } catch (error) {
      console.error('Durum güncelleme hatası:', error);
      alert('Hata: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDizgiyeGonder = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    if (!window.confirm(`${idList.length} soruyu dizgi birimine göndermek istediğinize emin misiniz?`)) return;

    try {
      setLoading(true);
      await Promise.all(idList.map(id => soruAPI.updateDurum(id, { yeni_durum: 'dizgi_bekliyor' })));

      // Listeyi yenile
      const response = await soruAPI.getAll({
        durum: filters.durum || undefined,
        brans_id: filters.brans_id || undefined,
        scope: scope || undefined
      });
      let data = response.data.data || [];

      // Branş Havuzu için Sekme Bazlı Filtreleme
      if (scope === 'brans') {
        if (activeTab === 'taslaklar') {
          data = data.filter(s =>
            ['beklemede', 'dizgi_bekliyor', 'dizgide', 'revize_istendi', 'revize_gerekli', 'alan_incelemede', 'dil_incelemede'].includes(s.durum)
          );
        } else {
          data = data.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam'].includes(s.durum));
        }
      }

      setSorular(data);
      setSelectedQuestions([]);
      alert(`✅ ${idList.length} soru başarıyla dizgiye gönderildi.`);
    } catch (error) {
      console.error('Dizgiye gönderme hatası:', error);
      alert('İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleİncelemeyeGonder = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    if (!window.confirm(`${idList.length} soruyu ALAN İNCELEME birimine göndermek istediğinize emin misiniz?`)) return;

    try {
      setLoading(true);
      await Promise.all(idList.map(id => soruAPI.updateDurum(id, { yeni_durum: 'alan_incelemede' })));

      // Veriyi yenile
      const response = await soruAPI.getAll({ scope });
      let data = response.data.data || [];
      if (scope === 'brans') {
        if (activeTab === 'taslaklar') {
          data = data.filter(s => ['beklemede', 'dizgi_bekliyor', 'dizgide', 'revize_istendi', 'revize_gerekli', 'alan_incelemede', 'dil_incelemede'].includes(s.durum));
        } else {
          data = data.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam'].includes(s.durum));
        }
      }
      setSorular(data);
      setSelectedQuestions([]);
      alert(`✅ ${idList.length} soru başarıyla ALAN İNCELEMEYE gönderildi.`);
    } catch (error) {
      console.error('İncelemeye gönderme hatası:', error);
      alert('İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleOrtakHavuzaGonder = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    if (!window.confirm(`${idList.length} soruyu ORTAK HAVUZA (Tamamlandı) göndermek istediğinize emin misiniz?`)) return;

    try {
      setLoading(true);
      await Promise.all(idList.map(id => soruAPI.updateDurum(id, { yeni_durum: 'tamamlandi' })));

      const response = await soruAPI.getAll({ scope });
      let data = response.data.data || [];
      if (scope === 'brans') {
        if (activeTab === 'taslaklar') {
          data = data.filter(s => ['beklemede', 'dizgi_bekliyor', 'dizgide', 'revize_istendi', 'revize_gerekli', 'alan_incelemede', 'dil_incelemede'].includes(s.durum));
        } else {
          data = data.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam'].includes(s.durum));
        }
      }
      setSorular(data);
      setSelectedQuestions([]);
      alert(`✅ ${idList.length} soru başarıyla Ortak Havuza gönderildi.`);
    } catch (error) {
      console.error('Tamamlama hatası:', error);
      alert('İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (selectedQuestions.length === 0) return;

    const selectedData = sorular.filter(s => selectedQuestions.includes(s.id));
    const htmlContent = generateExportHtml(selectedData);

    // Basit bir HTML çıktısı oluştur ve yeni pencerede aç (Yazdırma/Kopyalama için)
    const exportWindow = window.open('', '_blank');
    exportWindow.document.write(htmlContent);
    exportWindow.document.close();
  };



  // Admin için Branş Seçimi Landing Page
  if (user?.rol === 'admin' && !filters.brans_id) {
    return (
      <div className="max-w-6xl mx-auto py-10 space-y-8 animate-fade-in-up">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Soru Havuzu</h1>
          <p className="text-xl text-gray-500">Lütfen işlem yapmak istediğiniz branşı seçiniz</p>
        </div>

        {loading ? (
          <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {branslar.map(brans => (
              <button
                key={brans.id}
                onClick={() => setFilters({ ...filters, brans_id: brans.id })}
                className="group flex flex-col items-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-blue-500 hover:bg-gradient-to-br hover:from-white hover:to-blue-50 transition-all transform hover:-translate-y-1"
              >
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform shadow-inner">📚</div>
                <h3 className="text-2xl font-bold text-gray-800 group-hover:text-blue-700">{brans.brans_adi}</h3>
                <p className="text-sm font-medium text-gray-500 mt-2 bg-gray-100 px-3 py-1 rounded-full">{brans.ekip_adi}</p>
                <div className="mt-6 text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                  Soruları Görüntüle <span className="ml-2">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {user?.rol === 'admin' && filters.brans_id && (
            <button
              onClick={() => setFilters({ ...filters, brans_id: '' })}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm"
              title="Branş Seçimine Dön"
            >
              <span className="text-xl font-bold">←</span>
            </button>
          )}
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            {isTakipModu ? 'Bekleyen İş Takibi' : (scope === 'brans' ? 'Branş Havuzu' : 'Ortak Soru Havuzu')}
            {user?.rol === 'admin' && filters.brans_id && (
              <span className="text-gray-400 font-light ml-3 text-2xl flex items-center">
                <span className="mx-2">/</span>
                <span className="text-blue-600">{branslar.find(b => b.id == filters.brans_id)?.brans_adi}</span>
              </span>
            )}
          </h1>
        </div>

        {/* Branş Havuzu Sekmeleri */}
        {scope === 'brans' && (
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-fit">
            <button
              onClick={() => { setActiveTab('taslaklar'); setFilters(f => ({ ...f, durum: '' })); setSelectedQuestions([]); }}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'taslaklar' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ✍️ Süreçteki Sorularım
            </button>
            <button
              onClick={() => { setActiveTab('dizgi_sonrasi'); setFilters(f => ({ ...f, durum: '' })); setSelectedQuestions([]); }}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'dizgi_sonrasi' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              🏁 Dizgiden Gelenler (Onaylanacak)
            </button>
          </div>
        )}
      </div>

      {/* Filtreler */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isTakipModu && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                className="input"
                value={filters.durum}
                onChange={(e) => setFilters({ ...filters, durum: e.target.value })}
              >
                <option value="">Tümü</option>
                <option value="beklemede">Beklemede</option>
                <option value="dizgi_bekliyor">Dizgi Bekliyor</option>
                <option value="dizgide">Dizgide</option>
                <option value="tamamlandi">Tamamlandı</option>
                <option value="revize_gerekli">Revize Gerekli</option>
                <option value="revize_istendi">Revize İstendi</option>
              </select>
            </div>
          )}

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

      {/* Araç Çubuğu (Dışa Aktarma / Çoklu İşlem) */}
      {scope === 'brans' && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                checked={sorular.length > 0 && selectedQuestions.length === sorular.length && sorular.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedQuestions(sorular.map(s => s.id));
                  } else {
                    setSelectedQuestions([]);
                  }
                }}
              />
              <span className="text-sm font-bold text-gray-700">Tümünü Seç</span>
            </label>
            {selectedQuestions.length > 0 && (
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                {selectedQuestions.length} soru seçildi
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'taslaklar' && (
              <button
                onClick={() => handleDizgiyeGonder(selectedQuestions)}
                disabled={selectedQuestions.length === 0}
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-4 shadow-sm disabled:opacity-50 disabled:grayscale transition-all flex items-center gap-2"
              >
                🚀 Seçilenleri DİZGİYE Gönder
              </button>
            )}

            {activeTab === 'dizgi_sonrasi' && (
              <>
                <button
                  onClick={() => handleİncelemeyeGonder(selectedQuestions.filter(id => sorular.find(s => s.id === id)?.durum === 'dizgi_tamam'))}
                  disabled={selectedQuestions.filter(id => sorular.find(s => s.id === id)?.durum === 'dizgi_tamam').length === 0}
                  className="btn bg-orange-600 hover:bg-orange-700 text-white text-sm py-2 px-4 shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  🔍 Seçilenleri ALAN İNCELEMEYE Gönder
                </button>
                <button
                  onClick={() => handleOrtakHavuzaGonder(selectedQuestions.filter(id => sorular.find(s => s.id === id)?.durum === 'dil_onaylandi'))}
                  disabled={selectedQuestions.filter(id => sorular.find(s => s.id === id)?.durum === 'dil_onaylandi').length === 0}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-sm py-2 px-4 shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  ✅ Seçilenleri ORTAK HAVUZA Gönder
                </button>
              </>
            )}

            <button
              onClick={handleExport}
              disabled={selectedQuestions.length === 0}
              className="btn btn-secondary text-sm py-2 px-4 disabled:opacity-50"
            >
              📄 Word / Yazdır
            </button>

            {selectedQuestions.length > 0 && (
              <button
                onClick={() => setSelectedQuestions([])}
                className="text-xs text-red-600 hover:underline px-2"
              >
                Seçimi Temizle
              </button>
            )}
          </div>
        </div>
      )}

      {!scope && selectedQuestions.length > 0 && (
        <div className="flex justify-end items-center bg-indigo-50 p-4 rounded-xl border border-indigo-200 gap-4">
          <span className="text-sm font-medium text-indigo-800">{selectedQuestions.length} soru seçildi</span>
          <button onClick={handleExport} className="btn btn-primary text-sm py-2 px-4">📄 Seçilenleri Dışa Aktar</button>
          <button onClick={() => setSelectedQuestions([])} className="text-xs text-red-600 hover:underline">Temizle</button>
        </div>
      )}

      {/* Sorular Listesi */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : sorular.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="mt-2 text-lg font-medium text-gray-900">Henüz soru eklenmedi</h3>
          <p className="mt-1 text-sm text-gray-500">
            {user?.rol === 'soru_yazici'
              ? 'İlk soruyu ekleyerek soru havuzunu oluşturmaya başlayabilirsiniz.'
              : 'Bu kriterlere uygun henüz soru bulunmamaktadır.'}
          </p>
          {/* Empty State Cleaned */}
        </div>
      ) : (
        <div className="space-y-4">
          {sorular.map((soru) => (
            <div key={soru.id} className={`card hover:shadow-lg transition-shadow border-l-4 ${selectedQuestions.includes(soru.id) ? 'border-primary-500 bg-blue-50' : 'border-transparent'}`}>
              <div className="flex items-start">

                {/* Checkbox Seçimi: Sekmedeki tüm sorular seçilebilir olmalı */}
                {(scope === 'brans' || user?.rol === 'admin' || soru.durum === 'tamamlandi') && (
                  <label className="mr-5 mt-1 cursor-pointer flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors z-10">
                    <input
                      type="checkbox"
                      className="w-6 h-6 text-primary-600 rounded-md border-gray-400 focus:ring-primary-500 cursor-pointer shadow-sm"
                      checked={selectedQuestions.includes(soru.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.checked) setSelectedQuestions([...selectedQuestions, soru.id]);
                        else setSelectedQuestions(selectedQuestions.filter(id => id !== soru.id));
                      }}
                    />
                  </label>
                )}

                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getDurumBadge(soru.durum)}
                    <span className="text-sm text-gray-500">
                      {soru.brans_adi} • {soru.ekip_adi} • <span className="font-bold text-amber-600">V{soru.versiyon || 1}</span>
                    </span>
                    {soru.zorluk_seviyesi && (
                      <span className="text-sm text-gray-500">
                        Zorluk: {soru.zorluk_seviyesi}
                      </span>
                    )}
                  </div>

                  {/* HTML Render Fix or Final PNG Preview */}
                  {['tamamlandi', 'dizgi_tamam'].includes(soru.durum) && soru.final_png_url ? (
                    <div className="my-3 flex justify-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <img src={soru.final_png_url} className="max-h-64 object-contain shadow-sm rounded" alt="Final Soru" />
                    </div>
                  ) : (
                    <div className="text-gray-900 line-clamp-3 mb-2 text-sm question-preview" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                  )}

                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Yazan: {soru.olusturan_ad}</span>
                    {soru.dizgici_ad && <span>Dizgici: {soru.dizgici_ad}</span>}
                    <span>{new Date(soru.olusturulma_tarihi).toLocaleDateString('tr-TR')}</span>
                    {soru.fotograf_url && (
                      <span className="text-primary-600">📷 Görsel</span>
                    )}
                    {soru.final_png_url && (
                      <a href={soru.final_png_url} target="_blank" rel="noreferrer" className="text-green-600 font-bold flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        🖼️ PNG
                      </a>
                    )}
                  </div>

                  {soru.durum !== 'tamamlandi' && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className={`px-2 py-1 rounded-full font-semibold ${soru.onay_alanci ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                        Alan İnceleme: {soru.onay_alanci ? 'Tamam' : 'Bekliyor'}
                      </span>
                      <span className={`px-2 py-1 rounded-full font-semibold ${soru.onay_dilci ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                        Dil İnceleme: {soru.onay_dilci ? 'Tamam' : 'Bekliyor'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="ml-4 flex flex-col space-y-2">
                  <Link
                    to={`/sorular/${soru.id}${scope ? `?scope=${scope}` : ''}`}
                    className="btn btn-secondary text-sm text-center"
                  >
                    Detay
                  </Link>

                  {(user?.rol === 'admin' || (user?.rol === 'soru_yazici' && soru.olusturan_kullanici_id === user?.id && soru.durum !== 'tamamlandi')) && (
                    <button
                      onClick={() => handleSil(soru.id)}
                      className="btn bg-white text-red-600 border border-red-200 hover:bg-red-50 text-sm"
                    >
                      🗑 Sil
                    </button>
                  )}

                  {/* BRANŞ ÖĞRETMENİ AKSİYONLARI (LİSTE ÜZERİNDEN) */}
                  {user?.rol === 'soru_yazici' && (
                    <div className="flex flex-wrap gap-1">
                      {['beklemede', 'revize_istendi', 'revize_gerekli'].includes(soru.durum) && (
                        <button
                          onClick={() => handleDizgiyeGonder(soru.id)}
                          className="btn bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 text-xs py-1 px-2"
                        >
                          🚀 Dizgiye Gönder
                        </button>
                      )}
                      {soru.durum === 'dizgi_tamam' && (
                        <button
                          onClick={() => handleUpdateStatusIndividual(soru.id, 'alan_incelemede')}
                          className="btn bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 text-xs py-1 px-2"
                        >
                          🔍 Alan İncelemeye Gönder
                        </button>
                      )}
                      {soru.durum === 'alan_onaylandi' && (
                        <button
                          onClick={() => handleUpdateStatusIndividual(soru.id, 'dil_incelemede')}
                          className="btn bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 text-xs py-1 px-2"
                        >
                          🔤 Dil İncelemeye Gönder
                        </button>
                      )}
                      {soru.durum === 'dil_onaylandi' && (
                        <button
                          onClick={() => handleOrtakHavuzaGonder(soru.id)}
                          className="btn bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 text-xs py-1 px-2"
                        >
                          ✅ Havuza Gönder
                        </button>
                      )}
                    </div>
                  )}

                  {user?.rol === 'dizgici' && soru.durum === 'dizgi_bekliyor' && (
                    <button
                      onClick={() => handleDizgiAl(soru.id)}
                      className="btn btn-primary text-sm"
                    >
                      Dizgiye Al
                    </button>
                  )}

                  {user?.rol === 'dizgici' && soru.durum === 'dizgide' && (
                    <Link
                      to={`/sorular/${soru.id}${scope ? `?scope=${scope}` : ''}`}
                      className="btn bg-green-600 text-white hover:bg-green-700 text-sm text-center"
                    >
                      Dizgiyi Tamamla
                    </Link>
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


