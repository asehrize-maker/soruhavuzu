import React, { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhotoIcon,
  Bars3BottomLeftIcon,
  Bars3Icon,
  Bars3BottomRightIcon
} from '@heroicons/react/24/outline';

// --- İMLEÇ KORUMALI EDİTÖR ---
const EditableBlock = memo(({ initialHtml, onChange, className, placeholder }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
  }, []);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className + " outline-none empty:before:content-[attr(placeholder)] empty:before:text-gray-300 min-h-[1.5em] focus:bg-blue-50/10 transition rounded px-1"}
      placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
    />
  );
}, () => true);

// --- GELİŞMİŞ GÖRSEL EDİTÖRÜ (RESIZABLE & ALIGNABLE) ---
const ResizableImage = ({ src, width, align, onUpdate, onDelete }) => {
  const [isResizing, setIsResizing] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Resize Handler
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = imgRef.current ? imgRef.current.offsetWidth : 0;
    const containerWidth = containerRef.current ? containerRef.current.parentElement.offsetWidth : 1000;

    const doDrag = (dragEvent) => {
      const currentX = dragEvent.clientX;
      const diff = currentX - startX;
      let newWidthPx = startWidth + diff;

      // Yüzdeye çevir (Responsive olması için)
      let newWidthPercent = (newWidthPx / containerWidth) * 100;

      // Sınırlar
      if (newWidthPercent < 10) newWidthPercent = 10;
      if (newWidthPercent > 100) newWidthPercent = 100;

      onUpdate({ width: newWidthPercent, align });
    };

    const stopDrag = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  // Alignment Styles
  let containerStyle = { marginBottom: '1rem', position: 'relative' };
  if (align === 'left') containerStyle = { ...containerStyle, float: 'left', margin: '0 1rem 1rem 0', width: `${width}%` };
  else if (align === 'right') containerStyle = { ...containerStyle, float: 'right', margin: '0 0 1rem 1rem', width: `${width}%` };
  else if (align === 'center') containerStyle = { ...containerStyle, margin: '0 auto 1rem auto', width: `${width}%`, display: 'block' };
  else containerStyle = { ...containerStyle, width: `${width}%` }; // Default block

  return (
    <div
      ref={containerRef}
      className={`group relative transition-all border-2 ${isResizing ? 'border-blue-500' : 'border-transparent hover:border-blue-200'}`}
      style={containerStyle}
    >
      <img ref={imgRef} src={src} className="w-full h-auto block" alt="Soru Görseli" />

      {/* Kontrol Paneli (Hoverda görünür) */}
      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition z-50 pointer-events-none group-hover:pointer-events-auto border border-gray-200">
        <button onClick={() => onUpdate({ width, align: 'left' })} className={`p-1 rounded ${align === 'left' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Sola Yasla"><Bars3BottomLeftIcon className="w-4 h-4" /></button>
        <button onClick={() => onUpdate({ width, align: 'center' })} className={`p-1 rounded ${align === 'center' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Ortala"><Bars3Icon className="w-4 h-4" /></button>
        <button onClick={() => onUpdate({ width, align: 'right' })} className={`p-1 rounded ${align === 'right' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="Sağa Yasla"><Bars3BottomRightIcon className="w-4 h-4" /></button>
        <div className="w-[1px] bg-gray-300 mx-1"></div>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 text-red-500" title="Sil"><TrashIcon className="w-4 h-4" /></button>
      </div>

      {/* Resize Handle (Sağ Alt) */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-tl-lg shadow-sm z-10"
      >
        <ArrowsPointingOutIcon className="w-3 h-3 text-white" />
      </div>

      {/* Boyut Göstergesi */}
      {isResizing && (
        <div className="absolute bottom-2 right-8 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {Math.round(width)}%
        </div>
      )}
    </div>
  );
};

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // --- DEVLETLER (STATES) ---
  const [widthMode, setWidthMode] = useState('dar'); // 'dar' (82mm) | 'genis' (169mm)
  // components: { id, type: 'text'|'image', content: html|url, width: 100, align: 'center' }
  const [components, setComponents] = useState([
    { id: 'init_koku', type: 'text', content: '', placeholder: 'Soru kökünü buraya yazınız...' }
  ]);

  // Metadata
  const [metadata, setMetadata] = useState({ zorluk: '3', dogruCevap: '', brans_id: '', kazanim: '' });
  const [branslar, setBranslar] = useState([]);

  useEffect(() => {
    const loadBranslar = async () => {
      try {
        const res = await bransAPI.getAll();
        setBranslar(res.data.data || []);
        if (user?.brans_id) setMetadata(prev => ({ ...prev, brans_id: user.brans_id }));
        else if (res.data.data?.length > 0) setMetadata(prev => ({ ...prev, brans_id: res.data.data[0].id }));
      } catch (err) { console.error("Branşlar yüklenemedi", err); }
    };
    loadBranslar();
  }, [user]);

  // --- İŞLEVLER ---

  const addTextBlock = () => {
    const newComp = { id: Date.now(), type: 'text', content: '', placeholder: 'Metin...' };
    setComponents([...components, newComp]);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      // Varsayılan: %50 genişlik, ortalanmış
      const newComp = { id: Date.now(), type: 'image', content: url, file: file, width: 50, align: 'center' };
      setComponents([...components, newComp]);
    }
  };

  const updateComponent = (id, updates) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeComponent = (id) => {
    if (components.length <= 1 && components[0].type === 'text') {
      updateComponent(id, { content: '' }); // Tek kalan text'i silme, temizle
    } else {
      setComponents(prev => prev.filter(c => c.id !== id));
    }
  };

  const moveComponent = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === components.length - 1)) return;
    const newComps = [...components];
    const temp = newComps[index];
    newComps[index] = newComps[index + direction];
    newComps[index + direction] = temp;
    setComponents(newComps);
  };

  const execCmd = (cmd) => document.execCommand(cmd, false, null);

  const handleSave = async () => {
    if (!metadata.dogruCevap) return alert("Lütfen Doğru Cevabı seçiniz.");
    if (!metadata.brans_id) return alert("Lütfen Branş seçiniz!");

    try {
      const formData = new FormData();
      formData.append('dogru_cevap', metadata.dogruCevap);
      formData.append('brans_id', metadata.brans_id);
      formData.append('kazanim', metadata.kazanim || 'Genel');

      // HTML Oluşturma (Layout stili ile)
      // Floated elementler için 'clear: both' eklemek gerekebilir
      let htmlContent = components.map(c => {
        if (c.type === 'image') {
          // Görsel için style
          let style = `width: ${c.width}%; margin-bottom: 12px;`;
          if (c.align === 'left') style += ' float: left; margin-right: 12px;';
          if (c.align === 'right') style += ' float: right; margin-left: 12px;';
          if (c.align === 'center') style += ' display: block; margin-left: auto; margin-right: auto;';

          return `<div class="question-image-block" style="${style}"><img src="${c.content}" style="width: 100%; height: auto;" /></div>`;
        } else {
          return `<div class="question-text-block" style="margin-bottom: 8px; clear: both;">${c.content}</div>`;
        }
      }).join('');

      // Footer clear fix
      htmlContent += `<div style="clear: both;"></div>`;

      formData.append('soru_metni', htmlContent);

      // Resim dosyalarını da ayrıca append etmeliyiz ama backend tek dosya bekliyor olabilir ('fotograf' alanı).
      // Eğer backend çoklu dosya veya base64 desteklemiyorsa bu sorun olabilir.
      // Şimdilik ilk bulduğumuz resmi 'fotograf' olarak atayalım (Thumbnail için).
      const firstImage = components.find(c => c.type === 'image' && c.file);
      if (firstImage) {
        formData.append('fotograf', firstImage.file);
        formData.append('fotograf_konumu', 'ust'); // Legacy field
      }

      ['a', 'b', 'c', 'd', 'e'].forEach(opt => formData.append(`secenek_${opt}`, ''));

      await soruAPI.create(formData);
      alert("✅ Soru (Dizgili) başarıyla kaydedildi!");
    } catch (error) {
      console.error(error);
      alert("Hata: " + error.message);
    }
  };

  const RibbonButton = ({ cmd, label, icon }) => (
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700 font-medium" title={label}>{icon || label}</button>
  );

  return (
    <div className="min-h-screen bg-[#F3F2F1] pb-32 font-sans selection:bg-blue-200">

      {/* HEADER */}
      <div className="bg-[#0078D4] text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-wide flex items-center gap-2"><PhotoIcon className="w-5 h-5" /> Gelişmiş Dizgi Editörü</h1>
          <div className="h-6 w-[1px] bg-white/30"></div>
          <div className="flex bg-[#005A9E] rounded p-0.5 shadow-inner">
            <button onClick={() => setWidthMode('dar')} className={`px-3 py-1 text-xs font-bold rounded transition ${widthMode === 'dar' ? 'bg-white text-[#0078D4] shadow' : 'text-white/80'}`}>82mm (Dar)</button>
            <button onClick={() => setWidthMode('genis')} className={`px-3 py-1 text-xs font-bold rounded transition ${widthMode === 'genis' ? 'bg-white text-[#0078D4] shadow' : 'text-white/80'}`}>169mm (Geniş)</button>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-1.5 bg-white text-[#0078D4] font-bold rounded hover:bg-blue-50 transition shadow"
          >
            Kaydet
          </button>
          <button onClick={() => navigate('/sorular')} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded font-medium text-sm transition">Çıkış</button>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex justify-center p-8 overflow-y-auto">
        <div
          className="bg-white shadow-2xl transition-all duration-300 relative flex flex-col group print:shadow-none"
          style={{
            width: widthMode === 'dar' ? '82.4mm' : '169.6mm',
            minHeight: '120mm',
            padding: '10mm',
            paddingTop: '20mm' // Header space
          }}
        >
          {/* Toolbar (Floating on hover or persistent top) */}
          <div className="absolute top-0 left-0 right-0 bg-gray-50 border-b p-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition duration-300">
            <RibbonButton cmd="bold" label="B" />
            <RibbonButton cmd="italic" label="I" />
            <RibbonButton cmd="underline" label="U" />
            <div className="w-[1px] h-6 bg-gray-300 mx-1"></div>
            <RibbonButton cmd="superscript" label="x²" />
            <RibbonButton cmd="subscript" label="x₂" />
            <div className="flex-1"></div>
            <label className="cursor-pointer flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-bold transition">
              <PhotoIcon className="w-4 h-4" /> Resim Ekle
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
            <button onClick={addTextBlock} className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs font-bold transition">Metin Ekle</button>
          </div>

          {/* Soru İçeriği Loop */}
          <div className="space-y-2 relative" style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}>
            {/* Soru No */}
            <div className="absolute -top-4 -left-4 font-bold text-gray-400 text-xs select-none p-2">1</div>

            {components.map((comp, index) => (
              <div key={comp.id} className="relative group/item hover:ring-1 hover:ring-blue-100 rounded p-1 transition">
                {/* Sıralama Butonları (Solda belirir) */}
                <div className="absolute -left-8 top-1 flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition z-10">
                  <button onClick={() => moveComponent(index, -1)} className="p-1 bg-white hover:bg-gray-100 rounded border shadow text-gray-500"><ArrowUpIcon className="w-3 h-3" /></button>
                  <button onClick={() => moveComponent(index, 1)} className="p-1 bg-white hover:bg-gray-100 rounded border shadow text-gray-500"><ArrowDownIcon className="w-3 h-3" /></button>
                  <button onClick={() => removeComponent(comp.id)} className="p-1 bg-white hover:bg-red-50 rounded border shadow text-red-500"><TrashIcon className="w-3 h-3" /></button>
                </div>

                {comp.type === 'text' ? (
                  <EditableBlock
                    initialHtml={comp.content}
                    onChange={(html) => updateComponent(comp.id, { content: html })}
                    placeholder={comp.placeholder}
                  />
                ) : (
                  <ResizableImage
                    src={comp.content}
                    width={comp.width}
                    align={comp.align}
                    onUpdate={(updates) => updateComponent(comp.id, updates)}
                    onDelete={() => removeComponent(comp.id)}
                  />
                )}
                <div style={{ clear: 'both' }}></div> {/* Float temizliği */}
              </div>
            ))}

            {/* Boş Tıklama Alanı (Yeni metin eklemek için) */}
            <div className="min-h-[2rem] cursor-text" onClick={() => { if (components[components.length - 1].type !== 'text') addTextBlock(); }}></div>
          </div>
        </div>
      </div>

      {/* METADATA PANELİ (FOOTER gİBİ) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg-up flex justify-center z-50">
        <div className="flex gap-6 max-w-4xl w-full items-end">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Branş</label>
            <select className="w-full border p-1 rounded bg-gray-50" value={metadata.brans_id} onChange={e => setMetadata({ ...metadata, brans_id: e.target.value })}>
              <option value="">Seçiniz</option>
              {branslar.map(b => <option key={b.id} value={b.id}>{b.brans_adi}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Doğru Cevap</label>
            <div className="flex gap-2">
              {['A', 'B', 'C', 'D', 'E'].map(opt => (
                <button key={opt} onClick={() => setMetadata({ ...metadata, dogruCevap: opt })} className={`w-8 h-8 rounded-full border font-bold text-sm ${metadata.dogruCevap === opt ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Kazanım</label>
            <input type="text" className="w-full border p-1 rounded bg-gray-50 text-sm" placeholder="Örn: 1.2.3 Analitik..." value={metadata.kazanim} onChange={e => setMetadata({ ...metadata, kazanim: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}
