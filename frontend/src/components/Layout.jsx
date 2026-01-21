import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { kullaniciMesajAPI, bildirimAPI, soruAPI, authAPI } from '../services/api';

export default function Layout() {

  const { user: authUser, logout, viewRole, setViewRole } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const actualRole = authUser?.rol;
  const effectiveRole = viewRole || actualRole;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;
  const [okunmamisMesajSayisi, setOkunmamisMesajSayisi] = useState(0);
  const [okunmamisBildirimSayisi, setOkunmamisBildirimSayisi] = useState(0);
  const [showBildirimPanel, setShowBildirimPanel] = useState(false);
  const [bildirimler, setBildirimler] = useState([]);
  const [bildirimLoading, setBildirimLoading] = useState(false);
  const bildirimPanelRef = useRef(null);

  useEffect(() => {
    loadOkunmamisSayilar();
    refreshUserData();
    const interval = setInterval(loadOkunmamisSayilar, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshUserData = async () => {
    try {
      const response = await authAPI.getMe();
      if (response.data.success && response.data.user) {
        useAuthStore.getState().updateUser(response.data.user);
      }
    } catch (error) {
      console.error('Kullanıcı bilgileri güncellenemedi:', error);
    }
  };

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bildirimPanelRef.current && !bildirimPanelRef.current.contains(event.target)) {
        setShowBildirimPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const toggleBildirimPanel = () => {
    if (!showBildirimPanel) loadBildirimler();
    setShowBildirimPanel(!showBildirimPanel);
  };

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
    if (bildirim.link) {
      setShowBildirimPanel(false);
      navigate(bildirim.link);
    }
  };

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

  let menuItems = [
    { path: '/', label: user?.rol === 'admin' ? 'Genel Bakış' : 'Ana Sayfa', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/sorular', label: 'Soru Havuzu', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { path: '/sorular?takip=1', label: 'Soru Takibi', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { path: '/mesajlar', label: 'Mesajlar', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  ];

  if (effectiveRole === 'dizgici') {
    menuItems = menuItems.filter(i => i.path !== '/sorular?takip=1');
    const dizgiItem = { path: '/dizgi-yonetimi', label: 'Dizgi Yönetimi', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' };
    const idx = menuItems.findIndex(i => i.path === '/sorular');
    if (idx >= 0) menuItems.splice(idx + 1, 0, dizgiItem);
    else menuItems.push(dizgiItem);
  }

  if (effectiveRole === 'incelemeci') {
    menuItems = menuItems.filter(i => !i.path.startsWith('/sorular'));
    const alanFlag = (actualRole === 'admin') || !!authUser?.inceleme_alanci;
    const dilFlag = (actualRole === 'admin') || !!authUser?.inceleme_dilci;
    if (alanFlag) {
      menuItems.push({ path: '/?mode=alanci', label: 'Alan İnceleme', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' });
    }
    if (dilFlag) {
      menuItems.push({ path: '/?mode=dilci', label: 'Dil İnceleme', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' });
    }
  }

  if (actualRole === 'admin') {
    menuItems.push(
      { path: '/ekipler', label: 'Ekipler', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
      { path: '/branslar', label: 'Branşlar', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { path: '/kullanicilar', label: 'Kullanıcılar', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8v-1a5 5 0 015-5h2a5 5 0 015 5v1H5z' },
      { path: '/duyurular', label: 'Duyurular', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
      { path: '/raporlar', label: 'Raporlar', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
    );
  }

  const isActive = (p) => {
    const [pPath, pQuery] = p.split('?');
    const samePath = location.pathname === pPath;
    const currentSearch = location.search.replace(/^\?/, '');
    if (pQuery) return samePath && currentSearch === pQuery;
    return samePath && currentSearch === '';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <aside className="w-64 bg-[#1e293b] text-white flex flex-col flex-shrink-0 shadow-xl relative z-20">
        <div className="p-6 flex flex-col items-center border-b border-gray-700 bg-[#0f172a]">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-3 shadow-lg">SH</div>
          <h1 className="text-xl font-bold tracking-wider">SORU HAVUZU</h1>
        </div>
        <div className="px-6 py-6 bg-[#1e293b] border-b border-gray-700">
          <div className="text-left">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wide">{user?.ad_soyad}</h2>
            <div className="mt-1 flex flex-col gap-1">
              <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-100 border border-blue-700 w-fit">
                {(() => {
                  const r = effectiveRole;
                  if (r === 'admin') return 'Yönetici';
                  if (r === 'soru_yazici') return 'Branş';
                  if (r === 'dizgici') return 'Dizgici';
                  if (r === 'incelemeci') {
                    const alan = !!authUser?.inceleme_alanci;
                    const dil = !!authUser?.inceleme_dilci;
                    if (alan && dil) return 'İncelemeci (Alan + Dil)';
                    if (alan) return 'İncelemeci (Alan)';
                    if (dil) return 'İncelemeci (Dil)';
                    return 'İncelemeci';
                  }
                  return 'Kullanıcı';
                })()}
              </div>
              {user?.ekip_adi ? (
                <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1 mt-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {user.ekip_adi}
                </div>
              ) : (actualRole !== 'admin' && (
                <div className="text-[10px] text-red-400 font-bold uppercase flex items-center gap-1 mt-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Ekip Atanmamış
                </div>
              ))}
            </div>
            {actualRole === 'admin' && (
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Görünüm Değiştir</label>
                <select
                  className="w-full bg-[#0f172a] border border-gray-600 text-gray-200 text-xs rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={effectiveRole || 'admin'}
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    setViewRole(nextRole === 'admin' ? null : nextRole);
                    navigate('/');
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="soru_yazici">Branş</option>
                  <option value="dizgici">Dizgici</option>
                  <option value="incelemeci">İncelemeci</option>
                </select>
              </div>
            )}
            {user?.brans_adi && <p className="text-xs text-gray-400 mt-1">{user.brans_adi}</p>}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3 custom-scrollbar">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${isActive(item.path) ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              <svg className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200 ${isActive(item.path) ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700 bg-[#0f172a]">
          <button onClick={handleLogout} className="group flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 rounded-md hover:bg-red-900/20 hover:text-red-300 transition-colors">
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Güvenli Çıkış
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 z-10">
          <div className="text-gray-500 text-sm"></div>
          <div className="flex items-center space-x-4">
            <div className="relative" ref={bildirimPanelRef}>
              <button onClick={toggleBildirimPanel} className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" title="Bildirimler">
                <span className="sr-only">Bildirimleri Gör</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {okunmamisBildirimSayisi > 0 && <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-red-500 animate-pulse"></span>}
              </button>
              {showBildirimPanel && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden origin-top-right transform transition-all">
                  <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center backdrop-blur-sm">
                    <h3 className="font-semibold text-gray-800">Bildirimler</h3>
                    {okunmamisBildirimSayisi > 0 && <button onClick={handleTumunuOkunduIsaretle} className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md transition-colors">Tümünü Okundu İşaretle</button>}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {bildirimLoading ? <div className="p-8 text-center text-gray-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div> : bildirimler.length === 0 ? <div className="p-12 text-center text-gray-400"><div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></div><p className="text-gray-500 font-medium">Bildiriminiz bulunmuyor</p></div> : bildirimler.map((bildirim) => (
                      <div key={bildirim.id} onClick={() => handleBildirimOkundu(bildirim)} className={`group border-b border-gray-50 cursor-pointer transition-all hover:bg-blue-50/50 p-4 ${!bildirim.okundu ? 'bg-blue-50/30' : ''}`}><div className="flex items-start space-x-4"><div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${bildirim.tip === 'revize' ? 'bg-orange-500 shadow-orange-200' : bildirim.tip === 'info' ? 'bg-blue-500 shadow-blue-200' : bildirim.tip === 'success' ? 'bg-green-500 shadow-green-200' : 'bg-gray-400'}`}></div><div className="flex-1 min-w-0"><p className={`text-sm font-semibold mb-0.5 ${!bildirim.okundu ? 'text-gray-900' : 'text-gray-600'}`}>{bildirim.baslik}</p><p className="text-xs text-gray-500 leading-relaxed line-clamp-2 group-hover:text-gray-700">{bildirim.mesaj}</p><p className="text-[10px] text-gray-400 mt-2 font-medium">{new Date(bildirim.olusturulma_tarihi).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p></div>{!bildirim.okundu && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 animate-pulse mt-1.5"></div>}</div></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8">
          <div className="max-w-7xl mx-auto"><Outlet context={{ effectiveRole }} /></div>
        </main>
      </div>
    </div>
  );
}
