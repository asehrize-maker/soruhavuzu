import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';

export default function Sorular() {
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const isTakipModu = queryParams.get('takip') === '1';

  const [sorular, setSorular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branslar, setBranslar] = useState([]);
  const [filters, setFilters] = useState({
    durum: (user?.rol === 'admin' && !isTakipModu) ? '' : (isTakipModu ? '' : 'tamamlandi'),
    brans_id: '',
  });

  // reset filter when switching modes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      durum: isTakipModu ? '' : 'tamamlandi'
    }));
  }, [isTakipModu]);

  const [selectedQuestions, setSelectedQuestions] = useState([]);

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
        };
        const response = await soruAPI.getAll(params);
        let data = response.data.data || [];

        // Frontend tarafında da rol kısıtlamasını simüle et (Admin viewRole kullanıyorsa)
        if (effectiveRole === 'dizgici') {
          data = data.filter(s => ['dizgi_bekliyor', 'dizgide'].includes(s.durum));
        } else if (effectiveRole === 'soru_yazici') {
          data = data.filter(s => s.olusturan_kullanici_id === user.id || s.durum === 'tamamlandi');
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
  }, [user?.id, effectiveRole, filters.durum, filters.brans_id]);

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
      });
      setSorular(response.data.data || []);
    } catch (error) {
      alert(error.response?.data?.error || 'Soru dizgiye alınamadı');
    }
  };

  const handleDizgiyeGonder = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    if (!window.confirm(`${idList.length} soruyu dizgi birimine göndermek istediğinize emin misiniz?`)) return;

    try {
      setLoading(true);
      await Promise.all(idList.map(id => soruAPI.updateDurum(id, { durum: 'dizgi_bekliyor' })));

      // Listeyi yenile
      const response = await soruAPI.getAll({
        durum: filters.durum || undefined,
        brans_id: filters.brans_id || undefined,
      });
      let data = response.data.data || [];
      if (effectiveRole === 'dizgici') {
        data = data.filter(s => ['dizgi_bekliyor', 'dizgide'].includes(s.durum));
      } else if (effectiveRole === 'soru_yazici') {
        data = data.filter(s => s.olusturan_kullanici_id === user.id || s.durum === 'tamamlandi');
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

  const handleExport = () => {
    if (selectedQuestions.length === 0) return;

    // Basit bir HTML çıktısı oluştur ve yeni pencerede aç (Yazdırma/Kopyalama için)
    const exportWindow = window.open('', '_blank');
    const selectedData = sorular.filter(s => selectedQuestions.includes(s.id));

    let htmlContent = `
      <html>
      <head>
        <title>Soru Havuzu Dışa Aktarım</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; }
          .soru-item { margin-bottom: 30px; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 20px; }
          .soru-metni { font-size: 16px; margin-bottom: 15px; }
          .secenekler { margin-left: 20px; }
          .secenek { margin-bottom: 5px; }
          .soru-gorsel { max-width: 300px; display: block; margin: 10px 0; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">Yazdır / PDF Olarak Kaydet</button>
        </div>
        <h1>Seçilen Sorular (${selectedData.length})</h1>
    `;

    selectedData.forEach((soru, index) => {
      htmlContent += `
          <div class="soru-item">
            <div class="soru-no"><strong>Soru ${index + 1}</strong> <span style="font-size:12px; color: #666;">(#${soru.id})</span></div>
            
            ${soru.fotograf_konumu === 'ust' && soru.fotograf_url ? `<img src="${soru.fotograf_url}" class="soru-gorsel" />` : ''}
            
            <div class="soru-metni">${soru.soru_metni.replace(/\n/g, '<br>')}</div>
            
            ${soru.fotograf_konumu === 'alt' && soru.fotograf_url ? `<img src="${soru.fotograf_url}" class="soru-gorsel" />` : ''}

            <div class="secenekler">
              ${soru.secenek_a ? `<div class="secenek">A) ${soru.secenek_a}</div>` : ''}
              ${soru.secenek_b ? `<div class="secenek">B) ${soru.secenek_b}</div>` : ''}
              ${soru.secenek_c ? `<div class="secenek">C) ${soru.secenek_c}</div>` : ''}
              ${soru.secenek_d ? `<div class="secenek">D) ${soru.secenek_d}</div>` : ''}
              ${soru.secenek_e ? `<div class="secenek">E) ${soru.secenek_e}</div>` : ''}
            </div>
            
            <div style="margin-top: 10px; font-size: 12px; color: #999;">
               Doğru Cevap: <strong>${soru.dogru_cevap || '-'}</strong> | 
               Zorluk: ${soru.zorluk_seviyesi || '-'} | 
               Kazanım: ${soru.kazanim || '-'}
            </div>
          </div>
        `;
    });

    htmlContent += `
       <script>
         document.addEventListener("DOMContentLoaded", function() {
            renderMathInElement(document.body, {
              delimiters: [
                  {left: '$$', right: '$$', display: true},
                  {left: '$', right: '$', display: false}
              ]
            });
         });
       </script>
      </body>
      </html>
    `;

    exportWindow.document.write(htmlContent);
    exportWindow.document.close();
  };

  const getDurumBadge = (durum) => {
    const badges = {
      beklemede: 'badge badge-warning',
      dizgi_bekliyor: 'badge bg-purple-100 text-purple-700',
      dizgide: 'badge badge-info',
      tamamlandi: 'badge badge-success',
      revize_gerekli: 'badge badge-error',
      revize_istendi: 'badge badge-error',
    };
    const labels = {
      beklemede: 'Beklemede',
      dizgi_bekliyor: 'Dizgi Bekliyor',
      dizgide: 'Dizgide',
      tamamlandi: 'Tamamlandı',
      revize_gerekli: 'Revize Gerekli',
      revize_istendi: 'Revize İstendi',
    };
    return <span className={badges[durum]}>{labels[durum]}</span>;
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
            {isTakipModu ? 'Bekleyen İş Takibi' : 'Ortak Soru Havuzu'}
            {user?.rol === 'admin' && filters.brans_id && (
              <span className="text-gray-400 font-light ml-3 text-2xl flex items-center">
                <span className="mx-2">/</span>
                <span className="text-blue-600">{branslar.find(b => b.id == filters.brans_id)?.brans_adi}</span>
              </span>
            )}
          </h1>
        </div>
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
      <div className="flex justify-end space-x-3">
        {selectedQuestions.length > 0 && (
          <div className="flex items-center space-x-2 bg-indigo-50 px-3 py-1 rounded border border-indigo-200">
            <span className="text-sm font-medium text-indigo-800">{selectedQuestions.length} soru seçildi</span>
            <button
              onClick={handleExport}
              className="btn btn-primary text-sm py-1 px-3"
            >
              📄 Seçilenleri Dışa Aktar (Word/Yazdır)
            </button>
            {user?.rol === 'soru_yazici' && (
              <button
                onClick={() => handleDizgiyeGonder(selectedQuestions)}
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-sm py-1 px-3"
              >
                ✨ Seçilenleri Dizgiye Gönder
              </button>
            )}
            <button
              onClick={() => setSelectedQuestions([])}
              className="text-xs text-red-600 hover:underline"
            >
              Temizle
            </button>
          </div>
        )}
      </div>

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

                {/* Checkbox (Sadece Tamamlandı ise veya Admin ise) */}
                {(soru.durum === 'tamamlandi' || user?.rol === 'admin') && (
                  <div className="mr-4 mt-1">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      checked={selectedQuestions.includes(soru.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedQuestions([...selectedQuestions, soru.id]);
                        else setSelectedQuestions(selectedQuestions.filter(id => id !== soru.id));
                      }}
                    />
                  </div>
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

                  {/* HTML Render Fix */}
                  <div className="text-gray-900 line-clamp-3 mb-2 text-sm question-preview" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />

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

                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className={`px-2 py-1 rounded-full font-semibold ${soru.onay_alanci ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                      Alan İnceleme: {soru.onay_alanci ? 'Tamam' : 'Bekliyor'}
                    </span>
                    <span className={`px-2 py-1 rounded-full font-semibold ${soru.onay_dilci ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                      Dil İnceleme: {soru.onay_dilci ? 'Tamam' : 'Bekliyor'}
                    </span>
                  </div>
                </div>

                <div className="ml-4 flex flex-col space-y-2">
                  <Link
                    to={`/sorular/${soru.id}`}
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

                  {user?.rol === 'dizgici' && soru.durum === 'beklemede' && (
                    <button
                      onClick={() => handleDizgiAl(soru.id)}
                      className="btn btn-primary text-sm"
                    >
                      Dizgiye Al
                    </button>
                  )}

                  {user?.rol === 'soru_yazici' && soru.durum === 'tamamlandi' && (
                    <button
                      onClick={() => handleDizgiyeGonder(soru.id)}
                      className="btn bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 text-sm"
                    >
                      Dizgiye Gönder
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
