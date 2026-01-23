import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { soruAPI, bransAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
// Icons
import {
  PhotoIcon, DocumentTextIcon, QueueListIcon, Squares2X2Icon,
  BoldIcon, DocumentArrowUpIcon, TrashIcon, Bars4Icon
} from '@heroicons/react/24/outline';
import EditableBlock from '../components/EditableBlock';
import ResizableImage from '../components/ResizableImage';
import MetadataForm from '../components/MetadataForm';

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function SoruEkle() {
  const { user } = useAuth();
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
          // If current kazanım is not in the new list, pick the first one and clear custom flag
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
      formData.append('zorluk_seviyesi', metadata.zorluk || '3');
      formData.append('brans_id', metadata.brans_id);
      formData.append('kazanim', metadata.kazanim || 'Genel');
      // Otomatik Branş Havuzuna Gönder (Taslak olarak)
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
      navigate('/brans-havuzu');
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
          <button onClick={handleSave} className="px-6 py-1.5 bg-white text-[#0078D4] font-bold rounded hover:bg-blue-50 transition shadow">Soruyu Kaydet</button>
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

      <div className="max-w-4xl mx-auto mt-6 pb-12">
        <div className="bg-white border shadow-sm rounded-lg overflow-hidden">
          <MetadataForm
            values={metadata}
            onChange={setMetadata}
            branslar={branslar}
            kazanims={kazanims}
            kazanimLoading={kazanimLoading}
            allowManualKazanim={true}
            className="border-0 shadow-none"
          />
        </div>
      </div>

    </div>
  );
}
