import { useState, useRef } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // AYARLAR
  const [widthMode, setWidthMode] = useState('dar'); // 'dar' (82.4mm) | 'genis' (169.6mm)
  const [inputMode, setInputMode] = useState('yaz'); // 'yaz' (Manual) | 'resim' (PNG Upload)

  // İÇERİK BİLEŞENLERİ (Yaz Modu için)
  // Types: 'koku' (Root/Koyu), 'govde' (Body/Metin), 'gorsel' (Image)
  const [components, setComponents] = useState([
    { id: 'init_koku', type: 'koku', content: '' } // Varsayılan başlangıç
  ]);

  // RESİM MODU (Tek görsel)
  const [fullImage, setFullImage] = useState(null);
  const [fullImageUrl, setFullImageUrl] = useState(null);

  // Helper: Yeni bileşen ekle
  const addComponent = (type) => {
    setComponents([...components, { id: Date.now(), type, content: '' }]);
  };

  // Helper: Bileşen güncelle
  const updateComponent = (id, newContent) => {
    setComponents(components.map(c => c.id === id ? { ...c, content: newContent } : c));
  };

  // Helper: Bileşen sil
  const removeComponent = (id) => {
    setComponents(components.filter(c => c.id !== id));
  };

  // Helper: Resim Yükleme (Bileşen için)
  const handleComponentImage = (id, file) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setComponents(components.map(c => c.id === id ? { ...c, content: url, file: file } : c));
    }
  };

  // Helper: Full Resim Yükleme (PNG Modu)
  const handleFullImage = (file) => {
    if (file) {
      setFullImage(file);
      setFullImageUrl(URL.createObjectURL(file));
    }
  };

  // Mini Toolbar Component
  const EditorToolbar = ({ onCmd }) => (
    <div className="flex space-x-1 mb-1 border-b border-gray-100 pb-1 bg-gray-50 px-2 rounded-t">
      <button
        tabIndex="-1"
        className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded font-bold text-gray-700 text-sm"
        onClick={(e) => { e.preventDefault(); onCmd('bold'); }}
        title="Kalın"
      >
        B
      </button>
      <button
        tabIndex="-1"
        className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded italic text-gray-700 text-sm"
        onClick={(e) => { e.preventDefault(); onCmd('italic'); }}
        title="İtalik"
      >
        I
      </button>
      <button
        tabIndex="-1"
        className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded underline text-gray-700 text-sm"
        onClick={(e) => { e.preventDefault(); onCmd('underline'); }}
        title="Altı Çizili"
      >
        U
      </button>
      <button
        tabIndex="-1"
        className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700 text-sm"
        onClick={(e) => { e.preventDefault(); onCmd('superscript'); }}
        title="Üs (x²)"
      >
        x²
      </button>
    </div>
  );

  const execCmd = (cmd) => {
    document.execCommand(cmd, false, null);
  };

  // KAYDET (Taslak)
  const handleSave = () => {
    // Burada API çağrısı yapılacak. Şimdilik logluyoruz.
    console.log({
      widthMode,
      inputMode,
      components,
      fullImage
    });
    alert('Soru kaydedildi (Simülasyon)');
    navigate('/sorular');
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* 1. ÜST PANEL: AYARLAR */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">Soru Oluşturma Ekranı</h1>

            <div className="flex items-center gap-6">
              {/* Genişlik Seçimi */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setWidthMode('dar')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${widthMode === 'dar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Dar (82.4mm)
                </button>
                <button
                  onClick={() => setWidthMode('genis')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${widthMode === 'genis' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Geniş (169.6mm)
                </button>
              </div>

              {/* Mod Seçimi */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setInputMode('yaz')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${inputMode === 'yaz' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  ✎ Yeni Soru Yaz
                </button>
                <button
                  onClick={() => setInputMode('resim')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${inputMode === 'resim' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  🖼 Hazır (PNG) Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ORTA ALAN: CANVAS (KAĞIT) */}
      <div className="flex justify-center p-8 overflow-x-auto">
        <div
          className="bg-white shadow-2xl transition-all duration-300 relative"
          style={{
            width: widthMode === 'dar' ? '82.4mm' : '169.6mm',
            minHeight: '120mm',
            padding: '10px',
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '11pt',
            lineHeight: '1.4',
            color: '#000'
          }}
        >
          {/* Soru Numarası (Sabit) */}
          <div className="absolute top-2 left-2 text-sm font-bold text-gray-400 select-none">1.</div>

          {inputMode === 'resim' ? (
            // RESİM MODU
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded p-4 group hover:border-blue-400 transition cursor-pointer relative">
              {fullImageUrl ? (
                <div className="relative w-full">
                  <img src={fullImageUrl} className="w-full object-contain" alt="Yüklenen Soru" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setFullImage(null); setFullImageUrl(null); }}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-red-700"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-4xl text-gray-300 mb-2 group-hover:text-blue-400">🖼</div>
                  <p className="text-gray-500 font-sans text-sm">PNG Görseli Sürükleyin veya Tıklayın</p>
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/png,image/jpeg"
                    onChange={(e) => handleFullImage(e.target.files[0])}
                  />
                </>
              )}
            </div>
          ) : (
            // YAZMA MODU
            <div className="space-y-4 pt-4 pl-4">
              {components.length === 0 && (
                <div className="text-center text-gray-300 py-10 font-sans italic">
                  Aşağıdaki butonları kullanarak soru öğeleri ekleyin.
                </div>
              )}

              {components.map((comp) => (
                <div key={comp.id} className="relative group border border-transparent hover:border-blue-200 rounded p-1 transition animate-fade-in">
                  {/* Kontroller (Silme vs) */}
                  <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                    <span className="text-[10px] uppercase font-bold bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-sans tracking-wider shadow">
                      {comp.type}
                    </span>
                    <button
                      onClick={() => removeComponent(comp.id)}
                      className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 shadow"
                      title="Sil"
                    >
                      ×
                    </button>
                  </div>

                  {/* İÇERİK EDİTÖRÜ */}
                  {comp.type === 'gorsel' ? (
                    <div className="border border-dashed border-gray-300 rounded bg-gray-50 text-center relative hover:bg-gray-100 transition">
                      {comp.content ? (
                        <div className="relative">
                          <img src={comp.content} className="max-w-full h-auto mx-auto" alt="Görsel" />
                          <button
                            onClick={() => updateComponent(comp.id, '')}
                            className="absolute top-1 right-1 bg-white/80 p-1 rounded text-red-600 text-xs font-bold shadow hover:bg-white"
                          >
                            Değiştir
                          </button>
                        </div>
                      ) : (
                        <label className="block p-8 cursor-pointer">
                          <span className="text-gray-400 font-sans text-xs block">Görsel Seç</span>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleComponentImage(comp.id, e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  ) : (
                    // METİN (Kök veya Gövde)
                    <div>
                      <EditorToolbar onCmd={execCmd} />
                      <div
                        contentEditable
                        className={`outline-none min-h-[1.5em] focus:bg-blue-50/20 px-1 ${comp.type === 'koku' ? 'font-bold' : ''}`}
                        onInput={(e) => updateComponent(comp.id, e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: comp.content }} // İlk render için
                        // Not: dangerouslySetInnerHTML contentEditable ile input sırasında focus kaybı yaşatabilir.
                        // React contentEditable uyarısını suppress etmek için:
                        suppressContentEditableWarning={true}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. ALT BAR (Sadece Yaz Modunda) */}
      {inputMode === 'yaz' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-xl-up z-50 animate-slide-up">
          <div className="max-w-4xl mx-auto flex justify-center items-center gap-6">
            <div className="flex gap-2">
              <button
                onClick={() => addComponent('koku')}
                className="flex flex-col items-center justify-center w-24 h-20 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 active:scale-95 transition group"
              >
                <span className="text-2xl mb-1 group-hover:-translate-y-1 transition-transform">❓</span>
                <span className="text-xs font-bold text-indigo-800">Soru Kökü</span>
              </button>

              <button
                onClick={() => addComponent('govde')}
                className="flex flex-col items-center justify-center w-24 h-20 bg-purple-50 border border-purple-100 rounded-lg hover:bg-purple-100 hover:border-purple-300 active:scale-95 transition group"
              >
                <span className="text-2xl mb-1 group-hover:-translate-y-1 transition-transform">📄</span>
                <span className="text-xs font-bold text-purple-800">Soru Gövdesi</span>
              </button>

              <button
                onClick={() => addComponent('gorsel')}
                className="flex flex-col items-center justify-center w-24 h-20 bg-pink-50 border border-pink-100 rounded-lg hover:bg-pink-100 hover:border-pink-300 active:scale-95 transition group"
              >
                <span className="text-2xl mb-1 group-hover:-translate-y-1 transition-transform">📷</span>
                <span className="text-xs font-bold text-pink-800">Görsel Ekle</span>
              </button>
            </div>

            <div className="w-[1px] h-16 bg-gray-200"></div>

            <button
              onClick={handleSave}
              className="h-16 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition transform flex flex-col justify-center items-center"
            >
              <span>✓ KAYDET</span>
              <span className="text-[10px] font-normal opacity-75 mt-1">Soru Havuzuna Ekle</span>
            </button>
          </div>
        </div>
      )}

      {/* Resim Modu için Kaydet Butonu (Sabit Alt Bar olmasa bile) */}
      {inputMode === 'resim' && (
        <div className="fixed bottom-8 right-8">
          <button
            onClick={handleSave}
            disabled={!fullImage}
            className="btn btn-primary px-8 py-4 rounded-full shadow-2xl text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ KAYDET
          </button>
        </div>
      )}
    </div>
  );
}
