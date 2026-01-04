import { useState, useEffect, useRef } from 'react';
import { kullaniciMesajAPI } from '../services/api';
import useAuthStore from '../store/authStore';

export default function Mesajlar() {
  const { user } = useAuthStore();
  const [konusmalar, setKonusmalar] = useState([]);
  const [kullanicilar, setKullanicilar] = useState([]);
  const [secilenKullanici, setSecilenKullanici] = useState(null);
  const [mesajlar, setMesajlar] = useState([]);
  const [yeniMesaj, setYeniMesaj] = useState('');
  const [loading, setLoading] = useState(true);
  const [showYeniKonusma, setShowYeniKonusma] = useState(false);
  const mesajlarSonuRef = useRef(null);

  useEffect(() => {
    loadKonusmalar();
    loadKullanicilar();
    const interval = setInterval(loadKonusmalar, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secilenKullanici) {
      loadMesajlar(secilenKullanici.kullanici_id || secilenKullanici.id);
      const interval = setInterval(() => {
        loadMesajlar(secilenKullanici.kullanici_id || secilenKullanici.id, true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [secilenKullanici]);

  useEffect(() => {
    mesajlarSonuRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mesajlar]);

  const loadKonusmalar = async () => {
    try {
      const response = await kullaniciMesajAPI.getKonusmalar();
      setKonusmalar(response.data.data || []);
    } catch (error) {
      console.error('Konuşmalar yüklenemedi:', error);
      setKonusmalar([]); // Boş array set et
    } finally {
      setLoading(false);
    }
  };

  const loadKullanicilar = async () => {
    try {
      const response = await kullaniciMesajAPI.getKullanicilar();
      setKullanicilar(response.data.data || []);
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
      setKullanicilar([]); // Boş array set et
    }
  };

  const loadMesajlar = async (kullaniciId, silent = false) => {
    try {
      const response = await kullaniciMesajAPI.getKonusma(kullaniciId);
      setMesajlar(response.data.data);
      if (!silent) {
        await loadKonusmalar();
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
    }
  };

  const handleMesajGonder = async (e) => {
    e.preventDefault();
    if (!yeniMesaj.trim() || !secilenKullanici) return;

    try {
      await kullaniciMesajAPI.send({
        alici_id: secilenKullanici.kullanici_id || secilenKullanici.id,
        mesaj: yeniMesaj,
      });

      setYeniMesaj('');
      await loadMesajlar(secilenKullanici.kullanici_id || secilenKullanici.id);
      await loadKonusmalar();
    } catch (error) {
      alert('Mesaj gönderilemedi');
    }
  };

  const handleKonusmaAc = (konusma) => {
    setSecilenKullanici(konusma);
    setShowYeniKonusma(false);
  };

  const handleYeniKonusmaBaslat = (kullanici) => {
    setSecilenKullanici(kullanici);
    setMesajlar([]);
    setShowYeniKonusma(false);
  };

  const formatZaman = (tarih) => {
    const simdi = new Date();
    const mesajTarihi = new Date(tarih);
    const fark = Math.floor((simdi - mesajTarihi) / 1000);

    if (fark < 60) return 'Az önce';
    if (fark < 3600) return `${Math.floor(fark / 60)} dk önce`;
    if (fark < 86400 && simdi.getDate() === mesajTarihi.getDate()) {
      return mesajTarihi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    if (fark < 172800) return `Dün ${mesajTarihi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    return mesajTarihi.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getRolRengi = (rol) => {
    const renkler = {
      admin: 'bg-purple-100 text-purple-800',
      soru_yazici: 'bg-blue-100 text-blue-800',
      dizgici: 'bg-green-100 text-green-800',
    };
    return renkler[rol] || 'bg-gray-100 text-gray-800';
  };

  const getRolEtiket = (rol) => {
    const etiketler = {
      admin: 'Admin',
      soru_yazici: 'Soru Yazıcı',
      dizgici: 'Dizgici',
    };
    return etiketler[rol] || rol;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900">Mesajlar</h1>
        <p className="mt-2 text-gray-600">Ekip üyeleriyle mesajlaşın</p>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Sol Panel - Konuşmalar */}
        <div className="col-span-4 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setShowYeniKonusma(!showYeniKonusma)}
              className="w-full btn btn-primary flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
              Yeni Konuşma
            </button>
          </div>

          {showYeniKonusma ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Kullanıcı Seç</h3>
                <button
                  onClick={() => setShowYeniKonusma(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                {kullanicilar.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => handleYeniKonusmaBaslat(k)}
                    className="w-full p-3 text-left hover:bg-gray-50 rounded-lg border border-gray-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {k.ad_soyad?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{k.ad_soyad}</p>
                          <p className="text-xs text-gray-500">{k.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRolRengi(k.rol)}`}>
                        {getRolEtiket(k.rol)}
                      </span>
                    </div>
                    {k.brans_adi && (
                      <p className="text-xs text-gray-500 mt-2">📚 {k.brans_adi}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {konusmalar.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <p className="font-medium">Henüz konuşma yok</p>
                  <p className="text-sm mt-1">Yeni Konuşma butonuna tıklayarak başlayın</p>
                </div>
              ) : (
                konusmalar.map((konusma) => (
                  <button
                    key={konusma.kullanici_id}
                    onClick={() => handleKonusmaAc(konusma)}
                    className={`w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 transition ${
                      secilenKullanici?.kullanici_id === konusma.kullanici_id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {konusma.ad_soyad?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900 truncate">{konusma.ad_soyad}</p>
                          {konusma.okunmamis_sayisi > 0 && (
                            <span className="bg-primary-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-2">
                              {konusma.okunmamis_sayisi}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {konusma.ben_gonderdim && 'Sen: '}
                          {konusma.son_mesaj}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRolRengi(konusma.rol)}`}>
                            {getRolEtiket(konusma.rol)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatZaman(konusma.olusturulma_tarihi)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sağ Panel - Mesajlaşma */}
        <div className="col-span-8 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
          {secilenKullanici ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {secilenKullanici.ad_soyad?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{secilenKullanici.ad_soyad}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRolRengi(secilenKullanici.rol)}`}>
                        {getRolEtiket(secilenKullanici.rol)}
                      </span>
                      {secilenKullanici.brans_adi && (
                        <span className="text-xs text-gray-500">📚 {secilenKullanici.brans_adi}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mesajlar */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" style={{ minHeight: 0 }}>
                {mesajlar.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                        <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                      </svg>
                      <p className="font-medium">Henüz mesaj yok</p>
                      <p className="text-sm mt-1">İlk mesajı gönderin</p>
                    </div>
                  </div>
                ) : (
                  mesajlar.map((mesaj) => {
                    const benGonderdim = mesaj.gonderen_id === user.id;
                    return (
                      <div
                        key={mesaj.id}
                        className={`flex ${benGonderdim ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex items-end space-x-2 max-w-[70%] ${benGonderdim ? 'flex-row-reverse space-x-reverse' : ''}`}>
                          {!benGonderdim && (
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {mesaj.gonderen_adi?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div
                              className={`rounded-2xl px-4 py-2 ${
                                benGonderdim
                                  ? 'bg-primary-600 text-white rounded-br-none'
                                  : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{mesaj.mesaj}</p>
                            </div>
                            <div className={`flex items-center space-x-2 mt-1 px-2 ${benGonderdim ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-xs text-gray-400">
                                {formatZaman(mesaj.olusturulma_tarihi)}
                              </span>
                              {benGonderdim && (
                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={mesajlarSonuRef} />
              </div>

              {/* Mesaj Gönderme Formu */}
              <form onSubmit={handleMesajGonder} className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
                <div className="flex items-end space-x-2">
                  <textarea
                    value={yeniMesaj}
                    onChange={(e) => setYeniMesaj(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleMesajGonder(e);
                      }
                    }}
                    placeholder="Mesajınızı yazın..."
                    rows="2"
                    className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!yeniMesaj.trim()}
                    className="btn btn-primary px-6 py-2 h-[72px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Enter ile gönder, Shift+Enter ile yeni satır</p>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                <p className="text-lg font-medium">Mesajlaşmaya Başlayın</p>
                <p className="text-sm mt-2">Soldaki listeden bir konuşma seçin veya<br />yeni bir konuşma başlatın</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
