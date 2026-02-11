import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { soruAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import MesajKutusu from '../components/MesajKutusu';
import { getDurumBadge, STATUS_LABELS } from '../utils/helpers';
import html2canvas from 'html2canvas';
import {
  PaintBrushIcon,
  ArrowPathIcon,
  Squares2X2Icon,
  ClockIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  ArrowRightCircleIcon,
  XMarkIcon,
  PhotoIcon,
  DocumentArrowUpIcon,
  BeakerIcon,
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon as ChevronRightOutline
} from '@heroicons/react/24/outline';

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
  const [pendingIndex, setPendingIndex] = useState(0);
  const questionRef = useRef(null);

  useEffect(() => {
    loadSorular();
    loadBransCounts();
  }, []);

  const loadSorular = async () => {
    setLoading(true);
    try {
      const response = await soruAPI.getAll({ role: 'dizgici' });
      const all = (response.data.data || []);
      // Kuyrukta bekleyenleri yazım sırasına göre (eskiden yeniye) sırala
      const pendingList = all.filter(s => s.durum === 'dizgi_bekliyor' || s.durum === 'revize_istendi')
        .sort((a, b) => new Date(a.olusturulma_tarihi) - new Date(b.olusturulma_tarihi));

      setPending(pendingList);
      setInProgress(all.filter(s => s.durum === 'dizgide'));
      setSorular(all);

      // Eğer seçili soru yoksa veya seçili soru artık listede değilse index'i sıfırla
      setPendingIndex(0);
    } catch (error) {
      console.error('Sorular yüklenemedi');
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

  const handleDizgiAl = async (soruId) => {
    try {
      setLoading(true);
      const res = await soruAPI.dizgiAl(soruId);
      if (res.data.success) {
        setSelectedSoru(res.data.data);
      }
      await loadSorular();
      loadBransCounts();
    } catch (err) {
      alert(err.response?.data?.error || 'Soru alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleDurumGuncelle = async (soruId, durum, confirmMsg = null) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      const data = { yeni_durum: durum };
      if (durum === 'revize_gerekli' && revizeNotu) {
        data.aciklama = revizeNotu;
      }
      await soruAPI.updateDurum(soruId, data);
      setShowModal(false);
      setSelectedSoru(null);
      setRevizeNotu('');
      await loadSorular();
      loadBransCounts();
    } catch (error) {
      alert(error.response?.data?.error || 'Durum güncellenemedi');
    }
  };



  const handleCapturePNG = async () => {
    if (!questionRef.current) return;
    try {
      const canvas = await html2canvas(questionRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `soru-${selectedSoru.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('Görsel oluşturulamadı.');
    }
  };

  const QuestionCard = ({ soru }) => {
    // HTML etiketlerini temizle
    const plainText = soru.soru_metni ? soru.soru_metni.replace(/<[^>]+>/g, '') : '';
    const hasImage = soru.soru_metni?.includes('<img') || soru.fotograf_url || soru.final_png_url;

    return (
      <div
        onClick={() => setSelectedSoru(soru)}
        className={`p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer group flex flex-col gap-6 relative overflow-hidden ${selectedSoru?.id === soru.id
          ? 'bg-blue-600 border-blue-600 shadow-2xl shadow-blue-200 ring-4 ring-blue-500/20'
          : 'bg-white border-gray-100 hover:border-blue-400 hover:shadow-xl'
          }`}
      >
        <div className="flex justify-between items-center z-10 relative">
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${selectedSoru?.id === soru.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
              #{soru.id}
            </div>
            {soru.final_png_url && (
              <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${selectedSoru?.id === soru.id ? 'bg-emerald-400/20 text-white' : 'bg-emerald-50 text-emerald-600'
                }`}>
                DİZGİLİ
              </div>
            )}
          </div>
          {hasImage && <PhotoIcon className={`w-5 h-5 ${selectedSoru?.id === soru.id ? 'text-blue-200' : 'text-gray-400'}`} />}
        </div>

        <div className={`text-sm font-bold line-clamp-[15] min-h-[3em] leading-relaxed ${selectedSoru?.id === soru.id ? 'text-white' : 'text-gray-700'}`}>
          {plainText.trim().length > 0 ? plainText : (hasImage ? 'Görsel içerikli soru...' : 'İçerik önizlemesi yok')}
        </div>

        <div className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${selectedSoru?.id === soru.id ? 'text-blue-100' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border shadow-sm ${selectedSoru?.id === soru.id ? 'border-white/20 bg-white/10' : 'border-gray-200 bg-white'}`}>
            {soru.olusturan_ad?.charAt(0)}
          </div>
          {soru.olusturan_ad}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <PaintBrushIcon className="w-12 h-12 text-purple-600" strokeWidth={2.5} />
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Dizgi Laboratuvarı</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={loadSorular} className="p-4 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all shadow-sm active:scale-95">
            <ArrowPathIcon className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-32 text-center bg-white rounded-[4rem] border border-gray-50 shadow-sm">
          <ArrowPathIcon className="w-12 h-12 text-blue-100 mx-auto animate-spin mb-4" strokeWidth={2.5} />
          <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.3em]">PROBİS İş Akışı Yükleniyor...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* FLOW COLUMNS */}
          <div className="lg:col-span-5 flex flex-col gap-10">
            {/* COLUMN: PENDING */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-amber-500" strokeWidth={2.5} /> Kuyrukta Bekleyenler
                </h3>
                <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-xl text-[10px] font-black">{pending.length === 0 ? 0 : `${pendingIndex + 1} / ${pending.length}`}</span>
              </div>

              <div className="relative group">
                {pending.length > 0 && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setPendingIndex(prev => Math.max(0, prev - 1))}
                      disabled={pendingIndex === 0}
                      className="p-2 bg-white border border-gray-100 rounded-xl shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                      <ChevronLeftIcon className="w-6 h-6 text-gray-600" strokeWidth={2.5} />
                    </button>

                    <div className="flex-1 animate-fade-in-right" key={pending[pendingIndex]?.id}>
                      <QuestionCard soru={pending[pendingIndex]} />
                    </div>

                    <button
                      onClick={() => setPendingIndex(prev => Math.min(pending.length - 1, prev + 1))}
                      disabled={pendingIndex === pending.length - 1}
                      className="p-2 bg-white border border-gray-100 rounded-xl shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                      <ChevronRightOutline className="w-6 h-6 text-gray-600" strokeWidth={2.5} />
                    </button>
                  </div>
                )}
                {pending.length === 0 && (
                  <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 font-bold uppercase tracking-widest text-xs italic">Kuyruk Boş</div>
                )}
              </div>
            </div>

            {/* COLUMN: IN PROGRESS */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <BeakerIcon className="w-4 h-4 text-blue-500" strokeWidth={2.5} /> İşlemde Olanlar
                </h3>
                <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-xl text-[10px] font-black">{inProgress.length}</span>
              </div>
              <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar pr-2">
                {inProgress.map(soru => <QuestionCard key={soru.id} soru={soru} />)}
                {inProgress.length === 0 && <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 font-bold uppercase tracking-widest text-xs italic">Aktif işlem yok</div>}
              </div>
            </div>
          </div>

          {/* PREVIEW & ACTIONS AREA */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-8">
            {selectedSoru ? (
              <div className="sticky top-10 space-y-8 animate-scale-up">
                {/* PREVIEW CARD */}
                <div className="bg-white rounded-[3.5rem] p-12 shadow-2xl shadow-gray-200/50 border border-gray-50 flex flex-col gap-8">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-gray-50 pb-8">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Soru Detayı</h2>
                        <div className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${selectedSoru.durum.includes('bekliyor') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          selectedSoru.durum.includes('dizgide') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                          {STATUS_LABELS[selectedSoru.durum] || selectedSoru.durum}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                        {selectedSoru.brans_adi} <span className="mx-2 text-gray-200">|</span>
                        Oluşturan: <span className="text-gray-600">{selectedSoru.olusturan_ad}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => navigate(`/sorular/${selectedSoru.id}`)} className="p-4 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl transition shadow-sm border border-gray-100 active:bg-gray-200 group" title="Detay Sayfası">
                        <ArrowRightCircleIcon className="w-8 h-8 group-hover:text-blue-600 transition-colors" />
                      </button>
                      <button onClick={() => setShowMesaj(showMesaj === selectedSoru.id ? null : selectedSoru.id)} className={`p-3 rounded-2xl transition shadow-sm border ${showMesaj === selectedSoru.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                        }`} title="Mesajlaşma">
                        <ChatBubbleLeftRightIcon className="w-6 h-6" />
                      </button>

                      {selectedSoru.durum === 'dizgi_bekliyor' || selectedSoru.durum === 'revize_istendi' ? (
                        <button onClick={() => handleDizgiAl(selectedSoru.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-100 active:scale-95 flex items-center gap-2">
                          <PaintBrushIcon className="w-4 h-4" strokeWidth={2.5} /> Dizgiye Al
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* QUESTION TEXT AREA */}
                  <div className="relative group">
                    <div className="absolute -top-4 -left-4 bg-indigo-600 text-white p-2 rounded-xl shadow-lg z-10 scale-0 group-hover:scale-100 transition-transform">
                      <SparklesIcon className="w-4 h-4" />
                    </div>
                    <div className="p-10 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 shadow-inner min-h-[15rem] relative" ref={questionRef}>
                      {/* ÖNCE FİNAL PNG'Yİ GÖSTER (EĞER VARSA LATEST STATE ODUR) */}
                      {selectedSoru.final_png_url ? (
                        <div className="mb-10 text-center">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">Mevcut Dizgi Çıktısı (En Son Kaydedilen)</p>
                          <div className="p-4 bg-white rounded-3xl shadow-md border border-emerald-100 inline-block overflow-hidden max-w-full">
                            <img src={selectedSoru.final_png_url} className="max-w-full rounded-2xl mx-auto block" alt="Soru Dizgi Çıktısı" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-900 prose prose-xl max-w-none font-medium leading-relaxed [&_img]:hidden" dangerouslySetInnerHTML={{ __html: selectedSoru.soru_metni }} />
                      )}

                      {/* ORİJİNAL DRAFT GÖRSELİ (EĞER VARSA) */}
                      {selectedSoru.fotograf_url && (
                        <div className="mt-10 p-4 bg-white rounded-3xl shadow-sm border border-gray-100 inline-block overflow-hidden max-w-full">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Orijinal Taslak Görseli</p>
                          <img src={selectedSoru.fotograf_url} className="max-w-full rounded-2xl mx-auto block opacity-60 hover:opacity-100 transition-opacity" alt="Soru Taslak Görseli" />
                        </div>
                      )}

                      {/* EĞER FİNAL PNG VARSA METNİ ALTTA REFERANS OLARAK GÖSTERELİM */}
                      {selectedSoru.final_png_url && (
                        <div className="mt-10 pt-10 border-t border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center italic">Soru İçerik Metni (Referans)</p>
                          <div className="text-gray-500 prose prose-lg max-w-none font-medium leading-relaxed opacity-50 font-sans" dangerouslySetInnerHTML={{ __html: selectedSoru.soru_metni }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTIONS FOR POST-COMPLETION OR IN PROGRESS */}
                  {(selectedSoru.durum === 'tamamlandi' || selectedSoru.durum === 'dizgi_tamam' || selectedSoru.durum === 'dizgide') && (
                    <div className="flex flex-col gap-4 pt-4">
                      {selectedSoru.durum === 'dizgide' && (
                        <button
                          onClick={() => handleDurumGuncelle(selectedSoru.id, 'dizgi_tamam', 'Dizgiyi tamamlayıp soru yazarının onayına sunmak istediğinize emin misiniz?')}
                          disabled={!selectedSoru.final_png_url}
                          className={`w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] transition-all shadow-lg flex items-center justify-center gap-3 ${!selectedSoru.final_png_url ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 active:scale-95'}`}
                        >
                          <CheckCircleIcon className="w-6 h-6" />
                          {!selectedSoru.final_png_url ? 'ÖNCE PNG YÜKLEYİNİZ' : 'DİZGİYİ TAMAMLA VE GÖNDER'}
                        </button>
                      )}

                      {/* FILE ACTIONS */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={handleCapturePNG} className="flex-1 flex items-center justify-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] transition-all shadow-sm active:scale-95">
                          <PhotoIcon className="w-6 h-6" /> GÖRÜNÜMÜ AL (AUTO)
                        </button>

                        <label className="flex-1 flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] transition-all shadow-lg shadow-purple-100 active:scale-95 cursor-pointer">
                          <DocumentArrowUpIcon className="w-6 h-6" /> MANUEL DOSYA YÜKLE
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (!confirm("Seçilen dosya Final PNG olarak yüklenecek. Emin misiniz?")) { e.target.value = null; return; }
                            const fd = new FormData();
                            fd.append('final_png', file);
                            try {
                              await soruAPI.uploadFinal(selectedSoru.id, fd);
                              alert('Dosya yüklendi.');
                              // Refresh individual question state to show Finish button
                              const updatedSoru = await soruAPI.getById(selectedSoru.id);
                              setSelectedSoru(updatedSoru.data.data);
                              await loadSorular();
                            } catch (err) { alert(err.response?.data?.error || 'Dosya yüklenemedi'); }
                          }} />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* MESSAGING INTEGRATION */}
                  {showMesaj === selectedSoru.id && (
                    <div className="mt-4 border-t border-gray-100 pt-10 animate-fade-in">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                        <h4 className="text-xl font-black text-gray-900 tracking-tight">Eğitimci & Dizgici İletişimi</h4>
                      </div>
                      <div className="h-[500px] border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-inner bg-gray-50/30">
                        <MesajKutusu
                          soruId={selectedSoru.id}
                          soruSahibi={{ ad_soyad: selectedSoru.olusturan_ad }}
                          dizgici={{ ad_soyad: user.ad_soyad }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] p-32 text-center border border-gray-50 shadow-sm flex flex-col items-center gap-6 group">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <Squares2X2Icon className="w-10 h-10 text-gray-200 group-hover:text-blue-200 transition-colors" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-300 uppercase tracking-widest leading-none">ÇALIŞMA ALANI BOŞ</h3>
                  <p className="text-xs text-gray-300 font-bold uppercase tracking-widest italic opacity-60">LÜTFEN SOL SÜTUNDAN BİR GÖREV SEÇİN.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}




    </div>
  );
}
