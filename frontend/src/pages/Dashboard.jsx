import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI } from '../services/api';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await soruAPI.getStats();
      setStats(response.data.data);
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
