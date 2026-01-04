import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [branslar, setBranslar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    soru_metni: '',
    zorluk_seviyesi: '',
    brans_id: user?.brans_id || '',
  });
  const [fotograf, setFotograf] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (user?.rol === 'admin') {
      loadBranslar();
    }
  }, [user]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('soru_metni', formData.soru_metni);
      submitData.append('brans_id', formData.brans_id);
      if (formData.zorluk_seviyesi) {
        submitData.append('zorluk_seviyesi', formData.zorluk_seviyesi);
      }
      if (fotograf) {
        submitData.append('fotograf', fotograf);
      }

      await soruAPI.create(submitData);
      alert('Soru başarıyla eklendi!');
      navigate('/sorular');
    } catch (error) {
      alert(error.response?.data?.error || 'Soru eklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Yeni Soru Ekle</h1>
        <p className="mt-2 text-gray-600">Sisteme yeni bir soru ekleyin</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label htmlFor="soru_metni" className="block text-sm font-medium text-gray-700 mb-1">
            Soru Metni *
          </label>
          <textarea
            id="soru_metni"
            name="soru_metni"
            rows="6"
            required
            className="input"
            placeholder="Soru metnini buraya yazın..."
            value={formData.soru_metni}
            onChange={handleChange}
          />
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fotoğraf
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
            <div className="space-y-1 text-center">
              {previewUrl ? (
                <div className="mb-4">
                  <img src={previewUrl} alt="Preview" className="mx-auto max-h-64 rounded" />
                  <button
                    type="button"
                    onClick={() => {
                      setFotograf(null);
                      setPreviewUrl(null);
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-700"
                  >
                    Kaldır
                  </button>
                </div>
              ) : (
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <div className="flex text-sm text-gray-600">
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
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
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
            {loading ? 'Ekleniyor...' : 'Soru Ekle'}
          </button>
        </div>
      </form>
    </div>
  );
}
