import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, istatistikAPI, bransAPI } from '../services/api';
import {
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';

function IncelemeListesi({ bransId, bransAdi, reviewMode }) {
  const [sorular, setSorular] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSorular = async () => {
      setListLoading(true);
      setError(null);
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sunucu yanıt vermedi')), 10000));
        const res = await Promise.race([soruAPI.getAll(), timeoutPromise]);

        const allQuestions = res.data.data || [];

        const filtered = allQuestions.filter(s => {
          const isBransMatch = parseInt(s.brans_id) === parseInt(bransId);
          if (!isBransMatch) return false;
          const isStatusSuitable = ['inceleme_bekliyor', 'beklemede', 'incelemede', 'dizgide'].includes(s.durum);

          let isPendingReview = false;
          if (reviewMode === 'alanci') isPendingReview = !s.onay_alanci;
          if (reviewMode === 'dilci') isPendingReview = !s.onay_dilci;

          const notFinished = s.durum !== 'dizgi_bekliyor' && s.durum !== 'tamamlandi';

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
  }, [bransId, reviewMode]);

  const content = (
    <div className="mt-8">
      <h3 className="text-xl font-bold text-gray-800 mb-4">{bransAdi} - İnceleme Bekleyen Sorular</h3>
      {sorular.length === 0 ? (
        <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-500 border border-gray-200">
          Bu branşta incelenecek soru bulunamadı.
        </div>
      ) : (
        <div className="grid gap-4">
          {sorular.map(soru => (
            <div key={soru.id} className="card flex justify-between items-center hover:bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-4">
                {soru.fotograf_url && (
                  <img src={soru.fotograf_url} alt="" className="w-16 h-16 object-contain border rounded bg-white shadow-sm" />
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${soru.zorluk_seviyesi === 'kolay' || soru.zorluk_seviyesi === 1 ? 'bg-green-100 text-green-800' :
                        soru.zorluk_seviyesi === 'orta' || soru.zorluk_seviyesi === 2 || soru.zorluk_seviyesi === 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                      }`}>
                      {['ÇOK KOLAY', 'KOLAY', 'ORTA', 'ZOR', 'ÇOK ZOR'][soru.zorluk_seviyesi - 1] || String(soru.zorluk_seviyesi).toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">#{soru.id}</span>
                  </div>
                  <div className="mt-1 font-medium text-gray-900 line-clamp-2" dangerouslySetInnerHTML={{ __html: soru.soru_metni?.substring(0, 300) }} />
                  <p className="text-xs text-gray-500 mt-1">Yazar: {soru.olusturan_kullanici_ad_soyad} • Tarih: {new Date(soru.olusturulma_tarihi).toLocaleDateString("tr-TR")}</p>
                </div>
              </div>
              <Link to={`/sorular/${soru.id}?incelemeTuru=${reviewMode}`} className={`px-4 py-2 text-white text-sm font-medium rounded hover:opacity-90 transition ${reviewMode === 'alanci' ? 'bg-blue-600' : 'bg-green-600'}`}>
                {reviewMode === 'alanci' ? 'Alan İncele' : 'Dil İncele'}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (error) return (
    <div>
      <div className="text-center py-2 text-red-800 bg-red-100 rounded-lg mb-4 border border-red-200">{error}</div>
      {content}
    </div>
  );
  if (listLoading) return <div className="text-center py-8">Yükleniyor...</div>;

  return content;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const { effectiveRole } = useOutletContext() || {};

  // Logic: Eğer admin ise ve bir rol seçilmişse onu kullan, yoksa kendi rolü.
  const activeRole = (user?.rol === 'admin' && effectiveRole) ? effectiveRole : (user?.rol || effectiveRole);

  const [stats, setStats] = useState(null);
  const [detayliStats, setDetayliStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // İncelemeci modu state
  const [branslar, setBranslar] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [selectedBranchName, setSelectedBranchName] = useState(null);

  // İstatistik Detay Modal
  const [selectedStat, setSelectedStat] = useState(null);

  const getRoleGreeting = () => {
    const greetings = {
      admin: 'Sistem Yöneticisi',
      soru_yazici: 'Soru Yazıcı',
      dizgici: 'Dizgici',
      incelemeci: 'İncelemeci',
      alan_incelemeci: 'Alan İncelemeci',
      dil_incelemeci: 'Dil İncelemeci'
    };
    return greetings[activeRole] || '';
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeRole === 'admin') {
          const res = await istatistikAPI.getDetayliStats();
          if (res.data.success) {
            setDetayliStats(res.data.data);
          }
        } else {
          // Diğer roller için genel stats (veya rolüne özel endpoint varsa o)
          const res = await istatistikAPI.getGenelStats();
          if (res.data.success) {
            setStats(res.data.data);
          }
        }

        // Eğer incelemeci modundaysak branşları çekmeliyiz
        if (['alan_incelemeci', 'dil_incelemeci', 'incelemeci'].includes(activeRole)) {
          try {
            const bransRes = await bransAPI.getAll();
            if (bransRes.data.success) {
              setBranslar(bransRes.data.data);
            }
          } catch (err) {
            console.error("Branşlar çekilemedi", err);
          }
        }

      } catch (error) {
        console.error('İstatistikler yüklenirken hata:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user || activeRole) {
      fetchData();
    }
  }, [user, activeRole]);

  // Loading durumu
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-gray-600">İstatistikler yükleniyor...</p>
      </div>
    );
  }

  // --- ADMIN DASHBOARD ---
  if (activeRole === 'admin') {
    return (
      <div className="space-y-6">
        {/* İstatistik Modal */}
        {selectedStat && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setSelectedStat(null)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        {selectedStat.title}
                      </h3>
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        {['TÜRKÇE', 'FEN BİLİMLERİ', 'SOSYAL BİLGİLER', 'MATEMATİK', 'İNGİLİZCE'].map((bransAdi) => {
                          const statKey = selectedStat.key;
                          const findCount = () => {
                            if (!detayliStats?.branslar) return 0;
                            const matchingBranches = detayliStats.branslar.filter(b =>
                              b.brans_adi.trim().toUpperCase() === bransAdi.trim().toUpperCase() ||
                              (bransAdi === 'TÜRKÇE' && b.brans_adi.toUpperCase().includes('TURKCE')) ||
                              (bransAdi === 'İNGİLİZCE' && b.brans_adi.toUpperCase().includes('INGILIZCE'))
                            );
                            return matchingBranches.reduce((acc, curr) => {
                              const val = (statKey === 'toplam_soru' ? curr.soru_sayisi : curr[statKey]);
                              return acc + (parseInt(val) || 0);
                            }, 0);
                          };
                          const count = findCount();
                          return (
                            <div key={bransAdi} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                              <span className="font-medium text-gray-700">{bransAdi}</span>
                              <span className="font-bold text-gray-900">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setSelectedStat(null)}
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ana İstatistikler */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Genel İstatistikler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => setSelectedStat({ key: 'toplam_soru', title: 'Toplam Soru' })} className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white cursor-pointer transform transition hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium opacity-90">Toplam Soru</h3>
                  <p className="text-3xl font-bold mt-2">{detayliStats?.genel?.toplam_soru || 0}</p>
                </div>
                <DocumentTextIcon className="w-8 h-8 opacity-75" />
              </div>
            </div>
            {/* Diğer istatistik kartları... (Kısaltıldı ama temel yapı aynı) */}
            <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
              <h3 className="text-sm font-medium opacity-90">Beklemede</h3>
              <p className="text-3xl font-bold mt-2">{detayliStats?.genel?.beklemede || 0}</p>
            </div>
            <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <h3 className="text-sm font-medium opacity-90">Dizgide</h3>
              <p className="text-3xl font-bold mt-2">{detayliStats?.genel?.dizgide || 0}</p>
            </div>
            <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
              <h3 className="text-sm font-medium opacity-90">Tamamlandı</h3>
              <p className="text-3xl font-bold mt-2">{detayliStats?.genel?.tamamlandi || 0}</p>
            </div>
          </div>
        </div>

        {/* Sistem Bilgileri */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">🖥️ Sistem Bilgileri</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card bg-purple-50 border-l-4 border-purple-500">
              <h3 className="text-sm font-medium text-purple-900">Toplam Kullanıcı</h3>
              <p className="text-2xl font-bold text-purple-700 mt-2">{detayliStats?.sistem?.toplam_kullanici || 0}</p>
              <p className="text-xs text-purple-600 mt-1">
                {detayliStats?.sistem?.admin_sayisi} Admin, {detayliStats?.sistem?.soru_yazici_sayisi} Yazıcı
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- İNCELEMECİ MODU (Alan ve Dil) ---
  if (['alan_incelemeci', 'dil_incelemeci', 'incelemeci'].includes(activeRole)) {
    const reviewMode = activeRole === 'alan_incelemeci' ? 'alanci' :
      activeRole === 'dil_incelemeci' ? 'dilci' : 'genel';

    return (
      <div className="space-y-6">
        {/* Hoşgeldin Mesajı */}
        <div className="card bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <h1 className="text-3xl font-bold">
            Hoş Geldiniz, {user?.ad_soyad}
          </h1>
          <p className="mt-2 text-purple-100">
            {activeRole === 'incelemeci' ? 'İncelemeci paneli.' : `İncelemeci paneline hoş geldiniz (${reviewMode === 'alanci' ? 'ALAN' : 'DİL'}). İncelemek istediğiniz branşı seçin.`}
          </p>
        </div>

        {/* Branş Seçimi */}
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-gray-800">Branşlar</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {branslar.map(brans => (
            <div
              key={brans.id}
              onClick={() => { setSelectedBranchId(brans.id); setSelectedBranchName(brans.brans_adi); }}
              className={`card cursor-pointer transition-all hover:scale-105 border-l-4 ${selectedBranchId === brans.id ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200' : 'hover:bg-gray-50'
                } ${brans.brans_adi === 'TÜRKÇE' ? 'border-blue-500' :
                  brans.brans_adi === 'MATEMATİK' ? 'border-red-500' :
                    brans.brans_adi === 'FEN BİLİMLERİ' ? 'border-green-500' :
                      brans.brans_adi === 'İNGİLİZCE' ? 'border-indigo-500' :
                        'border-yellow-500'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">{brans.brans_adi}</span>
                {selectedBranchId === brans.id && <CheckCircleIcon className="w-5 h-5 text-blue-500" />}
              </div>
            </div>
          ))}
        </div>

        {/* Seçili Branşın Soruları */}
        {selectedBranchId && (
          <IncelemeListesi
            bransId={selectedBranchId}
            bransAdi={selectedBranchName}
            reviewMode={reviewMode}
          />
        )}
      </div>
    );
  }

  // --- DİĞER ROLLER (Soru Yazıcı, Dizgici vs) ---
  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900">
          Hoş Geldiniz, {user?.ad_soyad}
        </h1>
        <p className="mt-2 text-gray-600">
          {getRoleGreeting()} paneline hoş geldiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <h3 className="text-lg font-medium opacity-90">Toplam Soru</h3>
          <p className="text-4xl font-bold mt-2">{stats?.toplam || 0}</p>
        </div>
        <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <h3 className="text-lg font-medium opacity-90">Beklemede</h3>
          <p className="text-4xl font-bold mt-2">{stats?.beklemede || 0}</p>
        </div>
        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <h3 className="text-lg font-medium opacity-90">Dizgide</h3>
          <p className="text-4xl font-bold mt-2">{stats?.dizgide || 0}</p>
        </div>
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <h3 className="text-lg font-medium opacity-90">Tamamlandı</h3>
          <p className="text-4xl font-bold mt-2">{stats?.tamamlandi || 0}</p>
        </div>
      </div>
    </div>
  );
}
