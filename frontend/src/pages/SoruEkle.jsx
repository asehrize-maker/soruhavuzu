import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { soruAPI, bransAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import {
  PhotoIcon,
  DocumentTextIcon,
  QueueListIcon,
  Squares2X2Icon,
  BoldIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  Bars4Icon,
  SparklesIcon,
  DeviceTabletIcon,
  DevicePhoneMobileIcon,
  CheckBadgeIcon,
  ArrowRightIcon,
  InformationCircleIcon
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

  const [metadata, setMetadata] = useState({ brans_id: '', dogruCevap: '', kazanim: '', zorluk: '3', kazanim_is_custom: false });
  const [components, setComponents] = useState([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [widthMode, setWidthMode] = useState('dar'); // dar (82mm) | genis (169mm)

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
    const baseId = generateId();
    const opts = ['A', 'B', 'C', 'D'];
    const newComps = opts.map((opt, idx) => {
      let styleProps = { width: 100, float: 'none' };
      if (mode === 'grid') { styleProps = { width: 48, float: 'left' }; }
      return {
        id: baseId + idx,
        type: 'text', subtype: 'secenek', content: `<b>${opt})</b> `,
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
    if (!metadata.dogruCevap) return alert("Lütfen Doğru Cevabı seçiniz.");
    if (!metadata.brans_id) return alert("Lütfen Branş seçiniz!");

    try {
      const formData = new FormData();
      formData.append('dogru_cevap', metadata.dogruCevap);
      formData.append('brans_id', metadata.brans_id);
      formData.append('kazanim', metadata.kazanim || 'Genel');
      formData.append('zorluk_seviyesi', normalizeZorluk(metadata.zorluk));
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
      const firstImage = components.find(c => c.type === 'image' && c.file);
      if (firstImage) { formData.append('fotograf', firstImage.file); formData.append('fotograf_konumu', 'ust'); }
      ['a', 'b', 'c', 'd'].forEach(opt => formData.append(`secenek_${opt}`, ''));
      await soruAPI.create(formData);
      navigate('/brans-havuzu');
    } catch (error) { alert("Hata: " + error.message); }
  };

  const RibbonButton = ({ cmd, label, icon }) => (
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-9 h-9 flex items-center justify-center hover:bg-white hover:text-blue-600 rounded-xl transition-all shadow-sm active:scale-95">{icon || label}</button>
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
            <CheckBadgeIcon className="w-5 h-5" /> HAVUZA KAYDET
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 p-10 pt-16">
        {/* LEFT TOOLBAR */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white p-8 rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col gap-6">
            <div className="space-y-1 px-2 mb-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none">ARAÇ KUTUSU</h4>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">İçerik Ekle</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="group flex flex-col p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl cursor-pointer transition-all hover:shadow-xl hover:shadow-indigo-100 hover:-translate-y-1">
                <div className="flex items-center gap-3 text-white font-black text-sm uppercase tracking-widest"><DocumentArrowUpIcon className="w-5 h-5" /> Soru PNG'si</div>
                <span className="text-[10px] text-white/60 font-medium italic mt-1 font-sans">Hazır mizanpajlı resmi içe aktar</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleReadyQuestionUpload} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={addKoku} className="flex flex-col p-5 bg-gray-50 hover:bg-blue-600 group rounded-3xl border border-gray-100 transition-all hover:shadow-lg hover:shadow-blue-100 text-left">
                  <BoldIcon className="w-5 h-5 text-gray-400 group-hover:text-white mb-2" />
                  <span className="text-[10px] font-black text-gray-600 group-hover:text-white uppercase tracking-widest">Soru Kökü</span>
                </button>
                <button onClick={addGovde} className="flex flex-col p-5 bg-gray-50 hover:bg-blue-600 group rounded-3xl border border-gray-100 transition-all hover:shadow-lg hover:shadow-blue-100 text-left">
                  <DocumentTextIcon className="w-5 h-5 text-gray-400 group-hover:text-white mb-2" />
                  <span className="text-[10px] font-black text-gray-600 group-hover:text-white uppercase tracking-widest">Metin</span>
                </button>
              </div>

              <div className="pt-2">
                <h5 className="text-[10px] font-black text-gray-300 uppercase tracking-widest text-center mb-3">SEÇENEK ŞABLONLARI</h5>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => addSecenekler('list')} className="flex items-center gap-2 p-4 bg-emerald-50 hover:bg-emerald-600 group rounded-2xl text-[10px] font-black text-emerald-700 group-hover:text-white border border-emerald-100 uppercase tracking-widest transition-all">
                    <QueueListIcon className="w-5 h-5 group-hover:text-white" /> LİSTE
                  </button>
                  <button onClick={() => addSecenekler('grid')} className="flex items-center gap-2 p-4 bg-teal-50 hover:bg-teal-600 group rounded-2xl text-[10px] font-black text-teal-700 group-hover:text-white border border-teal-100 uppercase tracking-widest transition-all">
                    <Squares2X2Icon className="w-5 h-5 group-hover:text-white" /> IZGARA
                  </button>
                </div>
              </div>

              <label className="flex flex-col p-5 bg-orange-50 hover:bg-orange-600 group rounded-3xl border border-orange-100 transition-all text-left cursor-pointer mt-2">
                <div className="flex items-center gap-3 text-orange-700 group-hover:text-white font-black text-sm uppercase tracking-widest"><PhotoIcon className="w-5 h-5" /> Görsel Ekle</div>
                <span className="text-[10px] text-orange-400 group-hover:text-white/60 font-medium italic mt-1 font-sans">Grafik, harita veya fotoğraf</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          <div className="bg-blue-50 p-8 rounded-[3rem] border border-blue-100 space-y-3">
            <InformationCircleIcon className="w-8 h-8 text-blue-600" />
            <h5 className="text-xs font-black text-blue-900 uppercase tracking-widest">Dizgi Kuralı</h5>
            <p className="text-sm text-blue-700 font-medium italic leading-relaxed">Sistem MEB standartlarına göre otomatik sola yaslı ve tirelemesiz (hyphens: none) çıktı üretir.</p>
          </div>
        </div>

        {/* CENTER EDITOR */}
        <div className="lg:col-span-9 flex flex-col items-center gap-10">
          <div className="bg-gray-800 p-2 rounded-3xl shadow-2xl flex items-center gap-1 border border-white/5 mx-auto">
            <RibbonButton cmd="bold" label="B" />
            <RibbonButton cmd="italic" label="I" />
            <RibbonButton cmd="underline" label="U" />
            <div className="w-px h-6 bg-white/10 mx-2"></div>
            <RibbonButton cmd="superscript" label="x²" />
            <RibbonButton cmd="subscript" label="x₂" />
            <div className="w-px h-6 bg-white/10 mx-2"></div>
            <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }} className="p-2 hover:bg-white/10 rounded-xl transition"><QueueListIcon className="w-5 h-5 text-gray-400" /></button>
          </div>

          <div className="relative group/canvas perspective-1000">
            <div
              className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-700 relative flex flex-col group min-h-[140mm] border border-gray-100"
              style={{
                width: widthMode === 'dar' ? '82.4mm' : '169.6mm',
                padding: '10mm',
                paddingTop: '15mm',
                borderRadius: '2px'
              }}
            >
              <div className="space-y-1 relative" style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}>
                {components.map((comp, index) => (
                  <div
                    key={comp.id}
                    className={`relative group/item rounded px-2 transition-all duration-300 ${draggedItemIndex === index ? 'opacity-30 scale-95' : 'hover:bg-blue-50/30'}`}
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
                    <div className="absolute -left-10 top-2 flex flex-col gap-2 opacity-0 group-hover/item:opacity-100 transition-all z-[60] w-8">
                      <div title="Sürükle" className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-300 hover:text-blue-500 cursor-grab active:cursor-grabbing"><Bars4Icon className="w-4 h-4" strokeWidth={3} /></div>
                      <button onClick={() => removeComponent(comp.id)} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-rose-300 hover:text-rose-600"><TrashIcon className="w-4 h-4" strokeWidth={3} /></button>
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
                  <div className="flex flex-col items-center justify-center pt-32 text-center text-gray-200 pointer-events-none">
                    <ArrowRightIcon className="w-20 h-20 rotate-180 opacity-10 mb-4" />
                    <p className="font-black text-xs uppercase tracking-[0.3em] opacity-30">LÜTFEN SOL PANELİ KULLANARAK<br />SORU İÇERİĞİ OLUŞTURUN</p>
                  </div>
                )}
                <div style={{ clear: 'both' }}></div>
              </div>
            </div>
          </div>

          {/* METADATA FORM AREA */}
          <div className="w-full xl:w-[169.6mm] animate-fade-in-up">
            <div className="bg-white rounded-[3.5rem] shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <SparklesIcon className="w-6 h-6 text-amber-500" /> Soru Künyesi ve Ayarlar
                </h3>
                <div className="px-5 py-2 bg-gray-50 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest">Metadata</div>
              </div>
              <div className="p-4">
                <MetadataForm
                  values={metadata}
                  onChange={setMetadata}
                  branslar={branslar}
                  kazanims={kazanims}
                  kazanimLoading={kazanimLoading}
                  allowManualKazanim={true}
                  className="border-0 shadow-none bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
