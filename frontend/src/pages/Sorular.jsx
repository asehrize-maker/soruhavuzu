import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI, userAPI } from '../services/api';
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
  PencilSquareIcon,
  CheckBadgeIcon
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
    olusturan_id: '',
  });

  const [authors, setAuthors] = useState([]);

  useEffect(() => {
    const loadAuthors = async () => {
      try {
        setAuthors([]); // Clear previous list
        const res = await userAPI.getAuthors();
        // Backend zaten filtreli gönderiyor, ekstra frontend filtresine gerek yok
        setAuthors(res.data.data || []);
      } catch (err) {
        console.error('Yazarlar yüklenemedi', err);
      }
    };
    if (user) loadAuthors();
  }, [user?.id]);

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
        olusturan_id: filters.olusturan_id || undefined,
        scope: scope || undefined
      };
      const response = await soruAPI.getAll(params);
      let data = response.data.data || [];

      // Custom Frontend Filtering for Workflow Groups
      if (filters.durum === 'incelemede_grubu') {
        data = data.filter(s => ['inceleme_bekliyor', 'alan_incelemede', 'dil_incelemede', 'incelemede'].includes(s.durum));
      } else if (filters.durum === 'taslak_grubu') {
        data = data.filter(s => ['beklemede'].includes(s.durum));
      } else if (filters.durum === 'dizgi_grubu') {
        data = data.filter(s => ['dizgi_bekliyor', 'dizgide'].includes(s.durum));
      } else if (filters.durum === 'dizgi_sonrasi') {
        data = data.filter(s => ['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam', 'revize_istendi', 'revize_gerekli'].includes(s.durum));
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

            <div className="flex items-center gap-3 min-w-[160px] flex-1 md:flex-none">
              <PencilSquareIcon className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
              <select
                value={filters.olusturan_id}
                onChange={(e) => setFilters({ ...filters, olusturan_id: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
              >
                <option value="">TÜM YAZARLAR</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>{a.ad_soyad}</option>
                ))}
              </select>
            </div>

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
                    <button onClick={() => handleBulkUpdateStatus('dil_incelemede', 'Dil İncelemeye Gönder')} className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-100 transition-all flex items-center gap-2 active:scale-95">
                      <CheckBadgeIcon className="w-4 h-4" strokeWidth={2.5} /> DİL İNCELEME
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
                        className={`group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all border border-gray-100 ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-50' : 'hover:border-indigo-200'
                          }`}
                      >
                        <div className="flex flex-col lg:flex-row gap-6">
                          {/* LEFT SIDE: THE ACTUAL QUESTION CONTENT */}
                          <div className="flex-1 min-w-0">
                            <div className="relative group h-full">
                              {['tamamlandi', 'dizgi_tamam'].includes(soru.durum) && soru.final_png_url ? (
                                <div className="bg-slate-50 rounded-2xl border border-slate-100 flex justify-center items-center p-4 h-full min-h-[200px] group-hover:bg-white transition-colors duration-500">
                                  <img src={soru.final_png_url} className="max-h-72 object-contain drop-shadow-lg rounded-lg" alt="Final Out" />
                                </div>
                              ) : (
                                <div className="flex flex-col gap-4">
                                  {soru.fotograf_url && !soru.soru_metni?.includes('<img') && (
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 w-fit">
                                      <img src={soru.fotograf_url} className="max-h-56 object-contain rounded-lg shadow-sm" alt="Soru Görseli" />
                                    </div>
                                  )}
                                  <div
                                    className="text-gray-900 text-base font-medium leading-relaxed group-hover:text-black transition-colors [&_img]:max-h-[400px] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:my-6 [&_img]:rounded-2xl [&_img]:shadow-lg"
                                    dangerouslySetInnerHTML={{
                                      __html: soru.soru_metni?.replace(/src="blob:[^"]+"/g, `src="${soru.fotograf_url || ''}"`)
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* RIGHT SIDE: QUESTION INFO & METADATA */}
                          <div className="lg:w-72 flex flex-col gap-5 lg:border-l lg:border-gray-50 lg:pl-6 bg-gray-50/30 rounded-2xl p-4 lg:p-0 lg:bg-transparent lg:rounded-none">
                            {/* 1. Status & Identity */}
                            <div className="space-y-3">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">DURUM</span>
                                <div className="flex flex-wrap items-center gap-2">
                                  {getDurumBadge(soru.durum)}
                                  <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 font-bold text-[9px]">
                                    v{soru.versiyon || 1}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">BRANŞ</span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[9px] font-black text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 uppercase tracking-wide truncate max-w-full">{soru.brans_adi}</span>
                                  {soru.kategori && (
                                    <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100 uppercase tracking-wide">
                                      {soru.kategori.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 2. Personnel */}
                            <div className="space-y-3">
                              <div className="flex flex-col gap-2">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">KATKIDA BULUNANLAR</span>
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px]">
                                      {soru.olusturan_ad?.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-gray-400 uppercase leading-none mb-0.5">YAZAR</span>
                                      <span className="text-[10px] font-bold text-gray-700 truncate max-w-[140px]">{soru.olusturan_ad}</span>
                                    </div>
                                  </div>
                                  {soru.dizgici_ad && (
                                    <div className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                                      <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-black text-[10px]">
                                        {soru.dizgici_ad?.charAt(0)}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-purple-400 uppercase leading-none mb-0.5">DİZGİCİ</span>
                                        <span className="text-[10px] font-bold text-purple-900 truncate max-w-[140px]">{soru.dizgici_ad}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 3. Usage & Date */}
                            <div className="flex items-center justify-between text-[9px] font-bold text-gray-300 uppercase tracking-widest pl-1 mt-auto">
                              <span>{new Date(soru.olusturulma_tarihi).toLocaleDateString('tr-TR')}</span>
                            </div>

                            {/* 4. Status Tracker */}
                            {soru.durum !== 'tamamlandi' && (
                              <div className="space-y-2 pt-3 border-t border-dashed border-gray-200">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block text-center">ONAYLAR</span>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wide flex items-center justify-center gap-1 ${soru.onay_alanci ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-300 border border-gray-100'}`}>
                                    <span>ALAN</span>
                                    {soru.onay_alanci && <CheckCircleIcon className="w-3 h-3" />}
                                  </div>
                                  <div className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wide flex items-center justify-center gap-1 ${soru.onay_dilci ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-300 border border-gray-100'}`}>
                                    <span>DİL</span>
                                    {soru.onay_dilci && <CheckCircleIcon className="w-3 h-3" />}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ACTIONS - Compact */}
                          <div className="flex lg:flex-col items-center lg:items-end gap-3 lg:w-14 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-gray-100 mt-2 lg:mt-0">
                            <div
                              onClick={() => {
                                if (isSelected) setSelectedQuestions(selectedQuestions.filter(id => id !== soru.id));
                                else setSelectedQuestions([...selectedQuestions, soru.id]);
                              }}
                              className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-sm active:scale-95 ${isSelected ? 'bg-indigo-600 text-white shadow-indigo-200 scale-105' : 'bg-white border-2 border-slate-100 text-slate-300 hover:border-indigo-500 hover:text-indigo-500'
                                }`}
                              title="Seç"
                            >
                              {isSelected ? <CheckCircleIcon className="w-7 h-7" strokeWidth={2.5} /> : <div className="text-xs font-black">SEÇ</div>}
                            </div>

                            <button onClick={() => handleSil(soru.id)} className="w-10 h-10 flex items-center justify-center bg-white border border-rose-100 text-rose-300 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-xl transition-all shadow-sm active:scale-95" title="Sil">
                              <TrashIcon className="w-5 h-5" strokeWidth={2} />
                            </button>

                            <Link to={`/sorular/${soru.id}${scope ? `?scope=${scope}` : ''}`} className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl transition-all hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-200 active:scale-95 flex items-center justify-center" title="Detay">
                              <ChevronRightIcon className="w-6 h-6" strokeWidth={3} />
                            </Link>
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
