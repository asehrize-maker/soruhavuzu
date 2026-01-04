import { Outlet, Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRolBadge = (rol) => {
    const badges = {
      admin: 'bg-purple-100 text-purple-800',
      soru_yazici: 'bg-blue-100 text-blue-800',
      dizgici: 'bg-green-100 text-green-800',
    };
    const labels = {
      admin: 'Admin',
      soru_yazici: 'Soru Yazıcı',
      dizgici: 'Dizgici',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[rol]}`}>
        {labels[rol]}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-bold text-primary-600">
                Soru Havuzu
              </Link>
              
              <nav className="hidden md:flex space-x-4">
                <Link to="/" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                  Ana Sayfa
                </Link>
                <Link to="/sorular" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                  Sorular
                </Link>
                {user?.rol === 'admin' && (
                  <>
                    <Link to="/ekipler" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Ekipler
                    </Link>
                    <Link to="/branslar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Branşlar
                    </Link>
                    <Link to="/kullanicilar" className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">
                      Kullanıcılar
                    </Link>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.ad_soyad}</p>
                <div className="flex items-center justify-end space-x-2">
                  {getRolBadge(user?.rol)}
                  {user?.brans_adi && (
                    <span className="text-xs text-gray-500">{user.brans_adi}</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary text-sm"
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            © 2026 Soru Havuzu Sistemi. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}
