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

    // Revize Notlarını Metin Üzerinde Numaralandırarak İşaretle (ROL BAZLI FİLTRELEME)
    if (revizeNotlari && revizeNotlari.length > 0) {
      const visibleNotes = revizeNotlari.filter(not => {
        if (user?.rol === 'admin' || user?.rol === 'dizgici') return true;
        if (incelemeTuru) return not.inceleme_turu === incelemeTuru;
        return true;
      });

      visibleNotes.forEach((not, index) => {
        if (!not.secilen_metin) return;
        const colorClass = not.inceleme_turu === 'dilci' ? 'green' : 'blue';
        const mark = `<mark class="bg-${colorClass}-100 border-b-2 border-${colorClass}-400 px-1 relative group cursor-help transition-colors hover:bg-${colorClass}-200">
          ${not.secilen_metin}
          <sup class="text-${colorClass}-700 font-bold ml-0.5 select-none">[${revizeNotlari.indexOf(not) + 1}]</sup>
          <span class="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded w-48 z-50 shadow-xl mb-2">
            <strong>${not.inceleme_turu.toUpperCase()} Notu:</strong> ${not.not_metni}
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
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) setSelectedText(text);
  };

  const handleAddRevizeNot = async () => {
    if (!revizeNotuInput.trim()) return;
    try {
      const type = incelemeTuru || (effectiveRole === 'incelemeci' ? 'alanci' : 'admin');
      await soruAPI.addRevizeNot(id, {
        secilen_metin: selectedText,
        not_metni: revizeNotuInput,
        inceleme_turu: type
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

  const handleFinishReview = async () => {
    const hasNotes = revizeNotlari.length > 0;
    const msg = hasNotes
      ? "İşaretlediğiniz " + revizeNotlari.length + " adet notla birlikte incelemeyi bitirip Dizgiye göndermek istiyor musunuz?"
      : "Soruda hiç hata bulmadınız. Hatasız ONAYLAYIP incelemeyi bitirmek istiyor musunuz?";

    if (!confirm(msg)) return;

    try {
      const type = incelemeTuru || (effectiveRole === 'incelemeci' ? 'alanci' : 'admin');
      const newStatus = hasNotes ? 'revize_istendi' : 'dizgi_bekliyor';
      await soruAPI.updateDurum(id, {
        newStatus,
        aciklama: hasNotes ? (dizgiNotu || 'Metin üzerinde hatalar belirtildi.') : 'İnceleme hatasız tamamlandı.',
        inceleme_turu: type
      });
      alert('İŞLEM TAMAMLANDI: Soru Dizgiye gönderildi.');
      navigate('/dashboard');
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
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

  const canEdit = !incelemeTuru && (effectiveRole !== 'admin') && (effectiveRole !== 'incelemeci') && (soru.olusturan_kullanici_id === user?.id) &&
    (soru.durum === 'beklemede' || soru.durum === 'revize_gerekli' || soru.durum === 'revize_istendi');

  const getDurumBadge = (durum) => {
    const badges = { beklemede: 'badge badge-warning', inceleme_bekliyor: 'badge badge-primary', dizgi_bekliyor: 'badge badge-warning', dizgide: 'badge badge-info', tamamlandi: 'badge badge-success', revize_gerekli: 'badge badge-error', revize_istendi: 'badge badge-error' };
    const labels = { beklemede: 'Beklemede', inceleme_bekliyor: 'İnceleme Bekliyor', dizgi_bekliyor: 'Dizgi Bekliyor', dizgide: 'Dizgide', tamamlandi: 'Tamamlandı', revize_gerekli: 'Revize Gerekli', revize_istendi: 'Revize İstendi' };
    return <span className={badges[durum]}>{labels[durum]}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header Area */}
      <div className="bg-white border-b-2 border-gray-100 p-6 flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tighter">
            📝 Soru Detayı
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sorular')} className="btn btn-secondary btn-sm">← Geri</button>

          {/* HER DURUMDA GÖRÜNMESİ İÇİN ŞARTLAR ESNETİLDİ */}
          {soru.durum !== 'tamamlandi' && (
            <button
              onClick={handleFinishReview}
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 transition shadow-[0_4px_14px_0_rgba(22,163,74,0.39)] flex items-center gap-2 border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
            >
              🚀 İNCELEMEYİ BİTİR VE DİZGİYE GÖNDER
            </button>
          )}
        </div>
      </div>



      {/* Soru İçeriği */}
      <div className="flex items-center gap-3 mb-2 px-1">
        {getDurumBadge(soru.durum)}
        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-200 uppercase tracking-tighter">Versiyon 1</span>
        <span className="badge bg-green-100 text-green-800 font-bold">✅ Doğru: {soru.dogru_cevap}</span>
      </div>

      <div className="relative border-4 border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xl transition-all">
        <div className={`p-8 min-h-[400px] relative z-10 cursor-text`}>
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

          {soru.fotograf_url && (
            <div className="mt-10">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 inline-block shadow-lg">
                <img src={soru.fotograf_url} alt="Soru" className="max-w-full rounded-lg" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Revize Notları Listesi (ROL BAZLI FİLTRELEME) */}
      {revizeNotlari.filter(not => {
        if (user?.rol === 'admin' || user?.rol === 'dizgici') return true;
        if (incelemeTuru) return not.inceleme_turu === incelemeTuru;
        return true;
      }).length > 0 && (
          <div className="card bg-amber-50 border border-amber-200">
            <h3 className="text-xl font-bold mb-4 text-amber-900 flex items-center">
              <span className="mr-2">📝</span> Revize / Hata Notları
            </h3>
            <div className="space-y-3">
              {revizeNotlari.filter(not => {
                if (user?.rol === 'admin' || user?.rol === 'dizgici') return true;
                if (incelemeTuru) return not.inceleme_turu === incelemeTuru;
                return true;
              }).map((not) => (
                <div key={not.id} className="flex gap-4 p-3 bg-white border border-amber-100 rounded-lg shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {revizeNotlari.indexOf(not) + 1}
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
                  {(effectiveRole === 'admin' || user?.id === not.kullanici_id) && (
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
        <div className="fixed bottom-12 right-12 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 font-bold text-white flex justify-between items-center bg-purple-600 shadow-lg">
            <span>Not Ekle (Madde {revizeNotlari.length + 1})</span>
            <button onClick={() => setSelectedText('')}>✕</button>
          </div>
          <div className="p-4">
            <div className="text-[10px] text-gray-400 mb-2 italic">"{selectedText.substring(0, 60)}..."</div>
            <textarea className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-purple-500" rows="3" placeholder="Hata açıklamasını buraya yazın..." value={revizeNotuInput} onChange={(e) => setRevizeNotuInput(e.target.value)} />
            <button onClick={handleAddRevizeNot} className="w-full mt-2 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-black uppercase">Notu Kaydet</button>
          </div>
        </div>
      )}

      {/* Alt Araç Çubuğu */}
      <div className="flex gap-2">
        {canEdit && !editMode && <button onClick={handleEditStart} className="btn btn-primary">✏️ Düzenle</button>}
        {/* SADECE ADMIN VE SAHİBİ SİLEBİLİR - İNCELEMECİ SİLEMEZ */}
        {(effectiveRole === 'admin' || (soru.olusturan_kullanici_id === user?.id && effectiveRole !== 'incelemeci')) && (
          <button onClick={handleSil} className="btn btn-danger">Sil</button>
        )}
      </div>

      {/* Yorumlar ve Versiyon geçmişi aynen devam eder... */}
      <div className="card">
        <h3 className="text-xl font-bold mb-6 text-gray-800">İnceleme Yorumları</h3>
        <IncelemeYorumlari soruId={id} />
      </div>
    </div>
  );
}

function IncelemeYorumlari({ soruId }) {
  const [yorumlar, setYorumlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState('');
  const [loading, setLoading] = useState(true);
  const loadYorumlar = async () => {
    try { const res = await soruAPI.getComments(soruId); setYorumlar(res.data.data); } catch (e) { } finally { setLoading(false); }
  };
  useEffect(() => { loadYorumlar(); }, [soruId]);
  const handleYorumEkle = async () => {
    if (!yeniYorum.trim()) return;
    try { await soruAPI.addComment(soruId, yeniYorum); setYeniYorum(''); loadYorumlar(); } catch (e) { }
  };
  return (
    <div className="flex flex-col h-full min-h-[200px]">
      <div className="flex-1 space-y-3">
        {loading ? <p className="text-center text-gray-400">Yükleniyor...</p> : yorumlar.length === 0 ? <p className="text-center text-gray-400 italic text-sm">Hiç yorum yok.</p> :
          yorumlar.map((y) => (
            <div key={y.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-bold text-gray-900">{y.ad_soyad} <span className="text-[10px] font-normal text-gray-400 uppercase">({y.rol})</span></span>
                <span className="text-[10px] text-gray-400">{new Date(y.tarih).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{y.yorum_metni}</p>
            </div>
          ))}
      </div>
      <div className="mt-6 flex gap-2">
        <input type="text" className="input shadow-inner" placeholder="İnceleme notu yazın..." value={yeniYorum} onChange={(e) => setYeniYorum(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleYorumEkle()} />
        <button onClick={handleYorumEkle} className="btn btn-primary px-8">Ekle</button>
      </div>
    </div>
  );
}

function VersiyonGecmisi({ soruId }) {
  const [versiyonlar, setVersiyonlar] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => { try { const res = await soruAPI.getHistory(soruId); setVersiyonlar(res.data.data); } catch (e) { } finally { setLoading(false); } };
    load();
  }, [soruId]);
  if (loading) return <div className="text-center py-4">Sürümler yükleniyor...</div>;
  if (versiyonlar.length === 0) return <p className="text-center text-gray-400 italic">Henüz bir sürüm geçmişi yok.</p>;
  return (
    <div className="space-y-4">
      {versiyonlar.map((v) => (
        <div key={v.id} className="border rounded-xl p-4 bg-gray-50 hover:bg-white transition-all shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px] font-bold">v{v.versiyon_no}</span>
            <span className="text-[10px] text-gray-400">{new Date(v.degisim_tarihi).toLocaleString()}</span>
          </div>
          <div className="font-bold text-sm text-gray-900 mb-2">{v.ad_soyad}</div>
          <div className="text-xs text-gray-600 line-clamp-2 italic">"{v.degisim_aciklamasi || 'Soru güncellendi'}"</div>
        </div>
      ))}
    </div>
  );
}
