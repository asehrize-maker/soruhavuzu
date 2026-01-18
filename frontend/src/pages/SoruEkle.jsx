import React, { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';

// İmleç sorununu çözen, re-render olmayan editör bloğu
const EditableBlock = memo(({ initialHtml, onChange, className, placeholder }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
  }, []); // Sadece ilk yüklemede çalışır

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className + " outline-none empty:before:content-[attr(placeholder)] empty:before:text-gray-300 min-h-[1.5em]"}
      placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
    />
  );
}, () => true); // PROPS DEĞİŞSE BİLE ASLA RE-RENDER ETME (İmleci korumak için)

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // --- DEVLETLER (STATES) ---
  const [widthMode, setWidthMode] = useState('dar'); // 'dar' (82.4mm) | 'genis' (169.6mm)
  const [inputMode, setInputMode] = useState('yaz'); // 'yaz' | 'resim'

  // İçerik Bileşenleri
  const [components, setComponents] = useState([
    { id: 'init_koku', type: 'koku', content: '' }
  ]);

  // Resim Modu State
  const [fullImageUrl, setFullImageUrl] = useState(null);
  const [fullImageFile, setFullImageFile] = useState(null);

  // Soru Metadata
  const [metadata, setMetadata] = useState({ zorluk: '3', dogruCevap: '', brans_id: '' });
  const [branslar, setBranslar] = useState([]);

  useEffect(() => {
    // Branşları yükle
    const loadBranslar = async () => {
      try {
        const res = await bransAPI.getAll();
        setBranslar(res.data.data || []);

        // Kullanıcının branşı varsa onu seç, yoksa ilkini seç
        if (user?.brans_id) {
          setMetadata(prev => ({ ...prev, brans_id: user.brans_id }));
        } else if (res.data.data?.length > 0) {
          setMetadata(prev => ({ ...prev, brans_id: res.data.data[0].id }));
        }
      } catch (err) {
        console.error("Branşlar yüklenemedi", err);
      }
    };
    loadBranslar();
  }, [user]);

  // --- YARDIMCI FONKSİYONLAR ---

  const addComponent = (type) => {
    let defaultContent = '';
    // if (type === 'koku') defaultContent = ''; // Zaten boş
    // if (type === 'govde') defaultContent = '';

    const newComp = { id: Date.now(), type, content: defaultContent };
    setComponents([...components, newComp]);
  };

  const updateComponent = (id, html) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, content: html } : c));
  };

  const removeComponent = (id) => {
    if (components.length > 1) {
      setComponents(prev => prev.filter(c => c.id !== id));
    } else {
      // Son kalanı silme, içeriğini temizle
      updateComponent(id, '');
    }
  };

  const handleImageUpload = (id, file) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setComponents(prev => prev.map(c => c.id === id ? { ...c, content: url, file: file, isImage: true } : c));
    }
  };

  const handleFullImage = (file) => {
    if (file) {
      setFullImageFile(file);
      setFullImageUrl(URL.createObjectURL(file));
    }
  };

  const execCmd = (cmd) => {
    document.execCommand(cmd, false, null);
  };

  const handleCopyContent = () => {
    // 1. Plain Text Birleştirme
    const plainText = components.map(c => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = c.content;
      return tempDiv.innerText || tempDiv.textContent || "";
    }).join('\n\n');

    // 2. HTML Birleştirme (Formatlı Kopyalama İçin)
    const fullHtml = components.map(c => {
      return `<div style="margin-bottom: 12px;">${c.content}</div>`;
    }).join('');

    // Clipboard API
    const doCopy = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          const item = new ClipboardItem({
            'text/html': new Blob([fullHtml], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' })
          });
          await navigator.clipboard.write([item]);
          alert("📋 TÜM SORU (Biçimleriyle) KOPYALANDI!");
        } else {
          throw new Error("Clipboard API not fully supported");
        }
      } catch (err) {
        console.error(err);
        navigator.clipboard.writeText(plainText).then(() => alert("📋 Sadece Metin Kopyalandı (Tarayıcı kısıtlaması)"));
      }
    };
    doCopy();
  };

  const handleSave = async (submitToReview = false) => {
    if (!metadata.dogruCevap) {
      alert("Lütfen aşağıdan Doğru Cevabı seçiniz.");
      return;
    }
    if (!metadata.brans_id) {
      alert("Lütfen bir Ders/Branş seçiniz!");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('zorluk_seviyesi', '1');
      formData.append('dogru_cevap', metadata.dogruCevap);
      formData.append('brans_id', metadata.brans_id);
      formData.append('kazanim', 'Genel');
      // Olası eksik alanlar için varsayılanlar (Sınıf 8, Konu Genel)
      formData.append('sinif_seviyesi', '8');
      formData.append('unite', 'Genel');
      formData.append('konu', 'Genel');

      if (inputMode === 'resim') {
        if (fullImageFile) {
          formData.append('fotograf', fullImageFile);
          formData.append('fotograf_konumu', 'ust');
          formData.append('soru_metni', '<p>(Görsel Soru)</p>');
        } else {
          alert("Lütfen bir resim yükleyin.");
          return;
        }
      } else {
        const htmlContent = components.map(c => {
          return `<div class="type-${c.type}" style="margin-bottom: 8px;">${c.content}</div>`;
        }).join('');
        formData.append('soru_metni', htmlContent);
      }

      ['a', 'b', 'c', 'd', 'e'].forEach(opt => formData.append(`secenek_${opt}`, '.'));

      const res = await soruAPI.create(formData);

      // Eğer create sırasında durum işlenmediyse ve incelemeye gidecekse update atalım (Garanti olsun)
      if (submitToReview && res.data?.data?.id) {
        try {
          await soruAPI.updateDurum(res.data.data.id, { durum: 'inceleme_bekliyor' });
        } catch (e) { console.log("Durum update warning:", e); }
        alert("✅ Soru kaydedildi ve İNCELEMEYE GÖNDERİLDİ!");
      } else {
        alert("✅ Soru havuza kaydedildi!");
      }

      navigate('/sorular');

    } catch (error) {
      console.error("Save Error:", error);
      const serverMsg = error.response?.data?.message || error.response?.data?.error || JSON.stringify(error.response?.data);
      alert("Kaydetme Hatası: " + (serverMsg || error.message));
    }
  };

  // --- UI BİLEŞENLERİ ---

  const RibbonButton = ({ cmd, label, icon }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} // onMouseDown prevents focus loss from editor
      className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded text-gray-700 hover:text-blue-700 transition"
      title={label}
    >
      {icon || label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F3F2F1] pb-32 font-sans">

      {/* 1. ÜST BAR (APP HEADER) */}
      <div className="bg-[#0078D4] text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-wide">Soru Yazarı</h1>
          <div className="h-6 w-[1px] bg-white/30"></div>
          {/* Genişlik Seçimi */}
          <div className="flex bg-[#005A9E] rounded p-0.5">
            <button
              onClick={() => setWidthMode('dar')}
              className={`px-3 py-1 text-xs font-medium rounded transition ${widthMode === 'dar' ? 'bg-white text-[#0078D4] shadow' : 'text-white/80 hover:bg-white/10'}`}
            >
              Dar (82mm)
            </button>
            <button
              onClick={() => setWidthMode('genis')}
              className={`px-3 py-1 text-xs font-medium rounded transition ${widthMode === 'genis' ? 'bg-white text-[#0078D4] shadow' : 'text-white/80 hover:bg-white/10'}`}
            >
              Geniş (169mm)
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setInputMode('yaz')} className={`px-4 py-1.5 rounded text-sm font-bold transition ${inputMode === 'yaz' ? 'bg-white text-[#0078D4]' : 'text-white hover:bg-white/10'}`}>
            ✎ Yaz
          </button>
          <button onClick={() => setInputMode('resim')} className={`px-4 py-1.5 rounded text-sm font-bold transition ${inputMode === 'resim' ? 'bg-white text-[#0078D4]' : 'text-white hover:bg-white/10'}`}>
            🖼 Resim
          </button>
          <button onClick={() => navigate('/sorular')} className="px-4 py-1.5 rounded text-sm font-medium hover:bg-red-600 bg-red-500 ml-4">
            Çıkış
          </button>
        </div>
      </div>

      {/* 2. ÇALIŞMA ALANI (WORKSPACE) */}
      <div className="flex justify-center p-8 overflow-y-auto">

        {/* KAĞIT (PAPER) */}
        <div
          className="bg-white shadow-xl transition-all duration-300 relative flex flex-col"
          style={{
            width: widthMode === 'dar' ? '82.4mm' : '169.6mm',
            minHeight: '297mm', // A4 boyu kadar uzun hissettirsin
            marginBottom: '2rem'
          }}
        >
          {inputMode === 'resim' ? (
            // RESİM MODU
            <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 m-4 rounded hover:bg-gray-50 transition relative">
              {fullImageUrl ? (
                <>
                  <img src={fullImageUrl} className="w-full object-contain shadow-lg" alt="Soru" />
                  <button onClick={() => { setFullImageUrl(null); setFullImageFile(null); }} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow hover:bg-red-600">×</button>
                </>
              ) : (
                <>
                  <span className="text-4xl mb-4 opacity-20">🖼</span>
                  <p className="text-gray-400 font-medium">Hazır soru görselini (PNG) buraya bırakın</p>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFullImage(e.target.files[0])} />
                </>
              )}
            </div>
          ) : (
            // YAZMA MODU (WORD GİBİ)
            <>
              {/* RIBBON (ARAÇ ÇUBUĞU) - Word Tarzı */}
              <div className="bg-[#f3f2f1] border-b border-[#e1dfdd] p-2 sticky top-0 z-10 flex items-center gap-2">
                <div className="flex bg-white rounded border border-[#e1dfdd] p-1 shadow-sm">
                  <RibbonButton cmd="bold" label="Kalın" icon={<b className="font-serif">B</b>} />
                  <RibbonButton cmd="italic" label="İtalik" icon={<i className="font-serif">I</i>} />
                  <RibbonButton cmd="underline" label="Altı Çizili" icon={<u className="font-serif">U</u>} />
                </div>
                <div className="w-[1px] h-6 bg-gray-300"></div>
                <div className="flex bg-white rounded border border-[#e1dfdd] p-1 shadow-sm">
                  <RibbonButton cmd="superscript" label="Üs" icon={<span className="text-xs">x²</span>} />
                  <RibbonButton cmd="subscript" label="Alt İndis" icon={<span className="text-xs">x₂</span>} />
                </div>
                <div className="flex-1"></div>
                <button onClick={handleCopyContent} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 font-medium px-2 py-1 rounded hover:bg-white transition" title="Tümünü Kopyala">
                  📋 Kopyala
                </button>
                <div className="text-xs text-gray-400 font-mono">HelveticaSınav • 10pt • 12L</div>
              </div>

              {/* KAĞIT İÇERİĞİ */}
              <div
                className="p-[10mm] text-[10pt] leading-[1.2] text-black space-y-[3mm] text-left"
                style={{
                  fontFamily: '"HelveticaSınav", "Helvetica", "Arial", sans-serif',
                  hyphens: 'none',
                  WebkitHyphens: 'none'
                }}
              >
                {/* Soru Numarası */}
                <div className="absolute top-[10mm] left-[4mm] font-bold text-gray-400 text-xs select-none">1</div>

                {components.map((comp) => (
                  <div key={comp.id} className="group relative hover:bg-blue-50/10 transition rounded">
                    {/* Sol Tarafta Sil Butonu (Hover'da görünür, Word paragraf işareti gibi) */}
                    <button
                      onClick={() => removeComponent(comp.id)}
                      className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition px-2"
                      title="Bu bölümü sil"
                    >
                      🗑
                    </button>

                    {/* İçerik */}
                    {comp.isImage ? (
                      <div className="relative inline-block">
                        <img src={comp.content} alt="Görsel" className="max-w-full" />
                        <button onClick={() => updateComponent(comp.id, '')} className="absolute top-1 right-1 bg-white/80 text-black text-xs px-1 rounded shadow">Değiştir</button>
                      </div>
                    ) : (
                      <EditableBlock
                        initialHtml={comp.content}
                        onChange={(html) => updateComponent(comp.id, html)}
                        className={comp.type === 'koku' ? 'font-bold' : ''}
                        placeholder={comp.type === 'koku' ? 'Soru kökü...' : 'Metin...'}
                      />
                    )}
                  </div>
                ))}

                {/* Boş Alan (Tıklayınca son bileşene focuslanabilir veya yeni ekleyebilir) */}
                <div className="h-24 w-full cursor-text" onClick={() => {
                  // Belki en sona otomatik yeni paragraf ekler?
                }}></div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SORU DETAYLARI (META DATA) - Kağıdın Altında */}
      {inputMode === 'yaz' && (
        <div className="w-[170mm] mx-auto mt-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-20 animate-fade-in-up">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 border-b pb-2 tracking-wider">Soru Künyesi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Ders / Branş</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                value={metadata.brans_id}
                onChange={(e) => setMetadata({ ...metadata, brans_id: e.target.value })}
              >
                <option value="">Branş Seçiniz...</option>
                {branslar.map(b => (
                  <option key={b.id} value={b.id}>{b.brans_adi}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Zorluk Seviyesi</label>
              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                {[1, 2, 3, 4, 5].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setMetadata({ ...metadata, zorluk: lvl.toString() })}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${metadata.zorluk === lvl.toString()
                      ? (lvl < 3 ? 'bg-green-100 text-green-700 shadow-sm ring-1 ring-green-300' : (lvl === 3 ? 'bg-yellow-100 text-yellow-700 shadow-sm ring-1 ring-yellow-300' : 'bg-red-100 text-red-700 shadow-sm ring-1 ring-red-300'))
                      : 'text-gray-400 hover:bg-white hover:text-gray-600'
                      }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Doğru Cevap</label>
              <div className="flex gap-3 justify-start">
                {['A', 'B', 'C', 'D', 'E'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setMetadata({ ...metadata, dogruCevap: opt })}
                    className={`w-10 h-10 rounded-full font-bold transition-all flex items-center justify-center border-2 ${metadata.dogruCevap === opt
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ALT INSERT BAR (EKLEME ÇUBUĞU) */}
      {inputMode === 'yaz' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Ekle:</span>
              <button onClick={() => addComponent('koku')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold hover:bg-indigo-100 transition">
                ❓ Soru Kökü
              </button>
              <button onClick={() => addComponent('govde')} className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm font-bold hover:bg-purple-100 transition">
                📄 Soru Gövdesi
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-700 rounded-full text-sm font-bold hover:bg-pink-100 transition cursor-pointer">
                📷 Görsel
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  if (e.target.files[0]) {
                    const id = Date.now();
                    setComponents(prev => [...prev, { id, type: 'gorsel', content: '', isImage: true }]);
                    setTimeout(() => handleImageUpload(id, e.target.files[0]), 100);
                  }
                }} />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                className="px-6 py-2 bg-gray-500 text-white font-bold rounded shadow hover:bg-gray-600 transition"
                onClick={() => handleSave(false)}
              >
                KAYDET
              </button>
              <button
                className="px-6 py-2 bg-[#0078D4] text-white font-bold rounded shadow hover:bg-[#005A9E] transition transform hover:scale-105"
                onClick={() => handleSave(true)}
              >
                İNCELEMEYE GÖNDER
              </button>
            </div>
          </div>
        </div>
      )}

      {inputMode === 'resim' && (
        <div className="fixed bottom-8 right-8">
          <div className="flex flex-col gap-2 items-end">
            <button onClick={() => handleSave(false)} className="px-8 py-2 bg-gray-500 text-white font-bold rounded-full shadow hover:bg-gray-600 transition" disabled={!fullImageFile}>
              SADECE KAYDET
            </button>
            <button onClick={() => handleSave(true)} className="px-8 py-3 bg-[#0078D4] text-white font-bold rounded-full shadow-xl hover:scale-105 transition" disabled={!fullImageFile}>
              İNCELEMEYE GÖNDER
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
