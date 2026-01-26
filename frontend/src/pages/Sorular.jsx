import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import { getDurumBadge, generateExportHtml } from '../utils/helpers';
import {
  Squares2X2Icon,
  FunnelIcon,
  ArrowPathIcon,
  TrashIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FolderOpenIcon,
  InboxIcon,
  SparklesIcon,
  PhotoIcon,
  RocketLaunchIcon,
  MagnifyingGlassPlusIcon,
  ArchiveBoxArrowDownIcon,
  PrinterIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

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

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      durum: urlDurum || (isTakipModu ? '' : (scope === 'brans' ? '' : 'tamamlandi'))
    }));
  }, [isTakipModu, scope, urlDurum]);

  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState(queryParams.get('tab') || 'taslaklar');

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

  const loadSorular = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = {
        durum: filters.durum || undefined,
        brans_id: filters.brans_id || undefined,
        scope: scope || undefined
      };
      const response = await soruAPI.getAll(params);
      let data = response.data.data || [];

      if (scope === 'brans') {
        if (activeTab === 'taslaklar') {
          data = data.filter(s =>
            ['beklemede', 'inceleme_bekliyor', 'incelemede', 'alan_incelemede', 'dil_incelemede', 'revize_istendi', 'revize_gerekli', 'dizgi_bekliyor', 'dizgide'].includes(s.durum)
          );
        } else {
          data = data.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam'].includes(s.durum));
        }
      }

      if (effectiveRole === 'dizgici' && authUser?.rol !== 'admin') {
        data = data.filter(s => ['dizgi_bekliyor', 'dizgide'].includes(s.durum));
      }
      setSorular(data);
    } catch (error) {
      setSorular([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSorular();
  }, [user?.id, effectiveRole, filters.durum, filters.brans_id, scope, activeTab]);

  const handleSil = async (id) => {
    if (window.confirm('Bu soruyu kalıcı olarak silmek istediğinize emin misiniz?')) {
      try {
        await soruAPI.delete(id);
        setSorular(sorular.filter(s => s.id !== id));
      } catch (err) {
        alert('Silme işlemi başarısız oldu.');
      }
    }
  };

  const handleOrtakHavuzaGonder = async (id) => {
    if (!window.confirm('Bu soruyu ortak havuza aktarmak istediğinize emin misiniz?')) return;
    try {
      setLoading(true);
      await soruAPI.updateDurum(id, { yeni_durum: 'tamamlandi' });
      const response = await soruAPI.getAll({
        scope,
        brans_id: filters.brans_id || undefined,
        durum: filters.durum || undefined
      });
      setSorular(response.data.data || []);
      alert('Soru başarıyla ortak havuza aktarıldı.');
    } catch (error) {
      alert('Hata: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDizgiAl = async (soruId) => {
    try {
      await soruAPI.dizgiAl(soruId);
      loadSorular();
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
    } catch (error) {
      alert('Hata: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDizgiyeGonder = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;
    if (!window.confirm(`${idList.length} soruyu dizgiye göndermek istediğinize emin misiniz?`)) return;
    try {
      setLoading(true);
      const results = await Promise.allSettled(idList.map(id => soruAPI.updateDurum(id, { yeni_durum: 'dizgi_bekliyor' })));
      const failed = results.filter(r => r.status === 'rejected');
      const succeeded = results.filter(r => r.status === 'fulfilled');

      if (failed.length > 0) {
        const errorDetails = failed.map((f, i) => {
          const errMsg = f.reason?.response?.data?.error || f.reason?.message || 'Bilinmeyen hata';
          return `Soru #${idList[results.indexOf(f)]}: ${errMsg}`;
        }).join('\n');
        alert(`${failed.length} hata oluştu:\n\n${errorDetails}`);
      }

      if (succeeded.length > 0) {
        loadSorular();
      }
      setSelectedQuestions([]);
    } catch (error) {
      alert('İşlem sırasında beklenmeyen bir hata oluştu: ' + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (selectedQuestions.length === 0) return;
    const selectedData = sorular.filter(s => selectedQuestions.includes(s.id));
    const htmlContent = generateExportHtml(selectedData);
    const exportWindow = window.open('', '_blank');
    exportWindow.document.write(htmlContent);
    exportWindow.document.close();
  };

  if (user?.rol === 'admin' && !filters.brans_id) {
    return (
      <div className="max-w-7xl mx-auto py-12 space-y-10 animate-fade-in-up">
        <div className="text-center space-y-4">
          <Squares2X2Icon className="w-16 h-16 text-blue-600 mx-auto" strokeWidth={2.5} />
          <h1 className="text-5xl font-black text-gray-900 tracking-tight">Merkezi Soru Havuzu</h1>
          <p className="text-gray-500 font-medium max-w-2xl mx-auto">İşlem yapmak istediğiniz branş birimini seçerek devam edin. Tüm sorulardan bağımsız branş bazlı yönetim paneline erişeceksiniz.</p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <ArrowPathIcon className="w-10 h-10 text-gray-200 animate-spin" strokeWidth={3} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Branşlar Listeleniyor...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {branslar.map(brans => (
              <button
                key={brans.id}
                onClick={() => setFilters({ ...filters, brans_id: brans.id })}
                className="group p-8 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Squares2X2Icon className="w-24 h-24" /></div>
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-3xl font-black mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                  {brans.brans_adi.charAt(0)}
                </div>
                <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{brans.brans_adi}</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{brans.ekip_adi}</p>

                <div className="mt-8 flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all">
                  HAVUZA GİRİŞ YAP <ChevronRightIcon className="w-4 h-4" strokeWidth={3} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* HEADER AREA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <div className="flex items-center gap-4 mb-2">
            {user?.rol === 'admin' && filters.brans_id && (
              <button onClick={() => setFilters({ ...filters, brans_id: '' })} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-all shadow-sm">
                <ChevronRightIcon className="w-6 h-6 rotate-180" strokeWidth={3} />
              </button>
            )}
            <div className="flex flex-col">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                {isTakipModu ? <ArrowPathIcon className="w-10 h-10 text-amber-500" /> : <InboxIcon className="w-10 h-10 text-blue-600" />}
                {isTakipModu ? 'Bekleyen İş Takibi' : (scope === 'brans' ? 'Branş Havuzu' : 'Ortak Soru Havuzu')}
              </h1>
              {user?.rol === 'admin' && filters.brans_id && (
                <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                  {branslar.find(b => b.id == filters.brans_id)?.brans_adi} BİRİMİ KONTROLÜ
                </p>
              )}
            </div>
          </div>
        </div>

        {scope === 'brans' && (
          <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
            <button
              onClick={() => { setActiveTab('taslaklar'); setFilters(f => ({ ...f, durum: '' })); setSelectedQuestions([]); }}
              className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'taslaklar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              ✍️ SÜREÇTEKİ SORULARIM
            </button>
            <button
              onClick={() => { setActiveTab('dizgi_sonrasi'); setFilters(f => ({ ...f, durum: '' })); setSelectedQuestions([]); }}
              className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'dizgi_sonrasi' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              🏁 ONAY BEKLEYENLER
            </button>
          </div>
        )}
      </div>

      {/* FILTER & TOOLS */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
          <div className="flex items-center gap-4 min-w-[200px] w-full md:w-auto">
            <FunnelIcon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
            <select
              value={filters.durum}
              onChange={(e) => setFilters({ ...filters, durum: e.target.value })}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
            >
              <option value="">TÜM DURUMLAR</option>
              <option value="beklemede">BEKLEMEDE</option>
              <option value="dizgi_bekliyor">DİZGİ BEKLİYOR</option>
              <option value="dizgide">DİZGİDE</option>
              <option value="tamamlandi">TAMAMLANDI</option>
              <option value="revize_gerekli">REVİZE GEREKLİ</option>
              <option value="revize_istendi">REVİZE İSTENDİ</option>
            </select>
          </div>

          {user?.rol === 'admin' && (
            <div className="flex items-center gap-4 min-w-[200px] w-full md:w-auto">
              <Squares2X2Icon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
              <select
                value={filters.brans_id}
                onChange={(e) => setFilters({ ...filters, brans_id: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
              >
                <option value="">TÜM BRANŞLAR</option>
                {branslar.map((brans) => (
                  <option key={brans.id} value={brans.id}>{brans.brans_adi}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedQuestions.length > 0 && (
            <div className="flex items-center gap-2">
              {activeTab === 'taslaklar' && (
                <button onClick={() => handleDizgiyeGonder(selectedQuestions)} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-100 transition-all flex items-center gap-2 active:scale-95">
                  <RocketLaunchIcon className="w-4 h-4" strokeWidth={2.5} /> DİZGİYE GÖNDER
                </button>
              )}
              <button onClick={handleExport} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-100 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all flex items-center gap-2 active:scale-95">
                <PrinterIcon className="w-4 h-4" strokeWidth={2.5} /> YAZDIR / WORD
              </button>
              <button onClick={() => setSelectedQuestions([])} className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition" title="Seçimi Temizle">
                <XMarkIcon className="w-5 h-5" strokeWidth={3} />
              </button>
            </div>
          )}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={3} />
            <input placeholder="SORU ARA..." className="bg-gray-50 border-none rounded-2xl pl-12 pr-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:ring-4 focus:ring-blue-500/10 transition-all w-[180px]" />
          </div>
        </div>
      </div>

      {/* QUESTION LIST */}
      {loading ? (
        <div className="py-40 text-center">
          <ArrowPathIcon className="w-12 h-12 text-blue-100 animate-spin mx-auto mb-4" strokeWidth={3} />
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Havuza Bağlanılıyor...</p>
        </div>
      ) : sorular.length === 0 ? (
        <div className="bg-white rounded-[3.5rem] p-32 text-center border border-gray-50 shadow-sm space-y-4">
          <InboxIcon className="w-20 h-20 text-gray-100 mx-auto" strokeWidth={1} />
          <div className="space-y-1">
            <h3 className="text-xl font-black text-gray-300 uppercase tracking-widest">Henüz Veri Yok</h3>
            <p className="text-gray-300 font-bold uppercase tracking-widest text-[10px] italic">BU FİLTRELER ALTINDA KAYITLI SORU BULUNAMADI.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4 px-6 mb-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${sorular.length > 0 && selectedQuestions.length === sorular.length ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200 group-hover:border-blue-300 shadow-inner'
                }`} onClick={() => {
                  if (selectedQuestions.length === sorular.length) setSelectedQuestions([]);
                  else setSelectedQuestions(sorular.map(s => s.id));
                }}>
                {selectedQuestions.length === sorular.length && <CheckCircleIcon className="w-4 h-4 text-white" strokeWidth={3} />}
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">TÜMÜNÜ SEÇ ({sorular.length})</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {sorular.map((soru) => {
              const isSelected = selectedQuestions.includes(soru.id);
              return (
                <div
                  key={soru.id}
                  className={`group relative bg-white rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all border border-transparent ${isSelected ? 'border-blue-600 shadow-blue-100/50 ring-4 ring-blue-500/5' : 'hover:border-blue-100'
                    }`}
                >
                  <div className="flex flex-col lg:flex-row gap-8">
                    {/* CONTENT AREA */}
                    <div className="flex-1 space-y-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getDurumBadge(soru.durum)}
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 uppercase tracking-widest">{soru.brans_adi}</span>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3" /> VERSIYON {soru.versiyon || 1}
                        </span>
                        {soru.zorluk_seviyesi && (
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest ${soru.zorluk_seviyesi === 'Zor' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            soru.zorluk_seviyesi === 'Orta' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                            {soru.zorluk_seviyesi}
                          </span>
                        )}
                      </div>

                      <div className="relative group">
                        {['tamamlandi', 'dizgi_tamam'].includes(soru.durum) && soru.final_png_url ? (
                          <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex justify-center group-hover:bg-white transition-colors duration-500">
                            <img src={soru.final_png_url} className="max-h-56 object-contain drop-shadow-2xl rounded-xl group-hover:scale-[1.03] transition-transform duration-500" alt="Final Out" />
                          </div>
                        ) : (
                          <div className="text-gray-800 text-sm font-semibold line-clamp-3 leading-relaxed tracking-tight group-hover:text-black transition-colors" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center font-black text-xs text-gray-400">
                              {soru.olusturan_ad?.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-gray-400 uppercase leading-none">Yazan</span>
                              <span className="text-xs font-bold text-gray-700">{soru.olusturan_ad}</span>
                            </div>
                          </div>
                          {soru.dizgici_ad && (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center font-black text-xs text-purple-400">
                                {soru.dizgici_ad?.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-purple-400 uppercase leading-none">Dizgi</span>
                                <span className="text-xs font-bold text-purple-700">{soru.dizgici_ad}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="ml-auto flex items-center gap-4">
                          {soru.fotograf_url && <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-500 rounded-xl border border-gray-100 font-black text-[9px] uppercase tracking-widest"><PhotoIcon className="w-4 h-4" /> GÖRSEL</div>}
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{new Date(soru.olusturulma_tarihi).toLocaleDateString('tr-TR')}</span>
                        </div>
                      </div>

                      {/* STATUS TRACKER */}
                      {soru.durum !== 'tamamlandi' && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${soru.onay_alanci ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-300 border border-gray-100'
                            }`}>
                            {soru.onay_alanci && <CheckCircleIcon className="w-3 h-3" />} Alan Kontrol
                          </div>
                          <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${soru.onay_dilci ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-300 border border-gray-100'
                            }`}>
                            {soru.onay_dilci && <CheckCircleIcon className="w-3 h-3" />} Dil Kontrol
                          </div>
                        </div>
                      )}

                      {/* CONTEXT ACTIONS */}
                      {user?.rol === 'soru_yazici' && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {['beklemede', 'revize_istendi', 'revize_gerekli'].includes(soru.durum) && (
                            <button onClick={() => handleDizgiyeGonder(soru.id)} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-purple-100 flex items-center gap-2 active:scale-95">
                              <RocketLaunchIcon className="w-4 h-4" strokeWidth={2.5} /> DİZGİYE GÖNDER
                            </button>
                          )}
                          {soru.durum === 'dizgi_tamam' && (
                            <button onClick={() => handleUpdateStatusIndividual(soru.id, 'alan_incelemede')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-orange-100 flex items-center gap-2 active:scale-95">
                              <MagnifyingGlassPlusIcon className="w-4 h-4" strokeWidth={2.5} /> ALAN İNCELEMEYE GÖNDER
                            </button>
                          )}
                          {soru.durum === 'dil_onaylandi' && (
                            <button onClick={() => handleOrtakHavuzaGonder(soru.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 active:scale-95">
                              <ArchiveBoxArrowDownIcon className="w-4 h-4" strokeWidth={2.5} /> ORTAK HAVUZA AKTAR
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ACTIONS - NOW ON RIGHT */}
                    <div className="flex lg:flex-col items-center justify-between lg:justify-start gap-4 lg:w-16">
                      <div
                        onClick={() => {
                          if (isSelected) setSelectedQuestions(selectedQuestions.filter(id => id !== soru.id));
                          else setSelectedQuestions([...selectedQuestions, soru.id]);
                        }}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all shadow-md active:scale-95 ${isSelected ? 'bg-blue-600 text-white shadow-blue-300' : 'bg-white border-2 border-blue-100 text-blue-400 hover:border-blue-600 hover:text-blue-600'
                          }`}
                        title="Seç"
                      >
                        {isSelected ? <CheckCircleIcon className="w-8 h-8" strokeWidth={2.5} /> : <div className="text-sm font-black uppercase tracking-tighter">SEC</div>}
                      </div>

                      <div className="flex flex-row lg:flex-col gap-3">
                        <button onClick={() => handleSil(soru.id)} className="p-4 bg-white border-2 border-rose-100 text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-2xl transition-all shadow-sm active:scale-95" title="Sil">
                          <TrashIcon className="w-6 h-6" strokeWidth={2.5} />
                        </button>

                        <Link to={`/sorular/${soru.id}${scope ? `?scope=${scope}` : ''}`} className="p-4 bg-blue-600 text-white rounded-2xl transition-all shadow-xl shadow-blue-200 hover:scale-105 hover:bg-blue-700 active:scale-95 flex items-center justify-center" title="Detay">
                          <ChevronRightIcon className="w-8 h-8" strokeWidth={3} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
