import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI, userAPI, authAPI, ekipAPI } from '../services/api';
import { translateKey, getDurumBadge } from '../utils/helpers';
import {
  ArrowPathIcon,
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon,
  PencilSquareIcon,
  InformationCircleIcon,
  XMarkIcon,
  MegaphoneIcon,
  MagnifyingGlassPlusIcon,
  SparklesIcon,
  CursorArrowRaysIcon,
  ListBulletIcon
} from '@heroicons/react/24/outline';

const normalizeZorlukToScale = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).toLowerCase();
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num)) return Math.min(Math.max(num, 1), 5);
  if (raw.includes('kolay')) return 2;
  if (raw.includes('orta')) return 3;
  if (raw.includes('zor')) return 4;
  return null;
};



// --- ALT BİLEŞEN: İNCELEME LİSTESİ ---
function IncelemeListesi({ bransId, bransAdi, reviewMode }) {
  const [sorular, setSorular] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const { user: authUser } = useAuthStore();

  useEffect(() => {
    const fetchSorular = async () => {
      setListLoading(true);
      try {
        const response = await soruAPI.getAll();
        const allQuestions = response.data.data || [];
        const filtered = allQuestions.filter(s => {
          if (bransId && parseInt(s.brans_id) !== parseInt(bransId)) return false;
          if (reviewMode === 'alanci') return ['alan_incelemede', 'inceleme_bekliyor', 'incelemede', 'revize_istendi'].includes(s.durum);
          if (reviewMode === 'dilci') return ['dil_incelemede', 'inceleme_bekliyor', 'incelemede', 'revize_istendi'].includes(s.durum);
          return true;
        });
        setSorular(filtered);
      } catch (err) { } finally { setListLoading(false); }
    };
    fetchSorular();
  }, [bransId, reviewMode, authUser]);

  if (listLoading) return <div className="flex justify-center p-20"><ArrowPathIcon className="w-10 h-10 text-blue-200 animate-spin" /></div>;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <DocumentTextIcon className="w-6 h-6 text-blue-600" /> {bransAdi || 'Tüm Sorular'}
        </h3>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{sorular.length} Soru Bulundu</span>
      </div>

      {sorular.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
          <BookOpenIcon className="w-12 h-12 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">İncelenecek soru kalmadı!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-1">
          {sorular.map(soru => {
            const zorluk = normalizeZorlukToScale(soru.zorluk_seviyesi);
            const isPng = soru.soru_metni?.includes('<img');

            return (
              <Link
                key={soru.id}
                to={`/sorular/${soru.id}?incelemeTuru=${reviewMode}`}
                className="group flex flex-col gap-4 p-5 bg-white rounded-[2rem] border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all relative overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest rounded-md">#{soru.id}</span>
                  {!bransAdi && (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-black uppercase tracking-widest rounded-md max-w-[120px] truncate">
                      {soru.brans_adi}
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-md">{soru.kategori || 'GENEL'}</span>
                  <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${zorluk > 3 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                    }`}>
                    {zorluk > 3 ? 'ZOR' : 'NORMAL'}
                  </span>
                  {getDurumBadge(soru.durum)}
                </div>

                <div
                  className="text-gray-600 text-xs font-semibold line-clamp-2 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: isPng ? "<i>🖼️ Görsel İçerikli Soru</i>" : (soru.soru_metni?.replace(/<[^>]*>?/gm, '').substring(0, 150) || 'Metinsiz') }}
                />

                <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-auto">
                  <span className="text-[9px] font-bold text-gray-400 italic">Yazar: {soru.olusturan_ad || 'Bilinmiyor'}</span>
                  <ArrowPathIcon className="w-3 h-3 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function Dashboard() {
  // 1. ALL HOOKS
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlMode = searchParams.get('mode');

  const { user } = useAuthStore();
  const outletContext = useOutletContext();
  const effectiveRoleFromContext = outletContext?.effectiveRole;

  const rawRole = (user?.rol === 'admin' && effectiveRoleFromContext)
    ? effectiveRoleFromContext
    : (user?.rol || effectiveRoleFromContext);

  // UI blokları için rolü normalleştiriyoruz (alan_incelemeci/dil_incelemeci -> incelemeci)
  const activeRole = ['alan_incelemeci', 'dil_incelemeci', 'incelemeci'].includes(rawRole)
    ? 'incelemeci'
    : rawRole;

  const [stats, setStats] = useState(null);
  const [detayliStats, setDetayliStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [incelemeBransCounts, setIncelemeBransCounts] = useState([]);
  const [selectedBrans, setSelectedBrans] = useState(null);
  const [selectedEkip, setSelectedEkip] = useState(null);
  const [activeQuickView, setActiveQuickView] = useState(null);
  const [panelConfig, setPanelConfig] = useState(null);

  // --- ALT BİLEŞEN: HIZLI LİSTE PANELİ (INLINE) ---
  const QuickViewPanel = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!activeQuickView) return;
      const fetchData = async () => {
        setLoading(true);
        try {
          let res;
          if (activeQuickView.type === 'soru') res = await soruAPI.getAll();
          else if (activeQuickView.type === 'kullanici') res = await userAPI.getAll();
          else if (activeQuickView.type === 'brans') res = await bransAPI.getAll();
          else if (activeQuickView.type === 'ekip') res = await ekipAPI.getAll();

          setData(res.data.data || []);
        } catch (err) {
          console.error("QuickView error:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, [activeQuickView]);

    if (!activeQuickView) return null;

    return (
      <div className="bg-white rounded-[2.5rem] border-2 border-blue-50 shadow-xl shadow-blue-500/5 overflow-hidden animate-slide-down">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase italic flex items-center gap-3">
              <ListBulletIcon className="w-6 h-6 text-blue-600" /> {activeQuickView.title}
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Sistemde kayıtlı tüm veriler aşağıda listelenmiştir</p>
          </div>
          <button
            onClick={() => setActiveQuickView(null)}
            className="p-3 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all border border-gray-100 font-bold text-[10px] flex items-center gap-2 uppercase tracking-widest"
          >
            Paneli Kapat <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3">
              <ArrowPathIcon className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Veriler çekiliyor...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-black text-[10px] uppercase tracking-widest italic opacity-50">Henüz veri bulunmuyor.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.map((item, idx) => (
                <div key={item.id || idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between group hover:bg-white hover:border-blue-200 hover:shadow-md transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-black text-gray-800 line-clamp-1">
                      {activeQuickView.type === 'soru' ? (item.soru_metni?.replace(/<[^>]*>?/gm, '').substring(0, 80) || 'Metinsiz Soru') :
                        activeQuickView.type === 'kullanici' ? item.ad_soyad :
                          activeQuickView.type === 'brans' ? item.brans_adi :
                            item.ekip_adi || 'İsimsiz Ekip'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {activeQuickView.type === 'soru' ? `ID: #${item.id} | ${item.brans_adi || 'Branşsız'}` :
                          activeQuickView.type === 'kullanici' ? `${item.rol?.toUpperCase()} | ${item.email}` :
                            activeQuickView.type === 'brans' ? (item.ekip_adi || 'Ekipsiz') :
                              `PERSONEL: ${item.kullanici_sayisi || 0} | BRANŞ: ${item.brans_sayisi || 0}`}
                      </span>
                      {activeQuickView.type === 'soru' && getDurumBadge(item.durum)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-blue-50/50 text-center border-t border-blue-100 flex items-center justify-center gap-3">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
          <p className="text-[9px] font-black text-blue-600/60 uppercase tracking-[0.2em]">Özet Görünüm (Detaylı işlemler için yan menüdeki ilgili sayfaları kullanın)</p>
        </div>
      </div>
    );
  };

  // Otomatik mod tespiti (State yerine memo kullanalım)
  const reviewMode = useMemo(() => {
    if (rawRole === 'alan_incelemeci') return 'alanci';
    if (rawRole === 'dil_incelemeci') return 'dilci';
    if (user?.inceleme_alanci && !user?.inceleme_dilci) return 'alanci';
    if (!user?.inceleme_alanci && user?.inceleme_dilci) return 'dilci';
    // Admin veya belirsiz için varsayılan
    if (user?.rol === 'admin') return 'alanci';
    return null;
  }, [rawRole, user]);

  const isActualAdmin = user?.rol === 'admin';
  const canAlanInceleme = isActualAdmin || !!user?.inceleme_alanci || rawRole === 'alan_incelemeci' || rawRole === 'incelemeci';
  const canDilInceleme = isActualAdmin || !!user?.inceleme_dilci || rawRole === 'dil_incelemeci' || rawRole === 'incelemeci';

  const fetchData = useCallback(async () => {
    if (!activeRole) return;
    setLoading(true);
    try {
      if (activeRole === 'admin' || activeRole === 'koordinator') {
        const res = await soruAPI.getDetayliStats();
        if (res.data.success) setDetayliStats(res.data.data);
      } else {
        const res = await soruAPI.getStats({ role: activeRole });
        if (res.data.success) setStats(res.data.data);
      }

      // İncelemeci veya Admin için detaylı inceleme istatistikleri
      if (activeRole === 'incelemeci' || activeRole === 'admin') {
        try {
          const res = await soruAPI.getIncelemeDetayliStats();
          if (res.data.success) setIncelemeBransCounts(res.data.data);
        } catch (e) { console.warn("İnceleme stats alınamadı", e); }
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }, [activeRole]);

  // Dashboard verilerini yenile
  useEffect(() => { fetchData(); }, [fetchData]);

  // Config yükle
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await authAPI.getConfig();
        if (res.data.success) setPanelConfig(res.data.data);
      } catch (err) { console.warn("Config load error", err); }
    };
    fetchConfig();
  }, []);

  const { groupedTeams, teamAggregates, reviewStatsByStatus } = useMemo(() => {
    const rawData = incelemeBransCounts || [];

    // Grouping for Incelemeci Dashboard (Bekleyen vs Tamamlanan)
    const stats = {
      bekleyen: {},
      tamamlanan: {}
    };

    rawData.forEach(item => {
      const isAlanci = reviewMode === 'alanci';
      const bCount = isAlanci ? Number(item.alanci_bekleyen) : Number(item.dilci_bekleyen);
      const tCount = isAlanci ? Number(item.alanci_tamamlanan) : Number(item.dilci_tamamlanan);
      const bName = item.brans_adi;
      const cat = item.kategori || 'Belirsiz';

      if (bCount > 0) {
        if (!stats.bekleyen[bName]) stats.bekleyen[bName] = { total: 0, categories: {} };
        stats.bekleyen[bName].total += bCount;
        stats.bekleyen[bName].categories[cat] = (stats.bekleyen[bName].categories[cat] || 0) + bCount;
        stats.bekleyen[bName].id = item.brans_id;
      }
      if (tCount > 0) {
        if (!stats.tamamlanan[bName]) stats.tamamlanan[bName] = { total: 0, categories: {} };
        stats.tamamlanan[bName].total += tCount;
        stats.tamamlanan[bName].categories[cat] = (stats.tamamlanan[bName].categories[cat] || 0) + tCount;
        stats.tamamlanan[bName].id = item.brans_id;
      }
    });

    // Existing grouping logic for team filtering (optional, but keep for compatibility if needed elsewhere)
    const grouped = rawData.reduce((acc, item) => {
      const ekipAdi = item.ekip_adi || 'Ekipsiz Branşlar';
      if (!acc[ekipAdi]) acc[ekipAdi] = [];
      acc[ekipAdi].push(item);
      return acc;
    }, {});

    const aggregates = Object.entries(grouped).map(([ekipAdi, items]) => {
      const totalPending = items.reduce((sum, item) => {
        return sum + (reviewMode === 'alanci' ? (Number(item.alanci_bekleyen) || 0) : (Number(item.dilci_bekleyen) || 0));
      }, 0);
      return { ekipAdi, totalPending, items };
    });

    return { groupedTeams: grouped, teamAggregates: aggregates, reviewStatsByStatus: stats };
  }, [incelemeBransCounts, reviewMode]);

  const [expandedBranch, setExpandedBranch] = useState(null);

  const groupedBranchStats = useMemo(() => {
    if (!detayliStats?.branslar) return [];

    const groups = {};
    detayliStats.branslar.forEach(item => {
      const id = item.id;
      if (!groups[id]) {
        groups[id] = {
          id: id,
          brans_adi: item.brans_adi,
          teams: [],
          total: {
            soru: 0, taslak: 0, dizgi: 0, dizgi_sonrasi: 0, alan_inceleme: 0,
            dil_inceleme: 0, tamamlandi: 0
          }
        };
      }
      groups[id].teams.push(item);
      groups[id].total.soru += Number(item.soru_sayisi || 0);
      groups[id].total.taslak += Number(item.taslak || 0);
      groups[id].total.dizgi += Number(item.dizgi || 0);
      groups[id].total.dizgi_sonrasi += Number(item.dizgi_sonrasi || 0);
      groups[id].total.alan_inceleme += Number(item.alan_inceleme || 0);
      groups[id].total.dil_inceleme += Number(item.dil_inceleme || 0);
      groups[id].total.tamamlandi += Number(item.tamamlandi || 0);
    });

    return Object.values(groups).sort((a, b) => b.total.soru - a.total.soru);
  }, [detayliStats]);

  const [reindexing, setReindexing] = useState(false);

  const handleReindex = async () => {
    if (!window.confirm("Tüm soru numaraları sıfırdan başlanarak ardışık olarak yeniden düzenlenecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?")) return;

    setReindexing(true);
    try {
      const response = await soruAPI.adminCleanup({ action: 'reindex' });
      alert(response.data.message || "İşlem başarılı.");
      fetchData(); // İstatistikleri yenile
    } catch (err) {
      alert("Hata: " + (err.response?.data?.error || err.message));
    } finally {
      setReindexing(false);
    }
  };

  // 2. CONDITIONAL RENDERING (After all hooks)
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  // 3. RENDER
  return (
    <div className="space-y-6">
      {/* GLOBAL DASHBOARD ALERT */}
      {panelConfig?.panel_duyuru_aktif === 'true' && panelConfig?.panel_duyuru_mesaj && (
        <div className={`p-5 rounded-3xl border-2 shadow-sm flex items-start gap-4 animate-bounce-short ${panelConfig.panel_duyuru_tip === 'success' ? 'bg-green-50 border-green-100 text-green-800' :
          panelConfig.panel_duyuru_tip === 'warning' ? 'bg-orange-50 border-orange-100 text-orange-800' :
            panelConfig.panel_duyuru_tip === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
              'bg-blue-50 border-blue-100 text-blue-800'
          }`}>
          <div className={`p-3 rounded-2xl flex-shrink-0 ${panelConfig.panel_duyuru_tip === 'success' ? 'bg-green-100 text-green-600' :
            panelConfig.panel_duyuru_tip === 'warning' ? 'bg-orange-100 text-orange-600' :
              panelConfig.panel_duyuru_tip === 'error' ? 'bg-red-100 text-red-600' :
                'bg-blue-100 text-blue-600'
            }`}>
            <MegaphoneIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 pt-1">
            <h4 className="font-black uppercase tracking-widest text-xs mb-1">
              {panelConfig.panel_duyuru_baslik || 'Sistem Duyurusu'}
            </h4>
            <p className="text-sm font-bold opacity-90 leading-relaxed">
              {panelConfig.panel_duyuru_mesaj}
            </p>
          </div>
          <button
            onClick={() => setPanelConfig(prev => ({ ...prev, panel_duyuru_aktif: 'false' }))}
            className="p-2 hover:bg-black/5 rounded-xl transition-colors"
          >
            <XMarkIcon className="w-5 h-5 opacity-40" />
          </button>
        </div>
      )}

      {(activeRole === 'admin' || activeRole === 'koordinator') ? (
        <div className="space-y-8 animate-fade-in">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800">
              {user?.rol === 'koordinator' ? 'Ekip Yönetim Paneli' : 'Sistem Yönetim Paneli'}
            </h1>
            <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div onClick={() => setActiveQuickView(activeQuickView?.type === 'soru' ? null : { type: 'soru', title: 'Tüm Sorular Listesi' })} className={`card p-6 cursor-pointer hover:scale-105 transition shadow-lg ${activeQuickView?.type === 'soru' ? 'bg-blue-800 ring-4 ring-blue-500/30' : 'bg-blue-600'} text-white`}>
              <p className="text-blue-100 text-xs font-bold uppercase">TOPLAM SORU</p>
              <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.genel?.toplam_soru || 0}</h3>
            </div>
            <div onClick={() => setActiveQuickView(activeQuickView?.type === 'kullanici' ? null : { type: 'kullanici', title: 'Kullanıcı Listesi' })} className={`card p-6 cursor-pointer hover:scale-105 transition shadow-lg ${activeQuickView?.type === 'kullanici' ? 'bg-emerald-800 ring-4 ring-emerald-500/30' : 'bg-emerald-600'} text-white`}>
              <p className="text-emerald-100 text-xs font-bold uppercase">
                {user?.rol === 'koordinator' ? 'EKİP PERSONELİ' : 'KULLANICILAR'}
              </p>
              <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.sistem?.toplam_kullanici || 0}</h3>
            </div>
            <div onClick={() => setActiveQuickView(activeQuickView?.type === 'brans' ? null : { type: 'brans', title: 'Branş Listesi' })} className={`card p-6 cursor-pointer hover:scale-105 transition shadow-lg ${activeQuickView?.type === 'brans' ? 'bg-purple-800 ring-4 ring-purple-500/30' : 'bg-purple-600'} text-white`}>
              <p className="text-purple-100 text-xs font-bold uppercase">
                {user?.rol === 'koordinator' ? 'EKİP BRANŞLARI' : 'BRANŞLAR'}
              </p>
              <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.sistem?.toplam_brans || 0}</h3>
            </div>
            {user?.rol === 'admin' && (
              <div onClick={() => setActiveQuickView(activeQuickView?.type === 'ekip' ? null : { type: 'ekip', title: 'Ekip Listesi' })} className={`card p-6 cursor-pointer hover:scale-105 transition shadow-lg ${activeQuickView?.type === 'ekip' ? 'bg-orange-800 ring-4 ring-orange-500/30' : 'bg-orange-600'} text-white`}>
                <p className="text-orange-100 text-xs font-bold uppercase">EKİPLER</p>
                <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.sistem?.toplam_ekip || 0}</h3>
              </div>
            )}
          </div>

          {/* HIZLI LİSTE PANELİ BURADA GÖRÜNECEK */}
          <QuickViewPanel />

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">📊 İş Akış Özeti</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
              <Link to="/brans-havuzu?tab=taslaklar" className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition group">
                <p className="text-xs font-bold text-gray-400 group-hover:text-blue-500 transition uppercase">TASLAK</p>
                <p className="text-2xl font-black text-gray-700">{detayliStats?.genel?.taslak || 0}</p>
              </Link>
              <Link to="/dizgi-yonetimi" className="p-4 bg-orange-50 rounded-xl border border-orange-200 hover:border-orange-400 transition group">
                <p className="text-xs font-bold text-orange-600 uppercase">DİZGİ</p>
                <p className="text-2xl font-black text-orange-700">{detayliStats?.genel?.dizgi || 0}</p>
              </Link>
              <Link to="/brans-havuzu?durum=dizgi_sonrasi&scope=brans" className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 hover:border-yellow-400 transition group cursor-pointer">
                <p className="text-xs font-bold text-yellow-600 uppercase">DİZGİ SONRASI</p>
                <p className="text-2xl font-black text-yellow-700">{detayliStats?.genel?.dizgi_sonrasi || 0}</p>
              </Link>
              <Link to="/dashboard?mode=alanci" className="p-4 bg-blue-50 rounded-xl border border-blue-200 hover:border-blue-400 transition group">
                <p className="text-xs font-bold text-blue-600 uppercase">ALAN İNCELEME</p>
                <p className="text-2xl font-black text-blue-700">{detayliStats?.genel?.alan_inceleme || 0}</p>
              </Link>
              <Link to="/dashboard?mode=dilci" className="p-4 bg-purple-50 rounded-xl border border-purple-200 hover:border-purple-400 transition group">
                <p className="text-xs font-bold text-purple-600 uppercase">DİL İNCELEME</p>
                <p className="text-2xl font-black text-purple-700">{detayliStats?.genel?.dil_inceleme || 0}</p>
              </Link>
              <Link to="/sorular?durum=tamamlandi" className="p-4 bg-green-50 rounded-xl border border-green-200 hover:border-green-400 transition group">
                <p className="text-xs font-bold text-green-600 uppercase">TAMAMLANAN</p>
                <p className="text-2xl font-black text-green-700">{detayliStats?.genel?.tamamlandi || 0}</p>
              </Link>
            </div>
          </div>



          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-6 h-6 text-purple-600" />
              Detaylı Branş & Ekip Analizi
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg cursor-help" title="Alt ekipleri görmek için branş ismine tıklayın">Branş (Detay)</th>
                    <th className="px-4 py-3 text-center">Toplam</th>
                    <th className="px-4 py-3 text-center text-gray-400 uppercase">Taslak</th>
                    <th className="px-3 py-3 text-center text-orange-600">DİZGİ</th>
                    <th className="px-3 py-3 text-center text-yellow-600">DİZGİ SONRASI</th>
                    <th className="px-3 py-3 text-center text-blue-600">ALAN İNCELEME</th>
                    <th className="px-4 py-3 text-center text-purple-600 uppercase">Dil İncele</th>
                    <th className="px-4 py-3 rounded-r-lg text-center text-green-700 uppercase">Tamamlanan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedBranchStats.map((group) => (
                    <>
                      <tr
                        key={group.id}
                        className="hover:bg-gray-50 transition cursor-pointer group"
                        onClick={() => setExpandedBranch(expandedBranch === group.id ? null : group.id)}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-700 flex items-center gap-2">
                          <span className={`transition-transform duration-200 ${expandedBranch === group.id ? 'rotate-90' : ''}`}>▶</span>
                          {group.brans_adi}
                        </td>
                        <td className="px-4 py-3 text-center font-bold bg-gray-50/50">{group.total.soru}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{group.total.taslak || '-'}</td>
                        <td className="px-4 py-3 text-center text-orange-600 font-medium">{group.total.dizgi || '-'}</td>
                        <td className="px-4 py-3 text-center text-yellow-600 font-medium">{group.total.dizgi_sonrasi || '-'}</td>
                        <td className="px-4 py-3 text-center text-blue-600 font-medium">{group.total.alan_inceleme || '-'}</td>
                        <td className="px-4 py-3 text-center text-purple-600 font-medium">{group.total.dil_inceleme || '-'}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-bold bg-green-50/30">{group.total.tamamlandi || '-'}</td>
                      </tr>
                      {expandedBranch === group.id && (
                        group.teams.map((team, idx) => (
                          <tr key={`${group.id}-${idx}`} className="bg-gray-50/50 animate-fade-in text-xs">
                            <td className="px-4 py-2 pl-12 text-gray-500 font-medium flex items-center gap-2">
                              <span>↳</span> {team.ekip_adi}
                            </td>
                            <td className="px-4 py-2 text-center text-gray-500">{team.soru_sayisi}</td>
                            <td className="px-4 py-2 text-center text-gray-400 opacity-70">{team.taslak || '-'}</td>
                            <td className="px-4 py-2 text-center text-orange-500 opacity-70">{team.dizgi || '-'}</td>
                            <td className="px-4 py-2 text-center text-yellow-500 opacity-70">{team.dizgi_sonrasi || '-'}</td>
                            <td className="px-4 py-2 text-center text-blue-500 opacity-70">{team.alan_inceleme || '-'}</td>
                            <td className="px-4 py-2 text-center text-purple-500 opacity-70">{team.dil_inceleme || '-'}</td>
                            <td className="px-4 py-2 text-center text-green-600 opacity-70">{team.tamamlandi || '-'}</td>
                          </tr>
                        ))
                      )}
                    </>
                  ))}
                  {groupedBranchStats.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-400">Veri bulunamadı</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


        </div>
      ) : activeRole === 'incelemeci' ? (
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                {reviewMode === 'alanci' ? 'Alan İnceleme Paneli' : (reviewMode === 'dilci' ? 'Dil İnceleme Paneli' : 'İnceleme Paneli')}
              </h1>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-2 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-purple-500" /> Hoş Geldiniz, {user?.ad_soyad}
              </p>
            </div>
          </div>

          {!reviewMode ? (
            <div className="py-20 text-center space-y-4 bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
              <InformationCircleIcon className="w-16 h-16 text-gray-200 mx-auto" />
              <p className="text-gray-400 font-black text-[11px] uppercase tracking-[0.2em]">İnceleme yetkisi bulunamadı</p>
            </div>
          ) : (selectedBrans || urlMode) ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
              {/* SOL PANEL - SORU LİSTESİ */}
              <div className="lg:col-span-4 bg-gray-50/50 rounded-[3rem] p-8 border border-gray-100 shadow-inner overflow-y-auto max-h-[800px] custom-scrollbar">
                {(selectedBrans || !urlMode) && (
                  <button
                    onClick={() => setSelectedBrans(null)}
                    className="mb-6 flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-all group"
                  >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Branşlara Dön
                  </button>
                )}

                <div className="space-y-6">
                  <div className="pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-black text-gray-900 leading-tight">
                      {selectedBrans ? selectedBrans.brans_adi : (urlMode === 'alanci' ? 'Tüm Alan İncelemeleri' : 'Tüm Dil İncelemeleri')}
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">İnceleme Akışı</p>
                  </div>
                  <IncelemeListesi
                    bransId={selectedBrans?.id}
                    bransAdi={selectedBrans?.brans_adi}
                    reviewMode={reviewMode}
                  />
                </div>
              </div>

              {/* SAĞ PANEL - HOŞGELDİN / ÖNİZLEME ALANI */}
              <div className="lg:col-span-8 bg-white rounded-[3rem] p-12 border border-black/5 shadow-xl shadow-gray-200/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none"><SparklesIcon className="w-64 h-64" /></div>
                <div className="relative z-10 space-y-6 max-w-md">
                  <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-blue-500/10">
                    <CursorArrowRaysIcon className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">İnceleme Başlatın</h3>
                  <p className="text-gray-500 text-sm font-medium leading-relaxed">
                    Soldaki akıştan bir soru seçerek detayları görüntüleyebilir ve inceleme sürecini tamamlayabilirsiniz.
                  </p>
                  {!selectedBrans && urlMode && (
                    <div className="mt-8 pt-6 border-t border-gray-100 italic text-[11px] text-gray-400">
                      Branş bazlı özet için <Link to="/" className="text-blue-500 font-bold hover:underline">Ana Sayfa</Link>'ya dönebilirsiniz.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* SECTION: BEKLEYENLER */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3 uppercase italic">
                    <ClockIcon className="w-7 h-7 text-amber-500" /> İnceleme Bekleyenler
                  </h2>
                  <span className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-full font-black text-xs border border-amber-100">
                    {Object.values(reviewStatsByStatus.bekleyen).reduce((sum, b) => sum + b.total, 0)} Soru
                  </span>
                </div>

                <div className="space-y-4">
                  {Object.entries(reviewStatsByStatus.bekleyen).map(([bName, data]) => (
                    <div
                      key={bName}
                      onClick={() => setSelectedBrans({ id: data.id, brans_adi: bName })}
                      className="group p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity"><ArrowPathIcon className="w-20 h-20 animate-spin-slow" /></div>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-black text-gray-800">{bName}</h4>
                        <div className="bg-blue-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                          {data.total}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(data.categories).map(([cat, count]) => (
                          <span key={cat} className="px-3 py-1 bg-gray-50 text-[10px] font-black text-gray-500 rounded-xl border border-gray-100 group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:text-blue-600 transition-colors uppercase tracking-widest leading-none flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-current rounded-full opacity-40"></span>
                            {cat}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(reviewStatsByStatus.bekleyen).length === 0 && (
                    <div className="p-12 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                      <CheckCircleIcon className="w-12 h-12 text-green-300 mx-auto mb-2" />
                      <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">Harika! Bekleyen inceleme yok.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION: TAMAMLANANLAR */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3 uppercase italic">
                    <CheckCircleIcon className="w-7 h-7 text-emerald-500" /> İncelemesi Yapılanlar
                  </h2>
                  <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full font-black text-xs border border-emerald-100">
                    {Object.values(reviewStatsByStatus.tamamlanan).reduce((sum, b) => sum + b.total, 0)} Soru
                  </span>
                </div>

                <div className="space-y-4">
                  {Object.entries(reviewStatsByStatus.tamamlanan).map(([bName, data]) => (
                    <div
                      key={bName}
                      className="group p-6 bg-white/60 backdrop-blur-sm rounded-[2rem] border border-gray-100 opacity-80 hover:opacity-100 transition-all hover:bg-white"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-black text-gray-400 group-hover:text-gray-800 transition-colors">{bName}</h4>
                        <div className="bg-emerald-50 text-emerald-600 w-10 h-10 rounded-2xl flex items-center justify-center font-black">
                          {data.total}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(data.categories).map(([cat, count]) => (
                          <span key={cat} className="px-3 py-1 bg-white text-[10px] font-black text-gray-400 rounded-xl border border-gray-100 uppercase tracking-widest leading-none flex items-center gap-1.5">
                            {cat}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(reviewStatsByStatus.tamamlanan).length === 0 && (
                    <div className="p-12 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                      <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest italic opacity-50">HENÜZ ONAYLANAN SORU YOK.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeRole === 'soru_yazici' ? (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-8 rounded-2xl text-white shadow-xl">
            <h1 className="text-3xl font-bold">Hoş Geldiniz, {user?.ad_soyad}</h1>
            <p className="mt-2 text-blue-100 uppercase font-black tracking-widest text-xs">{translateKey(activeRole)} Paneli</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

              <Link to="/brans-havuzu?durum=taslak_grubu" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition text-center group">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest group-hover:text-amber-500">✍️ YAZILAN / TASLAK</p>
                <h3 className="text-3xl font-black text-gray-800 mt-1">{(Number(stats?.beklemede) || 0) + (Number(stats?.revize_gerekli) || 0)}</h3>
                <p className="text-[10px] text-gray-400 mt-1">Branş Biriminde Gönderilmeyi Bekleyenler</p>
              </Link>

              <Link to="/brans-havuzu?durum=dizgi_grubu" className="bg-orange-50 p-6 rounded-2xl border border-orange-100 shadow-sm hover:shadow-md transition text-center group relative overflow-hidden">
                <p className="text-orange-600 text-[10px] font-bold uppercase tracking-widest">⚙️ DİZGİDE</p>
                <h3 className="text-3xl font-black text-orange-700 mt-1">{(Number(stats?.dizgi_bekliyor) || 0) + (Number(stats?.dizgide) || 0)}</h3>
                <p className="text-[10px] text-orange-500 mt-1">Dizgi Biriminde</p>
              </Link>

              <Link to="/brans-havuzu?durum=dizgi_sonrasi" className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition text-center group">
                <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest">DİZGİ SONRASI</p>
                <h3 className="text-3xl font-black text-emerald-700 mt-1">{stats?.dizgi_tamam || 0}</h3>
                <p className="text-[10px] text-emerald-500 mt-1 font-bold">Onay Bekleyenler &rarr;</p>
              </Link>

              <Link to="/brans-havuzu?durum=incelemede_grubu" className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition text-center group relative overflow-hidden">
                <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">🔍 İNCELEMEDE</p>
                <h3 className="text-3xl font-black text-blue-700 mt-1">{(Number(stats?.inceleme_bekliyor) || 0) + (Number(stats?.alan_incelemede) || 0) + (Number(stats?.dil_incelemede) || 0)}</h3>
                <p className="text-[10px] text-blue-500 mt-1">İnceleme Birimlerinde</p>
              </Link>

              <Link to="/sorular?durum=tamamlandi" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition text-center group">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest group-hover:text-green-500">TAMAMLANAN</p>
                <h3 className="text-3xl font-black text-gray-800 mt-1">{stats?.tamamlandi || 0}</h3>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link to="/sorular/yeni" className="bg-blue-600 text-white p-8 rounded-2xl flex flex-col items-center justify-center font-bold gap-4 hover:bg-blue-700 transition shadow-lg group">
                <div className="p-3 bg-white/20 rounded-full group-hover:scale-110 transition">
                  <PencilSquareIcon className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <div className="text-xl">Yeni Soru Yaz</div>
                  <p className="text-blue-200 font-normal text-sm mt-1">Soru havuzuna yeni bir içerik ekleyin</p>
                </div>
              </Link>
              <Link to="/brans-havuzu" className="bg-indigo-600 text-white p-8 rounded-2xl flex flex-col items-center justify-center font-bold gap-4 hover:bg-indigo-700 transition shadow-lg group">
                <div className="p-3 bg-white/20 rounded-full group-hover:scale-110 transition">
                  <BookOpenIcon className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <div className="text-xl">Tamamlanmayan Sorular</div>
                  <p className="text-indigo-200 font-normal text-sm mt-1">Branşınızdaki tüm soruları yönetin</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      ) : activeRole === 'dizgici' ? (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-8 rounded-2xl text-white shadow-xl">
            <h1 className="text-3xl font-bold">Hoş Geldiniz, {user?.ad_soyad}</h1>
            <p className="mt-2 text-blue-100 uppercase font-black tracking-widest text-xs">{translateKey(activeRole)} Paneli</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">BEKLEYEN DİZGİ</p>
              <h3 className="text-4xl font-black text-gray-800 mt-2">{stats?.dizgi_bekliyor || 0}</h3>
            </div>
            <Link to="/dizgi-yonetimi" className="bg-orange-600 text-white p-8 rounded-2xl flex flex-col items-center justify-center font-bold gap-4 hover:bg-orange-700 transition shadow-lg group">
              <div className="p-3 bg-white/20 rounded-full group-hover:scale-110 transition">
                <DocumentTextIcon className="w-8 h-8" />
              </div>
              <div className="text-center">
                <div className="text-xl">Dizgi Yönetimi</div>
                <p className="text-orange-100 font-normal text-sm mt-1">Size atanan dizgi işlerini görüntüleyin</p>
              </div>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
