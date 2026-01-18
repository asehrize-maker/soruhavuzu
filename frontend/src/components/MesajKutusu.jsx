import { useState, useEffect, useRef } from 'react';
import { mesajAPI } from '../services/api';
import useAuthStore from '../store/authStore';

export default function MesajKutusu({ soruId, soruSahibi, dizgici }) {
  const { user: authUser, viewRole } = useAuthStore();
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;
  const [mesajlar, setMesajlar] = useState([]);
  const [yeniMesaj, setYeniMesaj] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const mesajSonuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadMesajlar();
    const interval = setInterval(loadMesajlar, 5000); // 5 saniyede bir yenile
    return () => clearInterval(interval);
  }, [soruId]);

  useEffect(() => {
    scrollToBottom();
  }, [mesajlar]);

  const loadMesajlar = async () => {
    try {
      const response = await mesajAPI.getBySoruId(soruId);
      setMesajlar(response.data.data);
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    mesajSonuRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!yeniMesaj.trim()) return;

    setSending(true);
    try {
      await mesajAPI.send({
        soru_id: soruId,
        mesaj: yeniMesaj,
      });
      setYeniMesaj('');
      await loadMesajlar();
      inputRef.current?.focus();
    } catch (error) {
      alert('Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    // Bugün
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return `${hours}:${minutes}`;
    }
    
    // Dün
    if (diff < 172800000 && date.getDate() === now.getDate() - 1) {
      return `Dün ${hours}:${minutes}`;
    }
    
    // Daha eski
    return `${date.getDate()}/${date.getMonth() + 1} ${hours}:${minutes}`;
  };

  const isBenimMesajim = (mesaj) => {
    return mesaj.gonderen_id === user.id;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-3 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-lg font-bold">
          {isBenimMesajim(mesajlar[0] || {}) 
            ? (dizgici?.ad_soyad?.[0] || soruSahibi?.ad_soyad?.[0])
            : soruSahibi?.ad_soyad?.[0]
          }
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">
            {isBenimMesajim(mesajlar[0] || {}) 
              ? (dizgici?.ad_soyad || soruSahibi?.ad_soyad || 'Kullanıcı')
              : soruSahibi?.ad_soyad || 'Kullanıcı'
            }
          </h3>
          <p className="text-xs text-primary-100">Soru #{soruId}</p>
        </div>
      </div>

      {/* Mesaj Listesi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" style={{ maxHeight: '500px' }}>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : mesajlar.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">Henüz mesaj yok</p>
            <p className="text-xs mt-1">İlk mesajı siz gönderin</p>
          </div>
        ) : (
          <>
            {mesajlar.map((mesaj, index) => {
              const benimMesaj = isBenimMesajim(mesaj);
              const showAvatar = index === 0 || mesajlar[index - 1]?.gonderen_id !== mesaj.gonderen_id;
              
              return (
                <div
                  key={mesaj.id}
                  className={`flex items-end space-x-2 ${benimMesaj ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  {/* Avatar */}
                  {showAvatar ? (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      benimMesaj ? 'bg-primary-600 text-white' : 'bg-gray-400 text-white'
                    }`}>
                      {mesaj.gonderen_adi?.[0]}
                    </div>
                  ) : (
                    <div className="w-8"></div>
                  )}

                  {/* Mesaj Balonu */}
                  <div className={`flex flex-col max-w-xs ${benimMesaj ? 'items-end' : 'items-start'}`}>
                    {showAvatar && !benimMesaj && (
                      <span className="text-xs text-gray-500 mb-1 px-2">
                        {mesaj.gonderen_adi}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        benimMesaj
                          ? 'bg-primary-600 text-white rounded-br-none'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{mesaj.mesaj}</p>
                      <div className={`flex items-center justify-end space-x-1 mt-1`}>
                        <span className={`text-xs ${benimMesaj ? 'text-primary-100' : 'text-gray-500'}`}>
                          {formatTime(mesaj.olusturulma_tarihi)}
                        </span>
                        {benimMesaj && (
                          <svg className="w-4 h-4 text-primary-100" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={mesajSonuRef} />
          </>
        )}
      </div>

      {/* Mesaj Gönderme Alanı */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 bg-white">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={yeniMesaj}
              onChange={(e) => setYeniMesaj(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Mesajınızı yazın..."
              rows="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              style={{ maxHeight: '100px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!yeniMesaj.trim() || sending}
            className={`p-3 rounded-full transition ${
              yeniMesaj.trim() && !sending
                ? 'bg-primary-600 hover:bg-primary-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 px-1">
          Enter ile gönder, Shift+Enter ile yeni satır
        </p>
      </form>
    </div>
  );
}
