import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { kullaniciMesajAPI, bildirimAPI } from '../services/api';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [okunmamisMesajSayisi, setOkunmamisMesajSayisi] = useState(0);
  const [okunmamisBildirimSayisi, setOkunmamisBildirimSayisi] = useState(0);
  const [showBildirimPanel, setShowBildirimPanel] = useState(false);
  const [bildirimler, setBildirimler] = useState([]);
  const [bildirimLoading, setBildirimLoading] = useState(false);
  const bildirimPanelRef = useRef(null);

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

  // Dışarı tıklamayı algıla
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bildirimPanelRef.current && !bildirimPanelRef.current.contains(event.target)) {
        setShowBildirimPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bildirimleri yükle
  const loadBildirimler = async () => {
    setBildirimLoading(true);
    try {
      const response = await bildirimAPI.getAll();
      setBildirimler(response.data.data || []);
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
    } finally {
      setBildirimLoading(false);
    }
  };

  // Bildirim panelini aç/kapa
  const toggleBildirimPanel = () => {
    if (!showBildirimPanel) {
      loadBildirimler();
    }
    setShowBildirimPanel(!showBildirimPanel);
  };

  // Bildirimi okundu işaretle
  const handleBildirimOkundu = async (bildirim) => {
    if (!bildirim.okundu) {
      try {
        await bildirimAPI.markAsRead(bildirim.id);
        setBildirimler(prev => prev.map(b =>
          b.id === bildirim.id ? { ...b, okundu: true } : b
        ));
        setOkunmamisBildirimSayisi(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Bildirim okundu işaretlenemedi:', error);
      }
    }
    // Link varsa yönlendir
    if (bildirim.link) {
      setShowBildirimPanel(false);
      navigate(bildirim.link);
    }
  };

  // Tüm bildirimleri okundu işaretle
  const handleTumunuOkunduIsaretle = async () => {
    try {
      await bildirimAPI.markAllAsRead();
      setBildirimler(prev => prev.map(b => ({ ...b, okundu: true })));
      setOkunmamisBildirimSayisi(0);
    } catch (error) {
      console.error('Bildirimler okundu işaretlenemedi:', error);
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
                  {user?.rol === 'admin' ? 'İstatistikler' : 'Ana Sayfa'}
                </Link>
                <Link to="/sorular" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                  Sorular
                </Link>
                <Link to="/mesajlar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                  Mesajlar
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
                    <Link to="/duyurular" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Duyurular
                    </Link>
                    <Link to="/raporlar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Raporlar
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

              <div className="relative" ref={bildirimPanelRef}>
                <button
                  onClick={toggleBildirimPanel}
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

                {/* Bildirim Dropdown Panel */}
                {showBildirimPanel && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">Bildirimler</h3>
                      {okunmamisBildirimSayisi > 0 && (
                        <button
                          onClick={handleTumunuOkunduIsaretle}
                          className="text-xs text-primary-600 hover:text-primary-800"
                        >
                          Tümünü okundu işaretle
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {bildirimLoading ? (
                        <div className="p-4 text-center text-gray-500">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                        </div>
                      ) : bildirimler.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <p>Henüz bildirim yok</p>
                        </div>
                      ) : (
                        bildirimler.map((bildirim) => (
                          <div
                            key={bildirim.id}
                            onClick={() => handleBildirimOkundu(bildirim)}
                            className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${!bildirim.okundu ? 'bg-blue-50' : ''
                              }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${bildirim.tip === 'revize' ? 'bg-orange-500' :
                                  bildirim.tip === 'info' ? 'bg-blue-500' :
                                    bildirim.tip === 'success' ? 'bg-green-500' :
                                      'bg-gray-400'
                                }`}></div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${!bildirim.okundu ? 'text-gray-900' : 'text-gray-600'}`}>
                                  {bildirim.baslik}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                  {bildirim.mesaj}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(bildirim.olusturulma_tarihi).toLocaleString('tr-TR', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              {!bildirim.okundu && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

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
