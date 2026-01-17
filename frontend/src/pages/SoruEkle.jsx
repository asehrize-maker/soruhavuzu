import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [branslar, setBranslar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const latexRef = useRef(null);
  const previewRef = useRef(null);
  const soruPreviewRef = useRef(null);
  const [showSoruPreview, setShowSoruPreview] = useState(false);
  const [formData, setFormData] = useState({
    soru_metni: '',
    latex_kodu: '',
    kazanim: '',
    zorluk_seviyesi: '',
    brans_id: user?.brans_id || '',
  });
  const [fotograf, setFotograf] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dosya, setDosya] = useState(null);
  const [dosyaError, setDosyaError] = useState('');

  // LaTeX Şablonları
  const latexTemplates = [
    { name: 'Kesir', code: '\\frac{pay}{payda}' },
    { name: 'Karekök', code: '\\sqrt{sayı}' },
    { name: 'Üs', code: 'x^{üs}' },
    { name: 'Alt İndis', code: 'x_{alt}' },
    { name: 'Toplam', code: '\\sum_{i=1}^{n} x_i' },
    { name: 'İntegral', code: '\\int_{a}^{b} f(x) dx' },
    { name: 'Limit', code: '\\lim_{x \\to \\infty} f(x)' },
    { name: 'Matris', code: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
    { name: 'Pi', code: '\\pi' },
    { name: 'Alfa', code: '\\alpha' },
    { name: 'Beta', code: '\\beta' },
    { name: 'Theta', code: '\\theta' },
    { name: 'Eşit Değil', code: '\\neq' },
    { name: 'Yaklaşık', code: '\\approx' },
    { name: 'Küçük Eşit', code: '\\leq' },
    { name: 'Büyük Eşit', code: '\\geq' },
  ];

  useEffect(() => {
    if (user?.rol === 'admin') {
      loadBranslar();
    }
  }, [user]);

  // LaTeX render for preview
  useEffect(() => {
    if (showPreview && formData.latex_kodu && previewRef.current) {
      renderLatexPreview();
    }
  }, [showPreview, formData.latex_kodu]);

  // Soru metni LaTeX preview
  useEffect(() => {
    if (showSoruPreview && formData.soru_metni && soruPreviewRef.current) {
      renderSoruPreview();
    }
  }, [showSoruPreview, formData.soru_metni]);

  const renderLatexContent = (content) => {
    let html = content;

    // Display math ($$...$$) önce işlenmeli (inline'dan önce)
    html = html.replace(/\$\$([^\$]+)\$\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        return `<span class="text-red-500">${match}</span>`;
      }
    });

    // Inline math ($...$) işleme
    html = html.replace(/\$([^\$]+)\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (e) {
        return `<span class="text-red-500">${match}</span>`;
      }
    });

    return html;
  };

  const renderSoruPreview = () => {
    if (!soruPreviewRef.current) return;

    try {
      soruPreviewRef.current.innerHTML = renderLatexContent(formData.soru_metni);
    } catch (error) {
      console.error('LaTeX rendering error:', error);
      soruPreviewRef.current.textContent = formData.soru_metni;
    }
  };

  const renderLatexPreview = () => {
    if (!previewRef.current) return;

    try {
      previewRef.current.innerHTML = renderLatexContent(formData.latex_kodu);
    } catch (error) {
      console.error('LaTeX rendering error:', error);
      previewRef.current.textContent = formData.latex_kodu;
    }
  };

  const loadBranslar = async () => {
    try {
      const response = await bransAPI.getAll();
      setBranslar(response.data.data);
    } catch (error) {
      console.error('Branşlar yüklenemedi:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const insertLatex = (template) => {
    const textarea = latexRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.latex_kodu;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + template + after;
    setFormData({ ...formData, latex_kodu: newText });

    // Cursor'ı template'in sonuna taşı
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + template.length, start + template.length);
    }, 0);
  };

  const wrapWithDelimiters = (type) => {
    const textarea = latexRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.latex_kodu;
    const selectedText = text.substring(start, end);

    let wrapped;
    if (type === 'inline') {
      wrapped = `$${selectedText}$`;
    } else {
      wrapped = `$$\n${selectedText}\n$$`;
    }

    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + wrapped + after;

    setFormData({ ...formData, latex_kodu: newText });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFotograf(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDosyaChange = (e) => {
    const file = e.target.files[0];
    setDosyaError('');

    if (file) {
      // 1MB limit kontrolü
      if (file.size > 1 * 1024 * 1024) {
        setDosyaError('Dosya boyutu 1MB\'dan büyük olamaz');
        setDosya(null);
        e.target.value = '';
        return;
      }

      // Dosya tipi kontrolü
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        setDosyaError('Sadece PDF, Word, Excel veya TXT dosyaları yüklenebilir');
        setDosya(null);
        e.target.value = '';
        return;
      }

      console.log('Dosya seçildi:', file.name, file.type, file.size);
      setDosya(file);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('soru_metni', formData.soru_metni);
      submitData.append('brans_id', formData.brans_id);
      if (formData.latex_kodu) {
        submitData.append('latex_kodu', formData.latex_kodu);
      }
      if (formData.kazanim) {
        submitData.append('kazanim', formData.kazanim);
      }
      if (formData.zorluk_seviyesi) {
        submitData.append('zorluk_seviyesi', formData.zorluk_seviyesi);
      }
      if (fotograf) {
        console.log('Fotoğraf ekleniyor:', fotograf.name);
        submitData.append('fotograf', fotograf);
      }
      if (dosya) {
        console.log('Dosya ekleniyor:', dosya.name, dosya.type, dosya.size);
        submitData.append('dosya', dosya);
      }

      // FormData içeriğini logla
      console.log('FormData içeriği:');
      for (let pair of submitData.entries()) {
        console.log(pair[0], pair[1]);
      }

      const response = await soruAPI.create(submitData);
      console.log('Sunucu yanıtı:', response.data);
      alert('Soru başarıyla eklendi!');
      navigate('/sorular');
    } catch (error) {
      console.error('Hata detayı:', error.response?.data);
      alert(error.response?.data?.error || 'Soru eklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Yeni Soru Ekle</h1>
          <p className="mt-2 text-gray-600">Sisteme yeni bir soru ekleyin</p>
        </div>
        <button
          onClick={() => navigate('/sorular')}
          className="btn btn-secondary"
        >
          ← Geri
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ana Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card space-y-6">
            {/* Soru Metni */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="soru_metni" className="block text-sm font-medium text-gray-700">
                  Soru Metni *
                  <span className="text-xs text-gray-500 ml-2">(LaTeX destekli)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowSoruPreview(!showSoruPreview)}
                  className="text-xs px-3 py-1 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded"
                >
                  {showSoruPreview ? '✕ Önizlemeyi Kapat' : '👁️ Önizleme'}
                </button>
              </div>
              <textarea
                id="soru_metni"
                name="soru_metni"
                rows="6"
                required
                className="input font-mono"
                placeholder="Örnek: Bir dairenin alanı $A = \\pi r^2$ formülü ile hesaplanır. Çevresi ise $$C = 2\\pi r$$ olarak bulunur."
                value={formData.soru_metni}
                onChange={handleChange}
              />

              {/* Soru Metni Önizleme */}
              {showSoruPreview && formData.soru_metni && (
                <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border-2 border-green-200 shadow-sm">
                  <p className="text-sm font-semibold text-green-700 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Soru Önizlemesi
                  </p>
                  <div ref={soruPreviewRef} className="prose prose-sm max-w-none bg-white p-4 rounded border border-green-100 text-base leading-relaxed">
                    {/* KaTeX renders here */}
                  </div>
                </div>
              )}
            </div>

            {/* LaTeX Editör */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  LaTeX Formülleri (Matematik için)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    {showTemplates ? 'Şablonları Gizle' : 'Şablonları Göster'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    {showPreview ? 'Önizlemeyi Gizle' : 'Önizleme'}
                  </button>
                </div>
              </div>

              {/* LaTeX Toolbar */}
              <div className="mb-2 flex flex-wrap gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <button
                  type="button"
                  onClick={() => wrapWithDelimiters('inline')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Satır içi formül ($...$)"
                >
                  $ $
                </button>
                <button
                  type="button"
                  onClick={() => wrapWithDelimiters('block')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Blok formül ($$...$$)"
                >
                  $$ $$
                </button>
                <div className="border-l border-gray-300 mx-1"></div>
                <button
                  type="button"
                  onClick={() => insertLatex('\\frac{}{}')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Kesir"
                >
                  a/b
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('\\sqrt{}')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Karekök"
                >
                  √
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('^{}')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Üst simge"
                >
                  x²
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('_{}')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Alt simge"
                >
                  x₁
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('\\sum_{i=1}^{n}')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Toplam"
                >
                  Σ
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('\\int')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="İntegral"
                >
                  ∫
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('\\pi')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                  title="Pi"
                >
                  π
                </button>
              </div>

              <textarea
                ref={latexRef}
                id="latex_kodu"
                name="latex_kodu"
                rows="8"
                className="input font-mono text-sm"
                placeholder="Örnek: Bir dairenin alanı $$A = \\pi r^2$$ formülü ile hesaplanır."
                value={formData.latex_kodu}
                onChange={handleChange}
              />

              {/* LaTeX Önizleme */}
              {showPreview && formData.latex_kodu && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Önizleme:</p>
                  <div className="prose prose-sm">
                    {formData.latex_kodu}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Not: Gerçek LaTeX render'ı soru detay sayfasında KaTeX ile görüntülenecektir.
                  </p>
                </div>
              )}
            </div>

            {/* Branş (Admin için) */}
            {user?.rol === 'admin' && (
              <div>
                <label htmlFor="brans_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Branş *
                </label>
                <select
                  id="brans_id"
                  name="brans_id"
                  required
                  className="input"
                  value={formData.brans_id}
                  onChange={handleChange}
                >
                  <option value="">Branş Seçin</option>
                  {branslar.map((brans) => (
                    <option key={brans.id} value={brans.id}>
                      {brans.brans_adi} ({brans.ekip_adi})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Kazanım */}
            <div>
              <label htmlFor="kazanim" className="block text-sm font-medium text-gray-700 mb-1">
                Kazanım
              </label>
              <textarea
                id="kazanim"
                name="kazanim"
                rows="3"
                className="input"
                placeholder="Örnek: Doğal sayılarda toplama ve çıkarma işlemlerini yapar."
                value={formData.kazanim}
                onChange={handleChange}
              />
              <p className="mt-1 text-xs text-gray-500">Bu sorunun hangi kazanımı ölçtüğünü yazınız</p>
            </div>

            {/* Zorluk Seviyesi */}
            <div>
              <label htmlFor="zorluk_seviyesi" className="block text-sm font-medium text-gray-700 mb-1">
                Zorluk Seviyesi
              </label>
              <select
                id="zorluk_seviyesi"
                name="zorluk_seviyesi"
                className="input"
                value={formData.zorluk_seviyesi}
                onChange={handleChange}
              >
                <option value="">Seçiniz</option>
                <option value="kolay">Kolay</option>
                <option value="orta">Orta</option>
                <option value="zor">Zor</option>
              </select>
            </div>

            {/* Fotoğraf */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Soru Fotoğrafı
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-primary-400 transition">
                <div className="space-y-1 text-center">
                  {previewUrl ? (
                    <div className="mb-4">
                      <img src={previewUrl} alt="Preview" className="mx-auto max-h-64 rounded shadow-md" />
                      <button
                        type="button"
                        onClick={() => {
                          setFotograf(null);
                          setPreviewUrl(null);
                        }}
                        className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        × Kaldır
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label htmlFor="fotograf" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                          <span>Fotoğraf yükle</span>
                          <input
                            id="fotograf"
                            name="fotograf"
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </label>
                        <p className="pl-1">veya sürükle bırak</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF max 5MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Dosya Ekleme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📎 Ek Dosya <span className="text-xs text-gray-500">(Opsiyonel)</span>
              </label>
              <div className="mt-1">
                {dosya ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{dosya.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(dosya.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDosya(null)}
                      className="text-red-600 hover:text-red-700 font-medium text-sm"
                    >
                      × Kaldır
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center px-6 py-4 border-2 border-gray-300 border-dashed rounded-lg hover:border-primary-400 transition">
                    <div className="text-center">
                      <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <div className="flex text-sm text-gray-600 justify-center mt-2">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                          <span>Dosya yükle</span>
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                            onChange={handleDosyaChange}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">PDF, Word, Excel, TXT - max 1MB</p>
                    </div>
                  </div>
                )}
                {dosyaError && (
                  <p className="mt-2 text-sm text-red-600">{dosyaError}</p>
                )}
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => navigate('/sorular')}
                className="btn btn-secondary"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Kaydediliyor...' : '✓ Soru Ekle'}
              </button>
            </div>
          </form>
        </div>

        {/* Yan Panel - Yardım & Şablonlar */}
        <div className="lg:col-span-1 space-y-4">
          {/* LaTeX Şablonları */}
          {showTemplates && (
            <div className="card">
              <h3 className="font-bold text-lg mb-3">LaTeX Şablonları</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {latexTemplates.map((template, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => insertLatex(template.code)}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-primary-50 rounded border border-gray-200 hover:border-primary-300 transition"
                  >
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <code className="text-xs text-gray-600">{template.code}</code>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Yardım */}
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-2">💡 İpuçları</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Matematiksel formülleri LaTeX ile yazabilirsiniz</li>
              <li>• Toolbar butonlarını kullanarak hızlıca ekleme yapın</li>
              <li>• Satır içi formül: <code className="bg-blue-100 px-1 rounded">$x^2$</code></li>
              <li>• Blok formül: <code className="bg-blue-100 px-1 rounded">$$x^2$$</code></li>
              <li>• Fotoğraf yükleyerek görsel soru ekleyebilirsiniz</li>
            </ul>
          </div>

          {/* Örnek Kullanımlar */}
          <div className="card bg-green-50 border-green-200">
            <h3 className="font-bold text-green-900 mb-2">📝 Örnek Kullanımlar</h3>
            <div className="text-sm text-green-800 space-y-3">
              <div>
                <p className="font-medium">Denklem:</p>
                <code className="text-xs bg-green-100 px-2 py-1 rounded block mt-1">
                  $$x = \frac{"{-b \\pm \\sqrt{b^2-4ac}}{2a}"}$$
                </code>
              </div>
              <div>
                <p className="font-medium">Limit:</p>
                <code className="text-xs bg-green-100 px-2 py-1 rounded block mt-1">
                  $$\lim_{"{x \\to 0}"} \frac{"{\\sin x}{x}"} = 1$$
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
