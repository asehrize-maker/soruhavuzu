import React, { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import {
  ArrowsPointingOutIcon,
  TrashIcon,
  PhotoIcon,
  Bars3BottomLeftIcon,
  Bars3Icon,
  Bars3BottomRightIcon,
  QueueListIcon,
  Squares2X2Icon,
  BoldIcon,
  DocumentTextIcon,
  Bars4Icon // Handle icon for drag
} from '@heroicons/react/24/outline';

// --- İMLEÇ KORUMALI EDİTÖR ---
const EditableBlock = memo(({ initialHtml, onChange, className, placeholder, style, label }) => {
  const ref = useRef(null);

  // İçerik boşsa placeholder gösterimini CSS empty:before ile yapıyoruz ama
  // Kullanıcı "yazı yazsın istemiyorum" dediği için placeholder'ı boş bırakabiliriz veya çok silik yapabiliriz.
  // Kullanıcı "Soru kökü metin paragraf... gibi mantıklı bir şey yap" dediği için
  // Placeholder yerine sadece FOCUS olunca görünen veya hiç görünmeyen bir yapı kuracağız.
  // En iyisi placeholder'ı kaldırmak, sadece focus olunca border/bg değişimi ile "buraya yaz" hissi vermek.

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml;
    }
  }, []);

  return (
    <div className="relative group/edit w-full">
      {/* Etiket (Sadece hoverda görünen küçük ipucu) */}
      <div className="absolute -top-2 left-0 text-[8px] text-gray-300 font-mono px-1 opacity-0 group-hover/edit:opacity-100 transition pointer-events-none uppercase">
        {label}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`outline-none min-h-[1.5em] hover:bg-gray-50 focus:bg-blue-50/20 transition rounded px-1 ${className || ''}`}
        style={style}
        // placeholder={placeholder} // Placeholder'ı kaldırdık (User request: "o yazılar olmasın")
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
      />
      {/* Boşsa gösterilecek minimal rehber (Sadece focus değilken) */}
      {(!initialHtml || initialHtml === '<br>') && (
        <div className="absolute top-0 left-1 text-gray-200 text-sm pointer-events-none select-none italic pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  );
}, () => true);

// --- RESIZABLE IMAGE ---
const ResizableImage = ({ src, width, height, align, onUpdate, onDelete }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeMode, setResizeMode] = useState(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const handleMouseDown = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeMode(mode);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidthPx = containerRef.current.offsetWidth;
    const startHeightPx = imgRef.current.offsetHeight;
    const containerWidth = containerRef.current.parentElement.offsetWidth;

    const doDrag = (dragEvent) => {
      const diffX = dragEvent.clientX - startX;
      const diffY = dragEvent.clientY - startY;
      let updates = {};

      if (mode === 'se' || mode === 'e') {
        let newWidthPx = startWidthPx + diffX;
        let newWidthPercent = (newWidthPx / containerWidth) * 100;
        if (newWidthPercent < 10) newWidthPercent = 10;
        if (newWidthPercent > 100) newWidthPercent = 100;
        updates.width = newWidthPercent;
      }
      if (mode === 'se' || mode === 's') {
        if (mode === 's' || (mode === 'se' && height !== 'auto')) {
          let newHeightPx = startHeightPx + diffY;
          if (newHeightPx < 50) newHeightPx = 50;
          updates.height = newHeightPx;
        }
      }
      onUpdate(updates);
    };

    const stopDrag = () => {
      setIsResizing(false);
      setResizeMode(null);
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  let containerStyle = { marginBottom: '0.5rem', position: 'relative' };
  if (align === 'left') containerStyle = { ...containerStyle, float: 'left', margin: '0 1rem 1rem 0', width: `${width}%` };
  else if (align === 'right') containerStyle = { ...containerStyle, float: 'right', margin: '0 0 1rem 1rem', width: `${width}%` };
  else if (align === 'center') containerStyle = { ...containerStyle, margin: '0 auto 1rem auto', width: `${width}%`, display: 'block' };
  else containerStyle = { ...containerStyle, width: `${width}%` };

  return (
    <div
      ref={containerRef}
      className={`group relative transition-all border-2 ${isResizing ? 'border-blue-500' : 'border-transparent hover:border-blue-200'}`}
      style={containerStyle}
    >
      <img ref={imgRef} src={src} className="block w-full" style={{ height: height === 'auto' ? 'auto' : `${height}px`, objectFit: height === 'auto' ? 'contain' : 'fill' }} alt="Görsel" />

      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition z-50 pointer-events-none group-hover:pointer-events-auto border border-gray-200">
        <button onClick={() => onUpdate({ align: 'left' })} className={`p-1 rounded ${align === 'left' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><Bars3BottomLeftIcon className="w-4 h-4" /></button>
        <button onClick={() => onUpdate({ align: 'center' })} className={`p-1 rounded ${align === 'center' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><Bars3Icon className="w-4 h-4" /></button>
        <button onClick={() => onUpdate({ align: 'right' })} className={`p-1 rounded ${align === 'right' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><Bars3BottomRightIcon className="w-4 h-4" /></button>
        <div className="w-[1px] bg-gray-300 mx-1"></div>
        <button onClick={() => onUpdate({ height: 'auto' })} className="p-1 rounded hover:bg-gray-100 text-xs font-bold">Oto</button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 text-red-500"><TrashIcon className="w-4 h-4" /></button>
      </div>

      <div onMouseDown={(e) => handleMouseDown(e, 'e')} className="absolute top-0 right-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-blue-500/20 z-10"></div>
      <div onMouseDown={(e) => handleMouseDown(e, 's')} className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-blue-500/20 z-10"></div>
      <div onMouseDown={(e) => handleMouseDown(e, 'se')} className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-nwse-resize opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-tl-lg shadow-sm z-20">
        <ArrowsPointingOutIcon className="w-3 h-3 text-white" />
      </div>
      {isResizing && <div className="absolute bottom-2 right-8 bg-black/70 text-white text-xs px-2 py-1 rounded">W: {Math.round(width)}% {height !== 'auto' ? `H: ${height}px` : ''}</div>}
    </div>
  );
};

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [widthMode, setWidthMode] = useState('dar');

  // DRAG & DROP İÇİN BAŞLANGIÇ: BOŞ ARRAY (Kullanıcı istediği için)
  const [components, setComponents] = useState([]);

  const [metadata, setMetadata] = useState({ zorluk: '3', dogruCevap: '', brans_id: '', kazanim: '' });
  const [branslar, setBranslar] = useState([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  useEffect(() => {
    const loadBranslar = async () => {
      try {
        const res = await bransAPI.getAll();
        setBranslar(res.data.data || []);
        if (user?.brans_id) setMetadata(prev => ({ ...prev, brans_id: user.brans_id }));
      } catch (err) { }
    };
    loadBranslar();
  }, [user]);

  // Ekleme Fonksiyonları (Sidebar Tetiklemeli)
  const addGovde = () => setComponents([...components, { id: Date.now(), type: 'text', subtype: 'govde', content: '', placeholder: 'Gövde', label: 'Gövde' }]);
  const addKoku = () => setComponents([...components, { id: Date.now(), type: 'text', subtype: 'koku', content: '', placeholder: 'Soru Kökü', label: 'Kök' }]);

  const addSecenekler = (mode = 'list') => {
    const baseId = Date.now();
    const opts = ['A', 'B', 'C', 'D'];
    const newComps = opts.map((opt, idx) => {
      let styleProps = { width: 100, float: 'none' };
      if (mode === 'grid') { styleProps = { width: 48, float: 'left' }; }
      return {
        id: baseId + idx,
        type: 'text', subtype: 'secenek', content: `<b>${opt})</b> `,
        placeholder: `${opt}`,
        label: `Seçenek ${opt}`,
        ...styleProps
      };
    });
    setComponents([...components, ...newComps]);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setComponents([...components, { id: Date.now(), type: 'image', content: URL.createObjectURL(file), file: file, width: 50, height: 'auto', align: 'center' }]);
    }
  };

  const updateComponent = (id, updates) => setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  const removeComponent = (id) => setComponents(prev => prev.filter(c => c.id !== id));

  // --- DRAG & DROP LOGIC ---
  const onDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Şeffaf görsel vs ayarlanabilir ama default yeterli
  };

  const onDragOver = (e, index) => {
    e.preventDefault(); // Drop'a izin ver
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    // Swap items in real-time (daha akıcı hissettirir)
    const newComps = [...components];
    const draggedItem = newComps[draggedItemIndex];
    newComps.splice(draggedItemIndex, 1);
    newComps.splice(index, 0, draggedItem);

    setComponents(newComps);
    setDraggedItemIndex(index);
  };

  const onDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const execCmd = (cmd) => document.execCommand(cmd, false, null);

  const handleSave = async () => {
    if (components.length === 0) return alert("Soru içeriği boş!");
    if (!metadata.dogruCevap) return alert("Lütfen Doğru Cevabı seçiniz.");
    if (!metadata.brans_id) return alert("Lütfen Branş seçiniz!");

    try {
      const formData = new FormData();
      formData.append('dogru_cevap', metadata.dogruCevap);
      formData.append('brans_id', metadata.brans_id);
      formData.append('kazanim', metadata.kazanim || 'Genel');

      let htmlContent = components.map(c => {
        let style = "";
        if (c.type === 'image') {
          style = `width: ${c.width}%; margin-bottom: 8px;`;
          if (c.height !== 'auto') style += ` height: ${c.height}px; object-fit: fill;`;
          if (c.align === 'left') style += ' float: left; margin-right: 12px;';
          else if (c.align === 'right') style += ' float: right; margin-left: 12px;';
          else style += ' display: block; margin-left: auto; margin-right: auto;';
          return `<div class="q-img" style="${style}"><img src="${c.content}" style="width:100%; height:100%;" /></div>`;
        }
        else {
          if (c.subtype === 'koku') style = "font-weight: bold; margin-bottom: 8px; font-size: 1.05em;";
          else if (c.subtype === 'secenek') {
            let w = c.width !== 100 ? `width: ${c.width}%;` : '';
            let f = c.float !== 'none' ? `float: ${c.float};` : '';
            let m = c.float === 'left' ? 'margin-right: 2%;' : '';
            style = `margin-bottom: 4px; padding-left: 8px; ${w} ${f} ${m}`;
          }
          else style = "margin-bottom: 8px;";

          return `<div class="q-txt q-${c.subtype}" style="${style} clear: ${c.float === 'none' ? 'both' : 'none'};">${c.content}</div>`;
        }
      }).join('');

      htmlContent += `<div style="clear: both;"></div>`;
      formData.append('soru_metni', htmlContent);

      const firstImage = components.find(c => c.type === 'image' && c.file);
      if (firstImage) { formData.append('fotograf', firstImage.file); formData.append('fotograf_konumu', 'ust'); }

      ['a', 'b', 'c', 'd'].forEach(opt => formData.append(`secenek_${opt}`, ''));

      await soruAPI.create(formData);
      alert("✅ Soru başarıyla kaydedildi!");
    } catch (error) { console.error(error); alert("Hata: " + error.message); }
  };

  const RibbonButton = ({ cmd, label, icon }) => (
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700 font-medium">{icon || label}</button>
  );

  return (
    <div className="min-h-screen bg-[#F3F2F1] pb-32 font-sans select-none">
      <div className="bg-[#0078D4] text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold flex items-center gap-2"><PhotoIcon className="w-5 h-5" /> Gelişmiş Dizgi Editörü</h1>
          <div className="flex bg-[#005A9E] rounded p-0.5 shadow-inner">
            <button onClick={() => setWidthMode('dar')} className={`px-3 py-1 text-xs font-bold rounded transition ${widthMode === 'dar' ? 'bg-white text-[#0078D4] shadow' : 'text-white/80'}`}>82mm (Dar)</button>
            <button onClick={() => setWidthMode('genis')} className={`px-3 py-1 text-xs font-bold rounded transition ${widthMode === 'genis' ? 'bg-white text-[#0078D4] shadow' : 'text-white/80'}`}>169mm (Geniş)</button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} className="px-6 py-1.5 bg-white text-[#0078D4] font-bold rounded hover:bg-blue-50 transition shadow">Kaydet</button>
          <button onClick={() => navigate('/sorular')} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded font-medium text-sm transition">Çıkış</button>
        </div>
      </div>

      <div className="flex justify-center p-8 overflow-y-auto">
        <div className="flex flex-col gap-4 sticky top-20 h-fit mr-4">
          {/* SIDEBAR TOOLS */}
          <div className="bg-white p-2 rounded shadow border flex flex-col gap-2 w-36">
            <span className="text-xs font-bold text-gray-400 uppercase text-center mb-1">Ekle</span>
            <button onClick={addGovde} className="flex items-center gap-2 p-2 hover:bg-blue-50 text-blue-700 rounded text-sm font-bold border border-transparent hover:border-blue-200 transition text-left group">
              <DocumentTextIcon className="w-5 h-5" /> Gövde
            </button>
            <button onClick={addKoku} className="flex items-center gap-2 p-2 hover:bg-purple-50 text-purple-700 rounded text-sm font-bold border border-transparent hover:border-purple-200 transition text-left group">
              <BoldIcon className="w-5 h-5" /> Kök
            </button>

            <div className="border-t my-1"></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Şıklar (4'lü)</span>

            <button onClick={() => addSecenekler('list')} className="flex items-center gap-2 p-2 hover:bg-green-50 text-green-700 rounded text-sm font-bold border border-transparent hover:border-green-200 transition text-left">
              <QueueListIcon className="w-5 h-5" /> Alt Alta
            </button>
            <button onClick={() => addSecenekler('grid')} className="flex items-center gap-2 p-2 hover:bg-teal-50 text-teal-700 rounded text-sm font-bold border border-transparent hover:border-teal-200 transition text-left">
              <Squares2X2Icon className="w-5 h-5" /> Yan Yana
            </button>

            <div className="border-t my-1"></div>
            <label className="flex items-center gap-2 p-2 hover:bg-orange-50 text-orange-700 rounded text-sm font-bold border border-transparent hover:border-orange-200 transition text-left cursor-pointer">
              <PhotoIcon className="w-5 h-5" /> Görsel
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
        </div>

        <div className="bg-white shadow-2xl transition-all duration-300 relative flex flex-col group"
          style={{ width: widthMode === 'dar' ? '82.4mm' : '169.6mm', minHeight: '120mm', padding: '10mm', paddingTop: '15mm' }}>

          {/* FORMAT TOOLBAR */}
          <div className="absolute top-0 left-0 right-0 bg-gray-50 border-b p-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition duration-300">
            <RibbonButton cmd="bold" label="B" />
            <RibbonButton cmd="italic" label="I" />
            <RibbonButton cmd="underline" label="U" />
            <div className="w-[1px] h-6 bg-gray-300 mx-1"></div>
            <RibbonButton cmd="superscript" label="x²" />
            <RibbonButton cmd="subscript" label="x₂" />
          </div>

          <div className="space-y-1 relative" style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}>

            {components.map((comp, index) => (
              <div
                key={comp.id}
                className={`relative group/item rounded px-1 transition ${draggedItemIndex === index ? 'opacity-50 bg-blue-50' : 'hover:ring-1 hover:ring-blue-100'}`}
                style={{
                  float: comp.float || 'none',
                  width: comp.width && comp.subtype === 'secenek' ? `${comp.width}%` : 'auto',
                  marginRight: comp.float === 'left' ? '2%' : '0'
                }}
                draggable="true"
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDragEnd={onDragEnd}
              >
                {/* Drag Handle & Delete (Sol tarafta sade sap) */}
                <div className="absolute -left-6 top-1 flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition z-10 w-5 cursor-grab active:cursor-grabbing">
                  <div title="Sürükle" className="p-0.5 text-gray-400 hover:text-blue-500"><Bars4Icon className="w-4 h-4" /></div>
                  <button onClick={() => removeComponent(comp.id)} className="p-0.5 text-red-300 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                </div>

                {comp.type === 'text' ? (
                  <EditableBlock
                    initialHtml={comp.content}
                    onChange={(html) => updateComponent(comp.id, { content: html })}
                    placeholder={comp.placeholder}
                    label={comp.label}
                    className={comp.subtype === 'koku' ? 'font-bold' : ''}
                  />
                ) : (
                  <ResizableImage src={comp.content} width={comp.width} height={comp.height} align={comp.align} onUpdate={(updates) => updateComponent(comp.id, updates)} onDelete={() => removeComponent(comp.id)} />
                )}
                {comp.float === 'none' && <div style={{ clear: 'both' }}></div>}
              </div>
            ))}

            {components.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300 border-2 border-dashed border-gray-100 rounded-lg select-none">
                <DocumentTextIcon className="w-12 h-12 mb-2" />
                <p>Sol menüden öğe ekleyiniz.</p>
              </div>
            )}

            <div style={{ clear: 'both' }}></div>
          </div>
        </div>
      </div>

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
              {['A', 'B', 'C', 'D'].map(opt => (
                <button key={opt} onClick={() => setMetadata({ ...metadata, dogruCevap: opt })} className={`w-8 h-8 rounded-full border font-bold text-sm ${metadata.dogruCevap === opt ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Kazanım</label>
            <input type="text" className="w-full border p-1 rounded bg-gray-50 text-sm" placeholder="Örn: 1.2.3" value={metadata.kazanim} onChange={e => setMetadata({ ...metadata, kazanim: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}
