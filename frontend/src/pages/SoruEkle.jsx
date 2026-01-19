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
  Bars4Icon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// --- İMLEÇ KORUMALI EDİTÖR ---
const EditableBlock = memo(({ initialHtml, onChange, className, style, label, hangingIndent }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml;
    }
    if (ref.current && !initialHtml) {
      setTimeout(() => { if (ref.current) ref.current.focus(); }, 50);
    }
  }, []);

  // Hanging Indent (Asılı Girinti) Stili
  const computedStyle = {
    ...style,
    textAlign: 'left', // Sola yaslı (Kullanıcı isteği)
    hyphens: 'none',   // Tireleme yok (Kullanıcı isteği)
    WebkitHyphens: 'none',
    msHyphens: 'none',
  };

  if (hangingIndent) {
    computedStyle.paddingLeft = '24px';
    computedStyle.textIndent = '-24px';
  }

  return (
    <div className="relative group/edit w-full">
      {/* Etiket */}
      <div className="absolute -top-3 left-0 text-[10px] text-gray-500 font-bold px-1 opacity-0 group-hover/edit:opacity-100 transition pointer-events-none uppercase tracking-wider bg-white/80 rounded border shadow-sm z-20">
        {label}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`outline-none min-h-[2em] p-1 border border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition rounded ${className || ''}`}
        style={computedStyle}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand("insertText", false, text);
        }}
      />
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

  let containerStyle = { marginBottom: '1rem', position: 'relative' }; // Image margin arttırıldı
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
      <div onMouseDown={(e) => handleMouseDown(e, 'se')} className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-nwse-resize opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-tl-lg shadow-sm z-20">
        <ArrowsPointingOutIcon className="w-3 h-3 text-white" />
      </div>
    </div>
  );
};

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [widthMode, setWidthMode] = useState('dar');
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

  const addKoku = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'koku', content: '', placeholder: '', label: 'Soru Kökü' }]);
  const addGovde = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'govde', content: '', placeholder: '', label: 'Gövde' }]);

  const addSecenekler = (mode = 'list') => {
    const baseId = generateId();
    const opts = ['A', 'B', 'C', 'D'];
    const newComps = opts.map((opt, idx) => {
      let styleProps = { width: 100, float: 'none' };
      if (mode === 'grid') { styleProps = { width: 48, float: 'left' }; }
      return {
        id: baseId + idx,
        type: 'text', subtype: 'secenek', content: `<b>${opt})</b> `, // Harf ile metin arasına boşluk koyduk
        placeholder: ``,
        label: `Seçenek ${opt}`,
        ...styleProps
      };
    });
    setComponents(prev => [...prev, ...newComps]);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setComponents(prev => [...prev, { id: generateId(), type: 'image', content: URL.createObjectURL(file), file: file, width: 50, height: 'auto', align: 'center' }]);
    }
  };

  const handleReadyQuestionUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setComponents(prev => [...prev, { id: generateId(), type: 'image', content: URL.createObjectURL(file), file: file, width: 100, height: 'auto', align: 'center' }]);
    }
  };

  const updateComponent = (id, updates) => setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  const removeComponent = (id) => setComponents(prev => prev.filter(c => c.id !== id));

  const onDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index);
  };
  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newComps = [...components];
    const item = newComps[draggedItemIndex];
    newComps.splice(draggedItemIndex, 1);
    newComps.splice(index, 0, item);
    setComponents(newComps);
    setDraggedItemIndex(index);
  };
  const onDragEnd = () => setDraggedItemIndex(null);
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
      // Otomatik İncelemeye Gönder
      formData.append('durum', 'inceleme_bekliyor');

      let htmlContent = components.map(c => {
        let style = "";
        if (c.type === 'image') {
          style = `width: ${c.width}%; margin-bottom: 12px;`;
          if (c.height !== 'auto') style += ` height: ${c.height}px; object-fit: fill;`;
          if (c.align === 'left') style += ' float: left; margin-right: 12px;';
          else if (c.align === 'right') style += ' float: right; margin-left: 12px;';
          else style += ' display: block; margin-left: auto; margin-right: auto;';
          return `<div class="q-img" style="${style}"><img src="${c.content}" style="width:100%; height:100%;" /></div>`;
        }
        else {
          // TEXT STYLES (Dizgi Kuralları - Sola Yaslı, Tirelemesiz)
          let commonStyle = "text-align: left; hyphens: none; -webkit-hyphens: none; line-height: 1.4;";

          if (c.subtype === 'koku') style = `${commonStyle} font-weight: bold; margin-bottom: 12px; margin-top: 4px; font-size: 10pt;`;
          else if (c.subtype === 'secenek') {
            let w = c.width !== 100 ? `width: ${c.width}%;` : '';
            let f = c.float !== 'none' ? `float: ${c.float};` : '';
            let m = c.float === 'left' ? 'margin-right: 2%;' : '';
            // Asılı Girinti (Hanging Indent)
            style = `${commonStyle} margin-bottom: 6px; padding-left: 24px; text-indent: -24px; ${w} ${f} ${m}`;
          }
          else style = `${commonStyle} margin-bottom: 8px; font-size: 10pt;`; // Govde

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
          <div className="bg-white p-2 rounded shadow border flex flex-col gap-2 w-36">
            <span className="text-xs font-bold text-gray-400 uppercase text-center mb-1">Yeni Ekle</span>
            <label className="flex flex-col p-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100 hover:border-blue-300 transition text-left cursor-pointer group mb-1">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm"><DocumentArrowUpIcon className="w-5 h-5" /> Soru PNG'si</div>
              <span className="text-[10px] text-gray-500 ml-7">Hazır dizili soru resmi</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleReadyQuestionUpload} />
            </label>
            <div className="border-t my-1"></div>
            <button onClick={addKoku} className="flex flex-col p-2 hover:bg-purple-50 rounded border border-transparent hover:border-purple-200 transition text-left group">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm"><BoldIcon className="w-4 h-4" /> Soru Kökü</div>
              <span className="text-[10px] text-gray-400 ml-6">Soru cümlesi (koyu)</span>
            </button>
            <button onClick={addGovde} className="flex flex-col p-2 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition text-left group">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm"><DocumentTextIcon className="w-4 h-4" /> Gövde</div>
              <span className="text-[10px] text-gray-400 ml-6">Metin, paragraf...</span>
            </button>
            <div className="border-t my-1"></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Şıklar (4 Adet)</span>
            <button onClick={() => addSecenekler('list')} className="flex items-center gap-2 p-2 hover:bg-green-50 text-green-700 rounded text-sm font-bold border border-transparent hover:border-green-200 transition text-left">
              <QueueListIcon className="w-5 h-5" /> Alt Alta
            </button>
            <button onClick={() => addSecenekler('grid')} className="flex items-center gap-2 p-2 hover:bg-teal-50 text-teal-700 rounded text-sm font-bold border border-transparent hover:border-teal-200 transition text-left">
              <Squares2X2Icon className="w-5 h-5" /> Yan Yana
            </button>
            <div className="border-t my-1"></div>
            <label className="flex flex-col p-2 hover:bg-orange-50 rounded border border-transparent hover:border-orange-200 transition text-left cursor-pointer">
              <div className="flex items-center gap-2 text-orange-700 font-bold text-sm"><PhotoIcon className="w-4 h-4" /> Görsel</div>
              <span className="text-[10px] text-gray-400 ml-6">Resim, grafik, harita</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
        </div>

        <div className="bg-white shadow-2xl transition-all duration-300 relative flex flex-col group min-h-[120mm]"
          style={{ width: widthMode === 'dar' ? '82.4mm' : '169.6mm', padding: '10mm', paddingTop: '15mm' }}>
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
                <div className="absolute -left-6 top-1 flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition z-10 w-5 cursor-grab active:cursor-grabbing">
                  <div title="Sürükle" className="p-0.5 text-gray-400 hover:text-blue-500"><Bars4Icon className="w-4 h-4" /></div>
                  <button onClick={() => removeComponent(comp.id)} className="p-0.5 text-red-300 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                </div>

                {comp.type === 'text' ? (
                  <EditableBlock
                    initialHtml={comp.content}
                    onChange={(html) => updateComponent(comp.id, { content: html })}
                    label={comp.label}
                    hangingIndent={comp.subtype === 'secenek'}
                    className={comp.subtype === 'koku' ? 'font-bold' : ''}
                  />
                ) : (
                  <ResizableImage src={comp.content} width={comp.width} height={comp.height} align={comp.align} onUpdate={(updates) => updateComponent(comp.id, updates)} onDelete={() => removeComponent(comp.id)} />
                )}
                {comp.float === 'none' && <div style={{ clear: 'both' }}></div>}
              </div>
            ))}

            {components.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20 text-gray-200 select-none">
                <p className="italic">Öğe eklemek için solu kullanın</p>
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
