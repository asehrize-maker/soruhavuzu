import { useState, useEffect } from 'react';
import { ekipAPI, userAPI } from '../services/api';

export default function Ekipler() {
  const [ekipler, setEkipler] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingEkip, setEditingEkip] = useState(null);
  const [formData, setFormData] = useState({
    ekip_adi: '',
    aciklama: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ekipRes, userRes] = await Promise.all([
        ekipAPI.getAll(),
        userAPI.getAll()
      ]);
      setEkipler(ekipRes.data.data);
      setUsers(userRes.data.data);
    } catch (error) {
      console.error('Veriler yüklenemedi', error);
      alert('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadEkipler = async () => {
    // Reload just teams usually, but users might change teams so better reload all if needed.
    // For simple CRUD, reloading just teams is fine, but if we view details we need fresh users?
    // Users are only assigned via Branslar page now (mostly), so maybe just reload teams is enough for CRUD.
    const response = await ekipAPI.getAll();
    setEkipler(response.data.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEkip) {
        await ekipAPI.update(editingEkip.id, formData);
        alert('Ekip güncellendi!');
      } else {
        await ekipAPI.create(formData);
        alert('Ekip oluşturuldu!');
      }
      setShowModal(false);
      setFormData({ ekip_adi: '', aciklama: '' });
      setEditingEkip(null);
      loadEkipler();
    } catch (error) {
      alert(error.response?.data?.error || 'İşlem başarısız');
    }
  };

  const handleEdit = (ekip) => {
    setEditingEkip(ekip);
    setFormData({
      ekip_adi: ekip.ekip_adi,
      aciklama: ekip.aciklama || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu ekibi silmek istediğinizden emin misiniz?')) return;

    try {
      await ekipAPI.delete(id);
      alert('Ekip silindi');
      loadEkipler();
    } catch (error) {
      alert(error.response?.data?.error || 'Silme işlemi başarısız');
    }
  };

  const openNewModal = () => {
    setEditingEkip(null);
    setFormData({ ekip_adi: '', aciklama: '' });
    setShowModal(true);
  };

  const handleTeamClick = async (ekip) => {
    setSelectedTeam(ekip);
    setShowDetailModal(true);
    // Refresh users to be sure
    try {
      const userRes = await userAPI.getAll();
      setUsers(userRes.data.data);
    } catch (e) { console.error(e); }
  };

  const getTeamUsers = (teamId) => {
    if (!users) return [];
    return users.filter(u => u.ekip_id === teamId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Ekip Yönetimi</h1>
        <button onClick={openNewModal} className="btn btn-primary">
          + Yeni Ekip
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : ekipler.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Henüz ekip yok</h3>
          <p className="mt-1 text-sm text-gray-500">Yeni ekip oluşturun</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ekipler.map((ekip) => (
            <div
              key={ekip.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer relative group"
              onClick={() => handleTeamClick(ekip)}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {ekip.ekip_adi}
                </h3>
                <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEdit(ekip)}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Düzenle"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(ekip.id)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Sil"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {ekip.aciklama && (
                <p className="text-gray-600 text-sm mb-4">{ekip.aciklama}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-gray-100">
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Branş Sayısı</span>
                  <span className="font-semibold text-lg text-gray-800">{ekip.brans_sayisi || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Kullanıcı</span>
                  <span className="font-semibold text-lg text-gray-800">{ekip.kullanici_sayisi || 0}</span>
                </div>
              </div>

              <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/20 rounded-lg pointer-events-none transition-colors"></div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedTeam.ekip_adi}</h2>
                <p className="text-sm text-gray-500 mt-1">Ekip Detayları ve Üyeleri</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-l-4 border-blue-600 pl-3">Ekip Üyeleri</h3>
                {getTeamUsers(selectedTeam.id).length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                    Bu ekipte henüz kayıtlı kullanıcı bulunmuyor.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Soyad</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branş</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getTeamUsers(selectedTeam.id).map(user => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                  {user.ad_soyad.substring(0, 2)}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{user.ad_soyad}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.rol === 'admin' ? 'bg-purple-100 text-purple-800' :
                                user.rol === 'soru_yazici' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                {user.rol === 'admin' ? 'Yönetici' : user.rol === 'soru_yazici' ? 'Branş' : 'Dizgici'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.brans_adi ? (
                                <span className="text-blue-600 font-medium">{user.brans_adi}</span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.email}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
              <button
                onClick={() => setShowDetailModal(false)}
                className="btn btn-secondary"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">
              {editingEkip ? 'Ekip Düzenle' : 'Yeni Ekip'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ekip Adı *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.ekip_adi}
                  onChange={(e) => setFormData({ ...formData, ekip_adi: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  rows="3"
                  className="input"
                  value={formData.aciklama}
                  onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                />
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
                  {editingEkip ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
