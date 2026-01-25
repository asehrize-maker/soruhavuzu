import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI, userAPI, authAPI } from '../services/api';
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
  MegaphoneIcon
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
  const [error, setError] = useState(null);
  const { user: authUser } = useAuthStore();

  useEffect(() => {
    const fetchSorular = async () => {
      if (!bransId) return;
      setListLoading(true);
      setError(null);
      try {
        const response = await soruAPI.getAll();
        const allQuestions = response.data.data || [];

        const filtered = allQuestions.filter(s => {
          if (parseInt(s.brans_id) !== parseInt(bransId)) return false;

          if (reviewMode === 'alanci') return ['alan_incelemede', 'inceleme_bekliyor', 'incelemede'].includes(s.durum);
          if (reviewMode === 'dilci') return ['dil_incelemede', 'inceleme_bekliyor', 'incelemede'].includes(s.durum);

          return ['alan_incelemede', 'dil_incelemede', 'inceleme_bekliyor', 'incelemede'].includes(s.durum);
        });
        setSorular(filtered);
      } catch (err) {
        setError("Sorular yüklenemedi: " + err.message);
      } finally {
        setListLoading(false);
      }
    };
    fetchSorular();
  }, [bransId, reviewMode, authUser]);

  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>;
  if (listLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="mt-8 animate-fade-in">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <DocumentTextIcon className="w-6 h-6 text-blue-600" />
        {bransAdi} - İnceleme Bekleyen Sorular
      </h3>
      {sorular.length === 0 ? (
        <div className="p-8 bg-gray-50 rounded-xl text-center text-gray-500 border border-gray-200">
          <BookOpenIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p>Bu branşta şu an incelenecek soru bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sorular.map(soru => {
            const zorluk = normalizeZorlukToScale(soru.zorluk_seviyesi);
            return (
              <div key={soru.id} className="card bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition flex justify-between items-start group">
                <div className="flex gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-bold uppercase tracking-wide ${zorluk === 1 ? 'bg-green-100 text-green-700' :
                        zorluk === 2 ? 'bg-green-50 text-green-600' :
                          zorluk === 3 ? 'bg-yellow-100 text-yellow-700' :
                            zorluk === 4 ? 'bg-orange-100 text-orange-700' :
                              zorluk === 5 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {['ÇOK KOLAY', 'KOLAY', 'ORTA', 'ZOR', 'ÇOK ZOR'][(zorluk || 0) - 1] || 'BELİRSİZ'}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">#{soru.id}</span>
                    </div>
                    <div className="text-gray-900 font-medium line-clamp-2 text-sm" dangerouslySetInnerHTML={{ __html: soru.soru_metni?.substring(0, 150) }} />
                  </div>
                </div>
                <Link to={`/sorular/${soru.id}?incelemeTuru=${reviewMode}`} className="btn btn-primary btn-sm">Gör & İncele</Link>
              </div>
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
  const [selectedStat, setSelectedStat] = useState(null);
  const [panelConfig, setPanelConfig] = useState(null);

  // URL'den inceleme modunu al (alanci/dilci)
  const getReviewModeFromUrl = () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    const mode = params.get('mode');
    if (mode === 'alanci' || mode === 'dilci') return mode;

    // Otomatik mod seçimi (Eğer sadece bir yetkisi varsa ve URL boşsa)
    if (rawRole === 'alan_incelemeci') return 'alanci';
    if (rawRole === 'dil_incelemeci') return 'dilci';
    if (user?.inceleme_alanci && !user?.inceleme_dilci) return 'alanci';
    if (!user?.inceleme_alanci && user?.inceleme_dilci) return 'dilci';

    return null;
  };

  const [reviewMode, setReviewMode] = useState(getReviewModeFromUrl);

  const isActualAdmin = user?.rol === 'admin';
  const canAlanInceleme = isActualAdmin || !!user?.inceleme_alanci || rawRole === 'alan_incelemeci' || rawRole === 'incelemeci';
  const canDilInceleme = isActualAdmin || !!user?.inceleme_dilci || rawRole === 'dil_incelemeci' || rawRole === 'incelemeci';

  const fetchData = useCallback(async () => {
    if (!activeRole) return;
    setLoading(true);
    try {
      if (activeRole === 'admin') {
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

  useEffect(() => {
    fetchData();
    const fetchConfig = async () => {
      try {
        const res = await authAPI.getConfig();
        if (res.data.success) setPanelConfig(res.data.data);
      } catch (err) { console.warn("Config load error", err); }
    };
    fetchConfig();
  }, [fetchData]);

  // URL değişikliklerini dinle
  useEffect(() => {
    const handleLocationChange = () => setReviewMode(getReviewModeFromUrl());
    window.addEventListener('popstate', handleLocationChange);
    // React Router location değişimi için
    setReviewMode(getReviewModeFromUrl());
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [window.location.hash, window.location.search]);

  const { groupedTeams, teamAggregates } = useMemo(() => {
    const grouped = (incelemeBransCounts || []).reduce((acc, item) => {
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

    return { groupedTeams: grouped, teamAggregates: aggregates };
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
            soru: 0, beklemede: 0, incelemede: 0, revize: 0,
            dizgide: 0, onay: 0, tamamlandi: 0
          }
        };
      }
      groups[id].teams.push(item);
      groups[id].total.soru += Number(item.soru_sayisi || 0);
      groups[id].total.beklemede += Number(item.beklemede || 0);
      groups[id].total.incelemede += Number(item.incelemede || 0);
      groups[id].total.revize += Number(item.revize || 0);
      groups[id].total.dizgide += Number(item.dizgide || 0);
      groups[id].total.onay += Number(item.onay_bekleyen || 0);
      groups[id].total.tamamlandi += Number(item.tamamlandi || 0);
    });

    return Object.values(groups).sort((a, b) => b.total.soru - a.total.soru);
  }, [detayliStats]);

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
            <InformationCircleIcon className="w-5 h-5 opacity-40" />
          </button>
        </div>
      )}

      {activeRole === 'admin' ? (
        <div className="space-y-8 animate-fade-in">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800">Yönetim Paneli</h1>
            <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div onClick={() => setSelectedStat({ key: 'toplam_soru', title: 'Toplam Soru' })} className="card bg-blue-600 text-white p-6 cursor-pointer hover:scale-105 transition shadow-lg">
              <p className="text-blue-100 text-xs font-bold uppercase">TOPLAM SORU</p>
              <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.genel?.toplam_soru || 0}</h3>
            </div>
            <div className="card bg-emerald-600 text-white p-6 shadow-lg">
              <p className="text-emerald-100 text-xs font-bold uppercase">KULLANICILAR</p>
              <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.sistem?.toplam_kullanici || 0}</h3>
            </div>
            <div className="card bg-purple-600 text-white p-6 shadow-lg">
              <p className="text-purple-100 text-xs font-bold uppercase">BRANŞLAR</p>
              <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.branslar?.length || 0}</h3>
            </div>
            <div className="card bg-orange-600 text-white p-6 shadow-lg">
              <p className="text-orange-100 text-xs font-bold uppercase">EKİPLER</p>
              <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.sistem?.toplam_ekip || 0}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">📊 İş Akış Özeti</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <Link to="/brans-havuzu?tab=taslaklar&durum=beklemede" className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition group">
                <p className="text-xs font-bold text-gray-400 group-hover:text-blue-500 transition">TASLAK</p>
                <p className="text-2xl font-black text-gray-700">{detayliStats?.genel?.beklemede || 0}</p>
              </Link>
              <Link to="/brans-havuzu?tab=taslaklar" className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 hover:border-yellow-400 transition group">
                <p className="text-xs font-bold text-yellow-600">İNCELEME</p>
                <p className="text-2xl font-black text-yellow-700">{(parseInt(detayliStats?.genel?.inceleme_bekliyor) || 0) + (parseInt(detayliStats?.genel?.incelemede) || 0)}</p>
              </Link>
              <Link to="/brans-havuzu?tab=taslaklar&durum=revize_istendi" className="p-4 bg-red-50 rounded-xl border border-red-200 hover:border-red-400 transition group">
                <p className="text-xs font-bold text-red-600">REVİZE</p>
                <p className="text-2xl font-black text-red-700">{detayliStats?.genel?.revize_istendi || 0}</p>
              </Link>
              <Link to="/brans-havuzu?tab=taslaklar&durum=dizgi_bekliyor" className="p-4 bg-orange-50 rounded-xl border border-orange-200 hover:border-orange-400 transition group">
                <p className="text-xs font-bold text-orange-600">DİZGİ</p>
                <p className="text-2xl font-black text-orange-700">{(parseInt(detayliStats?.genel?.dizgi_bekliyor) || 0) + (parseInt(detayliStats?.genel?.dizgide) || 0)}</p>
              </Link>
              <Link to="/sorular?durum=tamamlandi" className="p-4 bg-green-50 rounded-xl border border-green-200 hover:border-green-400 transition group">
                <p className="text-xs font-bold text-green-600">ORTAK HAVUZ</p>
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
                    <th className="px-4 py-3 text-center text-gray-400">Taslak</th>
                    <th className="px-4 py-3 text-center text-blue-600">İnceleme</th>
                    <th className="px-4 py-3 text-center text-red-600">Revize</th>
                    <th className="px-4 py-3 text-center text-orange-600">Dizgi</th>
                    <th className="px-4 py-3 text-center text-emerald-600">Onay</th>
                    <th className="px-4 py-3 rounded-r-lg text-center text-green-700">Tamamlanan</th>
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
                        <td className="px-4 py-3 text-center text-gray-400">{group.total.beklemede || '-'}</td>
                        <td className="px-4 py-3 text-center text-blue-600 font-medium">{group.total.incelemede || '-'}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-medium">{group.total.revize || '-'}</td>
                        <td className="px-4 py-3 text-center text-orange-600 font-medium">{group.total.dizgide || '-'}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-medium">{group.total.onay || '-'}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-bold bg-green-50/30">{group.total.tamamlandi || '-'}</td>
                      </tr>
                      {expandedBranch === group.id && (
                        group.teams.map((team, idx) => (
                          <tr key={`${group.id}-${idx}`} className="bg-gray-50/50 animate-fade-in text-xs">
                            <td className="px-4 py-2 pl-12 text-gray-500 font-medium flex items-center gap-2">
                              <span>↳</span> {team.ekip_adi}
                            </td>
                            <td className="px-4 py-2 text-center text-gray-500">{team.soru_sayisi}</td>
                            <td className="px-4 py-2 text-center text-gray-400 opacity-70">{team.beklemede || '-'}</td>
                            <td className="px-4 py-2 text-center text-blue-500 opacity-70">{team.incelemede || '-'}</td>
                            <td className="px-4 py-2 text-center text-red-500 opacity-70">{team.revize || '-'}</td>
                            <td className="px-4 py-2 text-center text-orange-500 opacity-70">{team.dizgide || '-'}</td>
                            <td className="px-4 py-2 text-center text-emerald-500 opacity-70">{team.onay_bekleyen || '-'}</td>
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
        reviewMode ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
              <h1 className="text-2xl font-bold">{reviewMode === 'alanci' ? 'Alan İnceleme' : 'Dil İnceleme'} Branş Seçimi</h1>
              {selectedEkip && <button onClick={() => { setSelectedEkip(null); setSelectedBrans(null); }} className="text-blue-600 font-bold hover:underline">&larr; Tüm Ekipler</button>}
            </div>

            <div className="bg-white p-6 rounded-2xl border min-h-[400px]">
              {selectedBrans ? (
                <IncelemeListesi bransId={selectedBrans.id} bransAdi={selectedBrans.brans_adi} reviewMode={reviewMode} />
              ) : selectedEkip ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(groupedTeams[selectedEkip] || []).filter(i => (reviewMode === 'alanci' ? i.alanci_bekleyen : i.dilci_bekleyen) > 0).map(brans => (
                    <button key={brans.brans_id} onClick={() => setSelectedBrans({ id: brans.brans_id, brans_adi: brans.brans_adi })} className="p-6 bg-gray-50 rounded-xl border hover:border-blue-500 transition">
                      <div className="font-bold text-gray-800">{brans.brans_adi}</div>
                      <div className="mt-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full inline-block">{(reviewMode === 'alanci' ? brans.alanci_bekleyen : brans.dilci_bekleyen)} Soru</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {teamAggregates.filter(a => a.totalPending > 0).map(agg => (
                    <button key={agg.ekipAdi} onClick={() => setSelectedEkip(agg.ekipAdi)} className="p-6 bg-white border rounded-xl hover:shadow-lg transition text-left flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{agg.ekipAdi}</h3>
                        <p className="text-xs text-gray-500">{agg.items.length} Branş</p>
                      </div>
                      <span className="text-2xl font-black text-blue-600">{agg.totalPending}</span>
                    </button>
                  ))}
                  {teamAggregates.filter(a => a.totalPending > 0).length === 0 && <div className="col-span-full text-center py-12 text-gray-400 font-bold">Harika! İncelenecek soru bulunmuyor.</div>}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-800">İnceleme Paneli</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card bg-blue-600 text-white p-6">
                <p className="text-blue-100 text-xs font-bold">TOPLAM EKİP</p>
                <h3 className="text-4xl font-extrabold mt-1">{teamAggregates.length}</h3>
              </div>
              {canAlanInceleme && (
                <div className="card bg-emerald-600 text-white p-6">
                  <p className="text-emerald-100 text-xs font-bold">ALAN İNCELEME BEKLEYEN</p>
                  <h3 className="text-4xl font-extrabold mt-1">{incelemeBransCounts.reduce((sum, b) => sum + (Number(b.alanci_bekleyen) || 0), 0)}</h3>
                </div>
              )}
              {canDilInceleme && (
                <div className="card bg-purple-600 text-white p-6">
                  <p className="text-purple-100 text-xs font-bold">DİL İNCELEME BEKLEYEN</p>
                  <h3 className="text-4xl font-extrabold mt-1">{incelemeBransCounts.reduce((sum, b) => sum + (Number(b.dilci_bekleyen) || 0), 0)}</h3>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {canAlanInceleme && <Link to="/?mode=alanci" className="p-6 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition font-bold text-blue-700">🔍 Alan İnceleme Girişi &rarr;</Link>}
              {canDilInceleme && <Link to="/?mode=dilci" className="p-6 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition font-bold text-purple-700">🔍 Dil İnceleme Girişi &rarr;</Link>}
            </div>
          </div>
        )
      ) : activeRole === 'soru_yazici' ? (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-8 rounded-2xl text-white shadow-xl">
            <h1 className="text-3xl font-bold">Hoş Geldiniz, {user?.ad_soyad}</h1>
            <p className="mt-2 text-blue-100 uppercase font-black tracking-widest text-xs">{activeRole?.replace('_', ' ')} Paneli</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/brans-havuzu?tab=taslaklar" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition text-center group">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest group-hover:text-amber-500">✍️ YAZILAN / TASLAK</p>
                <h3 className="text-3xl font-black text-gray-800 mt-1">{(Number(stats?.beklemede) || 0) + (Number(stats?.revize_gerekli) || 0)}</h3>
                <p className="text-[10px] text-gray-400 mt-1">Branş Havuzunda Gönderilmeyi Bekleyenler</p>
              </Link>
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm text-center relative overflow-hidden">
                <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">⚙️ İŞLEMDE OLANLAR</p>
                <h3 className="text-3xl font-black text-blue-700 mt-1">{(Number(stats?.dizgi_bekliyor) || 0) + (Number(stats?.dizgide) || 0) + (Number(stats?.inceleme_bekliyor) || 0)}</h3>
                <p className="text-[10px] text-blue-500 mt-1">Dizgi veya İnceleme Birimlerinde</p>
              </div>
              <Link to="/brans-havuzu?tab=dizgi_sonrasi" className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition text-center group">
                <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest">DİZGİ SONRASI</p>
                <h3 className="text-3xl font-black text-emerald-700 mt-1">{stats?.dizgi_tamam || 0}</h3>
                <p className="text-[10px] text-emerald-500 mt-1 font-bold">Onay Bekleyenler &rarr;</p>
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
                  <div className="text-xl">Branş Soru Havuzu</div>
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
            <p className="mt-2 text-blue-100 uppercase font-black tracking-widest text-xs">{activeRole?.replace('_', ' ')} Paneli</p>
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
