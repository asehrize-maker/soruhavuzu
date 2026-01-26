import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import { getDurumBadge } from '../utils/helpers';
import EditableBlock from '../components/EditableBlock';
import ResizableImage from '../components/ResizableImage';
import IncelemeYorumlari from '../components/IncelemeYorumlari';
import MetadataForm from '../components/MetadataForm';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';
import {
  TrashIcon,
  PhotoIcon,
  QueueListIcon,
  DocumentTextIcon,
  Bars4Icon,
  PencilSquareIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  CameraIcon,
  SparklesIcon,
  CheckCircleIcon,
  FlagIcon,
  PaintBrushIcon,
  MagnifyingGlassPlusIcon,
  InformationCircleIcon,
  XMarkIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckBadgeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

const parseHtmlToComponents = (html) => {
  if (!html) return [];
  const div = document.createElement('div');
  div.innerHTML = html;
  const nodes = Array.from(div.children);
  const structured = nodes.filter(n => n.classList.contains('q-txt') || n.classList.contains('q-img'));

  if (structured.length === 0) {
    return [{ id: generateId(), type: 'text', subtype: 'govde', content: html, label: 'Gövde' }];
  }

  return structured.map((node, idx) => {
    if (node.classList.contains('q-img')) {
      const img = node.querySelector('img');
      const style = node.getAttribute('style') || '';
      const wMatch = style.match(/width:\s*(\d+)%/);
      const hMatch = style.match(/height:\s*(\d+)px/);
      let align = 'center';
      if (style.includes('float: left')) align = 'left';
      else if (style.includes('float: right')) align = 'right';

      return {
        id: generateId() + idx,
        type: 'image',
        content: img ? img.src : '',
        width: wMatch ? parseInt(wMatch[1]) : 50,
        height: hMatch ? parseInt(hMatch[1]) : 'auto',
        align: align
      };
    } else {
      const subtype = Array.from(node.classList).find(c => c.startsWith('q-'))?.replace('q-', '') || 'govde';
      const style = node.getAttribute('style') || '';
      const wMatch = style.match(/width:\s*(\d+)%/);
      const fMatch = style.match(/float:\s*(\w+)/);

      return {
        id: generateId() + idx,
        type: 'text',
        subtype: subtype,
        content: node.innerHTML,
        label: subtype === 'koku' ? 'Soru Kökü' : (subtype === 'secenek' ? 'Seçenek' : 'Gövde'),
        width: wMatch ? parseInt(wMatch[1]) : 100,
        float: fMatch ? fMatch[1] : 'none'
      };
    }
  });
};

export default function SoruDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const incelemeTuru = queryParams.get('incelemeTuru');
  const scope = queryParams.get('scope');

  const { user: authUser, viewRole } = useAuthStore();
  const rawRole = viewRole || authUser?.rol;
  const effectiveRole = ['alan_incelemeci', 'dil_incelemeci', 'incelemeci'].includes(rawRole)
    ? 'incelemeci'
    : rawRole;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;

  const effectiveIncelemeTuru = useMemo(() => {
    if (incelemeTuru === 'alanci' || incelemeTuru === 'dilci') return incelemeTuru;
    if (effectiveRole === 'incelemeci') {
      const alan = !!authUser?.inceleme_alanci || rawRole === 'alan_incelemeci';
      const dil = !!authUser?.inceleme_dilci || rawRole === 'dil_incelemeci';
      if (alan && !dil) return 'alanci';
      if (dil && !alan) return 'dilci';
      if (alan && dil) return 'alanci';
    }
    return null;
  }, [incelemeTuru, effectiveRole, authUser, rawRole]);

  const canReview = effectiveRole === 'admin' || (effectiveRole === 'incelemeci' && !!effectiveIncelemeTuru);

  const [soru, setSoru] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dizgiNotu, setDizgiNotu] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branslar, setBranslar] = useState([]);
  const [kazanims, setKazanims] = useState([]);
  const [kazanimLoading, setKazanimLoading] = useState(false);

  const [components, setComponents] = useState([]);
  const [widthMode, setWidthMode] = useState('dar');
  const [editMetadata, setEditMetadata] = useState({ zorluk: '3', dogruCevap: '', brans_id: '', kazanim: '' });
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const soruMetniRef = useRef(null);
  const [selectedText, setSelectedText] = useState('');
  const [revizeNotuInput, setRevizeNotuInput] = useState('');
  const [revizeNotlari, setRevizeNotlari] = useState([]);

  useEffect(() => {
    loadSoru();
    loadRevizeNotlari();
    loadBranslar();
  }, [id]);

  useEffect(() => {
    const loadKazanims = async () => {
      if (!editMetadata.brans_id) {
        setKazanims([]);
        setEditMetadata(prev => ({ ...prev, kazanim: '' }));
        return;
      }
      try {
        setKazanimLoading(true);
        const res = await bransAPI.getKazanims(editMetadata.brans_id);
        const list = res.data.data || [];
        setKazanims(list);
        if (list.length > 0) {
          const codes = list.map(k => k.kod);
          if (!editMetadata.kazanim || !codes.includes(editMetadata.kazanim)) {
            setEditMetadata(prev => ({ ...prev, kazanim: list[0].kod }));
          }
        } else {
          setEditMetadata(prev => ({ ...prev, kazanim: '' }));
        }
      } catch (err) {
        setKazanims([]);
      } finally {
        setKazanimLoading(false);
      }
    };
    loadKazanims();
  }, [editMetadata.brans_id]);

  const loadBranslar = async () => {
    try {
      const res = await bransAPI.getAll();
      setBranslar(res.data.data || []);
    } catch (err) { }
  };

  const renderLatexInElement = (element, content) => {
    if (!element || !content) return;
    let html = content;
    html = html.replace(/\$\$([^\$]+)\$\$/g, (match, latex) => {
      try { return katex.renderToString(latex, { throwOnError: false, displayMode: true }); }
      catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\$([^\$]+)\$/g, (match, latex) => {
      try { return katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
      catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\n/g, '<br>');
    if (revizeNotlari && revizeNotlari.length > 0) {
      const visibleNotes = revizeNotlari.filter(not => {
        if (user?.rol === 'admin' || user?.rol === 'dizgici') return true;
        if (incelemeTuru || (user?.rol === 'incelemeci' && effectiveIncelemeTuru)) {
          return not.inceleme_turu === (incelemeTuru || effectiveIncelemeTuru);
        }
        return true;
      });
      visibleNotes.forEach((not, index) => {
        if (!not.secilen_metin) return;
        const colorClass = not.inceleme_turu === 'dilci' ? 'green' : 'blue';
        const mark = `<mark class="bg-${colorClass}-100 border-b-2 border-${colorClass}-400 px-1 relative group cursor-help transition-colors hover:bg-${colorClass}-200">${not.secilen_metin}<sup class="text-${colorClass}-700 font-bold ml-0.5 select-none">[${revizeNotlari.indexOf(not) + 1}]</sup><span class="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded w-48 z-[100] shadow-xl mb-2 font-sans font-medium"><strong>${not.inceleme_turu.toUpperCase()}:</strong> ${not.not_metni}</span></mark>`;
        html = html.split(not.secilen_metin).join(mark);
      });
    }
    element.innerHTML = html;
  };

  const loadSoru = async () => {
    try {
      const response = await soruAPI.getById(id);
      setSoru(response.data.data);
    } catch (error) {
      navigate('/sorular');
    } finally { setLoading(false); }
  };

  const handleSil = async () => {
    if (!confirm('Bu soruyu havuzdan tamamen silmek istediğinize emin misiniz?')) return;
    try {
      await soruAPI.delete(id);
      navigate(scope === 'brans' ? '/brans-havuzu' : '/sorular');
    } catch (e) {
      alert('Silme işlemi başarısız');
    }
  };

  const loadRevizeNotlari = async () => {
    try {
      const res = await soruAPI.getRevizeNotlari(id);
      setRevizeNotlari(res.data.data);
    } catch (e) { }
  };

  const handleCapturePNG = async () => {
    if (!soruMetniRef.current || !soruMetniRef.current.parentElement) return;
    try {
      const element = soruMetniRef.current.parentElement.parentElement;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `soru-${id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('Görsel oluşturulamadı.');
    }
  };

  useEffect(() => {
    if (soru && !editMode) {
      if (soruMetniRef.current) renderLatexInElement(soruMetniRef.current, soru.soru_metni);
    }
  }, [soru, revizeNotlari, editMode]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) setSelectedText(text);
  };

  const handleAddRevizeNot = async () => {
    if (!revizeNotuInput.trim()) return;
    try {
      const type = incelemeTuru || (effectiveRole === 'incelemeci' ? effectiveIncelemeTuru : 'admin');
      await soruAPI.addRevizeNot(id, {
        secilen_metin: selectedText,
        not_metni: revizeNotuInput,
        inceleme_turu: type
      });
      setRevizeNotuInput('');
      setSelectedText('');
      loadRevizeNotlari();
    } catch (e) { alert('Not eklenemedi'); }
  };

  const handleDeleteRevizeNot = async (notId) => {
    if (!confirm('Notu silmek istiyor musunuz?')) return;
    try {
      await soruAPI.deleteRevizeNot(id, notId);
      loadRevizeNotlari();
    } catch (e) { }
  };

  const handleUpdateStatus = async (status, confirmMsg = null) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      await soruAPI.updateDurum(id, { yeni_durum: status, aciklama: 'Durum güncellendi: ' + status });
      loadSoru();
      if (['tamamlandi', 'dizgi_bekliyor', 'alan_incelemede', 'dil_incelemede'].includes(status)) {
        navigate(scope === 'brans' ? '/brans-havuzu' : '/sorular');
      }
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleFinishReview = async () => {
    const hasNotes = revizeNotlari.length > 0;
    const type = incelemeTuru || (effectiveRole === 'incelemeci' ? effectiveIncelemeTuru : 'admin');
    if (!type) { alert('İnceleme türü belirlenemedi.'); return; }
    const nextStatus = type === 'alanci' ? 'alan_onaylandi' : 'dil_onaylandi';
    const msg = hasNotes ? `İşaretlediğiniz ${revizeNotlari.length} adet notla birlikte incelemeyi bitirmek istiyor musunuz?` : 'Soru hatasız mı? ONAYLAYIP incelemeyi bitirmek istediğinizden emin misiniz?';
    if (!confirm(msg)) return;
    try {
      await soruAPI.updateDurum(id, { yeni_durum: nextStatus, aciklama: hasNotes ? (dizgiNotu || 'Hatalar belirtildi.') : 'İnceleme onayı verildi.', inceleme_turu: type });
      navigate('/');
    } catch (e) { alert('Hata: ' + (e.response?.data?.error || e.message)); }
  };

  const handleDizgiAl = async () => {
    try {
      await soruAPI.dizgiAl(id);
      loadSoru();
    } catch (error) { alert(error.response?.data?.error || 'Soru dizgiye alınamadı'); }
  };

  const finalFileInputRef = useRef(null);
  const handleFinalUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Lütfen geçerli bir resim dosyası seçin.');
    if (confirm("Seçilen görsel DİZGİ SONUCU olarak yüklenecek. Onaylıyor musunuz?")) {
      try {
        const formData = new FormData();
        formData.append('final_png', file);
        await soruAPI.uploadFinal(id, formData);
        loadSoru();
      } catch (err) { alert('Yükleme başarısız: ' + (err.response?.data?.error || err.message)); }
    }
  };

  const handleEditStart = () => {
    setComponents(parseHtmlToComponents(soru.soru_metni));
    const toScale = (value) => {
      const raw = String(value || '').toLowerCase();
      const num = parseInt(raw, 10);
      if (!Number.isNaN(num)) return String(Math.min(Math.max(num, 1), 5));
      return '3';
    };
    setEditMetadata({
      zorluk: toScale(soru.zorluk_seviyesi),
      dogruCevap: soru.dogru_cevap || '',
      brans_id: soru.brans_id || '',
      kazanim: soru.kazanim || ''
    });
    setEditMode(true);
  };

  const handleEditSave = async () => {
    if (components.length === 0) return alert("Soru içeriği boş!");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('dogru_cevap', editMetadata.dogruCevap);
      formData.append('brans_id', editMetadata.brans_id);
      formData.append('kazanim', editMetadata.kazanim || 'Genel');
      formData.append('zorluk_seviyesi', editMetadata.zorluk);
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
      formData.append('soru_metni', htmlContent);
      formData.append('increment_version', 'true');
      await soruAPI.update(id, formData);
      setEditMode(false);
      loadSoru();
    } catch (error) { alert(error.response?.data?.error || 'Güncelleme başarısız'); }
    finally { setSaving(false); }
  };

  const addKoku = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'koku', content: '', placeholder: '', label: 'Soru Kökü' }]);
  const addGovde = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'govde', content: '', placeholder: '', label: 'Gövde' }]);
  const addSecenekler = (mode = 'list') => {
    const baseId = generateId();
    const opts = ['A', 'B', 'C', 'D'];
    const newComps = opts.map((opt, idx) => ({
      id: baseId + idx, type: 'text', subtype: 'secenek', content: `<b>${opt})</b>`,
      label: `Seçenek ${opt}`, width: mode === 'grid' ? 48 : 100, float: mode === 'grid' ? 'left' : 'none'
    }));
    setComponents(prev => [...prev, ...newComps]);
  };
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) setComponents(prev => [...prev, { id: generateId(), type: 'image', content: URL.createObjectURL(file), file, width: 50, height: 'auto', align: 'center' }]);
  };
  const updateComponent = (id, updates) => setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  const removeComponent = (id) => setComponents(prev => prev.filter(c => c.id !== id));
  const execCmd = (cmd) => document.execCommand(cmd, false, null);
  const onDragStart = (e, index) => { setDraggedItemIndex(index); };
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

  const RibbonButton = ({ cmd, label, icon }) => (
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all shadow-sm active:scale-95">{icon || label}</button>
  );

  if (loading) return <div className="py-40 text-center"><ArrowPathIcon className="w-12 h-12 text-blue-100 animate-spin mx-auto mb-4" strokeWidth={3} /><p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Soru Verileri Getiriliyor...</p></div>;
  if (!soru) return null;

  const isOwner = soru.olusturan_kullanici_id == user?.id;
  const isBranchTeacher = user?.rol === 'soru_yazici' && user?.brans_id === soru.brans_id;
  const isAdmin = effectiveRole === 'admin';
  const hasFullAccess = isAdmin || isOwner || isBranchTeacher;
  const availableStatusesForEdit = ['beklemede', 'revize_gerekli', 'revize_istendi', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi'];
  const canEdit = isAdmin || ((isOwner || isBranchTeacher) && availableStatusesForEdit.includes(soru.durum));

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-fade-in pb-32">
      {/* HEADER STRIP */}
      <div className="bg-white rounded-[3.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-4 bg-gray-50 hover:bg-gray-100 rounded-3xl transition-all border border-gray-100 group shadow-sm">
            <ArrowLeftIcon className="w-6 h-6 text-gray-400 group-hover:text-gray-900" strokeWidth={3} />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">{editMode ? 'Düzenleme Modu' : `Soru #${soru.id}`}</h1>
              {getDurumBadge(soru.durum)}
            </div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-blue-500" /> {soru.brans_adi} <span className="opacity-20">|</span> {soru.olusturan_ad} tarafından oluşturuldu
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {soru.final_png_url && <a href={soru.final_png_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-95"><ArrowDownTrayIcon className="w-5 h-5" /> FİNAL PNG</a>}
          <button onClick={handleCapturePNG} className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"><CameraIcon className="w-5 h-5" /> GÖRÜNÜMÜ AL</button>

          {!editMode && (
            <div className="flex flex-wrap items-center gap-2">
              {canReview && soru.durum !== 'tamamlandi' && (
                <button onClick={handleFinishReview} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95">🚩 İNCELEMEYİ SONLANDIR</button>
              )}
              {canEdit && (
                <button onClick={handleEditStart} className="flex items-center gap-2 bg-gray-900 border border-black hover:bg-black text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"><PencilSquareIcon className="w-5 h-5" /> DÜZENLE</button>
              )}
              {hasFullAccess && (
                <div className="flex gap-2">
                  {['beklemede', 'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede'].includes(soru.durum) && <button onClick={() => handleUpdateStatus('dizgi_bekliyor', 'Dizgiye gönderilsin mi?')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-100 transition-all">🚀 DİZGİYE GÖNDER</button>}
                  {(soru.durum === 'dizgi_tamam' || (soru.durum === 'dil_onaylandi' && !soru.onay_alanci)) && <button onClick={() => handleUpdateStatus('alan_incelemede')} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">🔍 ALAN İNCELEME</button>}
                  {(soru.durum === 'alan_onaylandi' || (soru.durum === 'dizgi_tamam' && soru.onay_alanci && !soru.onay_dilci)) && <button onClick={() => handleUpdateStatus('dil_incelemede')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">🔤 DİL İNCELEME</button>}
                  {(soru.durum === 'dizgi_tamam' || (soru.durum === 'dil_onaylandi' && soru.onay_alanci)) && <button onClick={() => handleUpdateStatus('tamamlandi', 'Ortak Havuza aktarılsın mı?')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all">✅ HAVUZA AKTAR</button>}
                </div>
              )}
              {effectiveRole === 'dizgici' && (soru.durum === 'dizgi_bekliyor' || soru.durum === 'revize_istendi') && <button onClick={handleDizgiAl} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">🚀 DİZGİYE BAŞLA</button>}
              {effectiveRole === 'dizgici' && soru.durum === 'dizgide' && (
                <div className="flex gap-2">
                  <input type="file" ref={finalFileInputRef} className="hidden" accept="image/*" onChange={handleFinalUpload} />
                  <button onClick={() => finalFileInputRef.current.click()} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"><PhotoIcon className="w-5 h-5" /> PNG YÜKLE</button>
                  <button onClick={() => handleUpdateStatus('dizgi_tamam')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">SONLANDIR</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* VIEW / EDIT CANVAS */}
        <div className="lg:col-span-8 space-y-8">
          <div className={`flex flex-col bg-white rounded-[3.5rem] shadow-2xl shadow-gray-200/50 border border-gray-50 overflow-hidden relative ${editMode ? 'perspective-1000' : ''}`}>
            {editMode && (
              <div className="bg-gray-900 text-white p-4 flex justify-between items-center z-[70]">
                <div className="flex items-center gap-4">
                  <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                    <button onClick={() => setWidthMode('dar')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${widthMode === 'dar' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>82mm</button>
                    <button onClick={() => setWidthMode('genis')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${widthMode === 'genis' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>169mm</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditMode(false)} className="px-5 py-2 hover:bg-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl">İPTAL</button>
                  <button onClick={handleEditSave} disabled={saving} className="bg-white text-blue-600 px-8 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl active:scale-95">DEĞİŞİKLİKLERİ KAYDET</button>
                </div>
              </div>
            )}

            <div className="p-12 xl:p-16 flex justify-center bg-gray-50/20">
              <div
                className={`bg-white shadow-2xl transition-all duration-700 relative flex flex-col group min-h-[140mm] border border-gray-100 ${editMode ? 'ring-2 ring-blue-500/20' : ''}`}
                style={{
                  width: widthMode === 'dar' && editMode ? '82.4mm' : (soru.soru_metni?.includes('width: 169') && !editMode ? '169.6mm' : (editMode ? '169.6mm' : '82.4mm')),
                  padding: '10mm',
                  paddingTop: '15mm',
                  borderRadius: '2px'
                }}
              >
                {editMode ? (
                  <div className="space-y-1 relative" style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}>
                    <div className="absolute top-[-40px] left-0 right-0 h-10 bg-gray-100 rounded-xl flex items-center px-4 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <RibbonButton cmd="bold" label="B" />
                      <RibbonButton cmd="italic" label="I" />
                      <div className="w-px h-4 bg-gray-300 mx-1"></div>
                      <button onClick={addKoku} className="text-[9px] font-black uppercase text-gray-500 hover:text-blue-600 px-2">KÖK +</button>
                      <button onClick={addGovde} className="text-[9px] font-black uppercase text-gray-500 hover:text-blue-600 px-2">METİN +</button>
                      <button onClick={() => addSecenekler('list')} className="text-[9px] font-black uppercase text-gray-500 hover:text-blue-600 px-2">ŞIKLAR +</button>
                    </div>
                    {components.map((comp, index) => (
                      <div
                        key={comp.id}
                        className={`relative group/item rounded px-1 transition-all ${draggedItemIndex === index ? 'opacity-30' : 'hover:bg-blue-50/20'}`}
                        style={{ float: comp.float || 'none', width: comp.width && comp.subtype === 'secenek' ? `${comp.width}%` : 'auto', marginRight: comp.float === 'left' ? '2%' : '0' }}
                        draggable="true" onDragStart={(e) => onDragStart(e, index)} onDragOver={(e) => onDragOver(e, index)}
                      >
                        <div className="absolute -left-8 top-1 flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition-all z-[60]">
                          <div className="p-1.5 text-gray-300 hover:text-blue-600 cursor-grab active:cursor-grabbing"><Bars4Icon className="w-4 h-4" /></div>
                          <button onClick={() => removeComponent(comp.id)} className="p-1.5 text-gray-300 hover:text-rose-500"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                        {comp.type === 'text' ? (
                          <EditableBlock initialHtml={comp.content} onChange={(html) => updateComponent(comp.id, { content: html })} label={comp.label} hangingIndent={comp.subtype === 'secenek'} className={comp.subtype === 'koku' ? 'font-bold text-sm' : 'text-sm'} />
                        ) : (
                          <ResizableImage src={comp.content} width={comp.width} height={comp.height} align={comp.align} onUpdate={(updates) => updateComponent(comp.id, updates)} onDelete={() => removeComponent(comp.id)} />
                        )}
                        {comp.float === 'none' && <div style={{ clear: 'both' }}></div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="prose max-w-none" style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}>
                    <div ref={soruMetniRef} className="text-gray-900 katex-left-align q-preview-container select-text" onMouseUp={handleTextSelection} />
                  </div>
                )}
                <div style={{ clear: 'both' }}></div>
              </div>
            </div>

            {!editMode && (
              <div className="p-10 bg-gray-900 border-t border-black flex flex-wrap items-center justify-between gap-6">
                <div className="flex gap-8">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">DOĞRU CEVAP</span>
                    <span className="text-2xl font-black text-emerald-500">{soru.dogru_cevap}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">ZORLUK DÜZEYİ</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(v => (
                        <div key={v} className={`w-4 h-1 rounded-full ${v <= parseInt(soru.zorluk_seviyesi) ? 'bg-amber-500' : 'bg-white/10'}`}></div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  {soru.onay_alanci && <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5"><CheckBadgeIcon className="w-4 h-4 text-emerald-400" /><span className="text-[9px] font-black text-white/60 tracking-widest uppercase">ALAN ONAYLI</span></div>}
                  {soru.onay_dilci && <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5"><CheckBadgeIcon className="w-4 h-4 text-blue-400" /><span className="text-[9px] font-black text-white/60 tracking-widest uppercase">DİL ONAYLI</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* ANALYSES & FEEDBACK */}
          <div className="bg-white rounded-[3.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-50 space-y-10">
            <div className="flex items-center justify-between border-b border-gray-50 pb-8">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-blue-600" /> İnceleme Diyalogları
              </h3>
              <span className="bg-gray-50 px-5 py-2 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest">HABERLEŞME MERKEZİ</span>
            </div>
            <IncelemeYorumlari soruId={id} />
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-8">
          {/* REVISION NOTES */}
          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-50 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 uppercase"><FlagIcon className="w-6 h-6 text-rose-500" /> Revize İmleri</h4>
              <span className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center font-black text-xs">{revizeNotlari.length}</span>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
              {revizeNotlari.map((not, i) => (
                <div key={not.id} className="group p-5 bg-gray-50 rounded-[1.5rem] border border-gray-100 space-y-3 relative hover:bg-white hover:shadow-lg transition-all">
                  <div className="flex justify-between items-start">
                    <div className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${not.inceleme_turu === 'alanci' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      {not.inceleme_turu === 'alanci' ? 'ALAN UZMANI' : 'DİL UZMANI'}
                    </div>
                    {(isAdmin || user?.id === not.kullanici_id) && <button onClick={() => handleDeleteRevizeNot(not.id)} className="p-1.5 bg-white text-gray-300 hover:text-rose-500 rounded-lg transition-colors border border-gray-100 active:scale-95"><XMarkIcon className="w-4 h-4" strokeWidth={3} /></button>}
                  </div>
                  <p className="text-[11px] font-bold text-gray-400 italic bg-white/50 p-2 rounded-xl border border-gray-50 line-clamp-2">"{not.secilen_metin}"</p>
                  <p className="text-xs font-black text-gray-900 leading-relaxed font-sans">{not.not_metni}</p>
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform"><FlagIcon className="w-12 h-12" /></div>
                </div>
              ))}
              {revizeNotlari.length === 0 && <div className="py-10 text-center text-gray-300 font-black text-[10px] uppercase tracking-widest opacity-60 italic">HATA İŞARETLENMEDİ.</div>}
            </div>
          </div>

          {/* SYSTEM LOGS / HISTORY */}
          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-50 space-y-6">
            <h4 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 uppercase"><ClockIcon className="w-6 h-6 text-amber-500" /> Soru Yaşam Döngüsü</h4>
            <div className="space-y-4 border-l-2 border-dashed border-gray-200 ml-4 pl-6 pb-2 relative">
              {/* Oluşturuldu */}
              <div className="relative">
                <div className="absolute left-[-30px] w-3 h-3 bg-emerald-500 rounded-full ring-4 ring-emerald-100"></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">OLUŞTURULDU</p>
                  <p className="text-[11px] font-bold text-gray-500">{soru.olusturan_ad} tarafından taslak hazırlandı</p>
                </div>
              </div>

              {/* Dizgi Bekliyor */}
              <div className="relative">
                <div className={`absolute left-[-30px] w-3 h-3 rounded-full ring-4 ${['dizgi_bekliyor', 'dizgide', 'dizgi_tamam', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi', 'tamamlandi'].includes(soru.durum) ? 'bg-purple-500 ring-purple-100' : 'bg-gray-300 ring-gray-100'}`}></div>
                <div className="space-y-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${['dizgi_bekliyor', 'dizgide', 'dizgi_tamam', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi', 'tamamlandi'].includes(soru.durum) ? 'text-purple-600' : 'text-gray-400'}`}>DİZGİYE GÖNDERİLDİ</p>
                  <p className="text-[11px] font-bold text-gray-500">{soru.durum === 'dizgi_bekliyor' ? 'Dizgici ataması bekleniyor' : (soru.dizgici_ad ? `${soru.dizgici_ad} işliyor` : 'Dizgi sürecinde')}</p>
                </div>
              </div>

              {/* Dizgi Tamamlandı */}
              <div className="relative">
                <div className={`absolute left-[-30px] w-3 h-3 rounded-full ring-4 ${['dizgi_tamam', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi', 'tamamlandi'].includes(soru.durum) ? 'bg-blue-500 ring-blue-100' : 'bg-gray-300 ring-gray-100'}`}></div>
                <div className="space-y-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${['dizgi_tamam', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi', 'tamamlandi'].includes(soru.durum) ? 'text-blue-600' : 'text-gray-400'}`}>DİZGİ TAMAMLANDI</p>
                  <p className="text-[11px] font-bold text-gray-500">Final görsel hazır</p>
                </div>
              </div>

              {/* Alan İnceleme */}
              <div className="relative">
                <div className={`absolute left-[-30px] w-3 h-3 rounded-full ring-4 ${soru.onay_alanci || ['alan_onaylandi', 'dil_incelemede', 'dil_onaylandi', 'tamamlandi'].includes(soru.durum) ? 'bg-orange-500 ring-orange-100' : (soru.durum === 'alan_incelemede' ? 'bg-orange-400 ring-orange-100 animate-pulse' : 'bg-gray-300 ring-gray-100')}`}></div>
                <div className="space-y-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${soru.onay_alanci || soru.durum === 'alan_incelemede' ? 'text-orange-600' : 'text-gray-400'}`}>
                    {soru.onay_alanci ? 'ALAN ONAYLI ✓' : (soru.durum === 'alan_incelemede' ? 'ALAN İNCELEMEDE...' : 'ALAN İNCELEME')}
                  </p>
                  <p className="text-[11px] font-bold text-gray-500">{soru.onay_alanci ? 'Uzman onayı alındı' : 'Konu uzmanı kontrolü'}</p>
                </div>
              </div>

              {/* Dil İnceleme */}
              <div className="relative">
                <div className={`absolute left-[-30px] w-3 h-3 rounded-full ring-4 ${soru.onay_dilci || soru.durum === 'tamamlandi' ? 'bg-cyan-500 ring-cyan-100' : (soru.durum === 'dil_incelemede' ? 'bg-cyan-400 ring-cyan-100 animate-pulse' : 'bg-gray-300 ring-gray-100')}`}></div>
                <div className="space-y-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${soru.onay_dilci || soru.durum === 'dil_incelemede' ? 'text-cyan-600' : 'text-gray-400'}`}>
                    {soru.onay_dilci ? 'DİL ONAYLI ✓' : (soru.durum === 'dil_incelemede' ? 'DİL İNCELEMEDE...' : 'DİL İNCELEME')}
                  </p>
                  <p className="text-[11px] font-bold text-gray-500">{soru.onay_dilci ? 'Dil uzmanı onayı alındı' : 'Dil ve yazım kontrolü'}</p>
                </div>
              </div>

              {/* Tamamlandı */}
              <div className="relative">
                <div className={`absolute left-[-30px] w-3 h-3 rounded-full ring-4 ${soru.durum === 'tamamlandi' ? 'bg-emerald-500 ring-emerald-100' : 'bg-gray-300 ring-gray-100'}`}></div>
                <div className="space-y-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${soru.durum === 'tamamlandi' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {soru.durum === 'tamamlandi' ? 'ORTAK HAVUZDA ✓' : 'ORTAK HAVUZ'}
                  </p>
                  <p className="text-[11px] font-bold text-gray-500">{soru.durum === 'tamamlandi' ? 'Tüm süreçler tamamlandı' : 'Son aşama'}</p>
                </div>
              </div>

              {/* Revize durumu göster */}
              {['revize_istendi', 'revize_gerekli'].includes(soru.durum) && (
                <div className="relative mt-4 pt-4 border-t border-dashed border-rose-200">
                  <div className="absolute left-[-30px] w-3 h-3 bg-rose-500 rounded-full ring-4 ring-rose-100 animate-pulse"></div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">⚠️ REVİZE GEREKLİ</p>
                    <p className="text-[11px] font-bold text-gray-500">Düzeltme yapılması bekleniyor</p>
                  </div>
                </div>
              )}
            </div>

            {/* Mevcut Durum Kartı */}
            <div className={`p-5 rounded-[2rem] border text-center ${soru.durum === 'tamamlandi' ? 'bg-emerald-50 border-emerald-100' :
              ['revize_istendi', 'revize_gerekli'].includes(soru.durum) ? 'bg-rose-50 border-rose-100' :
                'bg-gray-50 border-gray-100'
              }`}>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">GÜNCEL DURUM</p>
              <p className={`text-sm font-black uppercase tracking-wide ${soru.durum === 'tamamlandi' ? 'text-emerald-700' :
                ['revize_istendi', 'revize_gerekli'].includes(soru.durum) ? 'text-rose-700' :
                  'text-gray-700'
                }`}>{soru.durum?.replace(/_/g, ' ')}</p>
            </div>

            <div className="p-5 bg-gray-50 rounded-[2rem] border border-gray-100 text-center">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">OLUŞTURULMA TARİHİ</p>
              <p className="text-xs font-black text-gray-900">{new Date(soru.olusturulma_tarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* DELETE DANGER ZONE */}
          {hasFullAccess && effectiveRole !== 'incelemeci' && (
            <button
              onClick={handleSil}
              className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 px-8 py-5 rounded-[2.5rem] font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center justify-center gap-3"
            >
              <TrashIcon className="w-5 h-5" /> Soruyu Sil / Kaldır
            </button>
          )}
        </div>
      </div>

      {/* FLOATING ANNOTATION UI */}
      {selectedText && canReview && (
        <div className="fixed bottom-12 right-12 z-[100] w-[400px] bg-white rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25)] border border-gray-50 overflow-hidden animate-scale-up">
          <div className="p-6 bg-gray-900 text-white flex justify-between items-center px-8">
            <h5 className="font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2"><PlusIcon className="w-4 h-4 text-rose-500" /> Yeni Revize Notu</h5>
            <button onClick={() => setSelectedText('')} className="hover:bg-white/10 p-2 rounded-xl transition-all"><XMarkIcon className="w-6 h-6" /></button>
          </div>
          <div className="p-8 space-y-6">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">SEÇİLEN KESİT</span>
              <p className="text-xs font-bold text-gray-700 line-clamp-2 italic">"{selectedText}"</p>
            </div>
            <textarea
              className="w-full bg-gray-50 border-2 border-transparent border-dashed focus:border-indigo-600 rounded-2xl p-5 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-indigo-600/5 transition-all outline-none resize-none"
              rows="4"
              placeholder="Buradaki hatayı açıklayın..."
              value={revizeNotuInput}
              onChange={(e) => setRevizeNotuInput(e.target.value)}
            />
            <button
              onClick={handleAddRevizeNot}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              NOTU SİSTEME EKLE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const BoldIcon = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h4.5a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.75h3a3.75 3.75 0 010 7.5h-3m0 0h3a3.75 3.75 0 010 7.5h-3" />
  </svg>
);
