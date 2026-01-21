import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI, ekipAPI } from '../services/api';
import {
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon,
  PencilSquareIcon,
  InformationCircleIcon
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

        const filtered = allQuestions.filter(s => {
          const isBransMatch = parseInt(s.brans_id) === parseInt(bransId);
          if (!isBransMatch) return false;

          const isStatusSuitable = ['inceleme_bekliyor', 'incelemede', 'dizgide', 'revize_istendi', 'inceleme_tamam'].includes(s.durum);

          let isPendingReview = false;
          // Değerleri authUser veya adminlik durumuna göre belirle
          const isAlanci = !!authUser?.inceleme_alanci || authUser?.rol === 'admin';
          const isDilci = !!authUser?.inceleme_dilci || authUser?.rol === 'admin';

          if (reviewMode === 'alanci') {
            isPendingReview = !s.onay_alanci;
          } else if (reviewMode === 'dilci') {
            isPendingReview = !s.onay_dilci;
          } else {
            // Varsayılan mod (mod seçilmemişse yetkiye göre)
            if (isAlanci && !isDilci) isPendingReview = !s.onay_alanci;
            else if (isDilci && !isAlanci) isPendingReview = !s.onay_dilci;
            else if (isAlanci && isDilci) isPendingReview = (!s.onay_alanci || !s.onay_dilci);
          }

          return isStatusSuitable && isPendingReview;
        });
        setSorular(filtered);
      } catch (err) {
        console.error("Sorular çekilemedi", err);
        setError("Bir hata oluştu: " + (err.message));
      } finally {
        setListLoading(false);
      }
    };
    if (bransId) fetchSorular();
  }, [bransId, reviewMode, authUser]);

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
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition transform group-hover:scale-105 ${reviewMode === 'alanci' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
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
  const [ekipler, setEkipler] = useState([]);
  const [incelemeBransCounts, setIncelemeBransCounts] = useState([]);
  const [selectedBrans, setSelectedBrans] = useState(null);
  const [selectedEkip, setSelectedEkip] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);
  const [showBransDetay, setShowBransDetay] = useState(false);
  const [reviewMode, setReviewMode] = useState(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    const mode = params.get('mode');
    return (mode === 'alanci' || mode === 'dilci') ? mode : null;
  });

  // Sync reviewMode with URL param if it changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    const mode = params.get('mode');
    if (mode && (mode === 'alanci' || mode === 'dilci')) {
      setReviewMode(mode);
    } else if (!mode) {
      // URL'de mode yoksa null yap (ana sayfa için)
      setReviewMode(null);
    }
  }, [window.location.hash, window.location.search]);

  // İncelemeci için mode yoksa ve kullanıcı sadece bir türde incelemeci ise otomatik ayarla
  useEffect(() => {
    if (activeRole !== 'incelemeci') return;
    if (isActualAdmin) return;

    const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    const urlMode = params.get('mode');

    // Sadece URL'de mode parametresi varsa otomatik ayarla
    if (urlMode && (urlMode === 'alanci' || urlMode === 'dilci')) {
      if (user?.inceleme_alanci && !user?.inceleme_dilci) setReviewMode('alanci');
      else if (user?.inceleme_dilci && !user?.inceleme_alanci) setReviewMode('dilci');
    }
  }, [activeRole, isActualAdmin, user?.inceleme_alanci, user?.inceleme_dilci]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeRole === 'admin') {
        const res = await soruAPI.getDetayliStats();
        if (res.data.success) setDetayliStats(res.data.data);
      } else {
        const res = await soruAPI.getStats({ role: activeRole });
        if (res.data.success) setStats(res.data.data);
      }
      if (activeRole === 'incelemeci') {
        const res = await soruAPI.getIncelemeDetayliStats();
        if (res.data.success) setIncelemeBransCounts(res.data.data);
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
          <div className="hidden md:block">
            <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold border border-gray-200">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

          <div onClick={() => setSelectedStat({ key: 'toplam_kullanici', title: 'Kullanıcılar' })}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-400 p-6 text-white shadow-lg shadow-emerald-200 transition-all hover:scale-105 hover:shadow-xl cursor-pointer group">
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">KULLANICILAR</p>
                <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.sistem?.toplam_kullanici || 0}</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                <UserGroupIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
          </div>

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

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 to-orange-400 p-6 text-white shadow-lg shadow-orange-200 transition-all hover:scale-105 hover:shadow-xl cursor-pointer group">
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-orange-100 text-xs font-bold uppercase tracking-widest">EKİPLER</p>
                <h3 className="text-4xl font-extrabold mt-2">{detayliStats?.sistem?.toplam_ekip || 0}</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                <UserGroupIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
          </div>
        </div>

        {/* --- YENİ BÖLÜM: Soru Yaşam Döngüsü ve İş Yükü (Admin İçin) --- */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 table-responsive animate-fade-in-up">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
            Soru Yaşam Döngüsü ve İş Yükü
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center">
            <div className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-200 w-full relative group hover:border-blue-300 transition">
              <p className="text-xs font-bold text-gray-400 uppercase">TASLAK / BEKLİYOR</p>
              <p className="text-2xl font-black text-gray-700 mt-1">{detayliStats?.genel?.beklemede || 0}</p>
            </div>

            <div className="flex-1 p-4 bg-yellow-50 rounded-xl border border-yellow-200 w-full relative group hover:border-yellow-400 transition">
              <p className="text-xs font-bold text-yellow-600 uppercase">İNCELEME BEKLİYOR</p>
              <p className="text-3xl font-black text-yellow-700 mt-1">{detayliStats?.genel?.inceleme_bekliyor || 0}</p>
            </div>

            <div className="flex-1 p-4 bg-red-50 rounded-xl border border-red-200 w-full relative group hover:border-red-400 transition">
              <p className="text-xs font-bold text-red-600 uppercase">REVİZE / DÜZELTME</p>
              <p className="text-2xl font-black text-red-700 mt-1">{detayliStats?.genel?.revize_istendi || 0}</p>
            </div>

            <div className="flex-1 p-4 bg-orange-50 rounded-xl border border-orange-200 w-full relative group hover:border-orange-400 transition">
              <p className="text-xs font-bold text-orange-600 uppercase">DİZGİ AŞAMASI</p>
              <p className="text-2xl font-black text-orange-700 mt-1">{(parseInt(detayliStats?.genel?.dizgi_bekliyor) || 0) + (parseInt(detayliStats?.genel?.dizgide) || 0)}</p>
            </div>

            <div className="flex-1 p-4 bg-green-50 rounded-xl border border-green-200 w-full hover:border-green-400 transition">
              <p className="text-xs font-bold text-green-600 uppercase">HAVUZDA (TAMAM)</p>
              <p className="text-3xl font-black text-green-700 mt-1">{detayliStats?.genel?.tamamlandi || 0}</p>
            </div>
          </div>
        </div>

        {selectedStat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedStat(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{selectedStat.title} Detayları</h3>
                <button onClick={() => setSelectedStat(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {selectedStat.key === 'toplam_soru' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Branş Dağılımı</h4>
                      <div className="space-y-2">
                        {detayliStats?.branslar?.filter(b => b.soru_sayisi > 0).map((b, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700">{b.brans_adi}</span>
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{b.soru_sayisi}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {selectedStat.key === 'toplam_kullanici' && (
                  <div className="space-y-4">
                    {[
                      { label: 'Yöneticiler', value: detayliStats?.sistem?.admin_sayisi },
                      { label: 'Branşlar', value: detayliStats?.sistem?.soru_yazici_sayisi },
                      { label: 'Dizgiciler', value: detayliStats?.sistem?.dizgici_sayisi },
                      { label: 'İncelemeciler', value: detayliStats?.sistem?.incelemeci_sayisi },
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                        <span className="font-bold text-gray-700">{item.label}</span>
                        <span className="text-xl font-black text-emerald-600">{item.value || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
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

        {/* Revize Uyarısı - Aksiyon Gerektiren Durum */}
        {((stats?.revize_istendi || 0) + (stats?.revize_gerekli || 0)) > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm flex flex-col md:flex-row justify-between items-center animate-pulse-slow gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-red-800 text-xl">Aksiyon Gerekiyor!</h3>
                <p className="text-red-700 font-medium mt-1">Toplam <span className="font-black text-2xl mx-1">{(stats?.revize_istendi || 0) + (stats?.revize_gerekli || 0)}</span> sorunuz için incelemeciler düzeltme talep etti.</p>
              </div>
            </div>
            <Link to="/sorular?takip=1" className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-200 whitespace-nowrap">
              Düzeltmeleri Gör &rarr;
            </Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-blue-700 to-blue-600 p-8 rounded-2xl shadow-lg text-white">
          <div>
            <h1 className="text-3xl font-bold">Hoş Geldiniz, {user?.ad_soyad}</h1>
            <p className="text-blue-100 mt-2 text-lg">Soru hazırlama stüdyosuna erişiminiz hazır.</p>
          </div>
          <Link
            to="/sorular/yeni"
            className="mt-4 md:mt-0 flex items-center gap-3 px-8 py-4 bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition shadow-xl font-bold text-lg transform hover:scale-105"
          >
            <PencilSquareIcon className="w-6 h-6" />
            Yeni Soru Başlat
          </Link>
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
            <div className={`bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-center items-center ${((stats?.revize_istendi || 0) + (stats?.revize_gerekli || 0)) > 0 ? 'border-red-300 ring-2 ring-red-100 bg-red-50' : 'border-gray-200'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${((stats?.revize_istendi || 0) + (stats?.revize_gerekli || 0)) > 0 ? 'text-red-600' : 'text-gray-500'}`}>REVİZE BEKLEYEN</span>
              <span className={`text-3xl font-black ${((stats?.revize_istendi || 0) + (stats?.revize_gerekli || 0)) > 0 ? 'text-red-600' : 'text-gray-600'}`}>{(stats?.revize_istendi || 0) + (stats?.revize_gerekli || 0)}</span>
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
    // URL'den mode parametresini kontrol et
    const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    const mode = params.get('mode');

    // Eğer mode parametresi yoksa (Ana Sayfa), genel özet göster
    if (!mode) {
      return (
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 tracking-tight">İnceleme Paneli</h1>
              <p className="text-gray-500 mt-1 font-medium">Hoş geldiniz, {user?.ad_soyad}. İşte genel bakış.</p>
            </div>
            <div className="hidden md:block">
              <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold border border-gray-200">
                {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Genel İstatistikler */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div onClick={() => setShowBransDetay(true)}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 p-6 text-white shadow-lg shadow-blue-200 transition-all hover:scale-105 hover:shadow-xl group cursor-pointer">
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">EKİPLER</p>
                  <h3 className="text-4xl font-extrabold mt-2">
                    {new Set(incelemeBransCounts.map(b => b.ekip_id)).size || 0}
                  </h3>
                </div>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                  <UserGroupIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
            </div>

            {canAlanInceleme && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-400 p-6 text-white shadow-lg shadow-emerald-200 transition-all hover:scale-105 hover:shadow-xl group">
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">ALAN İNCELEME BEKLİYOR</p>
                    <h3 className="text-4xl font-extrabold mt-2">
                      {incelemeBransCounts.reduce((sum, b) => sum + (Number(b.alanci_bekleyen) || 0), 0)}
                    </h3>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                    <DocumentTextIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
              </div>
            )}

            {canDilInceleme && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-purple-400 p-6 text-white shadow-lg shadow-purple-200 transition-all hover:scale-105 hover:shadow-xl group">
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <p className="text-purple-100 text-xs font-bold uppercase tracking-widest">DİL İNCELEME BEKLİYOR</p>
                    <h3 className="text-4xl font-extrabold mt-2">
                      {incelemeBransCounts.reduce((sum, b) => sum + (Number(b.dilci_bekleyen) || 0), 0)}
                    </h3>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition">
                    <DocumentTextIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
              </div>
            )}
          </div>

          {/* Ekiplere Göre Soru Dağılımı */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-6 h-6 text-blue-600" />
              Ekiplere Göre İnceleme Dağılımı
            </h2>

            {incelemeBransCounts.length === 0 ? (
              <div className="p-8 bg-gray-50 rounded-xl text-center text-gray-500 border border-gray-200 shadow-sm flex flex-col items-center">
                <BookOpenIcon className="w-12 h-12 text-gray-300 mb-2" />
                <p>Henüz inceleme bekleyen soru bulunmuyor.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const teamMap = {};
                  incelemeBransCounts.forEach(item => {
                    if (!teamMap[item.ekip_adi]) teamMap[item.ekip_adi] = { name: item.ekip_adi, alanci: 0, dilci: 0, branches: [] };
                    const a = Number(item.alanci_bekleyen) || 0;
                    const d = Number(item.dilci_bekleyen) || 0;
                    teamMap[item.ekip_adi].alanci += a;
                    teamMap[item.ekip_adi].dilci += d;
                    teamMap[item.ekip_adi].branches.push({ name: item.brans_adi, a, d });
                  });

                  return Object.values(teamMap).map(tm => (
                    <div key={tm.name} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                          <UserGroupIcon className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">{tm.name}</h3>
                      </div>
                      <div className="space-y-2">
                        {tm.alanci > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Alan İnceleme:</span>
                            <span className="font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{tm.alanci}</span>
                          </div>
                        )}
                        {tm.dilci > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Dil İnceleme:</span>
                            <span className="font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{tm.dilci}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200">
                          {tm.branches.length} Branşta Bekleyen Var
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Hızlı Erişim */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Hızlı Erişim</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {canAlanInceleme && (
                <Link
                  to="/?mode=alanci"
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition">
                      <DocumentTextIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Alan İnceleme</h3>
                      <p className="text-xs text-gray-600">Branş seçerek inceleyin</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
              {canDilInceleme && (
                <Link
                  to="/?mode=dilci"
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition">
                      <DocumentTextIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Dil İnceleme</h3>
                      <p className="text-xs text-gray-600">Branş seçerek inceleyin</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          {/* Branş ve Ekip Detay Modalı */}
          {showBransDetay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowBransDetay(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="text-lg font-bold text-gray-900">Ekipler ve İnceleme Durumları</h3>
                  <button onClick={() => setShowBransDetay(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-4">
                    {(() => {
                      const teamsStats = Object.values(incelemeBransCounts.reduce((acc, item) => {
                        if (!acc[item.ekip_id]) {
                          acc[item.ekip_id] = { id: item.ekip_id, name: item.ekip_adi, count: 0 };
                        }
                        if (canAlanInceleme) acc[item.ekip_id].count += (Number(item.alanci_bekleyen) || 0);
                        if (canDilInceleme) acc[item.ekip_id].count += (Number(item.dilci_bekleyen) || 0);
                        return acc;
                      }, {}));

                      if (teamsStats.length === 0) return <p className="text-center text-gray-500">Kayıtlı ekip bulunamadı.</p>;

                      return teamsStats.sort((a, b) => b.count - a.count).map(team => (
                        <div key={team.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                              {team.name ? team.name.substring(0, 2).toUpperCase() : '??'}
                            </div>
                            <span className="font-bold text-gray-800">{team.name}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-lg font-bold ${team.count > 0 ? 'text-blue-600' : 'text-gray-500'}`}>{team.count}</span>
                            <span className="text-[10px] text-gray-400 block uppercase font-bold">BEKLEYEN</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Mode parametresi varsa (Alan İnceleme veya Dil İnceleme), branş seçim ekranını göster
    // Veriyi ekiplere ve takımlara göre grupla (useMemo ile optimize edildi)
    const { groupedTeams, teamAggregates } = useMemo(() => {
      const grouped = incelemeBransCounts.reduce((acc, item) => {
        if (!acc[item.ekip_adi]) acc[item.ekip_adi] = [];
        acc[item.ekip_adi].push(item);
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

    return (
      <div className="space-y-6 animate-fade-in">
        {/* HEADER & CRUMBS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {reviewMode === 'alanci' ? 'Alan İnceleme Paneli' : 'Dil İnceleme Paneli'}
            </h1>
            <nav className="flex items-center text-sm text-gray-500 gap-2">
              <span className={!selectedEkip ? "font-bold text-blue-600" : "hover:text-blue-600 cursor-pointer"} onClick={() => { setSelectedEkip(null); setSelectedBrans(null); }}>Ekipler</span>
              {selectedEkip && (
                <>
                  <span>/</span>
                  <span className={!selectedBrans ? "font-bold text-blue-600" : "hover:text-blue-600 cursor-pointer"} onClick={() => setSelectedBrans(null)}>{selectedEkip}</span>
                </>
              )}
              {selectedBrans && (
                <>
                  <span>/</span>
                  <span className="font-bold text-blue-600">{selectedBrans.brans_adi}</span>
                </>
              )}
            </nav>
          </div>
          <div className="text-right">
            {selectedBrans && (
              <button onClick={() => setSelectedBrans(null)} className="text-sm text-gray-500 hover:text-gray-700 underline">Branşlara Dön</button>
            )}
            {!selectedBrans && selectedEkip && (
              <button onClick={() => setSelectedEkip(null)} className="text-sm text-gray-500 hover:text-gray-700 underline">Tüm Ekiplere Dön</button>
            )}
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
          {/* LEVEL 3: QUESTION LIST */}
          {selectedBrans ? (
            <IncelemeListesi bransId={selectedBrans.id} bransAdi={selectedBrans.brans_adi} reviewMode={reviewMode} />
          ) : selectedEkip ? (
            /* LEVEL 2: BRANCH LIST FOR TEAM */
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-gray-400" /> {selectedEkip} Branşları
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(() => {
                  const branches = groupedTeams[selectedEkip]?.filter(item => {
                    // Branş yoksa veya null ise gösterme
                    if (!item.brans_id) return false;
                    const count = reviewMode === 'alanci' ? (Number(item.alanci_bekleyen) || 0) : (Number(item.dilci_bekleyen) || 0);
                    return count > 0;
                  });

                  if (!branches || branches.length === 0) {
                    return (
                      <div className="col-span-full p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        <BookOpenIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>Bu ekipte henüz bu kategoride incelenecek soru bulunmuyor.</p>
                      </div>
                    );
                  }

                  return branches.map(brans => {
                    const count = reviewMode === 'alanci' ? (Number(brans.alanci_bekleyen) || 0) : (Number(brans.dilci_bekleyen) || 0);
                    return (
                      <button
                        key={brans.brans_id}
                        onClick={() => setSelectedBrans({ id: brans.brans_id, brans_adi: brans.brans_adi })}
                        className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl hover:bg-blue-50 hover:shadow-md transition border border-gray-200 group"
                      >
                        <BookOpenIcon className={`w-8 h-8 mb-3 ${reviewMode === 'alanci' ? 'text-blue-500' : 'text-purple-500'}`} />
                        <span className="font-medium text-gray-800 text-center">{brans.brans_adi}</span>
                        <span className={`mt-2 ${reviewMode === 'alanci' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'} text-xs font-bold px-3 py-1 rounded-full`}>
                          {count} Soru
                        </span>
                      </button>
                    )
                  });
                })()}
              </div>
            </div>
          ) : (
            /* LEVEL 1: TEAM LIST */
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">İnceleme Bekleyen Ekipler</h2>
              {teamAggregates.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CheckCircleIcon className="w-16 h-16 mx-auto mb-3 opacity-20" />
                  <p>Harika! Şu an incelenmesi gereken hiç soru yok.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {teamAggregates.map(agg => (
                    <button
                      key={agg.ekipAdi}
                      onClick={() => setSelectedEkip(agg.ekipAdi)}
                      className="flex items-center justify-between p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:border-blue-300 transition group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${reviewMode === 'alanci' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'} group-hover:scale-110 transition`}>
                          <UserGroupIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-700 transition">{agg.ekipAdi}</h3>
                          <p className="text-xs text-gray-500 font-medium">{agg.items.length} farklı branşta</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`block text-2xl font-black ${reviewMode === 'alanci' ? 'text-blue-600' : 'text-purple-600'}`}>
                          {agg.totalPending}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">SORU</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
          <Link
            to="/dizgi-yonetimi"
            className="mt-4 md:mt-0 flex items-center gap-3 px-8 py-4 bg-white text-orange-600 rounded-xl hover:bg-orange-50 transition shadow-xl font-bold text-lg"
          >
            <DocumentTextIcon className="w-6 h-6" />
            Dizgi Yönetimine Git
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">BEKLEYEN DİZGİ</p>
            <h3 className="text-4xl font-black text-orange-600">{stats?.dizgi_bekliyor || 0}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">DİZGİSİ SÜREN</p>
            <h3 className="text-4xl font-black text-blue-600">{stats?.dizgide || 0}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center ring-2 ring-purple-100">
            <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-1">DOSYA BEKLEYEN</p>
            <h3 className="text-4xl font-black text-purple-600">{stats?.dosya_bekliyor || 0}</h3>
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
