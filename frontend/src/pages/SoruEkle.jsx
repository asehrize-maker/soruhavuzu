import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { soruAPI, bransAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import {
  PhotoIcon,
  DocumentTextIcon,
  QueueListIcon,
  Squares2X2Icon,
  DocumentArrowUpIcon,
  TrashIcon,
  Bars4Icon,
  SparklesIcon,
  DeviceTabletIcon,
  DevicePhoneMobileIcon,
  CheckBadgeIcon,
  XMarkIcon,
  ArrowRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import EditableBlock from '../components/EditableBlock';
import ResizableImage from '../components/ResizableImage';
import MetadataForm from '../components/MetadataForm';

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function SoruEkle() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [branslar, setBranslar] = useState([]);
  const [kazanims, setKazanims] = useState([]);
  const [kazanimLoading, setKazanimLoading] = useState(false);

  const [metadata, setMetadata] = useState({
    brans_id: '',
    dogruCevap: '',
    kazanim: '',
    zorluk: '3',
    kazanim_is_custom: false,
    kategori: 'deneme'
  });
  const [components, setComponents] = useState([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [widthMode, setWidthMode] = useState('dar'); // dar (82mm) | genis (169mm)

  useEffect(() => {
    const loadBranslar = async () => {
      try {
        const res = await bransAPI.getAll();
        setBranslar(res.data.data || []);
        if (user?.brans_id) setMetadata(prev => ({ ...prev, brans_id: user.brans_id, kategori: 'deneme' }));
      } catch (err) { }
    };
    loadBranslar();
  }, [user]);

  useEffect(() => {
    const loadKazanims = async () => {
      if (!metadata.brans_id) {
        setKazanims([]);
        setMetadata(prev => ({ ...prev, kazanim: '', kazanim_is_custom: false }));
        return;
      }
      try {
        setKazanimLoading(true);
        const res = await bransAPI.getKazanims(metadata.brans_id);
        const list = res.data.data || [];
        setKazanims(list);
        if (list.length > 0) {
          const codes = list.map(k => k.kod);
          if (!metadata.kazanim || !codes.includes(metadata.kazanim)) {
            setMetadata(prev => ({ ...prev, kazanim: list[0].kod, kazanim_is_custom: false }));
          }
        } else {
          setMetadata(prev => ({ ...prev, kazanim: '', kazanim_is_custom: true }));
        }
      } catch (err) {
        setKazanims([]);
      } finally {
        setKazanimLoading(false);
      }
    };
    loadKazanims();
  }, [metadata.brans_id]);

  const addKoku = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'koku', content: '', placeholder: '', label: 'Soru Kökü' }]);
  const addGovde = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'govde', content: '', placeholder: '', label: 'Gövde' }]);

  const addSecenekler = (mode = 'list') => {
    const existingSecenekler = components.filter(c => c.subtype === 'secenek');
    const hasE = existingSecenekler.some(c => c.content.includes('E)'));
    const count = hasE ? 5 : 4;

    let styleProps = { width: 100, float: 'none' };
    if (mode === 'grid') { styleProps = { width: count === 5 ? 31 : 48, float: 'left' }; }
    else if (mode === 'yanyana') { styleProps = { width: count === 5 ? 18 : 23, float: 'left' }; }

    if (existingSecenekler.length > 0) {
      setComponents(prev => prev.map(c =>
        c.subtype === 'secenek' ? { ...c, ...styleProps } : c
      ));
    } else {
      const baseId = generateId();
      const opts = hasE ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
      const newComps = opts.map((opt, idx) => ({
        id: baseId + idx,
        type: 'text', subtype: 'secenek', content: `<b>${opt})</b> `,
        placeholder: ``,
        label: `Seçenek ${opt}`,
        ...styleProps
      }));
      setComponents(prev => [...prev, ...newComps]);
    }
  };

  const addOptionE = () => {
    const existingSecenekler = components.filter(c => c.subtype === 'secenek');
    const hasE = existingSecenekler.some(c => c.content.includes('E)'));
    if (hasE) return;

    let currentMode = 'list';
    if (existingSecenekler.length > 0) {
      const w = existingSecenekler[0].width;
      if (w < 30) currentMode = 'yanyana';
      else if (w < 60) currentMode = 'grid';
    }

    let styleProps = { width: 100, float: 'none' };
    if (currentMode === 'grid') styleProps = { width: 31, float: 'left' };
    else if (currentMode === 'yanyana') styleProps = { width: 18, float: 'left' };

    // Update existing options width to match new 5-option layout
    if (currentMode !== 'list') {
      setComponents(prev => prev.map(c =>
        c.subtype === 'secenek' ? { ...c, ...styleProps } : c
      ));
    }

    const newComp = {
      id: generateId(),
      type: 'text', subtype: 'secenek', content: `<b>E)</b> `,
      placeholder: ``,
      label: `Seçenek E`,
      ...styleProps
    };
    setComponents(prev => [...prev, newComp]);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        let w = 50;
        if (img.naturalHeight > img.naturalWidth) w = 30; // Portrait -> smaller width
        else if (img.naturalWidth > img.naturalHeight * 1.5) w = 80; // Wide -> larger width
        setComponents(prev => [...prev, { id: generateId(), type: 'image', content: objectUrl, file: file, width: w, height: 'auto', align: 'center' }]);
      };
    }
  };

  const handleReadyQuestionUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        let w = 100;
        // Akıllı ölçeklendirme: Dikey görselleri tam genişlik yapma
        if (img.naturalHeight > img.naturalWidth * 1.5) w = 40; // Çok uzun/dikey
        else if (img.naturalHeight > img.naturalWidth) w = 60;  // Dikey
        else if (Math.abs(img.naturalHeight - img.naturalWidth) < 100) w = 70; // Kareye yakın

        setComponents(prev => [...prev, { id: generateId(), type: 'image', content: objectUrl, file: file, width: w, height: 'auto', align: 'center' }]);
      };
    }
  };

  const updateComponent = (id, updates) => setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  const removeComponent = (id) => setComponents(prev => prev.filter(c => c.id !== id));

  const onDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
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

  const normalizeZorluk = (value) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return '3';
    return String(Math.min(5, Math.max(1, num)));
  };

  const handleSave = async () => {
    if (components.length === 0) return alert("Soru içeriği boş!");
    if (!metadata.dogruCevap) return alert("Lütfen doğru cevabı seçiniz.");
    if (!metadata.brans_id) return alert("Lütfen branş seçiniz!");

    try {
      const formData = new FormData();
      const firstImage = components.find(c => c.type === 'image' && c.file);
      formData.append('dogru_cevap', metadata.dogruCevap);
      formData.append('brans_id', metadata.brans_id);
      formData.append('kazanim', metadata.kazanim || 'Genel');
      formData.append('zorluk_seviyesi', normalizeZorluk(metadata.zorluk));
      formData.append('kategori', metadata.kategori || 'deneme');
      formData.append('durum', 'beklemede');

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
          let commonStyle = "text-align: left; hyphens: none; -webkit-hyphens: none; line-height: 1.4;";
          if (c.subtype === 'koku') style = `${commonStyle} font-weight: bold; margin-bottom: 12px; margin-top: 4px; font-size: 10pt;`;
          else if (c.subtype === 'secenek') {
            let w = c.width !== 100 ? `width: ${c.width}%;` : '';
            let f = c.float !== 'none' ? `float: ${c.float};` : '';
            let m = c.float === 'left' ? 'margin-right: 2%;' : '';
            style = `${commonStyle} margin-bottom: 6px; padding-left: 24px; text-indent: -24px; ${w} ${f} ${m}`;
          }
          else style = `${commonStyle} margin-bottom: 8px; font-size: 10pt;`;
          return `<div class="q-txt q-${c.subtype}" style="${style} clear: ${c.float === 'none' ? 'both' : 'none'};">${c.content}</div>`;
        }
      }).join('');

      htmlContent += `<div style="clear: both;"></div>`;
      formData.append('soru_metni', htmlContent);
      if (firstImage) { formData.append('fotograf', firstImage.file); formData.append('fotograf_konumu', 'ust'); }
      ['a', 'b', 'c', 'd', 'e'].forEach(opt => formData.append(`secenek_${opt}`, ''));
      await soruAPI.create(formData);
      navigate('/brans-havuzu');
    } catch (error) { alert("Hata: " + error.message); }
  };

  const RibbonButton = ({ cmd, label, icon }) => (
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-9 h-9 flex items-center justify-center text-white font-bold hover:bg-white hover:text-blue-600 rounded-xl transition-all shadow-sm active:scale-95">{icon || label}</button>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] animate-fade-in font-sans pb-32">
      {/* EDITOR STRIP */}
      <div className="bg-gray-900 border-b border-black text-white p-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-[100] gap-4 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-blue-400" strokeWidth={2.5} />
            <span className="text-sm font-black uppercase tracking-[0.2em]">Soru Stüdyosu</span>
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
            <button onClick={() => setWidthMode('dar')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${widthMode === 'dar' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:text-white'}`}>
              <DevicePhoneMobileIcon className="w-4 h-4" /> 82MM (Dar)
            </button>
            <button onClick={() => setWidthMode('genis')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${widthMode === 'genis' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:text-white'}`}>
              <DeviceTabletIcon className="w-4 h-4" /> 169MM (Geniş)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sorular')} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">İPTAL VE ÇIKIŞ</button>
          <button onClick={handleSave} className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95">
            <CheckBadgeIcon className="w-5 h-5" /> SİSTEME KAYDET
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 pt-10">
        {/* LEFT TOOLBAR: TOOLS + OPTIONS */}
        <div className="lg:col-span-3 space-y-6">
          {/* CONTENT TOOLS */}
          <div className="bg-white p-5 rounded-3xl shadow-lg border border-gray-100 flex flex-col gap-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">İÇERİK</h4>

            <div className="grid grid-cols-1 gap-2">
              <label className="group flex flex-col p-4 bg-indigo-50 hover:bg-indigo-600 rounded-2xl cursor-pointer transition-all border border-indigo-100/50 hover:shadow-lg hover:shadow-indigo-200">
                <div className="flex items-center gap-3 text-indigo-900 group-hover:text-white font-black text-xs uppercase tracking-widest">
                  <DocumentArrowUpIcon className="w-5 h-5" />
                  <span>Soru Resmi</span>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleReadyQuestionUpload} />
              </label>

              <button onClick={addGovde} className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-800 group rounded-2xl border border-gray-100 transition-all text-left">
                <DocumentTextIcon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                <span className="text-[10px] font-black text-gray-600 group-hover:text-white uppercase tracking-widest">Metin</span>
              </button>

              <button onClick={addKoku} className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-800 group rounded-2xl border border-gray-100 transition-all text-left">
                <Bars4Icon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                <span className="text-[10px] font-black text-gray-600 group-hover:text-white uppercase tracking-widest">Soru Kökü</span>
              </button>

              <label className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-500 group rounded-2xl border border-orange-100 transition-all text-left cursor-pointer">
                <PhotoIcon className="w-5 h-5 text-orange-400 group-hover:text-white" />
                <span className="text-[10px] font-black text-orange-700 group-hover:text-white uppercase tracking-widest">Görsel</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          {/* OPTION BUTTONS moved here */}
          <div className="bg-white p-5 rounded-3xl shadow-lg border border-gray-100 flex flex-col gap-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">ŞIKLAR</h4>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => addSecenekler('list')} className="w-full py-3 flex items-center justify-start px-4 gap-3 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white rounded-2xl border border-emerald-100 transition-all group">
                <QueueListIcon className="w-5 h-5" strokeWidth={2} />
                <span className="text-[10px] font-black uppercase tracking-widest">LİSTE</span>
              </button>
              <button onClick={() => addSecenekler('grid')} className="w-full py-3 flex items-center justify-start px-4 gap-3 bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white rounded-2xl border border-teal-100 transition-all group">
                <Squares2X2Icon className="w-5 h-5" strokeWidth={2} />
                <span className="text-[10px] font-black uppercase tracking-widest">IZGARA</span>
              </button>
              <button onClick={() => addSecenekler('yanyana')} className="w-full py-3 flex items-center justify-start px-4 gap-3 bg-cyan-50 hover:bg-cyan-500 text-cyan-700 hover:text-white rounded-2xl border border-cyan-100 transition-all group">
                <div className="flex gap-0.5">
                  <div className="w-1.5 h-3 border border-current rounded-[1px]"></div>
                  <div className="w-1.5 h-3 border border-current rounded-[1px]"></div>
                  <div className="w-1.5 h-3 border border-current rounded-[1px]"></div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">YAN YANA</span>
              </button>
              <button onClick={addOptionE} className="w-full py-3 flex items-center justify-start px-4 gap-3 bg-indigo-50 hover:bg-indigo-500 text-indigo-700 hover:text-white rounded-2xl border border-indigo-100 transition-all group">
                <span className="w-5 h-5 flex items-center justify-center font-black border-2 border-current rounded-lg text-xs">E</span>
                <span className="text-[10px] font-black uppercase tracking-widest">E ŞIKKI EKLE</span>
              </button>
            </div>
          </div>
        </div>

        {/* CENTER EDITOR */}
        <div className="lg:col-span-6 flex flex-col items-center gap-6">
          <div className="bg-gray-800 p-2 rounded-2xl shadow-xl flex items-center gap-1 border border-white/5 mx-auto sticky top-24 z-40">
            <RibbonButton cmd="bold" label="B" />
            <RibbonButton cmd="italic" label="I" />
            <RibbonButton cmd="underline" label="U" />
            <div className="w-px h-6 bg-white/10 mx-2"></div>
            <RibbonButton cmd="superscript" label="x²" />
            <RibbonButton cmd="subscript" label="x₂" />
            <div className="w-px h-6 bg-white/10 mx-2"></div>
            <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }} className="p-2 hover:bg-white/10 rounded-xl transition"><QueueListIcon className="w-5 h-5 text-white/90" /></button>
          </div>

          <div className="relative group/canvas perspective-1000 w-full flex justify-center">
            <div
              className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-700 relative flex flex-col group min-h-[140mm] border border-gray-100"
              style={{
                width: widthMode === 'dar' ? '82.4mm' : '169.6mm',
                padding: '1mm 1mm 1mm 6mm',
                paddingTop: '1mm',
                borderRadius: '2px'
              }}
            >
              <div
                className="space-y-0 relative"
                style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}
                onClick={(e) => {
                  if (!e.target.closest('.delete-btn')) setConfirmDeleteId(null);
                }}
              >
                {components.map((comp, index) => (
                  <div
                    key={comp.id}
                    className={`relative group/item rounded p-0 pt-2 transition-all duration-300 ${draggedItemIndex === index ? 'opacity-30 scale-95' : 'hover:bg-blue-50/10'} ${confirmDeleteId === comp.id ? 'ring-2 ring-rose-500 bg-rose-50/50' : ''}`}
                    style={{
                      float: comp.float || 'none',
                      width: comp.width && comp.subtype === 'secenek' ? `${comp.width}%` : 'auto',
                      marginRight: comp.float === 'left' ? '2%' : '1%'
                    }}
                    draggable="true"
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDragEnd={onDragEnd}
                  >
                    {/* TOOLBAR - Top Right */}
                    <div className={`absolute top-0 right-1 flex items-center gap-1 transition-all z-[60] pt-1 ${confirmDeleteId === comp.id ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'}`}>
                      {confirmDeleteId === comp.id ? (
                        <div className="flex items-center gap-1 bg-rose-600 rounded-xl px-2 py-1 shadow-lg border border-rose-700 animate-fade-in text-white">
                          <span className="text-[9px] font-black uppercase tracking-tighter mr-1">SİLİNSİN Mİ?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); setConfirmDeleteId(null); }}
                            className="delete-btn p-1.5 hover:bg-white/20 rounded-lg transition-all active:scale-90"
                          >
                            <CheckBadgeIcon className="w-4 h-4" strokeWidth={3} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="delete-btn p-1.5 hover:bg-white/20 rounded-lg transition-all active:scale-90"
                          >
                            <XMarkIcon className="w-4 h-4" strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div title="Sürükle" className="p-1.5 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-100 text-gray-300 hover:text-blue-500 cursor-grab active:cursor-grabbing"><Bars4Icon className="w-4 h-4" strokeWidth={3} /></div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(comp.id); }}
                            className="delete-btn p-1.5 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-100 text-rose-300 hover:text-rose-600 active:scale-90 transition-all"
                          >
                            <TrashIcon className="w-4 h-4" strokeWidth={3} />
                          </button>
                        </div>
                      )}
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
                <div style={{ clear: 'both' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT METADATA PANEL */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden sticky top-32">
            <div className="p-5 border-b border-gray-50 bg-gray-50/50">
              <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-amber-500" /> KÜNYE
              </h3>
            </div>
            <div className="p-5">
              <MetadataForm
                values={metadata}
                onChange={setMetadata}
                branslar={branslar}
                kazanims={kazanims}
                kazanimLoading={kazanimLoading}
                allowManualKazanim={true}
                gridCols="grid-cols-1"
                hideBrans={user?.rol !== 'admin'}
                className="bg-transparent !p-0 !shadow-none gap-5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const BoldIcon = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h4.5a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.75h3a3.75 3.75 0 010 7.5h-3m0 0h3a3.75 3.75 0 010 7.5h-3" />
  </svg>
);
