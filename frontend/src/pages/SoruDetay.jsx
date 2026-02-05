import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import { getDurumBadge } from '../utils/helpers';
import EditableBlock from '../components/EditableBlock';
import ResizableImage from '../components/ResizableImage';

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
  XMarkIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckBadgeIcon,
  ArrowPathIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  Squares2X2Icon,
  CursorArrowRaysIcon,
  StopIcon,
  MinusIcon,
  PencilIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

const parseHtmlToComponents = (html, soru = null) => {
  if (!html) {
    // Eğer HTML boşsa ama soru nesnesi/fotoğrafı varsa, fotoğrafı tek bileşen olarak döndür
    if (soru?.fotograf_url) {
      return [{
        id: generateId(),
        type: 'image',
        content: soru.fotograf_url,
        width: 100,
        height: 'auto',
        align: 'center'
      }];
    }
    return [];
  }
  const div = document.createElement('div');
  div.innerHTML = html;

  // Eğer hiç çocuk element yoksa (sadece düz metin varsa)
  if (div.children.length === 0) {
    return html.trim() ? [{ id: generateId(), type: 'text', subtype: 'govde', content: html, label: 'Gövde' }] : [];
  }

  const nodes = Array.from(div.children);

  const result = nodes.map((node, idx) => {
    // RESİM KONTROLÜ: q-img class'lı, doğrudan img etiketi veya içinde sadece img olan div/p
    const isImageNode = node.classList.contains('q-img') || node.tagName === 'IMG' || (node.querySelector('img') && node.innerText.trim() === '');

    if (isImageNode) {
      const img = node.tagName === 'IMG' ? node : node.querySelector('img');
      if (!img) return null;

      const style = node.getAttribute('style') || '';
      const wMatch = style.match(/width:\s*(\d+)%/);
      const hMatch = style.match(/height:\s*(\d+)px/);

      let align = 'center';
      if (style.includes('float: left')) align = 'left';
      else if (style.includes('float: right')) align = 'right';

      let src = img.getAttribute('src') || '';
      // Eğer resim kaynağı blob ise veya geçersizse ve sorunun ana fotoğrafı varsa onu kullan
      if ((src.startsWith('blob:') || src.includes('createObjectURL') || !src.startsWith('http')) && soru?.fotograf_url) {
        src = soru.fotograf_url;
      }

      return {
        id: generateId() + idx,
        type: 'image',
        content: src,
        width: wMatch ? parseInt(wMatch[1]) : 50,
        height: hMatch ? parseInt(hMatch[1]) : 'auto',
        align: align
      };
    }
    // METİN KONTROLÜ
    else {
      let subtype = 'govde';
      let width = 100;
      let float = 'none';

      // q-txt yapısı varsa özelliklerini al
      if (node.classList.contains('q-txt')) {
        subtype = Array.from(node.classList).find(c => c.startsWith('q-') && c !== 'q-txt')?.replace('q-', '') || 'govde';
      } else {
        // Yapı yoksa içerkten tahmin et
        const text = node.innerText.trim();
        if (text.match(/^[A-E]\)/) || text.match(/^[A-E]\s\)/) || node.innerHTML.includes('<b>A)')) subtype = 'secenek';
      }

      const style = node.getAttribute('style') || '';
      const wMatch = style.match(/width:\s*(\d+)%/);
      const fMatch = style.match(/float:\s*(\w+)/);
      if (wMatch) width = parseInt(wMatch[1]);
      if (fMatch) float = fMatch[1];

      return {
        id: generateId() + idx,
        type: 'text',
        subtype: subtype,
        content: node.innerHTML,
        label: subtype === 'koku' ? 'Soru Kökü' : (subtype === 'secenek' ? 'Seçenek' : 'Gövde'),
        width: width,
        float: float
      };
    }
  }).filter(Boolean);

  // Eğer HTML işlendi ama hiç resim bulunamadıysa ve sorunun ana fotoğrafı varsa
  // (Özellikle sadece metin içeren veya boş HTML'li PNG soruları için)
  if (result.length === 0 && soru?.fotograf_url) {
    result.push({
      id: generateId(),
      type: 'image',
      content: soru.fotograf_url,
      width: 100,
      height: 'auto',
      align: 'center'
    });
  } else if (result.length > 0 && !result.some(c => c.type === 'image') && soru?.fotograf_url) {
    result.unshift({
      id: generateId(),
      type: 'image',
      content: soru.fotograf_url,
      width: 100,
      height: 'auto',
      align: 'center'
    });
  }

  return result;
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

  const [soru, setSoru] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = effectiveRole === 'admin';
  const isOwner = soru?.olusturan_kullanici_id == user?.id;
  const isBranchTeacher = user?.rol === 'soru_yazici' && Number(user?.brans_id) === Number(soru?.brans_id);
  const hasFullAccess = isAdmin || isOwner || isBranchTeacher;
  const canReview = (isAdmin || (effectiveRole === 'incelemeci' && !!effectiveIncelemeTuru)) && soru?.durum !== 'tamamlandi';

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

  useEffect(() => { if (editMode && branslar.length === 0) bransAPI.getAll().then(res => setBranslar(res.data.data || [])).catch(console.error); }, [editMode]);
  useEffect(() => {
    const loadKazanims = async () => {
      if (!editMetadata.brans_id) { setKazanims([]); return; }
      try { setKazanimLoading(true); const res = await bransAPI.getKazanims(editMetadata.brans_id); setKazanims(res.data.data || []); } catch (err) { } finally { setKazanimLoading(false); }
    };
    if (editMode) loadKazanims();
  }, [editMetadata.brans_id, editMode]);

  const onDragEnd = () => setDraggedItemIndex(null);

  const soruMetniRef = useRef(null);
  const [selectedText, setSelectedText] = useState('');
  const [revizeNotuInput, setRevizeNotuInput] = useState('');
  const [revizeNotlari, setRevizeNotlari] = useState([]);

  // Annotation State
  const [selectedAnnotation, setSelectedAnnotation] = useState(null); // { type: 'box'|'line', ...data }
  const [drawTool, setDrawTool] = useState('box'); // 'box', 'line'
  const [drawingShape, setDrawingShape] = useState(null); // { type, ...data }

  const [viewMode, setViewMode] = useState('auto'); // 'auto', 'text', 'image'

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
        if (!not.secilen_metin || not.secilen_metin.startsWith('IMG##')) return false; // Görsel notlarını atla
        if (user?.rol === 'admin' || user?.rol === 'dizgici') return true;
        if (incelemeTuru || (user?.rol === 'incelemeci' && effectiveIncelemeTuru)) {
          return not.inceleme_turu === (incelemeTuru || effectiveIncelemeTuru);
        }
        return true;
      });
      visibleNotes.forEach((not, index) => {
        if (!not.secilen_metin) return;
        const colorClass = not.inceleme_turu === 'dilci' ? 'green' : 'blue';
        const mark = `<mark class="bg-${colorClass}-100 border-b-2 border-${colorClass}-400 px-1 relative group cursor-help transition-colors hover:bg-${colorClass}-200">${not.secilen_metin}<sup class="text-${colorClass}-700 font-bold ml-0.5 select-none">[${revizeNotlari.indexOf(not) + 1}]</sup><span class="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded w-48 z-[100] shadow-xl mb-2 font-sans font-medium"><strong>${(not.inceleme_turu || '').toUpperCase()}:</strong> ${not.not_metni}</span></mark>`;
        html = html.split(not.secilen_metin).join(mark);
      });
    }
    element.innerHTML = html;

    // GÖRSEL DUZELTME: ESKİ/HATALI STİLLERİ EZ VE TAM GENİŞLİK YAP
    // Container zaten 185mm (Belge boyutu) ile sınırlı.
    // Bu yüzden görselleri %100 yaparak tam belge genişliğinde (okunaklı) gösteriyoruz.
    const images = element.querySelectorAll('img');
    images.forEach(img => {
      // BLOB URL DÜZELTME: Eğer resim kaynağı blob ise ve veritabanında kayıtlı URL varsa onu kullan
      if ((img.src.startsWith('blob:') || img.src.includes('createObjectURL')) && soru?.fotograf_url) {
        img.src = soru.fotograf_url;
      }

      // Zoom
      img.style.cursor = 'zoom-in';
      img.onclick = () => window.open(img.src, '_blank');
      img.title = "Büyütmek için tıklayın";

      // KRİTİK: Veritabanından gelen inline width (örn: %40) değerini EZİYORUZ.
      // Çünkü eski kayıtlarda bu değer görseli çok küçültüyor olabilir.
      img.style.width = '100%';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '20px auto';
      img.style.objectFit = 'contain';
    });
  };

  const loadSoru = async () => {
    try {
      const response = await soruAPI.getById(id);
      setSoru(response.data.data);
      // Soru yüklendiğinde revize notlarını da tazele
      loadRevizeNotlari();
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
        scale: 2,
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
    if (text) {
      setSelectedText(text);
      setSelectedAnnotation(null);
    }
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
      // Durum değiştiğinde notları tazele (belki çözüldü yapılmıştır)
      await loadSoru();
      await loadRevizeNotlari();
      if (['tamamlandi', 'dizgi_bekliyor', 'alan_incelemede', 'dil_incelemede'].includes(status)) {
        navigate(scope === 'brans' ? '/brans-havuzu' : '/sorular');
      }
    } catch (e) {
      alert('Hata: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleImageMouseDown = (e) => {
    if (!canReview) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDrawingShape({ type: drawTool, startX: x, startY: y, currentX: x, currentY: y });
    setSelectedAnnotation(null);
    setSelectedText('');
  };

  const handleImageMouseMove = (e) => {
    if (!drawingShape) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setDrawingShape(prev => ({ ...prev, currentX: x, currentY: y }));
  };

  const handleImageMouseUp = () => {
    if (!drawingShape) return;

    const { type, startX, startY, currentX, currentY } = drawingShape;

    // Minimal movement check to avoid accidental tiny shapes
    if (Math.abs(currentX - startX) < 1 && Math.abs(currentY - startY) < 1) {
      setDrawingShape(null);
      return;
    }

    if (type === 'box') {
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);
      setSelectedAnnotation({ type: 'box', x, y, w, h });
    } else if (type === 'line') {
      setSelectedAnnotation({ type: 'line', x1: startX, y1: startY, x2: currentX, y2: currentY });
    }
    setDrawingShape(null);
  };

  const handleAddRevizeNot = async () => {
    if (!revizeNotuInput.trim()) return;
    try {
      const type = incelemeTuru || (effectiveRole === 'incelemeci' ? effectiveIncelemeTuru : 'admin');

      let secilen_metin = selectedText;
      if (selectedAnnotation) {
        if (selectedAnnotation.type === 'box') {
          secilen_metin = `IMG##BOX:${selectedAnnotation.x.toFixed(2)},${selectedAnnotation.y.toFixed(2)},${selectedAnnotation.w.toFixed(2)},${selectedAnnotation.h.toFixed(2)}`;
        } else if (selectedAnnotation.type === 'line') {
          secilen_metin = `IMG##LINE:${selectedAnnotation.x1.toFixed(2)},${selectedAnnotation.y1.toFixed(2)},${selectedAnnotation.x2.toFixed(2)},${selectedAnnotation.y2.toFixed(2)}`;
        } else if (selectedAnnotation.type === 'draw') {
          const pointsStr = selectedAnnotation.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(';');
          secilen_metin = `IMG##DRAW:${pointsStr}`;
        } else {
          // Default to point
          secilen_metin = `IMG##${selectedAnnotation.x.toFixed(2)},${selectedAnnotation.y.toFixed(2)}`;
        }
      }

      await soruAPI.addRevizeNot(id, {
        secilen_metin: secilen_metin,
        not_metni: revizeNotuInput,
        inceleme_turu: type
      });
      setRevizeNotuInput('');
      setSelectedText('');
      setSelectedAnnotation(null);
      loadRevizeNotlari();
    } catch (e) { alert('Not eklenemedi'); }
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
        // Önce local olarak notları temizle (görsel değişeceği için)
        setRevizeNotlari([]);
        await soruAPI.uploadFinal(id, formData);
        await loadSoru();
        await loadRevizeNotlari();
      } catch (err) { alert('Yükleme başarısız: ' + (err.response?.data?.error || err.message)); }
    }
  };

  const handleEditStart = () => {
    setComponents(parseHtmlToComponents(soru.soru_metni, soru));
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
      kazanim: soru.kazanim || '',
      kategori: soru.kategori || 'deneme',
      kullanildi: soru.kullanildi || false,
      kullanim_alani: soru.kullanim_alani || ''
    });
    setEditMode(true);
  };

  const handleEditSave = async () => {
    if (components.length === 0) return alert("Soru içeriği boş!");
    if (!editMetadata.dogruCevap) return alert("Lütfen doğru cevabı seçiniz.");
    setSaving(true);
    try {
      const formData = new FormData();
      const firstImage = components.find(c => c.type === 'image' && c.file);
      formData.append('dogru_cevap', editMetadata.dogruCevap);
      formData.append('brans_id', editMetadata.brans_id);
      formData.append('kazanim', editMetadata.kazanim || 'Genel');
      formData.append('zorluk_seviyesi', editMetadata.zorluk);
      formData.append('kategori', editMetadata.kategori || 'deneme');
      formData.append('kullanildi', editMetadata.kullanildi ? 'true' : 'false');
      formData.append('kullanim_alani', editMetadata.kullanim_alani || '');
      if (firstImage) {
        formData.append('fotograf', firstImage.file);
        formData.append('fotograf_konumu', 'ust');
      }
      ['a', 'b', 'c', 'd', 'e'].forEach(opt => formData.append(`secenek_${opt}`, ''));
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
      loadRevizeNotlari();
    } catch (error) { alert(error.response?.data?.error || 'Güncelleme başarısız'); }
    finally { setSaving(false); }
  };

  const addKoku = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'koku', content: '', placeholder: '', label: 'Soru Kökü' }]);
  const addGovde = () => setComponents(prev => [...prev, { id: generateId(), type: 'text', subtype: 'govde', content: '', placeholder: '', label: 'Gövde' }]);
  const addSecenekler = (mode = 'list') => {
    const existingSecenekler = components.filter(c => c.subtype === 'secenek');
    const hasE = existingSecenekler.some(c => c.content.includes('E)'));
    const count = hasE ? 5 : 4;
    const baseId = generateId();
    const opts = hasE ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

    let styleProps = { width: 100, float: 'none' };
    if (mode === 'grid') styleProps = { width: count === 5 ? 31 : 48, float: 'left' };
    else if (mode === 'yanyana') styleProps = { width: count === 5 ? 18 : 23, float: 'left' };

    const newComps = opts.map((opt, idx) => ({
      id: baseId + idx, type: 'text', subtype: 'secenek', content: `<b>${opt})</b>`,
      label: `Seçenek ${opt}`, ...styleProps
    }));
    setComponents(prev => [...prev.filter(c => c.subtype !== 'secenek'), ...newComps]);
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
        setComponents(prev => [...prev, { id: generateId(), type: 'image', content: objectUrl, file, width: w, height: 'auto', align: 'center' }]);
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
        if (img.naturalHeight > img.naturalWidth * 1.5) w = 40;
        else if (img.naturalHeight > img.naturalWidth) w = 60;
        else if (Math.abs(img.naturalHeight - img.naturalWidth) < 100) w = 70;

        setComponents(prev => [...prev, { id: generateId(), type: 'image', content: objectUrl, file: file, width: w, height: 'auto', align: 'center' }]);
      };
    }
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
    <button onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }} className="w-9 h-9 flex items-center justify-center hover:bg-white hover:text-blue-600 rounded-xl transition-all shadow-sm active:scale-95">{icon || label}</button>
  );

  const BoldIcon = (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h4.5a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.75h3a3.75 3.75 0 010 7.5h-3m0 0h3a3.75 3.75 0 010 7.5h-3" />
    </svg>
  );

  if (loading) return <div className="py-40 text-center"><ArrowPathIcon className="w-12 h-12 text-blue-100 animate-spin mx-auto mb-4" strokeWidth={3} /><p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Soru Verileri Getiriliyor...</p></div>;
  if (!soru) return null;

  const availableStatusesForEdit = ['beklemede', 'revize_gerekli', 'revize_istendi', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi'];
  const canEdit = isAdmin || ((isOwner || isBranchTeacher) && availableStatusesForEdit.includes(soru.durum));


  if (editMode) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] animate-fade-in font-sans pb-32 -mx-4 sm:-mx-8 lg:-mx-12 px-4 sm:px-8 lg:px-12 pt-1">
        {/* EDITOR STRIP */}
        <div className="bg-gray-900 border-b border-black text-white p-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-[100] gap-4 shadow-xl mb-10 rounded-2xl">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-6 h-6 text-blue-400" strokeWidth={2.5} />
              <span className="text-sm font-black uppercase tracking-[0.2em]">Soru Düzenleme Stüdyosu</span>
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
            <button onClick={() => setEditMode(false)} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">İPTAL VE ÇIKIŞ</button>
            <button onClick={handleEditSave} disabled={saving} className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95">
              <CheckBadgeIcon className="w-5 h-5" /> SİSTEME KAYDET
            </button>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-2">
          {/* LEFT TOOLBAR: TOOLS + OPTIONS */}
          <div className="lg:col-span-2 space-y-6">
            {/* CONTENT TOOLS */}
            <div className="bg-white p-5 rounded-3xl shadow-lg border border-gray-100 flex flex-col gap-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">İÇERİK</h4>

              <div className="grid grid-cols-1 gap-2">
                <label className="group flex flex-col p-4 bg-indigo-50 hover:bg-indigo-600 rounded-2xl cursor-pointer transition-all border border-indigo-100/50 hover:shadow-lg hover:shadow-indigo-200">
                  <div className="flex items-center gap-3 text-indigo-900 group-hover:text-white font-black text-xs uppercase tracking-widest">
                    <DocumentArrowUpIcon className="w-5 h-5" />
                    <span>Soru Resmİ</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleReadyQuestionUpload} />
                </label>

                <button onClick={addKoku} className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-800 group rounded-2xl border border-gray-100 transition-all text-left">
                  <Bars4Icon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                  <span className="text-[10px] font-black text-gray-600 group-hover:text-white uppercase tracking-widest">Soru Kökü</span>
                </button>

                <button onClick={addGovde} className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-800 group rounded-2xl border border-gray-100 transition-all text-left">
                  <DocumentTextIcon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                  <span className="text-[10px] font-black text-gray-600 group-hover:text-white uppercase tracking-widest">Metin</span>
                </button>

                <label className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-500 group rounded-2xl border border-orange-100 transition-all text-left cursor-pointer">
                  <PhotoIcon className="w-5 h-5 text-orange-400 group-hover:text-white" />
                  <span className="text-[10px] font-black text-orange-700 group-hover:text-white uppercase tracking-widest">Görsel</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
            </div>

            {/* OPTION BUTTONS */}
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
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }} className="p-2 hover:bg-white/10 rounded-xl transition"><QueueListIcon className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="relative group/canvas perspective-1000 w-full flex justify-center">
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
                  <div style={{ clear: 'both' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT METADATA PANEL */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden sticky top-32">
              <div className="p-5 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-amber-500" /> KÜNYE
                </h3>
              </div>
              <div className="p-5">
                <MetadataForm
                  values={editMetadata}
                  onChange={setEditMetadata}
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
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">{editMode ? 'Düzenleme Modu' : 'Soru Detayı'}</h1>
              {getDurumBadge(soru.durum)}
            </div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-blue-500" /> {soru.brans_adi} <span className="opacity-20">|</span> <span className="text-blue-600 font-black">V{soru.versiyon || 1}</span> <span className="opacity-20">|</span> {soru.olusturan_ad} tarafından oluşturuldu
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {effectiveRole !== 'incelemeci' && (
            <>
              {soru.final_png_url && <a href={soru.final_png_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-95"><ArrowDownTrayIcon className="w-5 h-5" /> FİNAL PNG</a>}
              <button onClick={handleCapturePNG} className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"><CameraIcon className="w-5 h-5" /> GÖRÜNÜMÜ AL</button>
            </>
          )}

          {!editMode && (
            <div className="flex flex-wrap items-center gap-2">
              {canReview && soru.durum !== 'tamamlandi' && (
                <button onClick={handleFinishReview} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95">🚩 İNCELEMEYİ SONLANDIR</button>
              )}
              {canEdit && (
                <button onClick={handleEditStart} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95"><PencilIcon className="w-5 h-5" /> DÜZENLE</button>
              )}
              {hasFullAccess && (
                <div className="flex gap-2">
                  {['beklemede', 'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi'].includes(soru.durum) && <button onClick={() => handleUpdateStatus('dizgi_bekliyor', 'Dizgiye gönderilsin mi?')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-100 transition-all">🚀 DİZGİYE GÖNDER</button>}
                  {(soru.durum === 'dizgi_tamam' || (soru.durum === 'dil_onaylandi' && !soru.onay_alanci)) && <button onClick={() => handleUpdateStatus('alan_incelemede')} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">🔍 ALAN İNCELEME</button>}
                  {(soru.durum === 'alan_onaylandi' || (soru.durum === 'dizgi_tamam' && soru.onay_alanci && !soru.onay_dilci)) && <button onClick={() => handleUpdateStatus('dil_incelemede')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">🔤 DİL İNCELEME</button>}
                  {(soru.durum === 'dizgi_tamam' || (soru.durum === 'dil_onaylandi' && soru.onay_alanci)) && <button onClick={() => handleUpdateStatus('tamamlandi', 'Soruyu tamamlanan sorulara aktarmak istediğinize emin misiniz?')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all">✅ TAMAMLANANLARA AKTAR</button>}
                </div>
              )}
              {effectiveRole === 'dizgici' && (soru.durum === 'dizgi_bekliyor' || soru.durum === 'revize_istendi') && <button onClick={handleDizgiAl} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">🚀 DİZGİYE BAŞLA</button>}
              {effectiveRole === 'dizgici' && soru.durum === 'dizgide' && (
                <div className="flex gap-2">
                  <input type="file" ref={finalFileInputRef} className="hidden" accept="image/*" onChange={handleFinalUpload} />
                  <button onClick={() => finalFileInputRef.current.click()} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"><PhotoIcon className="w-5 h-5" /> PNG YÜKLE</button>
                  <button onClick={() => handleUpdateStatus('alan_incelemede', 'Dizgiyi sonlandırıp soruyu branşa göndermek istediğinize emin misiniz?')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5" /> SONLANDIR VE BRANŞA GÖNDER
                  </button>
                </div>
              )}
              {effectiveRole === 'dizgici' && soru.durum === 'dizgi_tamam' && (
                <button onClick={() => handleUpdateStatus('alan_incelemede', 'Soru branş incelemesine gönderilsin mi?')} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-orange-100 flex items-center gap-2">
                  🚀 BRANŞA GÖNDER
                </button>
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
                    <button onClick={() => setWidthMode('dar')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${widthMode === 'dar' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>82mm</button>
                    <button onClick={() => setWidthMode('genis')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${widthMode === 'genis' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>169mm</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditMode(false)} className="px-5 py-2 hover:bg-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl">İPTAL</button>
                  <button onClick={handleEditSave} disabled={saving} className="bg-white text-blue-600 px-8 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl active:scale-95">DEĞİŞİKLİKLERİ KAYDET</button>
                </div>
              </div>
            )}



            <div className="p-12 xl:p-16 flex justify-center bg-gray-50/20 min-h-[600px]">
              {(viewMode === 'image' || (viewMode === 'auto' && soru.final_png_url && !editMode)) ? (
                <div className="flex flex-col items-center gap-6 w-full">
                  {canReview && (
                    <div className="flex flex-col items-center gap-3 animate-fade-in-down z-20">
                      <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl shadow-blue-900/5 border border-white flex gap-2">
                        <button onClick={() => setDrawTool('box')} className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${drawTool === 'box' ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-500/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900'}`}>
                          <StopIcon className="w-5 h-5" strokeWidth={2.5} />
                          <span>Kutu Seçimi</span>
                        </button>
                        <button onClick={() => setDrawTool('line')} className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${drawTool === 'line' ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-500/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900'}`}>
                          <MinusIcon className="w-5 h-5" strokeWidth={2.5} />
                          <span>Altını Çiz</span>
                        </button>
                      </div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-white/50 px-4 py-1.5 rounded-full border border-gray-100/50 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        İnceleme yapmak için araç seçiniz
                      </p>
                    </div>
                  )}

                  <div
                    className="relative inline-block shadow-2xl rounded-sm overflow-hidden group/img select-none"
                    onMouseDown={handleImageMouseDown}
                    onMouseMove={handleImageMouseMove}
                    onMouseUp={handleImageMouseUp}
                    onMouseLeave={handleImageMouseUp}
                  >
                    <img
                      src={soru.final_png_url}
                      alt="Final Dizgi"
                      className={`max-w-full max-h-[80vh] object-contain ${canReview ? (drawTool === 'cursor' ? 'cursor-crosshair' : 'cursor-cell') : ''}`}
                      draggable={false}
                    />
                    {/* Markers */}
                    {revizeNotlari.map((not, i) => {
                      if (!not.secilen_metin?.startsWith('IMG##')) return null;
                      const meta = not.secilen_metin.replace('IMG##', '');
                      const colorClass = not.inceleme_turu === 'alanci' ? 'blue' : 'emerald';
                      const colorHex = not.inceleme_turu === 'alanci' ? '#2563eb' : '#059669';

                      // Parse Shape
                      let shape = { type: 'point', x: 0, y: 0 };
                      if (meta.startsWith('BOX:')) {
                        const [x, y, w, h] = meta.replace('BOX:', '').split(',').map(Number);
                        shape = { type: 'box', x, y, w, h };
                      } else if (meta.startsWith('LINE:')) {
                        const [x1, y1, x2, y2] = meta.replace('LINE:', '').split(',').map(Number);
                        shape = { type: 'line', x1, y1, x2, y2 };
                      } else if (meta.startsWith('DRAW:')) {
                        const sets = meta.replace('DRAW:', '').split(';');
                        const points = sets.map(s => { const [px, py] = s.split(',').map(Number); return { x: px, y: py }; });
                        if (points.length > 0) shape = { type: 'draw', points };
                      } else {
                        const [x, y] = meta.split(',').map(Number);
                        shape = { type: 'point', x, y };
                      }

                      return (
                        <div key={not.id} className="absolute inset-0 pointer-events-none">
                          {/* RENDER SHAPE */}
                          {shape.type === 'draw' && shape.points && shape.points.length > 1 && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                              <polyline
                                points={shape.points.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke={colorHex}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="drop-shadow-sm"
                                vectorEffect="non-scaling-stroke"
                              />
                              {/* Label at last point */}
                              <foreignObject x={`${shape.points[shape.points.length - 1].x}%`} y={`${shape.points[shape.points.length - 1].y}%`} width="30" height="30" style={{ overflow: 'visible' }}>
                                <div className={`w-5 h-5 -mt-6 rounded-full bg-${colorClass}-600 text-white flex items-center justify-center text-[9px] font-black shadow-sm mx-auto`}>{i + 1}</div>
                              </foreignObject>
                            </svg>
                          )}
                          {shape.type === 'box' && (
                            <div
                              className={`absolute border-2 border-${colorClass}-500 bg-${colorClass}-500/0 hover:bg-${colorClass}-500/10 transition-colors z-10 pointer-events-auto`}
                              style={{ left: `${shape.x}%`, top: `${shape.y}%`, width: `${shape.w}%`, height: `${shape.h}%` }}
                            >
                              <div className={`absolute -top-3 -right-3 w-6 h-6 rounded-full bg-${colorClass}-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm`}>{i + 1}</div>
                            </div>
                          )}
                          {shape.type === 'line' && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                              <line
                                x1={`${shape.x1}%`} y1={`${shape.y1}%`}
                                x2={`${shape.x2}%`} y2={`${shape.y2}%`}
                                stroke={colorHex}
                                strokeWidth="3"
                                strokeLinecap="round"
                                className="drop-shadow-sm"
                              />
                              <circle cx={`${shape.x2}%`} cy={`${shape.y2}%`} r="3" fill={colorHex} />
                              {/* Label at the end */}
                              <foreignObject x={`${shape.x2}%`} y={`${shape.y2}%`} width="30" height="30" style={{ overflow: 'visible' }}>
                                <div className={`w-5 h-5 -mt-6 rounded-full bg-${colorClass}-600 text-white flex items-center justify-center text-[9px] font-black shadow-sm mx-auto`}>{i + 1}</div>
                              </foreignObject>
                            </svg>
                          )}
                          {shape.type === 'point' && (
                            <div
                              className="absolute w-12 h-12 -ml-6 -mt-6 flex items-center justify-center group/marker z-10 hover:z-30 transition-all pointer-events-auto"
                              style={{ left: `${shape.x}%`, top: `${shape.y}%` }}
                            >
                              <div className={`absolute inset-0 rounded-full bg-${colorClass}-400/30 mix-blend-multiply border border-${colorClass}-400/20 shadow-[0_0_10px_rgba(0,0,0,0.1)] transition-all group-hover/marker:bg-${colorClass}-400/50`}></div>
                              <div className={`absolute inset-0 rounded-full animate-ping opacity-20 bg-${colorClass}-400`} style={{ animationDuration: '3s' }}></div>
                              <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full border border-white bg-${colorClass}-600 text-white shadow-md flex items-center justify-center text-[9px] font-black z-20 scale-90 group-hover/marker:scale-110 transition-transform`}>
                                {i + 1}
                              </div>
                              {/* Tooltip */}
                              <div className="opacity-0 group-hover/marker:opacity-100 absolute bottom-full mb-3 bg-gray-900/95 backdrop-blur-md text-white text-xs p-3 rounded-2xl whitespace-nowrap shadow-2xl transition-all translate-y-2 group-hover/marker:translate-y-0 pointer-events-none z-[100] border border-white/10">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`w-2 h-2 rounded-full bg-${colorClass}-400`}></span>
                                  <span className="font-black opacity-60 text-[9px] uppercase tracking-widest">{not.inceleme_turu} UZMANI</span>
                                </div>
                                <p className="font-bold leading-relaxed">{not.not_metni}</p>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900/95"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Drawing Shape Preview */}
                    {drawingShape && (
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {drawingShape.type === 'pencil' && drawingShape.points.length > 1 && (
                          <svg className="absolute inset-0 w-full h-full">
                            <polyline
                              points={drawingShape.points.map(p => `${p.x},${p.y}`).join(' ')}
                              fill="none"
                              stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                        )}
                        {drawingShape.type === 'box' && (
                          <div className="absolute border-2 border-indigo-500 bg-indigo-500/20"
                            style={{
                              left: `${Math.min(drawingShape.startX, drawingShape.currentX)}%`,
                              top: `${Math.min(drawingShape.startY, drawingShape.currentY)}%`,
                              width: `${Math.abs(drawingShape.currentX - drawingShape.startX)}%`,
                              height: `${Math.abs(drawingShape.currentY - drawingShape.startY)}%`
                            }}
                          ></div>
                        )}
                        {drawingShape.type === 'line' && (
                          <svg className="absolute inset-0 w-full h-full">
                            <line
                              x1={`${drawingShape.startX}%`} y1={`${drawingShape.startY}%`}
                              x2={`${drawingShape.currentX}%`} y2={`${drawingShape.currentY}%`}
                              stroke="#6366f1" strokeWidth="3" strokeDasharray="5,5"
                            />
                          </svg>
                        )}
                      </div>
                    )}

                    {/* Active Selection */}
                    {selectedAnnotation && (
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {selectedAnnotation.type === 'point' && (
                          <div className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-rose-500 shadow-lg animate-pulse" style={{ left: `${selectedAnnotation.x}%`, top: `${selectedAnnotation.y}%` }}></div>
                        )}
                        {selectedAnnotation.type === 'box' && (
                          <div className="absolute border-2 border-rose-500 bg-rose-500/20 animate-pulse"
                            style={{ left: `${selectedAnnotation.x}%`, top: `${selectedAnnotation.y}%`, width: `${selectedAnnotation.w}%`, height: `${selectedAnnotation.h}%` }}>
                          </div>
                        )}
                        {selectedAnnotation.type === 'line' && (
                          <svg className="absolute inset-0 w-full h-full">
                            <line
                              x1={`${selectedAnnotation.x1}%`} y1={`${selectedAnnotation.y1}%`}
                              x2={`${selectedAnnotation.x2}%`} y2={`${selectedAnnotation.y2}%`}
                              stroke="#f43f5e" strokeWidth="3" className="animate-pulse"
                            />
                            <circle cx={`${selectedAnnotation.x2}%`} cy={`${selectedAnnotation.y2}%`} r="4" fill="#f43f5e" />
                          </svg>
                        )}
                        {selectedAnnotation.type === 'draw' && (
                          <svg className="absolute inset-0 w-full h-full">
                            <polyline
                              points={selectedAnnotation.points.map(p => `${p.x},${p.y}`).join(' ')}
                              fill="none"
                              stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              className="animate-pulse"
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
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
                      {/* Edit Toolbar - Always Visible */}
                      <div className="sticky top-0 -mt-4 mb-4 -mx-2 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-3 flex items-center justify-between gap-4 shadow-xl z-[80]">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-2">Format:</span>
                          <button onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold text-sm transition-all" title="Kalın">B</button>
                          <button onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white italic text-sm transition-all" title="İtalik">I</button>
                          <button onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white underline text-sm transition-all" title="Altı Çizili">U</button>
                          <button onMouseDown={(e) => { e.preventDefault(); execCmd('subscript'); }} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-all" title="Alt Simge">X₂</button>
                          <button onMouseDown={(e) => { e.preventDefault(); execCmd('superscript'); }} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-all" title="Üst Simge">X²</button>
                        </div>
                        <div className="h-6 w-px bg-gray-600"></div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-2">Ekle:</span>
                          <button onClick={addKoku} className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all">+ Kök</button>
                          <button onClick={addGovde} className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all">+ Metin</button>
                          <button onClick={() => addSecenekler('list')} className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all">+ Şıklar</button>
                          <label className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer">
                            + Görsel
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                          </label>
                        </div>
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
                    <div className="prose max-w-[185mm] mx-auto w-full" style={{ fontFamily: '"Arial", sans-serif', fontSize: '10pt', lineHeight: '1.4' }}>
                      <div ref={soruMetniRef} className="text-gray-900 katex-left-align q-preview-container select-text" onMouseUp={handleTextSelection} />

                      {/* FALLBACK GÖRSEL: HTML içinde görsel yoksa ama URL varsa göster */}
                      {soru.fotograf_url && !soru.soru_metni?.includes('<img') && (
                        <div className="mt-8 flex justify-center p-4 border rounded-xl bg-gray-50 border-gray-100">
                          <img
                            src={soru.fotograf_url}
                            className="max-w-full rounded-lg shadow-sm cursor-zoom-in"
                            onClick={(e) => window.open(e.target.src, '_blank')}
                            alt="Soru Görseli"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ clear: 'both' }}></div>
                </div>
              )}
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


        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-8">
          {/* REVISION NOTES */}
          {/* REVISION NOTES */}
          {((!isBranchTeacher && effectiveRole !== 'dizgici') || revizeNotlari.length > 0 || ['revize_istendi', 'revize_gerekli'].includes(soru.durum)) && (
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
          )}

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
                    {soru.durum === 'tamamlandi' ? 'TAMAMLANDI ✓' : 'İŞLEMDE'}
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

      {/* FLOATING ANNOTATION UI - CENTERED MODAL */}
      {(selectedText || selectedAnnotation) && canReview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center px-8">
              <h5 className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2"><PlusIcon className="w-5 h-5 text-rose-500" /> Yeni Revize Notu</h5>
              <button onClick={() => { setSelectedText(''); setSelectedAnnotation(null); setRevizeNotuInput(''); }} className="hover:bg-white/10 p-2 rounded-xl transition-all"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 text-indigo-500">
                  {selectedAnnotation?.type === 'box' ? <StopIcon className="w-6 h-6" /> :
                    selectedAnnotation?.type === 'line' ? <MinusIcon className="w-6 h-6" /> :
                      selectedText ? <DocumentTextIcon className="w-6 h-6" /> : <XMarkIcon className="w-6 h-6" />}
                </div>
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">SEÇİLEN {selectedAnnotation ? 'ALAN' : 'KESİT'}</span>
                  {selectedAnnotation ? (
                    <p className="text-sm font-bold text-gray-800">
                      {selectedAnnotation.type === 'box' ? 'Kutu Alanı' : 'Çizgi İşareti'}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-gray-800 line-clamp-3 italic">"{selectedText}"</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">NOTUNUZ</label>
                <textarea
                  autoFocus
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-600 rounded-2xl p-5 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-indigo-600/5 transition-all outline-none resize-none placeholder-gray-300"
                  rows="4"
                  placeholder="Lütfen tespit ettiğiniz hatayı veya düzeltme isteğinizi detaylıca açıklayın..."
                  value={revizeNotuInput}
                  onChange={(e) => setRevizeNotuInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddRevizeNot(); } }}
                />
                <p className="text-[9px] text-gray-400 font-bold text-right px-1">Kaydetmek için ENTER tuşuna basabilirsiniz</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedText(''); setSelectedAnnotation(null); setRevizeNotuInput(''); }}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  İPTAL
                </button>
                <button
                  onClick={handleAddRevizeNot}
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  KAYDET
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

