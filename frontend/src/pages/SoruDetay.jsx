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

  // Çizim Kanvası State
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushWidth, setBrushWidth] = useState(2);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    loadSoru();
  }, [id]);

  const renderLatexInElement = (element, content) => {
    if (!element || !content) return;
    let html = content;
    html = html.replace(/\$\$([^\$]+)\$\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, { throwOnError: false, displayMode: true });
      } catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\$([^\$]+)\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, { throwOnError: false, displayMode: false });
      } catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\n/g, '<br>');
    if (revizeNotlari && revizeNotlari.length > 0) {
      revizeNotlari.forEach((not, index) => {
        if (!not.secilen_metin) return;
        const colorClass = not.inceleme_turu === 'dilci' ? 'green' : 'blue';
        const mark = `<mark class="bg-${colorClass}-200 rounded px-1 cursor-help relative group">
          ${not.secilen_metin}
          <span class="absolute bottom-full left-0 hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded w-48 z-50 shadow-lg mb-1">
            <strong>${index + 1}.</strong> ${not.not_metni} <br/>
            <span class="text-gray-400 text-[10px]">${new Date(not.tarih).toLocaleString()}</span>
          </span>
          <sup class="text-${colorClass}-700 font-bold ml-0.5 select-none">[${index + 1}]</sup>
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

  useEffect(() => {
    if (soru) {
      if (soruMetniRef.current) renderLatexInElement(soruMetniRef.current, soru.soru_metni);
      if (latexKoduRef.current && soru.latex_kodu) renderLatexInElement(latexKoduRef.current, soru.latex_kodu);
    }
  }, [soru, revizeNotlari]);

  useEffect(() => { if (id) loadRevizeNotlari(); }, [id]);

  const loadRevizeNotlari = async () => {
    try {
      const res = await soruAPI.getRevizeNotlari(id);
      setRevizeNotlari(res.data.data);
    } catch (e) { console.error(e); }
  };

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
    } catch (e) { alert('Not eklenemedi: ' + (e.response?.data?.error || e.message)); }
  };

  const handleDeleteRevizeNot = async (notId) => {
    if (!confirm('Notu silmek istiyor musunuz?')) return;
    try {
      await soruAPI.deleteRevizeNot(id, notId);
      loadRevizeNotlari();
    } catch (e) { alert('Silinemedi'); }
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
    } catch (error) { window.open(url, '_blank'); }
  };

  const handleDizgiTamamla = async () => {
    try {
      await soruAPI.dizgiTamamla(id, { notlar: dizgiNotu });
      alert('Dizgi tamamlandı!');
      loadSoru();
    } catch (error) { alert(error.response?.data?.error || 'Dizgi tamamlama başarısız'); }
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

  const handleEditCancel = () => {
    setEditMode(false);
    setEditData({ soru_metni: '', zorluk_seviyesi: '' });
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
              <p className="text-sm text-gray-600 mb-2">Hataları not alıp Dizgiye gönderin.</p>
              <textarea rows="2" className="w-full text-sm border-gray-300 rounded p-2 mb-2" placeholder="Notlarınız..." value={dizgiNotu} onChange={(e) => setDizgiNotu(e.target.value)} />
              <button
                onClick={async () => {
                  if (!dizgiNotu) return alert('Not giriniz');
                  try {
                    await soruAPI.updateDurum(id, { newStatus: 'revize_istendi', aciklama: dizgiNotu });
                    alert('Notlar Dizgiciye iletildi.');
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
        {/* CANVAS LAYER (Sadece İncelemeciler İçin) */}
        {incelemeTuru && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <canvas
              id="review-canvas"
              className={`w-full h-full pointer-events-auto ${isEraser ? 'cursor-cell' : 'cursor-crosshair'}`}
              onMouseDown={(e) => {
                const canvas = e.target;
                const rect = canvas.getBoundingClientRect();
                const ctx = canvas.getContext('2d');
                ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                canvas.isDrawing = true;
              }}
              onMouseMove={(e) => {
                const canvas = e.target;
                if (!canvas.isDrawing) return;
                const rect = canvas.getBoundingClientRect();
                const ctx = canvas.getContext('2d');
                ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);

                if (isEraser) {
                  ctx.globalCompositeOperation = 'destination-out';
                  ctx.lineWidth = brushWidth * 5;
                } else {
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.strokeStyle = brushColor;
                  ctx.lineWidth = brushWidth;
                }

                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
              }}
              onMouseUp={(e) => e.target.isDrawing = false}
              onMouseOut={(e) => e.target.isDrawing = false}
              ref={(canvas) => {
                if (canvas && !canvas.initialized) {
                  const parent = canvas.parentElement.parentElement;
                  canvas.style.width = '100%';
                  canvas.style.height = '100%';
                  canvas.width = parent.offsetWidth;
                  canvas.height = parent.offsetHeight;
                  canvas.initialized = true;
                }
              }}
            />
            {/* Çizim Araç Çubuğu */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 p-2 bg-white/90 backdrop-blur shadow-xl border border-gray-200 rounded-2xl pointer-events-auto z-50">
              <div className="flex flex-col gap-1 border-b pb-2">
                {['#ef4444', '#3b82f6', '#22c55e', '#000000'].map(color => (
                  <button
                    key={color}
                    onClick={() => { setBrushColor(color); setIsEraser(false); }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${brushColor === color && !isEraser ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <button
                onClick={() => setIsEraser(!isEraser)}
                className={`p-1.5 rounded-lg transition ${isEraser ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                title="Silgi"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              <div className="flex flex-col gap-1 items-center border-t border-b py-2 my-1">
                {[2, 5, 10].map(w => (
                  <button
                    key={w}
                    onClick={() => setBrushWidth(w)}
                    className={`w-full py-1 text-[9px] font-bold rounded ${brushWidth === w ? 'bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    {w === 2 ? 'İnce' : w === 5 ? 'Orta' : 'Kalın'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => { const c = document.getElementById('review-canvas'); c.getContext('2d').clearRect(0, 0, c.width, c.height); }}
                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                title="Temizle"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className={`p-8 min-h-[400px] relative z-10 ${incelemeTuru ? 'select-none' : ''}`}>
          <div className="prose max-w-none">
            {/* Soru Metni Başlığı Kaldırıldı */}
            {editMode ? (
              <div className="space-y-4 pointer-events-auto">
                <textarea className="input font-mono" rows="8" value={editData.soru_metni} onChange={(e) => setEditData({ ...editData, soru_metni: e.target.value })} />
                <button onClick={handleEditSave} disabled={saving} className="btn btn-primary">Kaydet</button>
                <button onClick={handleEditCancel} className="btn btn-secondary ml-2">İptal</button>
              </div>
            ) : (
              <div ref={soruMetniRef} className="text-gray-900 text-lg leading-relaxed katex-left-align relative z-10" onMouseUp={handleTextSelection} />
            )}
          </div>

          {/* Seçenekler */}
          <div className="mt-10">
            {/* Seçenekler Başlığı Kaldırıldı */}
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
              {/* Başlık Kaldırıldı */}
              <div ref={latexKoduRef} className="bg-white p-6 rounded-lg border border-blue-50 shadow-inner" />
            </div>
          )}

          {soru.fotograf_url && (
            <div className="mt-10">
              {/* Başlık Kaldırıldı */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 inline-block shadow-lg">
                <img src={soru.fotograf_url} alt="Soru" className="max-w-full rounded-lg" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diğer Detaylar */}
      <div className="card text-sm text-gray-500 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/50 border-dashed border-2">
        <div><div className="font-bold">Branş</div>{soru.brans_adi}</div>
        <div><div className="font-bold">Ekip</div>{soru.ekip_adi}</div>
        <div><div className="font-bold">Oluşturan</div>{soru.olusturan_ad}</div>
        {soru.dizgici_ad && <div><div className="font-bold">Dizgici</div>{soru.dizgici_ad}</div>}
      </div>

      {/* Yorumlar Paneli */}
      <div className="card">
        <h3 className="text-xl font-bold mb-6 text-gray-800">İnceleme Yorumları</h3>
        <IncelemeYorumlari soruId={id} />
      </div>

      {/* Versiyon Geçmişi */}
      {(user?.rol === 'admin' || user?.id === soru.olusturan_kullanici_id) && (
        <div className="card">
          <h3 className="text-xl font-bold mb-6 text-gray-800">Sürüm Geçmişi</h3>
          <VersiyonGecmisi soruId={id} />
        </div>
      )}

      {/* Popover */}
      {selectedText && (
        <div className="fixed bottom-12 right-12 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-bounce-in">
          <div className={`p-4 font-bold text-white flex justify-between items-center ${incelemeTuru === 'alanci' ? 'bg-blue-600' : 'bg-green-600'}`}>
            <span>Not Ekle</span>
            <button onClick={() => setSelectedText('')}>✕</button>
          </div>
          <div className="p-4">
            <div className="text-[10px] text-gray-400 mb-2 italic">"{selectedText.substring(0, 60)}..."</div>
            <textarea className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500" rows="3" placeholder="Notunuz..." value={revizeNotuInput} onChange={(e) => setRevizeNotuInput(e.target.value)} />
            <button onClick={handleAddRevizeNot} className="w-full mt-2 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-black">Kaydet</button>
          </div>
        </div>
      )}
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
