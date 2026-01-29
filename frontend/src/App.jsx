import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Sorular from './pages/Sorular';
import BransHavuzu from './pages/BransHavuzu';
import SoruDetay from './pages/SoruDetay';
import SoruEkle from './pages/SoruEkle';
import Ekipler from './pages/Ekipler';
import Branslar from './pages/Branslar';
import Kullanicilar from './pages/Kullanicilar';
import DizgiYonetimi from './pages/DizgiYonetimi';
import Mesajlar from './pages/Mesajlar';
import Raporlar from './pages/Raporlar';
import Duyurular from './pages/Duyurular';
import Logs from './pages/Logs';
import Ajanda from './pages/Ajanda';
import Settings from './pages/Settings';
import TestBuilder from './pages/TestBuilder';
import Denemeler from './pages/Denemeler';
import Layout from './components/Layout';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const role = useAuthStore((state) => state.viewRole || state.user?.rol);
  return role === 'admin' ? children : <Navigate to="/" />;
}

function ManagementRoute({ children }) {
  const role = useAuthStore((state) => state.viewRole || state.user?.rol);
  return (role === 'admin' || role === 'koordinator') ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="sorular" element={<Sorular />} />
        <Route path="brans-havuzu" element={<BransHavuzu />} />
        <Route path="sorular/yeni" element={<SoruEkle />} />
        <Route path="sorular/:id" element={<SoruDetay />} />
        <Route path="test-builder" element={<TestBuilder />} />
        <Route path="mesajlar" element={<Mesajlar />} />
        <Route path="dizgi-yonetimi" element={<DizgiYonetimi />} />
        <Route path="denemeler" element={<Denemeler />} />

        <Route path="ekipler" element={
          <AdminRoute>
            <Ekipler />
          </AdminRoute>
        } />
        <Route path="branslar" element={
          <AdminRoute>
            <Branslar />
          </AdminRoute>
        } />
        <Route path="kullanicilar" element={
          <ManagementRoute>
            <Kullanicilar />
          </ManagementRoute>
        } />
        <Route path="raporlar" element={
          <ManagementRoute>
            <Raporlar />
          </ManagementRoute>
        } />
        <Route path="duyurular" element={
          <ManagementRoute>
            <Duyurular />
          </ManagementRoute>
        } />
        <Route path="logs" element={
          <AdminRoute>
            <Logs />
          </AdminRoute>
        } />
        <Route path="ajanda" element={
          <ManagementRoute>
            <Ajanda />
          </ManagementRoute>
        } />
        <Route path="settings" element={
          <AdminRoute>
            <Settings />
          </AdminRoute>
        } />
      </Route>
    </Routes>
  );
}

export default App;
