import { useState, useEffect } from 'react';
import { userAPI, ekipAPI, bransAPI } from '../services/api';

export default function Kullanicilar() {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [ekipler, setEkipler] = useState([]);
  const [branslar, setBranslar] = useState([]);
  const [filteredBranslar, setFilteredBranslar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    ekip_id: '',
    brans_id: '',
    rol: '',
    aktif: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.ekip_id) {
      const ekipBranslar = branslar.filter(b => b.ekip_id === parseInt(formData.ekip_id));
      setFilteredBranslar(ekipBranslar);
      // Eğer seçili branş bu ekipte yoksa temizle
      if (formData.brans_id && !ekipBranslar.find(b => b.id === parseInt(formData.brans_id))) {
        setFormData(prev => ({ ...prev, brans_id: '' }));
      }
    } else {
      setFilteredBranslar([]);
    }
  }, [formData.ekip_id, branslar]);

  const loadData = async () => {
    try {
      const [userResponse, ekipResponse, bransResponse] = await Promise.all([
        userAPI.getAll(),
        ekipAPI.getAll(),
        bransAPI.getAll(),
      ]);
      setKullanicilar(userResponse.data.data);
      setEkipler(ekipResponse.data.data);
      setBranslar(bransResponse.data.data);
    } catch (error) {
      alert('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (kullanici) => {
    setEditingUser(kullanici);
    setFormData({
      ekip_id: kullanici.ekip_id || '',
      brans_id: kullanici.brans_id || '',
      rol: kullanici.rol,
      aktif: kullanici.aktif,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await userAPI.update(editingUser.id, formData);
      alert('Kullanıcı güncellendi!');
      setShowModal(false);
      setEditingUser(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Güncelleme başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    
    try {
      await userAPI.delete(id);
      alert('Kullanıcı silindi');
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Silme işlemi başarısız');
    }
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badges[rol]}`}>
        {labels[rol]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : kullanicilar.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Henüz kullanıcı yok</h3>
          <p className="mt-1 text-sm text-gray-500">Kayıt sayfasından yeni kullanıcılar ekleyebilirsiniz</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ad Soyad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ekip
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Branş
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {kullanicilar.map((kullanici) => (
                <tr key={kullanici.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {kullanici.ad_soyad}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{kullanici.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRolBadge(kullanici.rol)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {kullanici.ekip_adi || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-smEdit(kullanici)}
                      className="text-blue-600 hover:text-blue-800 mr-4"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handle text-gray-900">
                      {kullanici.brans_adi || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        kullanici.aktif
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {kullanici.aktif ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleDelete(kullanici.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Sil
                    </button>
                  </td>

      {/* Modal */}
      {showModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">
              Kullanıcı Düzenle: {editingUser.ad_soyad}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ekip
                </label>
                <select
                  className="input"
                  value={formData.ekip_id}
                  onChange={(e) => setFormData({ ...formData, ekip_id: e.target.value })}
                >
                  <option value="">Ekip Seçin</option>
                  {ekipler.map((ekip) => (
                    <option key={ekip.id} value={ekip.id}>
                      {ekip.ekip_adi}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branş
                </label>
                <select
                  className="input"
                  value={formData.brans_id}
                  onChange={(e) => setFormData({ ...formData, brans_id: e.target.value })}
                  disabled={!formData.ekip_id}
                >
                  <option value="">Branş Seçin</option>
                  {filteredBranslar.map((brans) => (
                    <option key={brans.id} value={brans.id}>
                      {brans.brans_adi}
                    </option>
                  ))}
                </select>
                {!formData.ekip_id && (
                  <p className="text-xs text-gray-500 mt-1">Önce ekip seçin</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  className="input"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                >
                  <option value="soru_yazici">Soru Yazıcı</option>
                  <option value="dizgici">Dizgici</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={formData.aktif}
                    onChange={(e) => setFormData({ ...formData, aktif: e.target.checked })}
                  />
                  <span className="ml-2 text-sm text-gray-700">Aktif</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  İptal
                </button>
                <button type="submit" className="btn btn-primary">
                  Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
