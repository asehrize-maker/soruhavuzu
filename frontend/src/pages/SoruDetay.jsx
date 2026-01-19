import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI } from '../services/api';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function SoruDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const incelemeTuru = queryParams.get('incelemeTuru'); // 'alanci' | 'dilci'

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

  // Revize Notları State
  const [selectedText, setSelectedText] = useState('');
  const [revizeNotuInput, setRevizeNotuInput] = useState('');
  const [revizeNotlari, setRevizeNotlari] = useState([]);

  useEffect(() => {
    loadSoru();
    loadRevizeNotlari();
  }, [id]);

  const renderLatexInElement = (element, content) => {
    if (!element || !content) return;
    let html = content;

    // LaTeX Render
    html = html.replace(/\$\$([^\$]+)\$\$/g, (match, latex) => {
      try { return katex.renderToString(latex, { throwOnError: false, displayMode: true }); }
      catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\$([^\$]+)\$/g, (match, latex) => {
      try { return katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
      catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\n/g, '<br>');

    // Revize Notlarını Metin Üzerinde Numaralandırarak İşaretle
    if (revizeNotlari && revizeNotlari.length > 0) {
      revizeNotlari.forEach((not, index) => {
        if (!not.secilen_metin) return;
        const colorClass = not.inceleme_turu === 'dilci' ? 'green' : 'blue';
        const mark = `<mark class="bg-${colorClass}-100 border-b-2 border-${colorClass}-400 px-1 relative group cursor-help transition-colors hover:bg-${colorClass}-200">
          ${not.secilen_metin}
          <sup class="text-${colorClass}-700 font-bold ml-0.5 select-none">[${index + 1}]</sup>
          <span class="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded w-48 z-50 shadow-xl mb-2">
            <strong>Not ${index + 1}:</strong> ${not.not_metni}
          </span>
        </mark>`;
        html = html.split(not.secilen_metin).join(mark);
      });
    }

    element.innerHTML = html;
  };

  const loadSoru = async () => {
    try {
      const response = await soruAPI.getById(id);
      setSoru(response.data.data);
    } catch (error) {
      alert('Soru yüklenemedi');
      navigate('/sorular');
    } finally { setLoading(false); }
  };

  const loadRevizeNotlari = async () => {
    try {
      const res = await soruAPI.getRevizeNotlari(id);
      setRevizeNotlari(res.data.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (soru) {
      if (soruMetniRef.current) renderLatexInElement(soruMetniRef.current, soru.soru_metni);
      if (latexKoduRef.current && soru.latex_kodu) renderLatexInElement(latexKoduRef.current, soru.latex_kodu);
    }
  }, [soru, revizeNotlari]);

  const handleTextSelection = () => {
    if (!incelemeTuru) return;
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) setSelectedText(text);
  };

  const handleAddRevizeNot = async () => {
    if (!revizeNotuInput.trim()) return;
    try {
      await soruAPI.addRevizeNot(id, {
        secilen_metin: selectedText,
        not_metni: revizeNotuInput,
        inceleme_turu: incelemeTuru
      });
      setRevizeNotuInput('');
      setSelectedText('');
      loadRevizeNotlari();
    } catch (e) { alert('Not eklenemedi'); }
  };

  const handleDeleteRevizeNot = async (notId) => {
    if (!confirm('Notu silmek istiyor musunuz?')) return;
    try {
      await soruAPI.deleteRevizeNot(id, notId);
      loadRevizeNotlari();
    } catch (e) { alert('Silinemedi'); }
  };

  const handleSil = async () => {
    if (!confirm('Bu soruyu silmek istediğinizden emin misiniz?')) return;
    try {
      await soruAPI.delete(id);
      alert('Soru silindi');
      navigate('/sorular');
    } catch (error) { alert(error.response?.data?.error || 'Silme işlemi başarısız'); }
  };

  const handleEditStart = () => {
    setEditData({ soru_metni: soru.soru_metni, zorluk_seviyesi: soru.zorluk_seviyesi || '' });
    setEditMode(true);
  };

  const handleEditSave = async () => {
    if (!editData.soru_metni.trim()) return alert('Soru metni boş olamaz');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('soru_metni', editData.soru_metni);
      if (editData.zorluk_seviyesi) formData.append('zorluk_seviyesi', editData.zorluk_seviyesi);
      await soruAPI.update(id, formData);
      alert('Soru güncellendi!');
      setEditMode(false);
      loadSoru();
    } catch (error) { alert(error.response?.data?.error || 'Güncelleme başarısız'); } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!soru) return null;

  const canEdit = !incelemeTuru && (user?.rol !== 'admin') && (user?.rol !== 'incelemeci') && (soru.olusturan_kullanici_id === user?.id) &&
    (soru.durum === 'beklemede' || soru.durum === 'revize_gerekli' || soru.durum === 'revize_istendi');

  const getDurumBadge = (durum) => {
    const badges = { beklemede: 'badge badge-warning', inceleme_bekliyor: 'badge badge-primary', dizgi_bekliyor: 'badge badge-warning', dizgide: 'badge badge-info', tamamlandi: 'badge badge-success', revize_gerekli: 'badge badge-error', revize_istendi: 'badge badge-error' };
    const labels = { beklemede: 'Beklemede', inceleme_bekliyor: 'İnceleme Bekliyor', dizgi_bekliyor: 'Dizgi Bekliyor', dizgide: 'Dizgide', tamamlandi: 'Tamamlandı', revize_gerekli: 'Revize Gerekli', revize_istendi: 'Revize İstendi' };
    return <span className={badges[durum]}>{labels[durum]}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header Area */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">📝 Soru Detayı</h1>
          <p className="mt-2 text-gray-600">Soru #{soru.id}</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => navigate('/sorular')} className="btn btn-secondary">← Geri</button>
          {canEdit && !editMode && <button onClick={handleEditStart} className="btn btn-primary">✏️ Düzenle</button>}
          {(user?.rol === 'admin' || soru.olusturan_kullanici_id === user?.id) && <button onClick={handleSil} className="btn btn-danger">Sil</button>}
        </div>
      </div>

      {/* İncelemeci İşlemleri Panel */}
      {user?.rol === 'incelemeci' && ['inceleme_bekliyor', 'beklemede', 'revize_gerekli'].includes(soru.durum) && (
        <div className="card bg-purple-50 border-2 border-purple-200 mb-6 shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-purple-200 pb-2">
            <h3 className="text-xl font-bold text-purple-900 flex items-center"><span className="text-2xl mr-2">⚡</span> İnceleme ve Karar Paneli</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${incelemeTuru === 'alanci' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
              {incelemeTuru === 'alanci' ? 'ALAN UZMANI' : 'DİL UZMANI'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
              <h4 className="font-bold text-green-800 mb-2">✅ Onay İşlemi</h4>
              <p className="text-sm text-gray-600 mb-3">{incelemeTuru === 'alanci' ? 'Bilimsel uygunluk onayı.' : 'Dil ve yazım onayı.'}</p>
              <button
                onClick={async () => {
                  if (!confirm('Onaylayıp Dizgiye göndermek istiyor musunuz?')) return;
                  try {
                    await soruAPI.updateDurum(id, { newStatus: 'dizgi_bekliyor', aciklama: 'İnceleme onaylandı.', inceleme_turu: incelemeTuru });
                    alert('Onaylandı ve Dizgiye gönderildi.');
                    navigate('/dashboard');
                  } catch (e) { alert('Hata oluştu'); }
                }}
                className={`w-full py-3 rounded-lg font-bold text-white shadow transition transform hover:scale-105 ${incelemeTuru === 'alanci' ? 'bg-blue-600' : 'bg-green-600'}`}
              > ✓ İNCELEME TAMAM: DİZGİYE GÖNDER </button>
            </div>
            <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
              <h4 className="font-bold text-red-800 mb-2">🛑 Revize / Hata Bildirimi</h4>
              <p className="text-sm text-gray-600 mb-2">Hataları metin üzerinden not alıp aşağıdaki butona basın.</p>
              <textarea rows="2" className="w-full text-sm border-gray-300 rounded p-2 mb-2" placeholder="Dizgici için genel bir not (opsiyonel)..." value={dizgiNotu} onChange={(e) => setDizgiNotu(e.target.value)} />
              <button
                onClick={async () => {
                  if (revizeNotlari.length === 0 && !dizgiNotu) return alert('Lütfen metin üzerinden hata seçin veya not girin.');
                  try {
                    await soruAPI.updateDurum(id, { newStatus: 'revize_istendi', aciklama: dizgiNotu || 'Metin üzerinde hatalar belirtildi.' });
                    alert('Hata notları Dizgiciye iletildi.');
                    navigate('/dashboard');
                  } catch (e) { alert('Hata'); }
                }}
                className="w-full py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700"
              > NOTLARLA DİZGİYE GÖNDER </button>
            </div>
          </div>
        </div>
      )}

      {/* Soru Bilgi Özeti */}
      <div className="flex items-center gap-3 mb-2 px-1">
        {getDurumBadge(soru.durum)}
        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-200 uppercase tracking-tighter">Versiyon 1</span>
        <span className="badge bg-green-100 text-green-800 font-bold">✅ Doğru: {soru.dogru_cevap}</span>
      </div>

      {/* SORU KALIBI / FRAME */}
      <div className="relative border-4 border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xl transition-all">
        <div className={`p-8 min-h-[400px] relative z-10 ${incelemeTuru ? 'cursor-text' : ''}`}>
          <div className="prose max-w-none">
            {editMode ? (
              <div className="space-y-4 pointer-events-auto">
                <textarea className="input font-mono" rows="8" value={editData.soru_metni} onChange={(e) => setEditData({ ...editData, soru_metni: e.target.value })} />
                <button onClick={handleEditSave} disabled={saving} className="btn btn-primary">Kaydet</button>
                <button onClick={() => setEditMode(false)} className="btn btn-secondary ml-2">İptal</button>
              </div>
            ) : (
              <div ref={soruMetniRef} className="text-gray-900 text-lg leading-relaxed katex-left-align relative z-10" onMouseUp={handleTextSelection} />
            )}
          </div>

          {/* Seçenekler */}
          <div className="mt-10">
            <div className="grid grid-cols-1 gap-4">
              {['a', 'b', 'c', 'd', 'e'].map((opt) => {
                const text = soru[`secenek_${opt}`];
                if (!text) return null;
                const isCorrect = soru.dogru_cevap === opt.toUpperCase();
                return (
                  <div key={opt} className={`p-4 rounded-xl border-2 flex items-start transition ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                    <span className={`font-bold mr-4 w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-lg ${isCorrect ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{opt.toUpperCase()}</span>
                    <div className="flex-1 text-gray-800 text-lg pt-1" ref={(el) => el && renderLatexInElement(el, text)} />
                  </div>
                );
              })}
            </div>
          </div>

          {soru.latex_kodu && (
            <div className="mt-10 p-6 bg-blue-50 rounded-xl border-2 border-blue-100">
              <div ref={latexKoduRef} className="bg-white p-6 rounded-lg border border-blue-50 shadow-inner" />
            </div>
          )}

          {soru.fotograf_url && (
            <div className="mt-10">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 inline-block shadow-lg">
                <img src={soru.fotograf_url} alt="Soru" className="max-w-full rounded-lg" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DİZGİCİ İÇİN HATA NOTLARI LİSTESİ */}
      {revizeNotlari.length > 0 && (
        <div className="card bg-amber-50 border border-amber-200">
          <h3 className="text-xl font-bold mb-4 text-amber-900 flex items-center">
            <span className="mr-2">📝</span> Revize / Hata Notları
          </h3>
          <div className="space-y-3">
            {revizeNotlari.map((not, idx) => (
              <div key={not.id} className="flex gap-4 p-3 bg-white border border-amber-100 rounded-lg shadow-sm">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                    {not.inceleme_turu === 'alanci' ? 'ALAN UZMANI' : 'DİL UZMANI'}
                  </div>
                  <div className="text-sm font-bold text-gray-800 mb-1 italic opacity-70">
                    "{not.secilen_metin}"
                  </div>
                  <p className="text-gray-900 font-medium">{not.not_metni}</p>
                </div>
                {(user?.id === not.kullanici_id || user?.rol === 'admin') && (
                  <button onClick={() => handleDeleteRevizeNot(not.id)} className="text-red-400 hover:text-red-700 transition self-start">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popover */}
      {selectedText && (
        <div className="fixed bottom-12 right-12 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-bounce-in">
          <div className={`p-4 font-bold text-white flex justify-between items-center ${incelemeTuru === 'alanci' ? 'bg-blue-600' : 'bg-green-600'}`}>
            <span>Not Ekle (Madde {revizeNotlari.length + 1})</span>
            <button onClick={() => setSelectedText('')}>✕</button>
          </div>
          <div className="p-4">
            <div className="text-[10px] text-gray-400 mb-2 italic">"{selectedText.substring(0, 60)}..."</div>
            <textarea className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500" rows="3" placeholder="Bu kısımdaki hatayı açıklayın..." value={revizeNotuInput} onChange={(e) => setRevizeNotuInput(e.target.value)} />
            <button onClick={handleAddRevizeNot} className="w-full mt-2 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-black">Kaydet</button>
          </div>
        </div>
      )}
    </div>
  );
}
