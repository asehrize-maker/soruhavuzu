import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI } from '../services/api';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [detayliStats, setDetayliStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      if (user?.rol === 'admin') {
        const [genelRes, detayliRes] = await Promise.all([
          soruAPI.getStats(),
          soruAPI.getDetayliStats()
        ]);
        setStats(genelRes.data.data);
        setDetayliStats(detayliRes.data.data);
      } else {
        const response = await soruAPI.getStats();
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleGreeting = () => {
    const greetings = {
      admin: 'Sistem Yöneticisi',
      soru_yazici: 'Soru Yazıcı',
      dizgici: 'Dizgici',
    };
    return greetings[user?.rol] || '';
  };

  // Loading durumu
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-gray-600">İstatistikler yükleniyor...</p>
      </div>
    );
  }

  // Admin için detaylı dashboard
  if (user?.rol === 'admin' && detayliStats) {
    return (
      <div className="space-y-6">


        {/* Ana İstatistikler */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Genel İstatistikler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium opacity-90">Toplam Soru</h3>
                  <p className="text-3xl font-bold mt-2">{detayliStats.genel.toplam_soru || 0}</p>
                </div>
                <svg className="w-12 h-12 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium opacity-90">Beklemede</h3>
                  <p className="text-3xl font-bold mt-2">{detayliStats.genel.beklemede || 0}</p>
                </div>
                <svg className="w-12 h-12 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium opacity-90">Dizgide</h3>
                  <p className="text-3xl font-bold mt-2">{detayliStats.genel.dizgide || 0}</p>
                </div>
                <svg className="w-12 h-12 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium opacity-90">Tamamlandı</h3>
                  <p className="text-3xl font-bold mt-2">{detayliStats.genel.tamamlandi || 0}</p>
                </div>
                <svg className="w-12 h-12 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Sistem Bilgileri */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">🖥️ Sistem Bilgileri</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card bg-purple-50 border-l-4 border-purple-500">
              <h3 className="text-sm font-medium text-purple-900">Toplam Kullanıcı</h3>
              <p className="text-2xl font-bold text-purple-700 mt-2">{detayliStats.sistem.toplam_kullanici || 0}</p>
              <p className="text-xs text-purple-600 mt-1">
                {detayliStats.sistem.admin_sayisi} Admin, {detayliStats.sistem.soru_yazici_sayisi} Yazıcı, {detayliStats.sistem.dizgici_sayisi} Dizgici
              </p>
            </div>

            <div className="card bg-indigo-50 border-l-4 border-indigo-500">
              <h3 className="text-sm font-medium text-indigo-900">Toplam Ekip</h3>
              <p className="text-2xl font-bold text-indigo-700 mt-2">{detayliStats.sistem.toplam_ekip || 0}</p>
            </div>

            <div className="card bg-pink-50 border-l-4 border-pink-500">
              <h3 className="text-sm font-medium text-pink-900">Toplam Branş</h3>
              <p className="text-2xl font-bold text-pink-700 mt-2">{detayliStats.sistem.toplam_brans || 0}</p>
            </div>

            <div className="card bg-teal-50 border-l-4 border-teal-500">
              <h3 className="text-sm font-medium text-teal-900">Fotoğraflı Soru</h3>
              <p className="text-2xl font-bold text-teal-700 mt-2">{detayliStats.genel.fotografli || 0}</p>
              <p className="text-xs text-teal-600 mt-1">
                {detayliStats.genel.latexli || 0} LaTeX'li soru
              </p>
            </div>
          </div>
        </div>



        {/* Branş Performansı */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🏆 Branş Performansı</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branş</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ekip</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Toplam</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Beklemede</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Dizgide</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamamlandı</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detayliStats.branslar.slice(0, 10).map((brans, index) => (
                  <tr key={brans.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{brans.brans_adi}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{brans.ekip_adi}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-600">{brans.soru_sayisi}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-yellow-600">{brans.beklemede}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-orange-600">{brans.dizgide}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600">{brans.tamamlandi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>




      </div>
    );
  }

  // Diğer roller için standart dashboard

  return (
    <div className="space-y-6">
      {/* Hoşgeldin Mesajı */}
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900">
          Hoş Geldiniz, {user?.ad_soyad}
        </h1>
        <p className="mt-2 text-gray-600">
          {getRoleGreeting()} paneline hoş geldiniz.
        </p>
      </div>

      {/* İstatistikler */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
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
      )}

      {/* Hızlı Erişim */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Hızlı Erişim</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(user?.rol === 'admin' || user?.rol === 'soru_yazici') && (
            <Link
              to="/sorular/yeni"
              className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Yeni Soru Ekle</h3>
                <p className="mt-1 text-sm text-gray-500">Sisteme yeni soru ekleyin</p>
              </div>
            </Link>
          )}

          <Link
            to="/sorular"
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Tüm Sorular</h3>
              <p className="mt-1 text-sm text-gray-500">Soruları listeleyin ve yönetin</p>
            </div>
          </Link>

          {user?.rol === 'admin' && (
            <Link
              to="/kullanicilar"
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Kullanıcılar</h3>
                <p className="mt-1 text-sm text-gray-500">Kullanıcı yönetimi</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Bilgilendirme */}
      {user?.rol === 'soru_yazici' && (
        <div className="card bg-blue-50 border-l-4 border-blue-500">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Soru Yazıcı İpucu</h3>
              <p className="mt-2 text-sm text-blue-700">
                Sorularınızı eklerken fotoğraf ekleyebilirsiniz. Eklediğiniz sorular otomatik olarak dizgiye gönderilir.
              </p>
            </div>
          </div>
        </div>
      )}

      {user?.rol === 'dizgici' && (
        <div className="card bg-green-50 border-l-4 border-green-500">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Dizgici İpucu</h3>
              <p className="mt-2 text-sm text-green-700">
                Sorular bölümünden bekleyen soruları dizgiye alabilir ve tamamlayabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
