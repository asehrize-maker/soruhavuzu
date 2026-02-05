import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { soruAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import MesajKutusu from '../components/MesajKutusu';
import { getDurumBadge } from '../utils/helpers';
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
  SparklesIcon
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
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showMesaj, setShowMesaj] = useState(null);
  const [revizeNotu, setRevizeNotu] = useState('');
  const [completeData, setCompleteData] = useState({ notlar: '', finalPng: null });
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
      setPending(all.filter(s => s.durum === 'dizgi_bekliyor' || s.durum === 'revize_istendi'));
      setInProgress(all.filter(s => s.durum === 'dizgide'));
      setCompleted(all.filter(s => s.durum === 'dizgi_tamam' || (s.durum === 'tamamlandi' && !s.final_png_url)));
      setSorular(all);
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

  const handleDurumGuncelle = async (soruId, durum) => {
    try {
      const data = { yeni_durum: durum };
      if (durum === 'revize_gerekli' && revizeNotu) {
        data.aciklama = revizeNotu;
      }
      await soruAPI.updateDurum(soruId, data);
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
    const hasImage = soru.soru_metni?.includes('<img') || soru.fotograf_url;

    return (
      <div
        onClick={() => setSelectedSoru(soru)}
        className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-2 relative overflow-hidden ${selectedSoru?.id === soru.id
          ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-200 ring-2 ring-blue-500/20'
          : 'bg-white border-gray-100 hover:border-blue-400 hover:shadow-md'
          }`}
      >
        <div className="flex justify-between items-center z-10 relative">
          <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${selectedSoru?.id === soru.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
            #{soru.id}
          </div>
          {hasImage && <PhotoIcon className={`w-4 h-4 ${selectedSoru?.id === soru.id ? 'text-blue-200' : 'text-gray-400'}`} />}
        </div>

        <div className={`text-xs font-bold line-clamp-2 min-h-[1.5em] ${selectedSoru?.id === soru.id ? 'text-white' : 'text-gray-700'}`}>
          {plainText.trim().length > 0 ? plainText : (hasImage ? 'Görsel içerikli soru...' : 'İçerik önizlemesi yok')}
        </div>

        <div className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${selectedSoru?.id === soru.id ? 'text-blue-200' : 'text-gray-400'}`}>
          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] border ${selectedSoru?.id === soru.id ? 'border-white/20 bg-white/10' : 'border-gray-200 bg-gray-50'}`}>
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
                <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-xl text-[10px] font-black">{pending.length}</span>
              </div>
              <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto no-scrollbar pr-2">
                {pending.map(soru => <QuestionCard key={soru.id} soru={soru} />)}
                {pending.length === 0 && <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 font-bold uppercase tracking-widest text-xs italic">Kuyruk Boş</div>}
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
              <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto no-scrollbar pr-2">
                {inProgress.map(soru => <QuestionCard key={soru.id} soru={soru} />)}
                {inProgress.length === 0 && <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 font-bold uppercase tracking-widest text-xs italic">Aktif işlem yok</div>}
              </div>
            </div>

            {/* COLUMN: COMPLETED BUT WAITING FILE */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-500" strokeWidth={2.5} /> Onaya Hazır / Tamamlanan
                </h3>
                <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-xl text-[10px] font-black">{completed.length}</span>
              </div>
              <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto no-scrollbar pr-2">
                {completed.map(soru => <QuestionCard key={soru.id} soru={soru} />)}
                {completed.length === 0 && <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 font-bold uppercase tracking-widest text-xs italic">Tamamlanan iş bulunamadı</div>}
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
                          {selectedSoru.durum.replace(/_/g, ' ')}
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
                      ) : selectedSoru.durum === 'dizgide' ? (
                        <button onClick={() => setShowCompleteModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 active:scale-95 flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4" strokeWidth={2.5} /> Dizgiyi Bitir
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
                      <div className="text-gray-900 prose prose-xl max-w-none font-medium leading-relaxed [&_img]:hidden" dangerouslySetInnerHTML={{ __html: selectedSoru.soru_metni }} />
                      {selectedSoru.fotograf_url && (
                        <div className="mt-10 p-4 bg-white rounded-3xl shadow-sm border border-gray-100 inline-block overflow-hidden max-w-full">
                          <img src={selectedSoru.fotograf_url} className="max-w-full rounded-2xl mx-auto block hover:scale-[1.02] transition-transform duration-500" alt="Soru Görseli" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTIONS FOR POST-COMPLETION */}
                  {(selectedSoru.durum === 'tamamlandi' || selectedSoru.durum === 'dizgi_tamam') && (
                    <div className="flex flex-col gap-4 pt-4">
                      {/* FILE ACTIONS */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={handleCapturePNG} className="flex-1 flex items-center justify-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] transition-all shadow-sm active:scale-95">
                          <PhotoIcon className="w-6 h-6" /> PNG ÇIKTISI AL (AUTO)
                        </button>

                        <label className="flex-1 flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] transition-all shadow-lg shadow-purple-100 active:scale-95 cursor-pointer">
                          <DocumentArrowUpIcon className="w-6 h-6" /> MANUEL DOSYA YÜKLE
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (!confirm("Seçilen dosya yüklenecek ve soru güncellenecek. Emin misiniz?")) { e.target.value = null; return; }
                            const fd = new FormData();
                            fd.append('final_png', file);
                            try {
                              await soruAPI.uploadFinal(selectedSoru.id, fd);
                              alert('Dosya yüklendi ve havuza aktarıldı');
                              await loadSorular();
                              loadBransCounts();
                            } catch (err) { alert(err.response?.data?.error || 'Dosya yüklenemedi'); }
                          }} />
                        </label>
                      </div>

                      {/* BRANCH SEND ACTION */}
                      {selectedSoru.durum === 'dizgi_tamam' && (
                        <button onClick={() => handleDurumGuncelle(selectedSoru.id, 'alan_incelemede')} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] transition-all shadow-xl shadow-orange-100 active:scale-95 flex items-center justify-center gap-3">
                          🚀 BRANŞA GÖNDER (İNCELEME İÇİN)
                        </button>
                      )}
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

      {/* COMPLETE MODAL */}
      {showCompleteModal && selectedSoru && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[3rem] p-10 max-w-xl w-full shadow-2xl border border-gray-50 animate-scale-up">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-500" /> Görevi Sonlandır
                </h2>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Soru Final Çıktısı</p>
              </div>
              <button onClick={() => setShowCompleteModal(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition">
                <XMarkIcon className="w-7 h-7 text-gray-300" />
              </button>
            </div>

            <div className="space-y-8">
              <div className="relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Final PNG Yükle (LaTeX / Tasarım)</label>
                <div className="flex items-center justify-center w-full">
                  <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all ${completeData.finalPng ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-blue-400'
                    }`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      {completeData.finalPng ? (
                        <DocumentArrowUpIcon className="w-12 h-12 text-emerald-500 mb-3 animate-bounce-short" />
                      ) : (
                        <PhotoIcon className="w-12 h-12 text-gray-300 mb-3" />
                      )}
                      <p className={`text-xs font-black uppercase tracking-widest ${completeData.finalPng ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {completeData.finalPng ? 'DOSYA SEÇİLDİ' : 'GÖRSELİ BURAYA SÜRÜKLEYİN'}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400 font-medium italic">
                        {completeData.finalPng ? completeData.finalPng.name : 'Veya buraya tıklayarak dosya seçin'}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={(e) => setCompleteData({ ...completeData, finalPng: e.target.files[0] })} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Eğitimci/Yazar Notu</label>
                <textarea
                  rows="4"
                  className="w-full bg-gray-50 border border-gray-200 rounded-[2rem] px-6 py-5 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                  placeholder="Dizgi hakkında teknik detaylar, kullanılan fontlar vb. bilgiler ekleyebilirsiniz..."
                  value={completeData.notlar}
                  onChange={(e) => setCompleteData({ ...completeData, notlar: e.target.value })}
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setShowCompleteModal(false)} className="flex-1 py-5 rounded-3xl text-[11px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-colors">İPTAL</button>
                <button onClick={handleDizgiTamamla} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl py-5 font-black text-sm uppercase tracking-[0.1em] transition-all shadow-xl shadow-emerald-100 active:scale-95 flex items-center justify-center gap-2">
                  GÖREVİ SİSTEME GÖNDER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
