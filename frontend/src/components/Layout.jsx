import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { kullaniciMesajAPI, bildirimAPI } from '../services/api';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [okunmamisMesajSayisi, setOkunmamisMesajSayisi] = useState(0);
  const [okunmamisBildirimSayisi, setOkunmamisBildirimSayisi] = useState(0);

  useEffect(() => {
    // İlk yüklemede sayıları al
    loadOkunmamisSayilar();
    
    // 10 saniyede bir güncelle
    const interval = setInterval(loadOkunmamisSayilar, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadOkunmamisSayilar = async () => {
    try {
      const [mesajRes, bildirimRes] = await Promise.all([
        kullaniciMesajAPI.getOkunmamisSayisi().catch(() => ({ data: { data: { sayi: 0 } } })),
        bildirimAPI.getOkunmamiSayisi().catch(() => ({ data: { data: { sayi: 0 } } })),
      ]);
      
      setOkunmamisMesajSayisi(mesajRes.data.data?.sayi || 0);
      setOkunmamisBildirimSayisi(bildirimRes.data.data?.sayi || 0);
    } catch (error) {
      console.error('Okunmamış sayılar yüklenemedi:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRolBadge = (rol) => {
    const badges = {
      admin: 'bg-purple-100 text-purple-800',
      soru_yazici: 'bg-blue-100 text-blue-800',
      dizgici: 'bg-green-100 text-green-800',
    };
    const labels = {
      admin: 'Admin',
      soru_yazici: 'Soru Yazıcı',
      dizgici: 'Dizgici',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[rol]}`}>
        {labels[rol]}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-bold text-primary-600">
                Soru Havuzu
              </Link>
              
              <nav className="hidden md:flex space-x-4">
                <Link to="/" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                  {user?.rol === 'admin' ? '📊 İstatistikler' : 'Ana Sayfa'}
                </Link>
                <Link to="/sorular" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                  Sorular
                </Link>
                <Link to="/mesajlar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                  💬 Mesajlar
                </Link>
                {user?.rol === 'dizgici' && (
                  <Link to="/dizgi-yonetimi" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                    Dizgi Yönetimi
                  </Link>
                )}
                {user?.rol === 'admin' && (
                  <>
                    <Link to="/ekipler" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Ekipler
                    </Link>
                    <Link to="/branslar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Branşlar
                    </Link>
                    <Link to="/kullanicilar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Kullanıcılar
                    </Link>
                    <Link to="/raporlar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      📊 Raporlar
                    </Link>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* Bildirimler */}
              <Link
                to="/mesajlar"
                className="relative p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
                title="Mesajlar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {okunmamisMesajSayisi > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {okunmamisMesajSayisi > 9 ? '9+' : okunmamisMesajSayisi}
                  </span>
                )}
              </Link>

              <button
                className="relative p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
                title="Bildirimler"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {okunmamisBildirimSayisi > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {okunmamisBildirimSayisi > 9 ? '9+' : okunmamisBildirimSayisi}
                  </span>
                )}
              </button>

              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.ad_soyad}</p>
                <div className="flex items-center justify-end space-x-2">
                  {getRolBadge(user?.rol)}
                  {user?.brans_adi && (
                    <span className="text-xs text-gray-500">{user.brans_adi}</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary text-sm"
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            © 2026 Soru Havuzu Sistemi. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}
