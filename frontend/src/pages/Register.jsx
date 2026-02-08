import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function Register() {
  const navigate = useNavigate();
  const { register, loading, error } = useAuthStore();
  const [formData, setFormData] = useState({
    ad_soyad: '',
    email: '',
    sifre: '',
    rol: 'soru_yazici',
    admin_secret: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await register(formData);
    if (result.success) {
      navigate('/');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Kayıt Ol
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Yeni hesap oluşturun
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="ad_soyad" className="block text-sm font-medium text-gray-700 mb-1">
                Ad Soyad
              </label>
              <input
                id="ad_soyad"
                name="ad_soyad"
                type="text"
                required
                className="input"
                value={formData.ad_soyad}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="sifre" className="block text-sm font-medium text-gray-700 mb-1">
                Şifre
              </label>
              <input
                id="sifre"
                name="sifre"
                type="password"
                required
                className="input"
                value={formData.sifre}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="rol" className="block text-sm font-medium text-gray-700 mb-1">
                Rol
              </label>
              <select
                id="rol"
                name="rol"
                className="input"
                value={formData.rol}
                onChange={handleChange}
              >
                <option value="soru_yazici">Branş</option>
                <option value="dizgici">Dizgici</option>
                <option value="incelemeci">İncelemeci</option>
                <option value="admin">Yönetici</option>
              </select>
            </div>

            {formData.rol === 'incelemeci' && (
              <div>
                <label htmlFor="inceleme_turu" className="block text-sm font-medium text-gray-700 mb-1">
                  İnceleme Türü
                </label>
                <select
                  id="inceleme_turu"
                  name="inceleme_turu"
                  className="input"
                  value={formData.inceleme_turu || 'alanci'}
                  onChange={handleChange}
                >
                  <option value="alanci">Alan Uzmanı</option>
                  <option value="dilci">Dil Uzmanı</option>
                </select>
              </div>
            )}

            {formData.rol === 'admin' && (
              <div>
                <label htmlFor="admin_secret" className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Secret
                </label>
                <input
                  id="admin_secret"
                  name="admin_secret"
                  type="password"
                  required
                  className="input"
                  value={formData.admin_secret}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
            <p className="font-medium mb-1">📝 Önemli Not:</p>
            <p>Kayıt olduktan sonra yönetici; ekip ve branş ataması yapacaktır.</p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary"
            >
              {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Zaten hesabınız var mı?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Giriş yapın
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
