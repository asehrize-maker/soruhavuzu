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
    fotograf_konumu: 'ust',
    secenek_a: '',
    secenek_b: '',
    secenek_c: '',
    secenek_d: '',
    secenek_e: '',
    dogru_cevap: '',
  });

  // ... (rest of state items: fotograf, previewUrl, dosya, dosyaError)

  // ... (latexTemplates, useEffects, render functions)

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('soru_metni', formData.soru_metni);
      submitData.append('brans_id', formData.brans_id);

      // Yeni alanları ekle
      if (formData.fotograf_konumu) submitData.append('fotograf_konumu', formData.fotograf_konumu);
      if (formData.secenek_a) submitData.append('secenek_a', formData.secenek_a);
      if (formData.secenek_b) submitData.append('secenek_b', formData.secenek_b);
      if (formData.secenek_c) submitData.append('secenek_c', formData.secenek_c);
      if (formData.secenek_d) submitData.append('secenek_d', formData.secenek_d);
      if (formData.secenek_e) submitData.append('secenek_e', formData.secenek_e);
      if (formData.dogru_cevap) submitData.append('dogru_cevap', formData.dogru_cevap);

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

      // ... (logging and API call)

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
          <form onSubmit={handleSubmit} className="card space-y-8 shadow-lg border border-gray-100">
            {/* Soru Metni */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <label htmlFor="soru_metni" className="block text-lg font-bold text-gray-800 mb-2 border-b pb-2">
                1. Soru Metni *
                <span className="text-xs font-normal text-gray-500 ml-2">(Sorunun ana gövdesi)</span>
              </label>
              <textarea
                id="soru_metni"
                name="soru_metni"
                rows="6"
                required
                className="input font-mono text-lg leading-relaxed shadow-sm focus:ring-2 focus:ring-primary-500"
                placeholder="Sorunuzu buraya yazın..."
                value={formData.soru_metni}
                onChange={handleChange}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSoruPreview(!showSoruPreview)}
                  className="text-sm px-4 py-2 bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-md font-medium transition"
                >
                  {showSoruPreview ? 'Önizlemeyi Gizle' : 'Önizlemeyi Göster'}
                </button>
              </div>
              {/* Soru Metni Önizleme */}
              {showSoruPreview && formData.soru_metni && (
                <div className="mt-3 p-4 bg-white rounded-lg border border-primary-200 shadow-inner">
                  <p className="text-xs font-bold text-primary-600 mb-2 uppercase tracking-wide">ÖNİZLEME</p>
                  <div ref={soruPreviewRef} className="prose prose-lg max-w-none text-gray-800">
                    {/* KaTeX renders here */}
                  </div>
                </div>
              )}
            </div>

            {/* Fotoğraf ve Konumu */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <label className="block text-lg font-bold text-blue-900 mb-2 border-b border-blue-200 pb-2">
                2. Görsel Ekleme (Opsiyonel)
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-blue-800 mb-2">
                    Soru Görseli
                  </label>
                  {/* File Upload UI */}
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-blue-300 border-dashed rounded-lg hover:bg-blue-50 transition bg-white">
                    <div className="space-y-1 text-center">
                      {previewUrl ? (
                        <div className="mb-4">
                          <img src={previewUrl} alt="Preview" className="mx-auto max-h-48 rounded shadow-md object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              setFotograf(null);
                              setPreviewUrl(null);
                            }}
                            className="mt-2 text-sm text-red-600 hover:text-red-700 font-bold bg-white px-2 py-1 rounded shadow-sm border"
                          >
                            Görseli Sil
                          </button>
                        </div>
                      ) : (
                        <>
                          <svg className="mx-auto h-12 w-12 text-blue-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="flex text-sm text-gray-600 justify-center">
                            <label htmlFor="fotograf" className="relative cursor-pointer bg-blue-100 px-3 py-1 rounded-md font-bold text-blue-700 hover:text-blue-800 hover:bg-blue-200 transition">
                              <span>Dosya Seç</span>
                              <input
                                id="fotograf"
                                name="fotograf"
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={handleFileChange}
                              />
                            </label>
                          </div>
                          <p className="text-xs text-blue-500 mt-2">PNG, JPG (Max 5MB)</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="fotograf_konumu" className="block text-sm font-semibold text-blue-800 mb-2">
                    Görsel Konumu
                  </label>
                  <select
                    id="fotograf_konumu"
                    name="fotograf_konumu"
                    className="input bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                    value={formData.fotograf_konumu}
                    onChange={handleChange}
                  >
                    <option value="ust">Soru Metninin Üstünde</option>
                    <option value="alt">Soru Metninin Altında</option>
                  </select>
                  <p className="mt-2 text-xs text-blue-600">
                    Öğrenci soruyu görüntülerken görselin metne göre nerede duracağını belirleyin.
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇENEKLER */}
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex justify-between items-center mb-4 border-b border-yellow-200 pb-2">
                <label className="block text-lg font-bold text-yellow-900">
                  3. Şıklar (Seçenekler)
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-gray-700">Doğru Cevap:</span>
                  <select
                    name="dogru_cevap"
                    value={formData.dogru_cevap}
                    onChange={handleChange}
                    className="input py-1 pl-2 pr-8 w-24 border-yellow-400 bg-yellow-100 font-bold text-yellow-900 focus:ring-yellow-500"
                    required
                  >
                    <option value="">Seç</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {['A', 'B', 'C', 'D', 'E'].map((opt) => (
                  <div key={opt} className={`flex items-start p-2 rounded-lg transition-colors ${formData.dogru_cevap === opt ? 'bg-green-100 ring-2 ring-green-400' : 'bg-white hover:bg-gray-50'}`}>
                    <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold mr-3 mt-2 ${formData.dogru_cevap === opt ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {opt}
                    </span>
                    <div className="flex-grow">
                      <textarea
                        name={`secenek_${opt.toLowerCase()}`}
                        rows="2"
                        className="input w-full min-h-[60px] resize-y border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder={`${opt} seçeneğini yazın...`}
                        value={formData[`secenek_${opt.toLowerCase()}`]}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Diğer Bilgiler */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <label className="block text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                4. Diğer Bilgiler
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branş */}
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

                {/* Zorluk */}
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
              </div>

              <div className="mt-4">
                <label htmlFor="kazanim" className="block text-sm font-medium text-gray-700 mb-1">
                  Kazanım
                </label>
                <textarea
                  id="kazanim"
                  name="kazanim"
                  rows="2"
                  className="input"
                  placeholder="Örnek: Doğal sayılarda toplama işlemini kavrar."
                  value={formData.kazanim}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Dosya Ekleme */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              {/* ... (Keep existing file upload logic, just wrapping it in styled div for consistency) ... */}
              {/* I will copy paste the original logic but wrapped */}
              <label className="block text-lg font-bold text-gray-800 mb-2 border-b pb-2">
                5. Ek Dosya (Opsiyonel)
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
                  <div className="flex items-center justify-center px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition bg-white">
                    <div className="text-center">
                      <label className="relative cursor-pointer font-medium text-primary-600 hover:text-primary-500">
                        <span>Ek Dosya Yükle</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={handleDosyaChange}
                        />
                      </label>
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
            <div className="flex justify-end space-x-4 pt-6 border-t mt-4">
              <button
                type="button"
                onClick={() => navigate('/sorular')}
                className="btn btn-secondary px-6 py-3 text-base"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary px-8 py-3 text-base font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition"
              >
                {loading ? 'Kaydediliyor...' : '✓ SORUYU KAYDET'}
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
