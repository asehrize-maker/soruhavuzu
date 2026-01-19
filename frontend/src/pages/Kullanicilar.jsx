import { useState, useEffect, useMemo } from 'react';
import { userAPI, ekipAPI, bransAPI } from '../services/api';

export default function Kullanicilar() {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [ekipler, setEkipler] = useState([]);
  const [branslar, setBranslar] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    ad_soyad: '',
    email: '',
    sifre: '',
    ekip_id: '',
    brans_id: '',
    brans_ids: [],
    rol: 'soru_yazici',
    inceleme_alanci: false,
    inceleme_dilci: false,
    aktif: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const filteredBranslar = useMemo(() => {
    if (!formData.ekip_id) return [];
    return branslar.filter(b => String(b.ekip_id) === String(formData.ekip_id));
  }, [formData.ekip_id, branslar]);

  // Branş seçimlerini ekip değiştiğinde temizle/doğrula
  useEffect(() => {
    if (formData.ekip_id) {
      const ekipBransIds = filteredBranslar.map(b => b.id);
      const gecerliBransIds = formData.brans_ids.filter(id => ekipBransIds.includes(id));
      if (gecerliBransIds.length !== formData.brans_ids.length) {
        setFormData(prev => ({
          ...prev,
          brans_ids: gecerliBransIds,
          brans_id: gecerliBransIds[0] || ''
        }));
      }
    }
  }, [formData.ekip_id, filteredBranslar]);

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
    const mevcutBransIds = kullanici.branslar && Array.isArray(kullanici.branslar)
      ? kullanici.branslar.map(b => b.id)
      : (kullanici.brans_id ? [kullanici.brans_id] : []);

    setFormData({
      ad_soyad: kullanici.ad_soyad || '',
      email: kullanici.email || '',
      sifre: '',
      ekip_id: kullanici.ekip_id || '',
      brans_id: kullanici.brans_id || '',
      brans_ids: mevcutBransIds,
      rol: kullanici.rol,
      inceleme_alanci: !!kullanici.inceleme_alanci,
      inceleme_dilci: !!kullanici.inceleme_dilci,
      aktif: kullanici.aktif,
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setFormData({
      ad_soyad: '',
      email: '',
      sifre: '123456',
      ekip_id: '',
      brans_id: '',
      brans_ids: [],
      rol: 'soru_yazici',
      inceleme_alanci: false,
      inceleme_dilci: false,
      aktif: true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      if (payload.rol !== 'incelemeci') {
        payload.inceleme_alanci = false;
        payload.inceleme_dilci = false;
      }

      if (editingUser) {
        await userAPI.update(editingUser.id, payload);
        alert('Kullanıcı güncellendi!');
      } else {
        if (!payload.sifre) throw new Error('Şifre gerekli');
        await userAPI.adminCreate(payload);
        alert('Kullanıcı oluşturuldu!');
      }

      setShowModal(false);
      setEditingUser(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || error.message || 'İşlem başarısız');
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
      case 'admin': label = 'Admin'; color = 'bg-purple-100 text-purple-800'; break;
      case 'soru_yazici': label = 'Soru Yazıcı'; color = 'bg-blue-100 text-blue-800'; break;
      case 'dizgici': label = 'Dizgici'; color = 'bg-green-100 text-green-800'; break;
      case 'incelemeci':
        if (kullanici.inceleme_dilci && !kullanici.inceleme_alanci) { label = 'Dil İncelemeci'; color = 'bg-teal-100 text-teal-800'; }
        else if (kullanici.inceleme_alanci && !kullanici.inceleme_dilci) { label = 'Alan İncelemeci'; color = 'bg-indigo-100 text-indigo-800'; }
        else { label = 'İncelemeci'; color = 'bg-orange-100 text-orange-800'; }
        break;
      default: label = kullanici.rol; color = 'bg-gray-100 text-gray-800';
    }
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
        <button onClick={handleAddNew} className="btn btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Kullanıcı Ekle
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ad Soyad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ekip/Branş</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {kullanicilar.map((kullanici) => (
                <tr key={kullanici.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{kullanici.ad_soyad}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kullanici.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getRolBadge(kullanici)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-bold">{kullanici.ekip_adi || '-'}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {kullanici.branslar?.map(b => (
                        <span key={b.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">{b.brans_adi}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${kullanici.aktif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {kullanici.aktif ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button onClick={() => handleEdit(kullanici)} className="text-blue-600 hover:text-blue-800 mr-4">Düzenle</button>
                    <button onClick={() => handleDelete(kullanici.id)} className="text-red-600 hover:text-red-800">Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                <input required className="input" value={formData.ad_soyad} onChange={(e) => setFormData({ ...formData, ad_soyad: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input required type="email" className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                  <input required className="input" value={formData.sifre} onChange={(e) => setFormData({ ...formData, sifre: e.target.value })} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ekip</label>
                <select className="input" value={formData.ekip_id} onChange={(e) => setFormData({ ...formData, ekip_id: e.target.value })}>
                  <option value="">Ekip Seçin</option>
                  {ekipler.map(e => <option key={e.id} value={e.id}>{e.ekip_adi}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branşlar</label>
                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                  {filteredBranslar.map(b => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                      <input type="checkbox" checked={formData.brans_ids.includes(b.id)} onChange={e => {
                        const newIds = e.target.checked ? [...formData.brans_ids, b.id] : formData.brans_ids.filter(id => id !== b.id);
                        setFormData({ ...formData, brans_ids: newIds, brans_id: newIds[0] || '' });
                      }} />
                      <span className="text-sm">{b.brans_adi}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select className="input" value={formData.rol} onChange={e => setFormData({ ...formData, rol: e.target.value })}>
                  <option value="soru_yazici">Soru Yazıcı</option>
                  <option value="dizgici">Dizgici</option>
                  <option value="incelemeci">İncelemeci</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {formData.rol === 'incelemeci' && (
                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">İnceleme Yetkileri</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.inceleme_alanci} onChange={e => setFormData({ ...formData, inceleme_alanci: e.target.checked })} />
                    <span className="text-sm">Alan İncelemesi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.inceleme_dilci} onChange={e => setFormData({ ...formData, inceleme_dilci: e.target.checked })} />
                    <span className="text-sm">Dil İncelemesi</span>
                  </label>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={formData.aktif} onChange={e => setFormData({ ...formData, aktif: e.target.checked })} />
                <label className="text-sm">Aktif Kullanıcı</label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">İptal</button>
                <button type="submit" className="btn btn-primary">{editingUser ? 'Güncelle' : 'Oluştur'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
