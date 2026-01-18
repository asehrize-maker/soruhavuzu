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
    brans_ids: [],
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
      // Eğer seçili branşlar bu ekipte yoksa temizle
      const ekipBransIds = ekipBranslar.map(b => b.id);
      const gecerliBransIds = formData.brans_ids.filter(id => ekipBransIds.includes(id));
      if (gecerliBransIds.length !== formData.brans_ids.length) {
        setFormData(prev => ({
          ...prev,
          brans_ids: gecerliBransIds,
          brans_id: gecerliBransIds[0] || ''
        }));
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
    // Mevcut branşları array olarak al
    const mevcutBransIds = kullanici.branslar && Array.isArray(kullanici.branslar)
      ? kullanici.branslar.map(b => b.id)
      : (kullanici.brans_id ? [kullanici.brans_id] : []);

    setFormData({
      ekip_id: kullanici.ekip_id || '',
      brans_id: kullanici.brans_id || '',
      brans_ids: mevcutBransIds,
      rol: kullanici.rol,
      aktif: kullanici.aktif,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      // Özel Rol Mantığı
      if (formData.rol === 'alan_incelemeci') {
        payload.rol = 'incelemeci';
        payload.inceleme_turu = 'alanci';
      } else if (formData.rol === 'dil_incelemeci') {
        payload.rol = 'incelemeci';
        payload.inceleme_turu = 'dilci';
      }

      await userAPI.update(editingUser.id, payload);
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

  const getRolBadge = (kullanici) => {
    let label = '';
    let color = '';

    switch (kullanici.rol) {
      case 'admin':
        label = 'Admin';
        color = 'bg-purple-100 text-purple-800';
        break;
      case 'soru_yazici':
        label = 'Soru Yazıcı';
        color = 'bg-blue-100 text-blue-800';
        break;
      case 'dizgici':
        label = 'Dizgici';
        color = 'bg-green-100 text-green-800';
        break;
      case 'incelemeci':
        if (kullanici.inceleme_turu === 'dilci') {
          label = 'Dil İncelemeci';
          color = 'bg-teal-100 text-teal-800';
        } else if (kullanici.inceleme_turu === 'alanci') {
          label = 'Alan İncelemeci';
          color = 'bg-indigo-100 text-indigo-800';
        } else {
          label = 'İncelemeci';
          color = 'bg-orange-100 text-orange-800';
        }
        break;
      default:
        label = kullanici.rol;
        color = 'bg-gray-100 text-gray-800';
    }

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        {label}
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
                    {getRolBadge(kullanici)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {kullanici.ekip_adi || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 flex flex-wrap gap-1">
                      {kullanici.branslar && kullanici.branslar.length > 0
                        ? kullanici.branslar.map((b, idx) => (
                          <span key={b.id || idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                            {b.brans_adi}
                          </span>
                        ))
                        : (kullanici.brans_adi || '-')
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${kullanici.aktif
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}
                    >
                      {kullanici.aktif ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleEdit(kullanici)}
                      className="text-blue-600 hover:text-blue-800 mr-4"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDelete(kullanici.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  Branşlar {formData.rol === 'dizgici' && <span className="text-xs text-gray-500">(Birden fazla seçebilirsiniz)</span>}
                </label>
                {!formData.ekip_id ? (
                  <p className="text-xs text-gray-500">Önce ekip seçin</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
                    {filteredBranslar.length === 0 ? (
                      <p className="text-sm text-gray-500">Bu ekipte branş yok</p>
                    ) : (
                      filteredBranslar.map((brans) => (
                        <label key={brans.id} className="flex items-center hover:bg-gray-50 p-1 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            checked={formData.brans_ids.includes(brans.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  brans_ids: [...formData.brans_ids, brans.id],
                                  brans_id: formData.brans_ids.length === 0 ? brans.id : formData.brans_id
                                });
                              } else {
                                const newIds = formData.brans_ids.filter(id => id !== brans.id);
                                setFormData({
                                  ...formData,
                                  brans_ids: newIds,
                                  brans_id: newIds[0] || ''
                                });
                              }
                            }}
                          />
                          <span className="ml-2 text-sm text-gray-700">{brans.brans_adi}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                {formData.brans_ids.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    {formData.brans_ids.length} branş seçili
                  </p>
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
                  <option value="alan_incelemeci">Alan İncelemeci</option>
                  <option value="dil_incelemeci">Dil İncelemeci</option>
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
    </div>
  );
}
