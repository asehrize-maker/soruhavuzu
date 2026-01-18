import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI } from '../services/api';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function SoruDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;
  const [soru, setSoru] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dizgiNotu, setDizgiNotu] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ soru_metni: '', zorluk_seviyesi: '' });
  const [saving, setSaving] = useState(false);
  const soruMetniRef = useRef(null);
  const latexKoduRef = useRef(null);

  useEffect(() => {
    loadSoru();
  }, [id]);

  const renderLatexInElement = (element, content) => {
    if (!element || !content) return;

    let html = content;

    // Display math ($$...$$) önce işlenmeli
    html = html.replace(/\$\$([^\$]+)\$\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        return `<span class="text-red-500 text-sm">${match}</span>`;
      }
    });

    // Inline math ($...$) işleme
    html = html.replace(/\$([^\$]+)\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (e) {
        return `<span class="text-red-500 text-sm">${match}</span>`;
      }
    });

    // Yeni satırları koruyarak render et
    html = html.replace(/\n/g, '<br>');

    element.innerHTML = html;
  };

  const loadSoru = async () => {
    try {
      const response = await soruAPI.getById(id);
      const soruData = response.data.data;
      setSoru(soruData);

      // Soru yüklendikten sonra LaTeX render et
      setTimeout(() => {
        if (soruMetniRef.current && soruData?.soru_metni) {
          renderLatexInElement(soruMetniRef.current, soruData.soru_metni);
        }
        if (latexKoduRef.current && soruData?.latex_kodu) {
          renderLatexInElement(latexKoduRef.current, soruData.latex_kodu);
        }
      }, 0);
    } catch (error) {
      alert('Soru yüklenemedi');
      navigate('/sorular');
    } finally {
      setLoading(false);
    }
  };

  // Dosya indirme helper fonksiyonu
  const getDownloadUrl = (url, filename) => {
    if (!url) return '';

    // Cloudinary URL'sine fl_attachment parametresi ekle
    if (url.includes('cloudinary.com')) {
      // Raw dosyalar için doğrudan URL kullan (download attribute ile birlikte çalışır)
      return url;
    }

    return url;
  };

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'dosya';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Dosya indirme hatası:', error);
      // Hata durumunda doğrudan linki yeni sekmede aç
      window.open(url, '_blank');
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

  // Düzenleme modunu başlat
  const handleEditStart = () => {
    setEditData({
      soru_metni: soru.soru_metni,
      zorluk_seviyesi: soru.zorluk_seviyesi || ''
    });
    setEditMode(true);
  };

  // Düzenlemeyi kaydet
  const handleEditSave = async () => {
    if (!editData.soru_metni.trim()) {
      alert('Soru metni boş olamaz');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('soru_metni', editData.soru_metni);
      if (editData.zorluk_seviyesi) {
        formData.append('zorluk_seviyesi', editData.zorluk_seviyesi);
      }

      await soruAPI.update(id, formData);
      alert('Soru güncellendi!');
      setEditMode(false);
      loadSoru();
    } catch (error) {
      alert(error.response?.data?.error || 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  // Düzenleme iptal
  const handleEditCancel = () => {
    setEditMode(false);
    setEditData({ soru_metni: '', zorluk_seviyesi: '' });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!soru) return null;

  // Düzenleme izni kontrolü - admin veya kendi sorusu ve (beklemede veya revize_gerekli durumunda)
  const canEdit = (user?.rol === 'admin' || soru.olusturan_kullanici_id === user?.id) &&
    (soru.durum === 'beklemede' || soru.durum === 'revize_gerekli');

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Soru Detayı</h1>
          <p className="mt-2 text-gray-600">Soru #{soru.id}</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => navigate('/sorular')} className="btn btn-secondary">
            ← Geri
          </button>
          {canEdit && !editMode && (
            <button onClick={handleEditStart} className="btn btn-primary">
              ✏️ Düzenle
            </button>
          )}
          {(user?.rol === 'admin' || soru.olusturan_kullanici_id === user?.id) && (
            <button onClick={handleSil} className="btn btn-danger">
              Sil
            </button>
          )}
        </div>
      </div>

      {/* Revize Notu Uyarısı */}
      {soru.durum === 'revize_gerekli' && soru.revize_notu && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-orange-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-semibold text-orange-800">Revize Gerekli</h4>
              <p className="text-orange-700 mt-1">{soru.revize_notu}</p>
            </div>
          </div>
        </div>
      )}

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
          {editMode ? (
            <div className="space-y-4">
              <textarea
                className="input font-mono"
                rows="8"
                value={editData.soru_metni}
                onChange={(e) => setEditData({ ...editData, soru_metni: e.target.value })}
                placeholder="Soru metnini girin..."
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zorluk Seviyesi</label>
                <select
                  className="input"
                  value={editData.zorluk_seviyesi}
                  onChange={(e) => setEditData({ ...editData, zorluk_seviyesi: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  <option value="kolay">Kolay</option>
                  <option value="orta">Orta</option>
                  <option value="zor">Zor</option>
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Kaydediliyor...' : '✓ Kaydet'}
                </button>
                <button
                  onClick={handleEditCancel}
                  disabled={saving}
                  className="btn btn-secondary"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div ref={soruMetniRef} className="text-gray-900 text-base leading-relaxed katex-left-align">
              {/* LaTeX renders here */}
            </div>
          )}
        </div>

        {soru.latex_kodu && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-lg font-semibold mb-3 text-blue-900 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              Matematiksel İfadeler
            </h4>
            <div ref={latexKoduRef} className="text-gray-800 bg-white p-4 rounded border border-blue-100 katex-left-align">
              {/* LaTeX code renders here */}
            </div>
          </div>
        )}

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

        {soru.dosya_url && (
          <div className="mt-6">
            <h4 className="text-lg font-medium mb-3">📎 Ek Dosya</h4>
            <button
              onClick={() => handleDownload(soru.dosya_url, soru.dosya_adi)}
              className="flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition group w-full text-left"
            >
              <svg className="w-10 h-10 text-primary-600 group-hover:text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="ml-4 flex-1">
                <p className="font-medium text-gray-900 group-hover:text-primary-600">
                  {soru.dosya_adi || 'Dosya İndir'}
                </p>
                {soru.dosya_boyutu && (
                  <p className="text-sm text-gray-500">
                    {soru.dosya_boyutu < 1024 ? soru.dosya_boyutu + ' B' :
                      soru.dosya_boyutu < 1024 * 1024 ? (soru.dosya_boyutu / 1024).toFixed(1) + ' KB' :
                        (soru.dosya_boyutu / (1024 * 1024)).toFixed(2) + ' MB'}
                  </p>
                )}
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        )}

        {soru.kazanim && (
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">🎯 Kazanım</h4>
            <p className="text-gray-700">{soru.kazanim}</p>
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

      {/* Dizgi İşlemleri & Değerlendirme */}
      {(user?.rol === 'dizgici' || user?.rol === 'admin') && (soru.durum === 'dizgide' || soru.durum === 'beklemede' || soru.durum === 'tamamlandi') && (
        <div className="card bg-indigo-50 border border-indigo-100">
          <h3 className="text-xl font-semibold mb-4 text-indigo-900">İnceleme ve İşlemler</h3>

          {/* İnceleme Yorumları */}
          <div className="mb-6">
            <h4 className="font-medium text-indigo-800 mb-2">Yorumlar / Notlar</h4>
            <div className="bg-white rounded-lg border border-indigo-200 h-64 overflow-y-auto mb-3 p-3 space-y-3">
              <IncelemeYorumlari soruId={id} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Durum Değişikliği */}
            {soru.durum !== 'tamamlandi' && (
              <div className="space-y-4">
                <h4 className="font-medium text-indigo-800">Durum İşlemleri</h4>

                {/* Revize İste */}
                <div className="bg-white p-3 rounded border border-red-200">
                  <label className="block text-sm font-medium text-red-800 mb-1">Revize İste (Soru Yazarına)</label>
                  <textarea
                    rows="2"
                    className="input text-sm border-red-300 focus:border-red-500 focus:ring-red-500 mb-2"
                    placeholder="Revize nedenini açıklayın..."
                    value={dizgiNotu}
                    onChange={(e) => setDizgiNotu(e.target.value)}
                  />
                  <button
                    onClick={async () => {
                      if (!dizgiNotu) return alert('Lütfen revize notu girin');
                      try {
                        await soruAPI.updateDurum(id, { durum: 'revize_gerekli', revize_notu: dizgiNotu });
                        alert('Revize talebi gönderildi');
                        loadSoru();
                        setDizgiNotu('');
                      } catch (e) { alert(e.response?.data?.error || 'Hata'); }
                    }}
                    className="w-full btn bg-red-600 text-white hover:bg-red-700 text-sm"
                  >
                    Revize Gerekli
                  </button>
                </div>

                {/* Dizgi Tamamla */}
                {soru.durum === 'dizgide' && (
                  <div className="bg-white p-3 rounded border border-green-200">
                    <label className="block text-sm font-medium text-green-800 mb-2">Dizgiyi Onayla</label>
                    <button onClick={handleDizgiTamamla} className="w-full btn btn-success text-sm">
                      ✓ Dizgiyi Tamamla
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Versiyon Geçmişi (Sadece Admin ve Sahibi) */}
      {(user?.rol === 'admin' || user?.id === soru.olusturan_kullanici_id) && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Versiyon Geçmişi</h3>
          <VersiyonGecmisi soruId={id} />
        </div>
      )}

      {/* Dizgi Geçmişi (Eski) */}
      {soru.dizgi_gecmisi && soru.dizgi_gecmisi.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Dizgi Hareketleri</h3>
          <div className="space-y-3">
            {soru.dizgi_gecmisi.map((gecmis) => (
              <div key={gecmis.id} className="border-l-4 border-primary-500 pl-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{gecmis.dizgici_ad}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(gecmis.tamamlanma_tarihi).toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="text-xs text-gray-400 uppercase mt-1">{gecmis.durum}</div>
                {gecmis.notlar && (
                  <p className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded">{gecmis.notlar}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Alt Bileşenler
function IncelemeYorumlari({ soruId }) {
  const [yorumlar, setYorumlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState('');
  const [loading, setLoading] = useState(true);

  const loadYorumlar = async () => {
    try {
      const res = await soruAPI.getComments(soruId);
      setYorumlar(res.data.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadYorumlar(); }, [soruId]);

  const handleYorumEkle = async () => {
    if (!yeniYorum.trim()) return;
    try {
      await soruAPI.addComment(soruId, yeniYorum);
      setYeniYorum('');
      loadYorumlar();
    } catch (e) { alert('Yorum eklenemedi'); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {loading ? <p className="text-sm text-gray-500 text-center">Yükleniyor...</p> :
          yorumlar.length === 0 ? <p className="text-sm text-gray-400 text-center">Henüz yorum yok.</p> :
            yorumlar.map((y) => (
              <div key={y.id} className="bg-gray-50 p-2 rounded text-sm relative group">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-gray-700">{y.ad_soyad} <span className="text-xs font-normal text-gray-500">({y.rol})</span></span>
                  <span className="text-xs text-gray-400">{new Date(y.tarih).toLocaleString('tr-TR')}</span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{y.yorum_metni}</p>
              </div>
            ))}
      </div>
      <div className="mt-3 flex gap-2 pt-2 border-t">
        <input
          type="text"
          className="input text-sm py-1"
          placeholder="Bir yorum yazın..."
          value={yeniYorum}
          onChange={(e) => setYeniYorum(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleYorumEkle()}
        />
        <button onClick={handleYorumEkle} className="btn btn-primary py-1 px-3 text-sm">Ekle</button>
      </div>
    </div>
  );
}

function VersiyonGecmisi({ soruId }) {
  const [versiyonlar, setVersiyonlar] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await soruAPI.getHistory(soruId);
        setVersiyonlar(res.data.data);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    load();
  }, [soruId]);

  if (loading) return <div className="text-center text-sm text-gray-500">Yükleniyor...</div>;
  if (versiyonlar.length === 0) return <div className="text-center text-sm text-gray-500">Bu soru henüz hiç güncellenmemiş (Versiyon 1).</div>;

  return (
    <div className="space-y-4">
      {versiyonlar.map((v) => {
        const data = v.data; // JSON verisi
        return (
          <div key={v.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="badge bg-gray-600 text-white">v{v.versiyon_no}</span>
                <span className="text-sm font-medium text-gray-900">{v.ad_soyad}</span>
              </div>
              <span className="text-xs text-gray-500">{new Date(v.degisim_tarihi).toLocaleString('tr-TR')}</span>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {v.degisim_aciklamasi || 'Güncelleme'}
            </div>

            {/* Değişiklik Özeti (Basit) */}
            <div className="bg-white p-2 border rounded text-xs text-gray-600 font-mono h-24 overflow-y-auto">
              {/* Sadece metni gösterelim şimdilik */}
              <p><strong>Soru Metni:</strong> {data.soru_metni?.substring(0, 100)}...</p>
              <p><strong>Cevap:</strong> {data.dogru_cevap}</p>
              <p><strong>Durum:</strong> {data.durum}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
