import { useState, useEffect, useRef, memo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import katex from 'katex';
import 'katex/dist/katex.min.css';
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
  DocumentArrowUpIcon,
  PencilSquareIcon
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

  const computedStyle = {
    ...style,
    textAlign: 'left',
    hyphens: 'none',
    WebkitHyphens: 'none',
    msHyphens: 'none',
  };

  if (hangingIndent) {
    computedStyle.paddingLeft = '24px';
    computedStyle.textIndent = '-24px';
  }

  return (
    <div className="relative group/edit w-full">
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

  let containerStyle = { marginBottom: '1rem', position: 'relative' };
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
  const effectiveRole = viewRole || authUser?.rol;
  const user = authUser ? { ...authUser, rol: effectiveRole } : authUser;

  const effectiveIncelemeTuru = (() => {
    if (incelemeTuru === 'alanci' || incelemeTuru === 'dilci') return incelemeTuru;
    if (effectiveRole === 'incelemeci') {
      const alan = !!authUser?.inceleme_alanci;
      const dil = !!authUser?.inceleme_dilci;
      if (alan && !dil) return 'alanci';
      if (dil && !alan) return 'dilci';
      if (alan && dil) return 'alanci'; // varsayılan (UI üzerinden değiştirilebilir)
      return null;
    }
    return null;
  })();

  const canReview = effectiveRole === 'admin' || (effectiveRole === 'incelemeci' && !!effectiveIncelemeTuru);

  const [soru, setSoru] = useState(null);

  // DEBUG LOGS
  useEffect(() => {
    if (soru && user) {
      console.log('--- SORU DETAY DEBUG ---');
      console.log('User:', user);
      console.log('Soru:', soru);
      console.log('Effective Role:', effectiveRole);
      console.log('Is Owner Check:', soru.olusturan_kullanici_id, '==', user.id, '->', soru.olusturan_kullanici_id == user.id);
      console.log('Soru Durum:', soru.durum);
      const availableStatuses = ['beklemede', 'revize_gerekli', 'revize_istendi', 'inceleme_tamam'];
      console.log('Durum Allowed?:', availableStatuses.includes(soru.durum));
      console.log('Can Edit Final:', !incelemeTuru && (effectiveRole === 'admin' || ((soru.olusturan_kullanici_id == user.id) && availableStatuses.includes(soru.durum))));
      console.log('------------------------');
    }
  }, [soru, user, effectiveRole]);
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
        const mark = `<mark class="bg-${colorClass}-100 border-b-2 border-${colorClass}-400 px-1 relative group cursor-help transition-colors hover:bg-${colorClass}-200">
          ${not.secilen_metin}
          <sup class="text-${colorClass}-700 font-bold ml-0.5 select-none">[${revizeNotlari.indexOf(not) + 1}]</sup>
          <span class="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded w-48 z-50 shadow-xl mb-2">
            <strong>${not.inceleme_turu.toUpperCase()} Notu:</strong> ${not.not_metni}
          </span>
        </mark>`;
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

  const handleFinishReview = async () => {
    const hasNotes = revizeNotlari.length > 0;
    const msg = hasNotes
      ? `İşaretlediğiniz ${revizeNotlari.length} adet notla birlikte incelemeyi bitirmek istiyor musunuz?\n\n(Not: Hem alan hem dil incelemesi bittiğinde soru Branşa geri gönderilecektir.)`
      : 'Soru hatasız mı? ONAYLAYIP incelemeyi bitirmek istediğinizden emin misiniz?\n\n(Not: Hem alan hem dil incelemesi bittiğinde soru Branşa geri gönderilecektir.)';

    if (!confirm(msg)) return;

    try {
      const type = incelemeTuru || (effectiveRole === 'incelemeci' ? effectiveIncelemeTuru : 'admin');
      if (effectiveRole === 'incelemeci' && !type) {
        alert('İnceleme türü bulunamadı. Admin tarafından alan/dil yetkisi atanmalı.');
        return;
      }
      // Kullanıcı talebi: İnceleme bittiğinde backend hem alan hem dil onayı var mı diye bakar.
      await soruAPI.updateDurum(id, {
        yeni_durum: 'inceleme_tamam',
        aciklama: hasNotes ? (dizgiNotu || 'Metin üzerinde hatalar belirtildi.') : 'İnceleme hatasız tamamlandı.',
        inceleme_turu: type
      });
      alert('İncelemeniz kaydedildi. Tüm uzmanlar bitirdiğinde soru otomatik olarak Branşa iletilecektir.');
      navigate('/');
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleSendToDizgi = async () => {
    if (!confirm('Soruyu inceledim/düzelttim. Dizgi birimine GÖNDERMEK istediğinizden emin misiniz?')) return;
    try {
      await soruAPI.updateDurum(id, {
        yeni_durum: 'dizgi_bekliyor',
        aciklama: 'Branş onayı verildi, dizgi ve havuz aşamasına hazır.'
      });
      alert('Soru başarıyla Dizgi ve Havuza gönderildi.');
      navigate('/');
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleSendToInceleme = async () => {
    if (!confirm('Soruyu tekrar İNCELEME ekibine göndermek istediğinizden emin misiniz?')) return;
    try {
      await soruAPI.updateDurum(id, {
        yeni_durum: 'inceleme_bekliyor',
        aciklama: 'Branş tarafından tekrar incelemeye gönderildi.'
      });
      alert('Soru tekrar inceleme havuzuna gönderildi.');
      navigate('/');
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDizgiTamamla = async () => {
    if (!confirm('Dizgi işlemini bitirip soruyu HAVUZA (Tamamlandı) göndermek istediğinizden emin misiniz?')) return;
    try {
      await soruAPI.updateDurum(id, {
        yeni_durum: 'tamamlandi',
        aciklama: 'Dizgisi yapıldı ve havuza gönderildi.'
      });
      alert(`Soru başarıyla tamamlandı (V${soru.versiyon || 1}) ve Hazır Soru Havuzuna eklendi.`);
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
    setEditMetadata({
      zorluk: soru.zorluk_seviyesi || '3',
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

      htmlContent += `<div style="clear: both;"></div>`;
      formData.append('soru_metni', htmlContent);

      const firstNewImage = components.find(c => c.type === 'image' && c.file);
      if (firstNewImage) {
        formData.append('fotograf', firstNewImage.file);
        formData.append('fotograf_konumu', 'ust');
      }

      ['a', 'b', 'c', 'd', 'e'].forEach(opt => formData.append(`secenek_${opt}`, ''));

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

  const handleEditAndAction = async () => {
    if (components.length === 0) return alert("Soru içeriği boş!");
    if (!editMetadata.dogruCevap) return alert("Lütfen Doğru Cevabı seçiniz.");

    // Kaydetme işlemi (EditSave fonksiyonunu çağırıyoruz ama alert vermesini engellemek için parametre özelleştiremiyoruz, o yüzden standart akış çalışacak)
    // Ancak kullanıcı deneyimi için önce kaydedip sonra sormak mantıklı.
    await handleEditSave();

    setTimeout(() => {
      // 1. Seçenek: Dizgiye Gönder
      if (confirm("✅ Değişiklikler başarıyla kaydedildi.\n\n🚀 Soruyu DİZGİ birimine göndermek istiyor musunuz?\n('Tamam' derseniz DİZGİYE gider, 'İptal' derseniz diğer seçeneğe geçilir)")) {
        handleSendToDizgi();
      } else {
        // 2. Seçenek: İncelemeye Gönder
        if (confirm("🔍 O zaman soruyu tekrar İNCELEME ekibine göndermek ister misiniz?\n('Tamam' derseniz İNCELEMEYE gider, 'İptal' derseniz sadece kaydedilmiş olarak kalır)")) {
          handleSendToInceleme();
        }
      }
    }, 500);
  };

  const handleSaveAndInceleme = async () => {
    await handleEditSave();
    // Kısa bir gecikme ile aksiyonu tetikle ki state güncellensin
    setTimeout(() => handleSendToInceleme(), 500);
  };

  const handleSaveAndDizgi = async () => {
    await handleEditSave();
    setTimeout(() => handleSendToDizgi(), 500);
  };

  const RibbonButton = ({ cmd, label, icon }) => (
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700 font-medium">{icon || label}</button>
  );

  if (loading) return <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!soru) return null;

  const isOwner = soru.olusturan_kullanici_id == user?.id;
  const isAdmin = effectiveRole === 'admin';

  const availableStatusesForEdit = ['beklemede', 'revize_gerekli', 'revize_istendi', 'inceleme_tamam', 'dizgi_bekliyor'];
  const canEdit = isAdmin || (isOwner && availableStatusesForEdit.includes(soru.durum));

  const getDurumBadge = (durum) => {
    const badges = { beklemede: 'badge badge-warning', inceleme_bekliyor: 'badge badge-primary', dizgi_bekliyor: 'badge badge-warning', dizgide: 'badge badge-info', tamamlandi: 'badge badge-success', revize_gerekli: 'badge badge-error', revize_istendi: 'badge badge-error', inceleme_tamam: 'badge badge-emerald' };
    const labels = { beklemede: 'Beklemede', inceleme_bekliyor: 'İnceleme Bekliyor', dizgi_bekliyor: 'Dizgi Bekliyor', dizgide: 'Dizgide', tamamlandi: 'Tamamlandı', revize_gerekli: 'Revize Gerekli', revize_istendi: 'Revize İstendi', inceleme_tamam: 'İnceleme Tamamlandı' };
    return <span className={badges[durum]}>{labels[durum]}</span>;
  };

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

              {/* BRANŞ (YAZAR) VEYA ADMIN İÇİN AKSİYONLAR (Dizgiye veya İncelemeye Gönder) */}
              {(isAdmin || isOwner) && ['revize_istendi', 'tamamlandi', 'inceleme_tamam', 'dizgi_bekliyor'].includes(soru.durum) && (
                <>
                  {/* Düzenle Butonu - Sadece gerekli durumlarda */}
                  {canEdit && (
                    <button
                      onClick={handleEditStart}
                      className="px-6 py-3 bg-blue-100 text-blue-700 rounded-xl font-black text-sm hover:bg-blue-200 transition shadow-[0_4px_14px_0_rgba(59,130,246,0.2)] flex items-center gap-2 border-b-4 border-blue-300 active:border-b-0 active:translate-y-1"
                    >
                      ✍️ DÜZENLE
                    </button>
                  )}

                  {/* İncelemeye Gönder */}
                  <button
                    onClick={handleSendToInceleme}
                    className="px-6 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-black text-sm hover:bg-indigo-200 transition shadow-[0_4px_14px_0_rgba(79,70,229,0.2)] flex items-center gap-2 border-b-4 border-indigo-300 active:border-b-0 active:translate-y-1"
                  >
                    🔍 TEKRAR İNCELEMEYE GÖNDER
                  </button>

                  {/* Dizgiye Gönder */}
                  <button
                    onClick={handleSendToDizgi}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 transition shadow-[0_4px_14px_0_rgba(22,163,74,0.39)] flex items-center gap-2 border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
                  >
                    🚀 DİZGİYE GÖNDER
                  </button>
                </>
              )}

              {/* DİZGİCİ İÇİN DİZGİYE AL BUTONU (EĞER BEKLEMEDEYSE) */}
              {effectiveRole === 'dizgici' && soru.durum === 'dizgi_bekliyor' && (
                <button
                  onClick={() => handleStatusUpdate('dizgide')}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl font-black text-sm hover:bg-orange-700 transition shadow-[0_4px_14px_0_rgba(249,115,22,0.39)] flex items-center gap-2 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
                >
                  🚀 DİZGİYE AL
                </button>
              )}

              {/* DİZGİCİ İÇİN TAMAMLAMA BUTONU */}
              {effectiveRole === 'dizgici' && soru.durum === 'dizgide' && (
                <button
                  onClick={handleDizgiTamamla}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition shadow-[0_4px_14px_0_rgba(22,163,74,0.39)] flex items-center gap-2 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
                >
                  ✅ TAMAMLANDI
                </button>
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

      <div className="relative border-4 border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xl transition-all">
        {editMode ? (
          <div className="bg-[#F3F2F1] min-h-[600px] flex flex-col pointer-events-auto">
            <div className="bg-[#0078D4] text-white p-2 shadow-md flex justify-between items-center sticky top-0 z-[60]">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold flex items-center gap-2"><PencilSquareIcon className="w-4 h-4" /> Düzenleme Modu</h2>
                <div className="flex bg-[#005A9E] rounded p-0.5">
                  <button onClick={() => setWidthMode('dar')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${widthMode === 'dar' ? 'bg-white text-[#0078D4]' : 'text-white/80'}`}>82mm</button>
                  <button onClick={() => setWidthMode('genis')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${widthMode === 'genis' ? 'bg-white text-[#0078D4]' : 'text-white/80'}`}>169mm</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveAndInceleme} disabled={saving} className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-200 border border-indigo-300">🔍 KAYDET & İNCELEME</button>
                <button onClick={handleSaveAndDizgi} disabled={saving} className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded hover:bg-green-600 border border-green-600">🚀 KAYDET & DİZGİ</button>
                <button onClick={handleEditSave} disabled={saving} className="px-4 py-1 bg-white text-blue-700 text-xs font-bold rounded hover:bg-blue-50">KAYDET</button>
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
                      className={`relative group/item rounded px-1 transition ${draggedItemIndex === index ? 'opacity-50 bg-blue-50' : 'hover:ring-1 hover:ring-blue-100'}`}
                      style={{ float: comp.float || 'none', width: comp.width && comp.subtype === 'secenek' ? `${comp.width}%` : 'auto', marginRight: comp.float === 'left' ? '2%' : '0' }}
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

            <div className="bg-white border-t p-4 grid grid-cols-1 md:grid-cols-4 gap-4 mt-auto">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Brans</label>
                <select className="w-full border p-1 rounded text-xs" value={editMetadata.brans_id} onChange={e => setEditMetadata({ ...editMetadata, brans_id: e.target.value })}>
                  {branslar.map(b => <option key={b.id} value={b.id}>{b.brans_adi}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Dogru Cevap</label>
                <div className="flex gap-1 mt-1">
                  {['A', 'B', 'C', 'D', 'E'].map(opt => (
                    <button key={opt} onClick={() => setEditMetadata({ ...editMetadata, dogruCevap: opt })} className={`w-6 h-6 rounded-full border font-bold text-[10px] ${editMetadata.dogruCevap === opt ? 'bg-blue-600 text-white' : 'bg-gray-50'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Kazanim</label>
                {kazanimLoading ? (
                  <div className="text-[11px] text-gray-500 mt-1">Kazanimlar yukleniyor...</div>
                ) : (
                  <select
                    className="w-full border p-1 rounded text-xs"
                    value={editMetadata.kazanim}
                    onChange={e => setEditMetadata({ ...editMetadata, kazanim: e.target.value })}
                    disabled={!editMetadata.brans_id || kazanims.length === 0}
                  >
                    {!editMetadata.brans_id && <option value="">Once brans secin</option>}
                    {editMetadata.brans_id && kazanims.length === 0 && <option value="">Bu brans ta kazanim yok</option>}
                    {kazanims.map(k => (
                      <option key={k.id} value={k.kod}>
                        {k.kod} - {k.aciklama}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Zorluk</label>
                <select className="w-full border p-1 rounded text-xs" value={editMetadata.zorluk} onChange={e => setEditMetadata({ ...editMetadata, zorluk: e.target.value })}>
                  <option value="1">1 (?ok Kolay)</option>
                  <option value="2">2 (Kolay)</option>
                  <option value="3">3 (Orta)</option>
                  <option value="4">4 (Zor)</option>
                  <option value="5">5 (?ok Zor)</option>
                </select>
              </div>
            </div>
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

      {/* Alt Araç Çubuğu */}
      <div className="flex gap-2">
        {canEdit && !editMode && <button onClick={handleEditStart} className="btn btn-primary">✏️ Düzenle</button>}
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

function IncelemeYorumlari({ soruId }) {
  const [yorumlar, setYorumlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState('');
  const [loading, setLoading] = useState(true);
  const loadYorumlar = async () => {
    try { const res = await soruAPI.getComments(soruId); setYorumlar(res.data.data); } catch (e) { } finally { setLoading(false); }
  };
  useEffect(() => { loadYorumlar(); }, [soruId]);
  const handleYorumEkle = async () => {
    if (!yeniYorum.trim()) return;
    try { await soruAPI.addComment(soruId, yeniYorum); setYeniYorum(''); loadYorumlar(); } catch (e) { }
  };
  return (
    <div className="flex flex-col h-full min-h-[200px]">
      <div className="flex-1 space-y-3">
        {loading ? <p className="text-center text-gray-400">Yükleniyor...</p> : yorumlar.length === 0 ? <p className="text-center text-gray-400 italic text-sm">Hiç yorum yok.</p> :
          yorumlar.map((y) => (
            <div key={y.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-bold text-gray-900">{y.ad_soyad} <span className="text-[10px] font-normal text-gray-400 uppercase">({y.rol})</span></span>
                <span className="text-[10px] text-gray-400">{new Date(y.tarih).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{y.yorum_metni}</p>
            </div>
          ))}
      </div>
      <div className="mt-6 flex gap-2">
        <input type="text" className="input shadow-inner" placeholder="İnceleme notu yazın..." value={yeniYorum} onChange={(e) => setYeniYorum(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleYorumEkle()} />
        <button onClick={handleYorumEkle} className="btn btn-primary px-8">Ekle</button>
      </div>
    </div>
  );
}

function VersiyonGecmisi({ soruId }) {
  const [versiyonlar, setVersiyonlar] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => { try { const res = await soruAPI.getHistory(soruId); setVersiyonlar(res.data.data); } catch (e) { } finally { setLoading(false); } };
    load();
  }, [soruId]);
  if (loading) return <div className="text-center py-4">Sürümler yükleniyor...</div>;
  if (versiyonlar.length === 0) return <p className="text-center text-gray-400 italic">Henüz bir sürüm geçmişi yok.</p>;
  return (
    <div className="space-y-4">
      {versiyonlar.map((v) => (
        <div key={v.id} className="border rounded-xl p-4 bg-gray-50 hover:bg-white transition-all shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px] font-bold">v{v.versiyon_no}</span>
            <span className="text-[10px] text-gray-400">{new Date(v.degisim_tarihi).toLocaleString()}</span>
          </div>
          <div className="font-bold text-sm text-gray-900 mb-2">{v.ad_soyad}</div>
          <div className="text-xs text-gray-600 line-clamp-2 italic">"{v.degisim_aciklamasi || 'Soru güncellendi'}"</div>
        </div>
      ))}
    </div>
  );
}
