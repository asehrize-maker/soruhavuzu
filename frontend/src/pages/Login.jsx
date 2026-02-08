import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { authAPI } from '../services/api';
import { MegaphoneIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuthStore();
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    sifre: '',
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await authAPI.getConfig();
        if (res.data.success) {
          setConfig(res.data.data);
          if (res.data.data.site_basligi) {
            document.title = res.data.data.site_basligi;
          }
        }
      } catch (err) {
        console.error('Config load error:', err);
      }
    };
    fetchConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(formData);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="w-20 h-20 bg-blue-600 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-6 rotate-3">
            <span className="text-white text-3xl font-black italic">SH</span>
          </div>
          <h2 className="text-center text-4xl font-black text-gray-900 tracking-tight">
            {config?.site_basligi || 'Soru Sistemi'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500 font-medium">
            Profesyonel Soru Yönetim Platformu
          </p>
        </div>

        {config?.duyuru_aktif === 'true' && config?.duyuru_mesaji && (
          <div className="bg-blue-600 rounded-2xl p-4 shadow-lg border border-blue-500 relative overflow-hidden animate-pulse-slow">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <MegaphoneIcon className="w-16 h-16 text-white" />
            </div>
            <div className="flex gap-4 items-start relative z-10">
              <div className="bg-white/20 p-2 rounded-lg">
                <MegaphoneIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1">Duyuru</h4>
                <p className="text-blue-50 text-sm font-medium leading-relaxed">
                  {config.duyuru_mesaji}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-10 rounded-3xl shadow-2xl border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-600"></div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-head-shake">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  E-posta Adresi
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="admin@soruhavuzu.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="sifre" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Parola
                </label>
                <input
                  id="sifre"
                  name="sifre"
                  type="password"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                  value={formData.sifre}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl hover:shadow-2xl active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Bağlanılıyor...' : 'Sisteme Giriş Yap'}
            </button>

            {config?.kayit_acik === 'true' && (
              <div className="text-center pt-4">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                  Erişiminiz yok mu?{' '}
                  <Link to="/register" className="text-blue-600 hover:text-blue-800 transition-colors ml-1">
                    Hemen Kayıt Olun
                  </Link>
                </p>
              </div>
            )}
          </form>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
            {config?.footer_metni || '© 2026 SORU SİSTEMİ'}
          </p>
        </div>
      </div>
    </div>
  );
}
