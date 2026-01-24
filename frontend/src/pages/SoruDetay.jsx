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
  BoldIcon,
  DocumentTextIcon,
  Bars4Icon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// --- İMLEÇ KORUMALI EDİTÖR ---


// --- RESIZABLE IMAGE ---


const parseHtmlToComponents = (html) => {
  if (!html) return [];
  const div = document.createElement('div');
  div.innerHTML = html;

  // SoruEkle formatındaki blokları ara
  const nodes = Array.from(div.children);
  const structured = nodes.filter(n => n.classList.contains('q-txt') || n.classList.contains('q-img'));

  if (structured.length === 0) {
    // Klasik HTML ise tek bir gövde bloğu olarak al
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
  const incelemeTuru = queryParams.get('incelemeTuru'); // 'alanci' | 'dilci'

  const { user: authUser, viewRole } = useAuthStore();
  const rawRole = viewRole || authUser?.rol;
  // UI logic normalization (alan_incelemeci/dil_incelemeci -> incelemeci)
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

  // Editor States
  const [components, setComponents] = useState([]);
  const [widthMode, setWidthMode] = useState('dar');
  const [editMetadata, setEditMetadata] = useState({ zorluk: '3', dogruCevap: '', brans_id: '', kazanim: '' });
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const soruMetniRef = useRef(null);
  const latexKoduRef = useRef(null);

  // Revize Notları State
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

    // LaTeX Render
    html = html.replace(/\$\$([^\$]+)\$\$/g, (match, latex) => {
      try { return katex.renderToString(latex, { throwOnError: false, displayMode: true }); }
      catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\$([^\$]+)\$/g, (match, latex) => {
      try { return katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
      catch (e) { return `<span class="text-red-500 text-sm">${match}</span>`; }
    });
    html = html.replace(/\n/g, '<br>');

    // Revize Notlarını Metin Üzerinde Numaralandırarak İşaretle (ROL BAZLI FİLTRELEME)
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
        const mark = `<mark class="bg-${colorClass}-100 border-b-2 border-${colorClass}-400 px-1 relative group cursor-help transition-colors hover:bg-${colorClass}-200">${not.secilen_metin}<sup class="text-${colorClass}-700 font-bold ml-0.5 select-none">[${revizeNotlari.indexOf(not) + 1}]</sup><span class="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded w-48 z-50 shadow-xl mb-2"><strong>${not.inceleme_turu.toUpperCase()} Notu:</strong> ${not.not_metni}</span></mark>`;
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
      alert('Soru yüklenemedi');
      navigate('/sorular');
    } finally { setLoading(false); }
  };

  const loadRevizeNotlari = async () => {
    try {
      const res = await soruAPI.getRevizeNotlari(id);
      setRevizeNotlari(res.data.data);
    } catch (e) { console.error(e); }
  };

  const handleCapturePNG = async () => {
    if (!soruMetniRef.current || !soruMetniRef.current.parentElement) return;
    try {
      // Capture the white card element
      const element = soruMetniRef.current.parentElement.parentElement;
      const canvas = await html2canvas(element, {
        scale: 3, // Very high quality for print
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const link = document.createElement('a');
      link.download = `soru-${id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG error:', err);
      alert('Görsel oluşturulamadı.');
    }
  };

  useEffect(() => {
    if (soru && !editMode) {
      if (soruMetniRef.current) renderLatexInElement(soruMetniRef.current, soru.soru_metni);
      if (latexKoduRef.current && soru.latex_kodu) renderLatexInElement(latexKoduRef.current, soru.latex_kodu);
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
      if (effectiveRole === 'incelemeci' && !type) {
        alert('İnceleme türü bulunamadı. Admin tarafından alan/dil yetkisi atanmalı.');
        return;
      }
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
    } catch (e) { alert('Silinemedi'); }
  };

  const handleUpdateStatus = async (status, confirmMsg = null) => {
    if (confirmMsg && !confirm(confirmMsg)) return;

    try {
      await soruAPI.updateDurum(id, {
        yeni_durum: status,
        aciklama: 'Durum güncellendi: ' + status
      });
      alert('✅ Soru durumu güncellendi: ' + status);
      loadSoru();
      // Önemli aşamalardan sonra listeye dönmek kullanıcı deneyimi için daha iyi
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

    if (!type) {
      alert('İnceleme türü belirlenemedi.');
      return;
    }

    const nextStatus = type === 'alanci' ? 'alan_onaylandi' : 'dil_onaylandi';

    const msg = hasNotes
      ? `İşaretlediğiniz ${revizeNotlari.length} adet notla birlikte incelemeyi bitirmek istiyor musunuz?`
      : 'Soru hatasız mı? ONAYLAYIP incelemeyi bitirmek istediğinizden emin misiniz?';

    if (!confirm(msg)) return;

    try {
      await soruAPI.updateDurum(id, {
        yeni_durum: nextStatus,
        aciklama: hasNotes ? (dizgiNotu || 'Hatalar belirtildi.') : 'İnceleme onayı verildi.',
        inceleme_turu: type
      });
      alert('✅ İncelemeniz tamamlandı ve branş öğretmenine geri gönderildi.');
      navigate('/');
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDizgiAl = async () => {
    try {
      await soruAPI.dizgiAl(id);
      alert('Soru üzerinize alındı. Dizgi işlemine başlayabilirsiniz.');
      loadSoru();
    } catch (error) {
      alert(error.response?.data?.error || 'Soru dizgiye alınamadı');
    }
  };

  const finalFileInputRef = useRef(null);

  const handleFinalUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return alert('Lütfen geçerli bir resim dosyası (PNG/JPG) seçin.');
    }

    if (confirm("Seçilen görsel DİZGİ SONUCU olarak yüklenecek. Onaylıyor musunuz?")) {
      try {
        const formData = new FormData();
        formData.append('final_png', file);
        await soruAPI.uploadFinal(id, formData);
        alert('Dizgi görseli yüklendi!');
        loadSoru(); // Yenile
      } catch (err) {
        alert('Yükleme başarısız: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleDizgiTamamla = async () => {
    if (!soru.final_png_url) {
      if (!confirm('UYARI: Henüz final dizgi görseli (PNG) yüklenmemiş!\n\nDizgisi yapılmamış soruyu tamamlamak istediğinize emin misiniz?')) return;
    } else {
      if (!confirm('Dizgi işlemini bitirip soruyu kontrol için BRANŞA göndermek istediğinizden emin misiniz?')) return;
    }

    try {
      await soruAPI.updateDurum(id, {
        yeni_durum: 'dizgi_tamam',
        aciklama: 'Dizgisi yapıldı ve branş kontrolüne gönderildi.'
      });
      alert(`✅ Soru başarıyla branş havuzuna (Dizgi Tamamlandı) gönderildi.`);
      navigate('/');
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleSil = async () => {
    if (!confirm('Bu soruyu silmek istediğinizden emin misiniz?')) return;
    try {
      await soruAPI.delete(id);
      alert('Soru silindi');
      navigate('/sorular');
    } catch (error) { alert(error.response?.data?.error || 'Silme işlemi başarısız'); }
  };

  const handleEditStart = () => {
    setComponents(parseHtmlToComponents(soru.soru_metni));
    const toScale = (value) => {
      const raw = String(value || '').toLowerCase();
      const num = parseInt(raw, 10);
      if (!Number.isNaN(num)) return String(Math.min(Math.max(num, 1), 5));
      if (raw.includes('kolay')) return '2';
      if (raw.includes('orta')) return '3';
      if (raw.includes('zor')) return '4';
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
    if (!editMetadata.dogruCevap) return alert("Lütfen Doğru Cevabı seçiniz.");
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('dogru_cevap', editMetadata.dogruCevap);
      formData.append('brans_id', editMetadata.brans_id);
      formData.append('kazanim', editMetadata.kazanim || 'Genel');
      const normalizeZorluk = () => {
        const num = parseInt(editMetadata.zorluk, 10);
        if (Number.isNaN(num)) return '3';
        return String(Math.min(5, Math.max(1, num)));
      };
      formData.append('zorluk_seviyesi', normalizeZorluk());

      let htmlContent = components.map(c => {
        let style = "";
        if (c.type === 'image') {
          style = `width: ${c.width}%; margin - bottom: 12px; `;
          if (c.height !== 'auto') style += ` height: ${c.height} px; object - fit: fill; `;
          if (c.align === 'left') style += ' float: left; margin-right: 12px;';
          else if (c.align === 'right') style += ' float: right; margin-left: 12px;';
          else style += ' display: block; margin-left: auto; margin-right: auto;';
          return `<div class="q-img" style="${style}"><img src="${c.content}" style="width:100%; height:100%;" /></div>`;
        }
        else {
          let commonStyle = "text-align: left; hyphens: none; -webkit-hyphens: none; line-height: 1.4;";
          if (c.subtype === 'koku') style = `${commonStyle} font-weight: bold; margin-bottom: 12px; margin-top: 4px; font-size: 10pt;`;
          else if (c.subtype === 'secenek') {
            let w = c.width !== 100 ? `width: ${c.width}%; ` : '';
            let f = c.float !== 'none' ? `float: ${c.float}; ` : '';
            let m = c.float === 'left' ? 'margin-right: 2%;' : '';
            style = `${commonStyle} margin-bottom: 6px; padding-left: 24px; text-indent: -24px; ${w} ${f} ${m} `;
          }
          else style = `${commonStyle} margin-bottom: 8px; font-size: 10pt; `;
          return `<div class="q-txt q-${c.subtype}" style="${style} clear: ${c.float === 'none' ? 'both' : 'none'};">${c.content}</div>`;
        }
      }).join('');

      htmlContent += `<div style="clear: both;"></div>`;
      formData.append('soru_metni', htmlContent);

      const firstNewImage = components.find(c => c.type === 'image' && c.file);
      if (firstNewImage) {
        formData.append('fotograf', firstNewImage.file);
        formData.append('fotograf_konumu', 'ust');
      }

      ['a', 'b', 'c', 'd', 'e'].forEach(opt => formData.append(`secenek_${opt} `, ''));

      await soruAPI.update(id, formData);
      alert('Soru güncellendi!');
      setEditMode(false);
      loadSoru();
    } catch (error) {
      alert(error.response?.data?.error || 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  // Editor Helpers
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
        type: 'text', subtype: 'secenek', content: `<b>${opt})</b>`,
        placeholder: ``,
        label: `Seçenek ${opt} `,
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
  const updateComponent = (id, updates) => setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  const removeComponent = (id) => setComponents(prev => prev.filter(c => c.id !== id));
  const execCmd = (cmd) => document.execCommand(cmd, false, null);
  const onDragStart = (e, index) => { setDraggedItemIndex(index); e.dataTransfer.effectAllowed = "move"; };
  const onDragEnd = () => setDraggedItemIndex(null);
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
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700 font-medium">{icon || label}</button>
  );

  if (loading) return <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!soru) return null;

  const isOwner = soru.olusturan_kullanici_id == user?.id;
  const isAdmin = effectiveRole === 'admin';

  const availableStatusesForEdit = ['beklemede', 'revize_gerekli', 'revize_istendi', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam'];
  const canEdit = isAdmin || (isOwner && availableStatusesForEdit.includes(soru.durum));



  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header Area */}
      <div className="bg-white border-b-2 border-gray-100 p-6 flex justify-between items-center mb-6 rounded-xl">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tighter">
            {editMode ? '✏️ SORUYU DÜZENLE' : '📝 SORU DETAYI'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sorular')} className="btn btn-secondary btn-sm">← Geri</button>

          {/* Final PNG Indirme (Admin ve Tamamlanmış sorularda herkes için) */}
          {soru.final_png_url && (
            <a
              href={soru.final_png_url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-200 transition flex items-center gap-2 border border-emerald-300"
            >
              🖼️ FİNAL PNG İNDİR
            </a>
          )}

          <button
            onClick={handleCapturePNG}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold text-xs hover:bg-blue-200 transition flex items-center gap-2 border border-blue-300"
          >
            📸 GÖRÜNÜMÜ PNG AL
          </button>

          {!editMode && (
            <>
              {/* İNCELEME MODUNDA VEYA ADMIN/İNCELEMECİ İSE GÖRÜNECEK BUTONLAR */}
              {canReview && soru.durum !== 'tamamlandi' && (
                <button
                  onClick={handleFinishReview}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] flex items-center gap-2 border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1"
                >
                  🚩 İNCELEMEYİ BİTİR VE BRANŞA GÖNDER
                </button>
              )}

              {/* BRANŞ (YAZAR) VEYA ADMIN İÇİN AKSİYONLAR */}
              {(isAdmin || isOwner) && (
                <div className="flex flex-wrap gap-2">
                  {/* Düzenle Butonu */}
                  {canEdit && (
                    <button
                      onClick={handleEditStart}
                      className="px-6 py-3 bg-blue-100 text-blue-700 rounded-xl font-black text-sm hover:bg-blue-200 transition shadow-sm flex items-center gap-2 border-b-4 border-blue-300 active:border-b-0 active:translate-y-1"
                    >
                      ✍️ DÜZENLE
                    </button>
                  )}

                  {/* Dizgiye Gönder */}
                  {['beklemede', 'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede'].includes(soru.durum) && (
                    <button
                      onClick={() => handleUpdateStatus('dizgi_bekliyor', 'Soru dizgiye gönderilecektir. Emin misiniz?')}
                      className="px-6 py-3 bg-purple-600 text-white rounded-xl font-black text-sm hover:bg-purple-700 transition shadow-lg flex items-center gap-2 border-b-4 border-purple-800 active:border-b-0 active:translate-y-1"
                    >
                      🚀 DİZGİYE GÖNDER
                    </button>
                  )}

                  {/* Alan İncelemeye Gönder (Dizgi bittiyse veya Dil onaylıysa - Alan hala onaylamamışsa) */}
                  {(soru.durum === 'dizgi_tamam' || (soru.durum === 'dil_onaylandi' && !soru.onay_alanci)) && (
                    <button
                      onClick={() => handleUpdateStatus('alan_incelemede', 'Soru ALAN İncelemesine gönderilecektir. Emin misiniz?')}
                      className="px-6 py-3 bg-orange-600 text-white rounded-xl font-black text-sm hover:bg-orange-700 transition shadow-lg flex items-center gap-2 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
                    >
                      🔍 ALAN İNCELEMEYE GÖNDER
                    </button>
                  )}

                  {/* Dil İncelemeye Gönder (Alan onaylıysa veya Dizgi bittiyse - Alan ve Dil henüz bitmemişse) */}
                  {(soru.durum === 'alan_onaylandi' || (soru.durum === 'dizgi_tamam' && soru.onay_alanci && !soru.onay_dilci)) && (
                    <button
                      onClick={() => handleUpdateStatus('dil_incelemede', 'Soru DİL İncelemesine gönderilecektir. Emin misiniz?')}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition shadow-lg flex items-center gap-2 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
                    >
                      🔤 DİL İNCELEMEYE GÖNDER
                    </button>
                  )}

                  {/* Ortak Havuza Gönder (Dil onaylı ve Alan onaylı ise) */}
                  {soru.durum === 'dil_onaylandi' && soru.onay_alanci && (
                    <button
                      onClick={() => handleUpdateStatus('tamamlandi', 'Soru ORTAK HAVUZA (Final) gönderilecektir. Bu işlem geri alınamaz (Admin hariç). Emin misiniz?')}
                      className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition shadow-lg flex items-center gap-2 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1"
                    >
                      ✅ ORTAK HAVUZA GÖNDER
                    </button>
                  )}

                  {/* İnceleme sonrası dizgiye geri gönderme (Revize) */}
                  {['alan_onaylandi', 'dil_onaylandi', 'alan_incelemede', 'dil_incelemede'].includes(soru.durum) && (
                    <button
                      onClick={() => handleUpdateStatus('revize_istendi', 'Dizgi hatası mı var? Soruyu dizgiye revize için geri göndermek istiyor musunuz?')}
                      className="px-6 py-3 bg-red-100 text-red-700 rounded-xl font-black text-sm hover:bg-red-200 transition shadow-sm flex items-center gap-2 border-b-4 border-red-300 active:border-b-0 active:translate-y-1"
                    >
                      🛠️ DİZGİYE REVİZE GÖNDER
                    </button>
                  )}
                </div>
              )}

              {/* DİZGİCİ İÇİN DİZGİYE AL BUTONU */}
              {effectiveRole === 'dizgici' && (soru.durum === 'dizgi_bekliyor' || soru.durum === 'revize_istendi') && (
                <button
                  onClick={handleDizgiAl}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl font-black text-sm hover:bg-orange-700 transition shadow-[0_4px_14px_0_rgba(249,115,22,0.39)] flex items-center gap-2 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
                >
                  🚀 DİZGİYE AL
                </button>
              )}

              {/* DİZGİCİ İÇİN DOSYA YÜKLEME VE TAMAMLAMA */}
              {effectiveRole === 'dizgici' && soru.durum === 'dizgide' && (
                <>
                  <input
                    type="file"
                    ref={finalFileInputRef}
                    className="hidden"
                    accept="image/png,image/jpeg"
                    onChange={handleFinalUpload}
                  />
                  <button
                    onClick={() => finalFileInputRef.current.click()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-xl font-black text-sm hover:bg-purple-700 transition shadow-[0_4px_14px_0_rgba(147,51,234,0.39)] flex items-center gap-2 border-b-4 border-purple-800 active:border-b-0 active:translate-y-1"
                  >
                    <PhotoIcon className="w-5 h-5" />
                    📤 DİZGİ GÖRSELİ YÜKLE (PNG)
                  </button>

                  <button
                    onClick={handleDizgiTamamla}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition shadow-[0_4px_14px_0_rgba(22,163,74,0.39)] flex items-center gap-2 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
                  >
                    ✅ TAMAMLANDI (BRANŞA GÖNDER)
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>



      {/* Soru İçeriği */}
      <div className="flex items-center gap-3 mb-2 px-1">
        {getDurumBadge(soru.durum)}
        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-200 uppercase tracking-tighter">V{soru.versiyon || 1}</span>
        <span className="badge bg-green-100 text-green-800 font-bold">✅ Doğru: {soru.dogru_cevap}</span>
        {soru.kazanim && <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[10px] font-bold border border-blue-200 uppercase tracking-tighter">Kazanım: {soru.kazanim}</span>}
      </div>

      {/* Final PNG Önizleme (Dizgi Sonucu) */}
      {soru.final_png_url && !editMode && (
        <div className="card border-4 border-emerald-200 bg-emerald-50 rounded-xl overflow-hidden shadow-lg mb-6">
          <div className="bg-emerald-200 px-4 py-2 flex justify-between items-center">
            <span className="text-emerald-900 font-black text-xs uppercase tracking-widest flex items-center gap-2">
              ✨ DİZGİ SONUCU (PNG)
            </span>
            <span className="text-[10px] text-emerald-700 font-bold italic">Bu görsel baskıya hazır final dosyasıdır</span>
          </div>
          <div className="p-4 flex justify-center bg-white/50">
            <img src={soru.final_png_url} className="max-w-full rounded shadow-sm border border-emerald-100" alt="Final PNG" />
          </div>
        </div>
      )}

      <div className="relative border-4 border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xl transition-all">
        {editMode ? (
          <div className="bg-[#F3F2F1] min-h-[600px] flex flex-col pointer-events-auto">
            <div className="bg-[#0078D4] text-white p-2 shadow-md flex justify-between items-center sticky top-0 z-[60]">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold flex items-center gap-2"><PencilSquareIcon className="w-4 h-4" /> Düzenleme Modu</h2>
                <div className="flex bg-[#005A9E] rounded p-0.5">
                  <button onClick={() => setWidthMode('dar')} className={`px - 2 py - 0.5 text - [10px] font - bold rounded ${widthMode === 'dar' ? 'bg-white text-[#0078D4]' : 'text-white/80'} `}>82mm</button>
                  <button onClick={() => setWidthMode('genis')} className={`px - 2 py - 0.5 text - [10px] font - bold rounded ${widthMode === 'genis' ? 'bg-white text-[#0078D4]' : 'text-white/80'} `}>169mm</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleEditSave} disabled={saving} className="px-6 py-1 bg-white text-blue-700 text-xs font-black rounded hover:bg-blue-50 border-b-2 border-blue-200">💾 KAYDET VE BRANŞ HAVUZUNDA TUT</button>
                <button onClick={() => setEditMode(false)} className="px-4 py-1 bg-red-500 text-white text-xs font-bold rounded hover:bg-red-600">İPTAL</button>
              </div>
            </div>

            <div className="flex p-4 gap-4 overflow-y-auto max-h-[700px]">
              <div className="flex flex-col gap-2 w-32 shrink-0">
                <button onClick={addKoku} className="flex items-center gap-2 p-2 bg-white border rounded text-xs font-bold text-purple-700 hover:bg-purple-50"><BoldIcon className="w-4 h-4" /> Kök</button>
                <button onClick={addGovde} className="flex items-center gap-2 p-2 bg-white border rounded text-xs font-bold text-blue-700 hover:bg-blue-50"><DocumentTextIcon className="w-4 h-4" /> Gövde</button>
                <button onClick={() => addSecenekler('list')} className="flex items-center gap-2 p-2 bg-white border rounded text-xs font-bold text-green-700 hover:bg-green-50"><QueueListIcon className="w-4 h-4" /> Şıklar</button>
                <label className="flex items-center gap-2 p-2 bg-white border rounded text-xs font-bold text-orange-700 hover:bg-orange-50 cursor-pointer">
                  <PhotoIcon className="w-4 h-4" /> Resim
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>

              <div className="bg-white shadow-xl mx-auto p-8 relative min-h-[500px]" style={{ width: widthMode === 'dar' ? '82.4mm' : '169.6mm' }}>
                <div className="absolute top-0 left-0 right-0 bg-gray-50 border-b p-1 flex items-center gap-1">
                  <RibbonButton cmd="bold" label="B" />
                  <RibbonButton cmd="italic" label="I" />
                  <RibbonButton cmd="underline" label="U" />
                  <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                  <RibbonButton cmd="superscript" label="x²" />
                  <RibbonButton cmd="subscript" label="x₂" />
                </div>
                <div className="mt-8 space-y-1 relative">
                  {components.map((comp, index) => (
                    <div
                      key={comp.id}
                      className={`relative group / item rounded px - 1 transition ${draggedItemIndex === index ? 'opacity-50 bg-blue-50' : 'hover:ring-1 hover:ring-blue-100'} `}
                      style={{ float: comp.float || 'none', width: comp.width && comp.subtype === 'secenek' ? `${comp.width}% ` : 'auto', marginRight: comp.float === 'left' ? '2%' : '0' }}
                      draggable="true"
                      onDragStart={(e) => onDragStart(e, index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="absolute -left-6 top-1 flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition z-10 w-5 cursor-grab">
                        <div className="p-0.5 text-gray-400"><Bars4Icon className="w-4 h-4" /></div>
                        <button onClick={() => removeComponent(comp.id)} className="p-0.5 text-red-300 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                      {comp.type === 'text' ? (
                        <EditableBlock initialHtml={comp.content} onChange={(html) => updateComponent(comp.id, { content: html })} label={comp.label} hangingIndent={comp.subtype === 'secenek'} className={comp.subtype === 'koku' ? 'font-bold text-sm' : 'text-sm'} />
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

            <MetadataForm
              values={editMetadata}
              onChange={setEditMetadata}
              branslar={branslar}
              kazanims={kazanims}
              kazanimLoading={kazanimLoading}
            />
          </div>
        ) : (
          <div className="bg-[#F3F2F1] p-8 flex justify-center overflow-x-auto min-h-[400px]">
            <div
              className="bg-white shadow-lg p-[10mm] relative"
              style={{
                width: soru.soru_metni?.includes('width: 169') ? '169.6mm' : '82.4mm',
                minHeight: '120mm'
              }}
            >
              <div
                className="prose max-w-none"
                style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}
              >
                <div
                  ref={soruMetniRef}
                  className="text-gray-900 katex-left-align q-preview-container select-text"
                  onMouseUp={handleTextSelection}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {revizeNotlari.filter(not => {
        if (user?.rol === 'admin' || user?.rol === 'dizgici') return true;
        if (incelemeTuru) return not.inceleme_turu === incelemeTuru;
        return true;
      }).length > 0 && (
          <div className="card bg-amber-50 border border-amber-200">
            <h3 className="text-xl font-bold mb-4 text-amber-900 flex items-center">
              <span className="mr-2">📝</span> Revize / Hata Notları
            </h3>
            <div className="space-y-3">
              {revizeNotlari.filter(not => {
                if (user?.rol === 'admin' || user?.rol === 'dizgici') return true;
                if (incelemeTuru) return not.inceleme_turu === incelemeTuru;
                return true;
              }).map((not) => (
                <div key={not.id} className="flex gap-4 p-3 bg-white border border-amber-100 rounded-lg shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {revizeNotlari.indexOf(not) + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                      {not.inceleme_turu === 'alanci' ? 'ALAN UZMANI' : 'DİL UZMANI'}
                    </div>
                    <div className="text-sm font-bold text-gray-800 mb-1 italic opacity-70">
                      "{not.secilen_metin}"
                    </div>
                    <p className="text-gray-900 font-medium">{not.not_metni}</p>
                  </div>
                  {(effectiveRole === 'admin' || user?.id === not.kullanici_id) && (
                    <button onClick={() => handleDeleteRevizeNot(not.id)} className="text-red-400 hover:text-red-700 transition self-start">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}



      {/* Popover - Sadece İnceleme/Admin Modunda */}
      {selectedText && canReview && (
        <div className="fixed bottom-12 right-12 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 font-bold text-white flex justify-between items-center bg-purple-600 shadow-lg">
            <span>Not Ekle (Madde {revizeNotlari.length + 1})</span>
            <button onClick={() => setSelectedText('')}>✕</button>
          </div>
          <div className="p-4">
            <div className="text-[10px] text-gray-400 mb-2 italic">"{selectedText.substring(0, 60)}..."</div>
            <textarea className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-purple-500" rows="3" placeholder="Hata açıklamasını buraya yazın..." value={revizeNotuInput} onChange={(e) => setRevizeNotuInput(e.target.value)} />
            <button onClick={handleAddRevizeNot} className="w-full mt-2 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-black uppercase">Notu Kaydet</button>
          </div>
        </div>
      )}

      {/* Alt Araç Çubuğu - Sadece Sil butonu */}
      <div className="flex gap-2">
        {/* SADECE ADMIN VE SAHİBİ SİLEBİLİR - İNCELEMECİ SİLEMEZ */}
        {(effectiveRole === 'admin' || (soru.olusturan_kullanici_id === user?.id && effectiveRole !== 'incelemeci')) && (
          <button onClick={handleSil} className="btn btn-danger">Sil</button>
        )}
      </div>

      {/* Yorumlar ve Versiyon geçmişi aynen devam eder... */}
      <div className="card">
        <h3 className="text-xl font-bold mb-6 text-gray-800">İnceleme Yorumları</h3>
        <IncelemeYorumlari soruId={id} />
      </div>
    </div>
  );
}




