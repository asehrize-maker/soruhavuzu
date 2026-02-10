import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  XMarkIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';

export default function Sorular({ scope }) {
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;

  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const isTakipModu = queryParams.get('takip') === '1';
  const urlDurum = queryParams.get('durum');

  const handleTestBuilder = () => {
    const selectedSoruObjects = sorular.filter(s => selectedQuestions.includes(s.id));
    navigate('/test-builder', { state: { selectedQuestions: selectedSoruObjects } });
  };

  const [sorular, setSorular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageLocation, setUsageLocation] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [branslar, setBranslar] = useState([]);
  const [filters, setFilters] = useState({
    durum: urlDurum || ((user?.rol === 'admin' && !isTakipModu) ? '' : (isTakipModu ? '' : (scope === 'brans' ? '' : 'tamamlandi'))),
    brans_id: '',
    zorluk_seviyesi: '',
    search: '',
    kazanim: '',
    kategori: '',
    kullanildi: '',
  });

  const [kazanimlar, setKazanimlar] = useState([]);
  const [kazanimSearch, setKazanimSearch] = useState('');
  const [isKazanimOpen, setIsKazanimOpen] = useState(false);
  const [allQuestionsForTracking, setAllQuestionsForTracking] = useState([]);
  const [statsForTracking, setStatsForTracking] = useState({});

  useEffect(() => {
    if (filters.brans_id) {
      bransAPI.getKazanims(filters.brans_id).then(res => {
        setKazanimlar(res.data.data || []);
      }).catch(err => console.error('Kazanımlar yüklenemedi:', err));
    } else {
      setKazanimlar([]);
    }
  }, [filters.brans_id]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      durum: urlDurum || (isTakipModu ? '' : (scope === 'brans' ? '' : 'tamamlandi'))
    }));
  }, [isTakipModu, scope, urlDurum]);

  const [selectedQuestions, setSelectedQuestions] = useState([]);
  // const [activeTab, setActiveTab] = useState(queryParams.get('tab') || 'taslaklar'); // Removed tab logic

  useEffect(() => {
    if (!user) return;
    const loadBranslar = async () => {
      try {
        const response = await bransAPI.getAll();
        setBranslar(response.data.data || []);
      } catch (error) {
        console.error('Branşlar yüklenemedi:', error);
      }
    };
    loadBranslar();
  }, [user?.id]);

  const loadSorular = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Bekleyen iş takibi modunda tüm bekleyenleri istatistik için çek
      if (isTakipModu) {
        const trackingResponse = await soruAPI.getAll({ scope: undefined });
        const allPending = trackingResponse.data.data.filter(s => s.durum !== 'tamamlandi' && s.durum !== 'arsiv');
        setAllQuestionsForTracking(allPending);

        const stats = {
          dizgi_bekliyor: allPending.filter(s => s.durum === 'dizgi_bekliyor').length,
          dizgide: allPending.filter(s => s.durum === 'dizgide' || s.durum === 'revize_istendi').length,
          inceleme_bekliyor: allPending.filter(s => s.durum === 'inceleme_bekliyor' || s.durum === 'incelemede').length,
          incelemede: allPending.filter(s => s.durum === 'alan_incelemede' || s.durum === 'dil_incelemede').length,
          onay_bekleyen: allPending.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam'].includes(s.durum)).length,
          revize_yazarda: allPending.filter(s => s.durum === 'revize_gerekli').length,
          taslak: allPending.filter(s => s.durum === 'beklemede').length
        };
        setStatsForTracking(stats);
      }

      const params = {
        durum: ['incelemede_grubu', 'taslak_grubu', 'dizgi_grubu', 'dizgi_sonrasi'].includes(filters.durum) ? undefined : (filters.durum || undefined),
        brans_id: filters.brans_id || undefined,
        zorluk_seviyesi: filters.zorluk_seviyesi || undefined,
        search: filters.search || undefined,
        kazanim: filters.kazanim || undefined,
        kategori: filters.kategori || undefined,
        kullanildi: filters.kullanildi || undefined,
        scope: scope || undefined
      };
      const response = await soruAPI.getAll(params);
      let data = response.data.data || [];

      // Custom Frontend Filtering for Workflow Groups
      if (filters.durum === 'incelemede_grubu') {
        data = data.filter(s => ['inceleme_bekliyor', 'alan_incelemede', 'dil_incelemede', 'incelemede'].includes(s.durum));
      } else if (filters.durum === 'taslak_grubu') {
        data = data.filter(s => ['beklemede', 'revize_gerekli'].includes(s.durum));
      } else if (filters.durum === 'dizgi_grubu') {
        data = data.filter(s => ['dizgi_bekliyor', 'dizgide', 'revize_istendi'].includes(s.durum));
      } else if (filters.durum === 'dizgi_sonrasi') {
        data = data.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam'].includes(s.durum));
      }

      if (scope === 'brans') {
        // Tamamlanmayan Sorular: 'tamamlandi' hariç her şey
        if (!filters.durum) {
          data = data.filter(s => s.durum !== 'tamamlandi');
        }
      }

      // Bekleyen İş Takibi Modu: Sadece aktif işlem bekleyenleri göster (Taslaklar ve Tamamlananlar hariç)
      if (isTakipModu && !filters.durum) {
        data = data.filter(s => [
          'dizgi_bekliyor',
          'dizgide',
          'dizgi_tamam',
          'alan_incelemede',
          'alan_onaylandi',
          'dil_incelemede',
          'dil_onaylandi',
          'inceleme_bekliyor',
          'incelemede',
          'inceleme_tamam',
          'revize_istendi',
          'revize_gerekli'
        ].includes(s.durum));
      }

      console.log(`Filter Mode: scope=${scope},isTakip=${isTakipModu},durum=${filters.durum},count=${data.length}`);

      if (effectiveRole === 'dizgici' && authUser?.rol !== 'admin') {
        data = data.filter(s => ['dizgi_bekliyor', 'dizgide', 'revize_istendi', 'dizgi_tamam'].includes(s.durum));
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
  }, [user?.id, effectiveRole, filters, scope]);

  const handleSil = async (id) => {
    if (window.confirm('Bu soruyu kalıcı olarak silmek istediğinize emin misiniz?')) {
      try {
        await soruAPI.delete(id);
        setSorular(sorular.filter(s => s.id !== id));
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.message || 'Silme işlemi başarısız oldu.';
        alert('Hata: ' + errorMsg);
      }
    }
  };

  const handleOrtakHavuzaGonder = async (id) => {
    if (!window.confirm('Bu soruyu tamamlanan sorulara aktarmak istediğinize emin misiniz?')) return;
    try {
      setLoading(true);
      await soruAPI.updateDurum(id, { yeni_durum: 'tamamlandi' });
      const response = await soruAPI.getAll({
        scope,
        brans_id: filters.brans_id || undefined,
        durum: filters.durum || undefined
      });
      setSorular(response.data.data || []);
      alert('Soru başarıyla tamamlanan sorulara aktarılmışır.');
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

  const handleBulkUpdateStatus = async (targetStatus, buttonLabel) => {
    if (selectedQuestions.length === 0) return;

    // Filtreleme mantığı: Sadece bu duruma geçebilecek soruları seç
    let eligibleQuestions = [];

    if (targetStatus === 'dizgi_bekliyor') {
      eligibleQuestions = selectedQuestions.filter(id => {
        const s = sorular.find(q => q.id === id);
        return ['beklemede', 'revize_istendi', 'revize_gerekli'].includes(s?.durum);
      });
    } else if (targetStatus === 'alan_incelemede') {
      eligibleQuestions = selectedQuestions.filter(id => {
        const s = sorular.find(q => q.id === id);
        return ['dizgi_tamam', 'dil_onaylandi'].includes(s?.durum);
      });
    } else if (targetStatus === 'dil_incelemede') {
      eligibleQuestions = selectedQuestions.filter(id => {
        const s = sorular.find(q => q.id === id);
        return ['alan_onaylandi'].includes(s?.durum);
      });
    } else if (targetStatus === 'tamamlandi') {
      eligibleQuestions = selectedQuestions.filter(id => {
        const s = sorular.find(q => q.id === id);
        return ['dil_onaylandi'].includes(s?.durum);
      });
    } else {
      eligibleQuestions = selectedQuestions;
    }

    if (eligibleQuestions.length === 0) {
      alert(`Seçilen sorular arasında "${buttonLabel}" işlemine uygun soru bulunamadı.`);
      return;
    }

    if (!window.confirm(`${eligibleQuestions.length} soru için "${buttonLabel}" işlemi yapılacak. Emin misiniz?`)) return;

    try {
      setLoading(true);
      const results = await Promise.allSettled(eligibleQuestions.map(id => soruAPI.updateDurum(id, { yeni_durum: targetStatus })));
      const failed = results.filter(r => r.status === 'rejected');
      const succeeded = results.filter(r => r.status === 'fulfilled');

      if (failed.length > 0) {
        const firstError = failed[0].reason?.response?.data?.error || failed[0].reason?.message || 'Bilinmeyen hata';
        alert(`${failed.length} işlem başarısız oldu. Hata: ${firstError}`);
      }

      if (succeeded.length > 0) {
        loadSorular();
        setSelectedQuestions([]);
      }
    } catch (error) {
      alert('İşlem sırasında beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };
  const handleBulkMarkUsed = async () => {
    if (selectedQuestions.length === 0 || !usageLocation) return;

    try {
      setBulkUpdating(true);
      await soruAPI.updateBulkUsage({
        ids: selectedQuestions,
        kullanildi: true,
        kullanim_alani: usageLocation
      });
      setShowUsageModal(false);
      setUsageLocation('');
      setSelectedQuestions([]);
      loadSorular();
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      alert('Güncelleme sırasında bir hata oluştu: ' + errorMsg);
    } finally {
      setBulkUpdating(false);
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

  const renderTrackerGrid = () => {
    if (!isTakipModu) return null;

    const cards = [
      { id: 'taslak', label: 'TASLAK HAVUZU', count: statsForTracking.taslak, icon: '✍️', color: 'bg-gray-50 text-gray-400 border-gray-100', filter: 'taslak_grubu' },
      { id: 'revize', label: 'YAZAR REVİZE', count: statsForTracking.revize_yazarda, icon: '⚠️', color: 'bg-red-50 text-red-600 border-red-100', filter: 'revize_gerekli' },
      { id: 'dizgi_bekliyor', label: 'DİZGİ SIRASI', count: statsForTracking.dizgi_bekliyor, icon: '⚙️', color: 'bg-purple-50 text-purple-600 border-purple-100', filter: 'dizgi_bekliyor' },
      { id: 'dizgide', label: 'DİZGİDE / REVİZE', count: statsForTracking.dizgide, icon: '🖍️', color: 'bg-orange-50 text-orange-600 border-orange-100', filter: 'dizgi_grubu' },
      { id: 'inceleme_bekliyor', label: 'İNCELEME SIRASI', count: statsForTracking.inceleme_bekliyor, icon: '⏳', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', filter: 'inceleme_bekliyor' },
      { id: 'incelemede', label: 'İNCELEMEDE', count: statsForTracking.incelemede, icon: '🔍', color: 'bg-blue-50 text-blue-600 border-blue-100', filter: 'incelemede_grubu' },
      { id: 'onay_bekleyen', label: 'ONAY BEKLEYEN', count: statsForTracking.onay_bekleyen, icon: '🚀', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', filter: 'dizgi_sonrasi' },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-10">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => setFilters({ ...filters, durum: card.filter })}
            className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center text-center group relative h-40 ${filters.durum === card.filter ? 'border-blue-600 shadow-xl shadow-blue-50 scale-[1.02]' : `${card.color} hover:scale-[1.05] hover:shadow-lg`}`}
          >
            <span className="text-2xl mb-2">{card.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-widest leading-tight mb-1">{card.label}</span>
            <span className="text-3xl font-black">{card.count || 0}</span>
            {filters.durum === card.filter && (
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1.5 rounded-full shadow-lg">
                <CheckCircleIcon className="w-4 h-4" strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>
    );
  };


  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* HEADER AREA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <div className="flex items-center gap-4 mb-2">
            {(user?.rol === 'admin' || isTakipModu) && (filters.brans_id || filters.durum) && (
              <button onClick={() => setFilters({ ...filters, brans_id: '', durum: isTakipModu ? '' : filters.durum })} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-all shadow-sm">
                <ChevronRightIcon className="w-6 h-6 rotate-180" strokeWidth={3} />
              </button>
            )}
            <div className="flex flex-col">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                {isTakipModu ? <ArrowPathIcon className="w-10 h-10 text-amber-500" /> : <InboxIcon className="w-10 h-10 text-blue-600" />}
                {isTakipModu ? 'Bekleyen İş Takibi' : (scope === 'brans' ? 'Tamamlanmayan Sorular' : 'Tamamlanan Sorular')}
              </h1>
              {user?.rol === 'admin' && (filters.brans_id || (isTakipModu && filters.durum)) && (
                <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                  {filters.brans_id ? `${branslar.find(b => b.id == filters.brans_id)?.brans_adi} BİRİMİ` : ''}
                  {isTakipModu && filters.durum ? `FİLTRE: ${filters.durum === 'taslak_grubu' ? 'TASLAKLAR' : filters.durum.toUpperCase()}` : 'GENEL TAKİP'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {renderTrackerGrid()}

      {/* FILTER & TOOLS */}
      {!isTakipModu && (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            {(scope === 'brans' || isTakipModu) && (
              <div className="flex items-center gap-3 min-w-[160px] flex-1 md:flex-none">
                <FunnelIcon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
                <select
                  value={filters.durum}
                  onChange={(e) => setFilters({ ...filters, durum: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
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
            )}

            {effectiveRole !== 'soru_yazici' && (
              <div className="flex items-center gap-3 min-w-[160px] flex-1 md:flex-none">
                <Squares2X2Icon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
                <select
                  value={filters.brans_id}
                  onChange={(e) => setFilters({ ...filters, brans_id: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="">TÜM BRANŞLAR</option>
                  {branslar.map((brans) => (
                    <option key={brans.id} value={brans.id}>{brans.brans_adi}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 min-w-[200px] flex-1 md:flex-none relative">
              <SparklesIcon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
              <div className="relative w-full">
                <input
                  type="text"
                  value={filters.kazanim}
                  onFocus={() => setIsKazanimOpen(true)}
                  onChange={(e) => {
                    setFilters({ ...filters, kazanim: e.target.value });
                    setKazanimSearch(e.target.value);
                    setIsKazanimOpen(true);
                  }}
                  placeholder="KAZANIM SEÇ..."
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                />

                {isKazanimOpen && (
                  <div className="absolute z-[100] mt-2 w-full max-h-60 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-y-auto no-scrollbar py-2 animate-scale-up">
                    <div
                      className="px-5 py-3 text-[10px] font-black text-blue-600 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex items-center justify-between group"
                      onClick={() => setIsKazanimOpen(false)}
                    >
                      <span>"{filters.kazanim || 'Filtreyi Temizle'}" OLARAK ARA</span>
                      <PencilSquareIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {kazanimlar
                      .filter(k =>
                        !kazanimSearch ||
                        k.aciklama.toLowerCase().includes(kazanimSearch.toLowerCase()) ||
                        k.kod.toLowerCase().includes(kazanimSearch.toLowerCase())
                      )
                      .map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setFilters({ ...filters, kazanim: item.kod });
                            setKazanimSearch(item.kod);
                            setIsKazanimOpen(false);
                          }}
                          className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex flex-col gap-1 transition-colors"
                        >
                          <span className="text-[10px] font-black text-gray-900 border-b border-gray-100 pb-1 w-fit mb-1">{item.kod}</span>
                          <span className="text-[9px] font-bold text-gray-500 leading-relaxed uppercase">{item.aciklama}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              {isKazanimOpen && (
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setIsKazanimOpen(false)}
                />
              )}
            </div>

            <div className="flex items-center gap-3 min-w-[160px] flex-1 md:flex-none">
              <SparklesIcon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
              <select
                value={filters.zorluk_seviyesi}
                onChange={(e) => setFilters({ ...filters, zorluk_seviyesi: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
              >
                <option value="">TÜM ZORLUKLAR</option>
                <option value="1">⭐ ÇOK KOLAY (1)</option>
                <option value="2">⭐⭐ KOLAY (2)</option>
                <option value="3">⭐⭐⭐ ORTA (3)</option>
                <option value="4">⭐⭐⭐⭐ ZOR (4)</option>
                <option value="5">🔥🔥🔥 ÇOK ZOR (5)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 min-w-[160px] flex-1 md:flex-none">
              <ArchiveBoxArrowDownIcon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
              <select
                value={filters.kategori}
                onChange={(e) => setFilters({ ...filters, kategori: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
              >
                <option value="">TÜM KATEGORİLER</option>
                <option value="deneme">DENEME</option>
                <option value="fasikul">FASİKÜL</option>
                <option value="yaprak_test">YAPRAK TEST</option>
              </select>
            </div>

            <div className="flex items-center gap-3 min-w-[160px] flex-1 md:flex-none">
              <CheckCircleIcon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
              <select
                value={filters.kullanildi}
                onChange={(e) => setFilters({ ...filters, kullanildi: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
              >
                <option value="">TÜM KULLANIMLAR</option>
                <option value="true">KULLANILANLAR</option>
                <option value="false">KULLANILMAYANLAR</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {
        (!isTakipModu || (isTakipModu && filters.durum)) && (
          <div className="flex flex-wrap items-center gap-3">
            {selectedQuestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {scope === 'brans' && (
                  <>
                    <button onClick={() => handleBulkUpdateStatus('dizgi_bekliyor', 'Dizgiye Gönder')} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-100 transition-all flex items-center gap-2 active:scale-95">
                      <RocketLaunchIcon className="w-4 h-4" strokeWidth={2.5} /> DİZGİYE GÖNDER
                    </button>
                    <button onClick={() => handleBulkUpdateStatus('alan_incelemede', 'Alan İncelemeye Gönder')} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-100 transition-all flex items-center gap-2 active:scale-95">
                      <MagnifyingGlassPlusIcon className="w-4 h-4" strokeWidth={2.5} /> ALAN İNCELEME
                    </button>
                  </>
                )}
                {scope !== 'brans' && (
                  <>
                    <button onClick={handleTestBuilder} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 transition-all flex items-center gap-2 active:scale-95">
                      <SparklesIcon className="w-4 h-4" strokeWidth={2.5} /> SAYFA TASARLA
                    </button>
                    <button onClick={() => setShowUsageModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all flex items-center gap-2 active:scale-95">
                      <CheckCircleIcon className="w-4 h-4" strokeWidth={2.5} /> KULLANILDI İŞARETLE
                    </button>
                  </>
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
              <input
                placeholder="SORU ARA..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="bg-gray-50 border-none rounded-2xl pl-12 pr-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:ring-4 focus:ring-blue-500/10 transition-all w-[180px]"
              />
            </div>
          </div>
        )
      }

      {/* QUESTION LIST */}
      {
        (!isTakipModu || (isTakipModu && filters.durum)) && (
          <>
            {loading ? (
              <div className="py-40 text-center">
                <ArrowPathIcon className="w-12 h-12 text-blue-100 animate-spin mx-auto mb-4" strokeWidth={3} />
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Sisteme Bağlanılıyor...</p>
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
                              {soru.kategori && (
                                <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100 uppercase tracking-widest">
                                  {soru.kategori.replace('_', ' ')}
                                </span>
                              )}
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic flex items-center gap-1">
                                <SparklesIcon className="w-3 h-3" /> VERSIYON {soru.versiyon || 1}
                              </span>

                            </div>

                            {soru.kullanildi && (
                              <div className="bg-emerald-50/80 border border-emerald-200 rounded-3xl p-5 flex items-center justify-between shadow-sm animate-fade-in group-hover:bg-white transition-colors duration-500">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <CheckCircleIcon className="w-6 h-6 text-white" strokeWidth={3} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">KULLANIM BİLGİSİ</span>
                                    <span className="text-xs font-black text-emerald-900 line-clamp-1">{soru.kullanim_alani || 'Kullanım yeri belirtilmedi'}</span>
                                  </div>
                                </div>
                                <span className="text-[9px] font-black text-emerald-600/40 uppercase tracking-[0.2em] italic mr-2 hidden sm:block">BU SORU SEÇİLEREK KULLANILMIŞTIR</span>
                              </div>
                            )}

                            <div className="relative group">
                              {['tamamlandi', 'dizgi_tamam'].includes(soru.durum) && soru.final_png_url ? (
                                <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex justify-center group-hover:bg-white transition-colors duration-500">
                                  <img src={soru.final_png_url} className="max-h-56 object-contain drop-shadow-2xl rounded-xl group-hover:scale-[1.03] transition-transform duration-500" alt="Final Out" />
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3">
                                  {/* Eğer metin içinde img etiketi yoksa ve fotoğraf varsa göster */}
                                  {soru.fotograf_url && !soru.soru_metni?.includes('<img') && (
                                    <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100 w-fit">
                                      <img src={soru.fotograf_url} className="max-h-48 object-contain rounded-lg shadow-sm" alt="Soru Görseli" />
                                    </div>
                                  )}
                                  <div
                                    className={`text-gray-800 text-sm font-semibold leading-relaxed tracking-tight group-hover:text-black transition-colors [&_img]:max-h-[300px] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:my-4 [&_img]:rounded-xl [&_img]:shadow-md`}
                                    dangerouslySetInnerHTML={{
                                      __html: soru.soru_metni?.replace(/src="blob:[^"]+"/g, `src="${soru.fotograf_url || ''}"`)
                                    }}
                                  />
                                </div>
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
                              <div className="flex flex-col gap-3 mt-4 p-4 bg-gray-50/50 rounded-[1.5rem] border border-gray-100 transition-colors group-hover:bg-white">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">BULUNDUĞU AŞAMA:</span>
                                    {getDurumBadge(soru.durum)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${soru.onay_alanci ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-300 border border-gray-100'
                                    }`}>
                                    {soru.onay_alanci ? <CheckCircleIcon className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current opacity-20" />} ALAN KONTROLÜ
                                  </div>
                                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${soru.onay_dilci ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-300 border border-gray-100'
                                    }`}>
                                    {soru.onay_dilci ? <CheckCircleIcon className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current opacity-20" />} DİL KONTROLÜ
                                  </div>
                                </div>
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
          </>
        )
      }

      {/* USAGE MODAL */}
      {
        showUsageModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
              <div className="p-6 bg-emerald-600 text-white flex justify-between items-center px-8">
                <h5 className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5" /> Kullanıldı İşaretle
                </h5>
                <button onClick={() => setShowUsageModal(false)} className="hover:bg-white/10 p-2 rounded-xl transition-all">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 text-center">
                    SEÇİLEN SORU SAYISI
                  </p>
                  <p className="text-2xl font-black text-emerald-900 text-center">{selectedQuestions.length}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">KULLANIM YERİ / ETKİNLİK ADI</label>
                  <input
                    autoFocus
                    className="w-full bg-gray-50 border-2 border-gray-100 focus:border-emerald-600 rounded-2xl p-4 text-sm font-bold text-gray-800 outline-none transition-all"
                    placeholder="Örn: 2024 Mart Denemesi, 5. Fasikül"
                    value={usageLocation}
                    onChange={(e) => setUsageLocation(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBulkMarkUsed(); }}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUsageModal(false)}
                    className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    İPTAL
                  </button>
                  <button
                    onClick={handleBulkMarkUsed}
                    disabled={!usageLocation || bulkUpdating}
                    className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {bulkUpdating ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      'İŞLEMİ TAMAMLA'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
