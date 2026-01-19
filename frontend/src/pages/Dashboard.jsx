import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import {
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon,
  PencilSquareIcon,
  InformationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// --- ALT BİLEŞEN: İNCELEME LİSTESİ ---
function IncelemeListesi({ bransId, bransAdi, reviewMode }) {
  const [sorular, setSorular] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user: authUser } = useAuthStore();

  useEffect(() => {
    const fetchSorular = async () => {
      setListLoading(true);
      setError(null);
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sunucu yanıt vermedi')), 10000));
        const response = await Promise.race([soruAPI.getAll(), timeoutPromise]);

        const allQuestions = response.data.data || [];

        // Filtreleme
        const filtered = allQuestions.filter(s => {
          const isBransMatch = parseInt(s.brans_id) === parseInt(bransId);
          if (!isBransMatch) return false;

          const isStatusSuitable = ['inceleme_bekliyor', 'beklemede', 'incelemede', 'dizgide'].includes(s.durum);

          // Determine pending review. Prefer explicit reviewMode (admin can select),
          // otherwise fallback to user's inceleme flags.
          let isPendingReview = false;
          if (typeof reviewMode !== 'undefined' && reviewMode) {
            if (reviewMode === 'alanci') isPendingReview = !s.onay_alanci;
            else if (reviewMode === 'dilci') isPendingReview = !s.onay_dilci;
          } else {
            const alan = !!authUser?.inceleme_alanci;
            const dil = !!authUser?.inceleme_dilci;
            if (alan && !dil) isPendingReview = !s.onay_alanci;
            else if (dil && !alan) isPendingReview = !s.onay_dilci;
            else if (alan && dil) isPendingReview = (!s.onay_alanci || !s.onay_dilci);
          }

          const notFinished = s.durum !== 'tamamlandi';

          return isStatusSuitable && isPendingReview && notFinished;
        });
        setSorular(filtered);
      } catch (err) {
        console.error("Sorular çekilemedi", err);
        setError("Bir hata oluştu: " + (err.message));
      } finally {
        setListLoading(false);
      }
    };

    if (bransId) {
      fetchSorular();
    }
  }, [bransId]);

  const content = (
    <div className="mt-8 animate-fade-in">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <DocumentTextIcon className="w-6 h-6 text-blue-600" />
        {bransAdi} - İnceleme Bekleyen Sorular
      </h3>

      {sorular.length === 0 ? (
        <div className="p-8 bg-gray-50 rounded-xl text-center text-gray-500 border border-gray-200 shadow-sm flex flex-col items-center">
          <BookOpenIcon className="w-12 h-12 text-gray-300 mb-2" />
          <p>Bu branşta şu an incelenecek soru bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sorular.map(soru => (
            <div key={soru.id} className="card bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition flex justify-between items-start group">
              <div className="flex gap-4">
                {soru.fotograf_url ? (
                  <img src={soru.fotograf_url} alt="Soru" className="w-20 h-20 object-contain border rounded bg-gray-50 p-1" />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs text-center p-1">
                    Görsel Yok
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-bold uppercase tracking-wide ${soru.zorluk_seviyesi == 1 ? 'bg-green-100 text-green-700' :
                      soru.zorluk_seviyesi == 2 ? 'bg-green-50 text-green-600' :
                        soru.zorluk_seviyesi == 3 ? 'bg-yellow-100 text-yellow-700' :
                          soru.zorluk_seviyesi == 4 ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                      }`}>
                      {['ÇOK KOLAY', 'KOLAY', 'ORTA', 'ZOR', 'ÇOK ZOR'][soru.zorluk_seviyesi - 1] || 'BELİRSİZ'}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">#{soru.id}</span>
                  </div>

                  <div className="text-gray-900 font-medium line-clamp-2 text-sm max-w-2xl" dangerouslySetInnerHTML={{ __html: soru.soru_metni?.substring(0, 300) }} />

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <UserGroupIcon className="w-3 h-3" /> {soru.olusturan_kullanici_ad_soyad}
                    </span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" /> {new Date(soru.olusturulma_tarihi).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                to={`/sorular/${soru.id}?incelemeTuru=${reviewMode}`}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition transform group-hover:scale-105 ${reviewMode === 'alanci' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
              >
                {reviewMode === 'alanci' ? 'Alan İncele' : 'Dil İncele'} &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
      <InformationCircleIcon className="w-5 h-5" />
      {error}
    </div>
  );

  if (listLoading) return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return content;
}

const RefreshButton = ({ onRefresh, loading }) => (
  <button
    onClick={onRefresh}
    disabled={loading}
    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition shadow-sm border border-gray-100 font-bold text-sm disabled:opacity-50 group"
  >
    <ArrowPathIcon className={`w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors ${loading ? 'animate-spin' : ''}`} />
    Yenile
  </button>
);

export default function Dashboard() {
  const { user } = useAuthStore();
  const { effectiveRole } = useOutletContext() || {};
  const activeRole = (user?.rol === 'admin' && effectiveRole) ? effectiveRole : (user?.rol || effectiveRole);
  const isActualAdmin = user?.rol === 'admin';
  const canAlanInceleme = isActualAdmin || !!user?.inceleme_alanci;
  const canDilInceleme = isActualAdmin || !!user?.inceleme_dilci;

  const [stats, setStats] = useState(null);
  const [detayliStats, setDetayliStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branslar, setBranslar] = useState([]);
  const [incelemeBransCounts, setIncelemeBransCounts] = useState([]);
  const [selectedBrans, setSelectedBrans] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);
  const [reviewMode, setReviewMode] = useState('alanci');

  // Ensure reviewers only see their registered review type (unless admin)
  useEffect(() => {
    if (activeRole !== 'incelemeci') return;
    if (isActualAdmin) {
      // Admin keeps ability to toggle; default stays as 'alanci'
      return;
    }
    // Non-admin reviewer: set mode according to their registered flag
    if (user?.inceleme_alanci && !user?.inceleme_dilci) setReviewMode('alanci');
    else if (user?.inceleme_dilci && !user?.inceleme_alanci) setReviewMode('dilci');
  }, [activeRole, isActualAdmin, user?.inceleme_alanci, user?.inceleme_dilci]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setStats(null);
    setDetayliStats(null);
    try {
      if (activeRole === 'admin') {
        const res = await soruAPI.getDetayliStats();
        if (res.data.success) {
          setDetayliStats(res.data.data);
        }
      } else {
        const res = await soruAPI.getStats({ role: activeRole });
        if (res.data.success) {
          setStats(res.data.data);
        }
      }

      if (activeRole === 'incelemeci') {
        const bransRes = await bransAPI.getAll();
        if (bransRes.data.success) {
          setBranslar(bransRes.data.data);
        }
      }
    } catch (error) {
      console.error("Dashboard veri hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [activeRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute review counts per branch for both alan and dil roles (client-side)
  useEffect(() => {
    const loadCounts = async () => {
      if (activeRole !== 'incelemeci') return;
      try {
        const res = await soruAPI.getAll();
        const allQuestions = res.data.data || [];
        const map = {};
        // initialize map with branches
        branslar.forEach(b => { map[b.id] = { id: b.id, brans_adi: b.brans_adi, alanci: 0, dilci: 0 }; });
        allQuestions.forEach(s => {
          const isStatusSuitable = ['inceleme_bekliyor', 'beklemede', 'incelemede', 'dizgide'].includes(s.durum);
          if (!isStatusSuitable) return;
          const bid = Number(s.brans_id);
          if (!map[bid]) return;
          if (!s.onay_alanci) map[bid].alanci += 1;
          if (!s.onay_dilci) map[bid].dilci += 1;
        });
        setIncelemeBransCounts(Object.values(map));
      } catch (err) {
        console.error('İnceleme branş istatistikleri yüklenemedi', err);
        setIncelemeBransCounts([]);
      }
    };

    loadCounts();
  }, [activeRole, branslar]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  // 1. ADMIN DASHBOARD
  if (activeRole === 'admin') {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Yönetim Paneli</h1>
            <p className="text-gray-500 mt-1 font-medium">Sistem özetini ve aktiviteleri buradan yönetebilirsiniz.</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <RefreshButton onRefresh={fetchData} loading={loading} />
            <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold border border-gray-200">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Toplam Soru */}
          <div onClick={() => setSelectedStat({ key: 'toplam_soru', title: 'Toplam Soru' })}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 p-6 text-white shadow-lg shadow-blue-200 transition-all hover:scale-105 hover:shadow-xl cursor-pointer group">
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">TOPLAM SORU</p>
                <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.genel?.toplam_soru || 0}</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                <DocumentTextIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
          </div>

          {/* Kullanıcılar */}
          <div onClick={() => setSelectedStat({ key: 'toplam_kullanici', title: 'Kullanıcılar' })}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-400 p-6 text-white shadow-lg shadow-emerald-200 transition-all hover:scale-105 hover:shadow-xl cursor-pointer group">
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">KULLANICILAR</p>
                <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.genel?.toplam_kullanici || 0}</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                <UserGroupIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
          </div>

          {/* Branşlar */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-purple-400 p-6 text-white shadow-lg shadow-purple-200 transition-all hover:scale-105 hover:shadow-xl cursor-pointer group">
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-purple-100 text-xs font-bold uppercase tracking-widest">BRANŞLAR</p>
                <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.branslar?.length || 0}</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                <BookOpenIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
          </div>

          {/* Ekipler */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 to-orange-400 p-6 text-white shadow-lg shadow-orange-200 transition-all hover:scale-105 hover:shadow-xl cursor-pointer group">
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-orange-100 text-xs font-bold uppercase tracking-widest">EKİPLER</p>
                <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.genel?.toplam_ekip || 0}</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                <UserGroupIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
          </div>
        </div>

        {/* Modal - Same as before */}
        {selectedStat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{selectedStat.title} Detayları</h3>
                <button onClick={() => setSelectedStat(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                  {detayliStats?.branslar?.map((b, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100 transition">
                      <span className="font-medium text-gray-700">{b.brans_adi}</span>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{b.soru_sayisi}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. SORU YAZICI
  if (activeRole === 'soru_yazici') {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-blue-700 to-blue-600 p-8 rounded-2xl shadow-lg text-white">
          <div>
            <h1 className="text-3xl font-bold">Hoş Geldiniz, {user?.ad_soyad}</h1>
            <p className="text-blue-100 mt-2 text-lg">Soru hazırlama stüdyosuna erişiminiz hazır.</p>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <RefreshButton onRefresh={fetchData} loading={loading} />
            <Link
              to="/sorular/yeni"
              className="flex items-center gap-3 px-8 py-4 bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition shadow-xl font-bold text-lg transform hover:scale-105"
            >
              <PencilSquareIcon className="w-6 h-6" />
              Yeni Soru Başlat
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <InformationCircleIcon className="w-6 h-6 text-blue-500" />
              Soru Ekleme Şablon Bilgileri
            </h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono font-bold text-gray-500 mt-0.5">DAR</span>
                <span><strong>82mm Sütun Genişliği:</strong> Tek sütunlu dizgi formatına uygun sorular için bu modu kullanın.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono font-bold text-gray-500 mt-0.5">GENİŞ</span>
                <span><strong>169mm Sütun Genişliği:</strong> Tam sayfa genişliğindeki veya yan yana tablolu sorular için uygundur.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-500 mt-0.5">RESİM</span>
                <span>Hazır soru görsellerini (PNG/JPG) yükleyebilirsiniz.</span>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center">
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">İNCELENEN</span>
              <span className="text-3xl font-black text-blue-600">{stats?.inceleme_bekliyor || 0}</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center ring-2 ring-red-100">
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1 text-red-600">REVİZE BEKLEYEN</span>
              <span className="text-3xl font-black text-red-600">{(stats?.revize_istendi || 0) + (stats?.revize_gerekli || 0)}</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center">
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1 text-orange-600">DİZGİ AŞAMASI</span>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-orange-600">{stats?.dizgide || 0}</span>
                {(stats?.dizgi_bekliyor || 0) > 0 && (
                  <span className="text-[10px] font-bold text-orange-400 mt-1 uppercase">+{stats.dizgi_bekliyor} Sırada Bekliyor</span>
                )}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center">
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1 text-green-600">TAMAMLANAN</span>
              <span className="text-3xl font-black text-green-600">{stats?.tamamlandi || 0}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. İNCELEMECİ
  if (activeRole === 'incelemeci') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {reviewMode === 'alanci' ? 'Alan İnceleme Paneli' : 'Dil İnceleme Paneli'}
              </h1>
              <p className="text-gray-500">
                Lütfen incelemek istediğiniz branşı seçiniz.
              </p>
            </div>
            <RefreshButton onRefresh={fetchData} loading={loading} />
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />
            <span>Bilgi: İncelemesi biten veya dizgiye gönderilen soruları sol menüdeki <b>"Soru Havuzu"</b> sekmesinden takip edebilirsiniz.</span>
          </div>

          {isActualAdmin && canAlanInceleme && canDilInceleme && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReviewMode('alanci')}
                className={`px-4 py-2 rounded-lg font-medium transition ${reviewMode === 'alanci'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Alan
              </button>
              <button
                type="button"
                onClick={() => setReviewMode('dilci')}
                className={`px-4 py-2 rounded-lg font-medium transition ${reviewMode === 'dilci'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Dil
              </button>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {canAlanInceleme && (isActualAdmin || user?.inceleme_alanci) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Alan İnceleme</h4>
                <div className="flex flex-wrap gap-3">
                  {branslar.map(brans => {
                    const countObj = incelemeBransCounts.find(b => Number(b.id) === Number(brans.id));
                    const count = countObj ? Number(countObj.alanci || 0) : 0;
                    return (
                      <button
                        key={`alan-${brans.id}`}
                        onClick={() => { setSelectedBrans(brans); setReviewMode('alanci'); }}
                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${selectedBrans?.id === brans.id && reviewMode === 'alanci'
                          ? 'bg-blue-600 text-white shadow-md transform scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <span>{brans.brans_adi}</span>
                        {count > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {canDilInceleme && (isActualAdmin || user?.inceleme_dilci) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Dil İnceleme</h4>
                <div className="flex flex-wrap gap-3">
                  {branslar.map(brans => {
                    const countObj = incelemeBransCounts.find(b => Number(b.id) === Number(brans.id));
                    const count = countObj ? Number(countObj.dilci || 0) : 0;
                    return (
                      <button
                        key={`dil-${brans.id}`}
                        onClick={() => { setSelectedBrans(brans); setReviewMode('dilci'); }}
                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${selectedBrans?.id === brans.id && reviewMode === 'dilci'
                          ? 'bg-purple-600 text-white shadow-md transform scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <span>{brans.brans_adi}</span>
                        {count > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedBrans ? (
          <IncelemeListesi
            bransId={selectedBrans.id}
            bransAdi={selectedBrans.brans_adi}
            reviewMode={reviewMode}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
            <BookOpenIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Soruları görüntülemek için yukarıdan bir branş seçiniz.</p>
          </div>
        )}
      </div>
    );
  }

  // 4. DİZGİCİ
  if (activeRole === 'dizgici') {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-orange-600 to-orange-500 text-white">
          <div>
            <h1 className="text-3xl font-bold">Hoş Geldiniz, {user?.ad_soyad}</h1>
            <p className="text-orange-50 mt-2 text-lg font-medium opacity-90">Dizgi ve mizanpaj görevleriniz burada yönetilmeyi bekliyor.</p>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <RefreshButton onRefresh={fetchData} loading={loading} />
            <Link
              to="/dizgi-yonetimi"
              className="flex items-center gap-3 px-8 py-4 bg-white text-orange-600 rounded-xl hover:bg-orange-50 transition shadow-xl font-bold text-lg"
            >
              <DocumentTextIcon className="w-6 h-6" />
              Dizgi Yönetimine Git
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">BEKLEYEN DİZGİ</p>
            <h3 className="text-4xl font-black text-orange-600">{stats?.dizgi_bekliyor || 0}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">DİZGİSİ SÜREN</p>
            <h3 className="text-4xl font-black text-blue-600">{stats?.dizgide || 0}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">TAMAMLANAN</p>
            <h3 className="text-4xl font-black text-green-600">{stats?.tamamlandi || 0}</h3>
          </div>
        </div>
      </div>
    );
  }

  // 5. DEFAULT
  return (
    <div className="p-8 text-center text-gray-500">
      <h2 className="text-xl font-semibold text-gray-700">Panel Hazırlanıyor</h2>
      <p>Rolünüze uygun içerik yüklenemedi veya yetkiniz kısıtlı.</p>
    </div>
  );
}
