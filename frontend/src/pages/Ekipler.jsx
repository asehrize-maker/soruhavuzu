import { useState, useEffect } from 'react';
import { ekipAPI, userAPI } from '../services/api';
import {
  UserGroupIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  UsersIcon,
  BookOpenIcon,
  Squares2X2Icon,
  ArrowPathIcon,
  ChevronRightIcon,
  UserPlusIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';

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

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ekipRes, userRes] = await Promise.all([
        ekipAPI.getAll(),
        userAPI.getAll()
      ]);
      setEkipler(ekipRes.data.data || []);
      setUsers(userRes.data.data || []);
    } catch (error) {
      console.error('Veriler yüklenemedi', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEkipler = async () => {
    const response = await ekipAPI.getAll();
    setEkipler(response.data.data || []);
  };

  const refreshUsers = async () => {
    try {
      const userRes = await userAPI.getAll();
      setUsers(userRes.data.data || []);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEkip) {
        await ekipAPI.update(editingEkip.id, formData);
      } else {
        await ekipAPI.create(formData);
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
    if (!confirm('Bu ekibi (ve bağlı tüm verilerini) silmek istediğinizden emin misiniz?')) return;
    try {
      await ekipAPI.delete(id);
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

  const handleTeamClick = (ekip) => {
    setSelectedTeam(ekip);
    setShowDetailModal(true);
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Bu kullanıcıyı ekipten çıkarmak istediğinize emin misiniz?')) return;
    try {
      await userAPI.update(userId, { ekip_id: null });
      await refreshUsers();
    } catch (error) {
      alert('İşlem başarısız: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddMemberToTeam = async (e) => {
    e.preventDefault();
    if (!selectedUserToAdd || !selectedTeam) return;
    try {
      await userAPI.update(selectedUserToAdd, { ekip_id: selectedTeam.id });
      await refreshUsers();
      setShowAddMemberModal(false);
      setSelectedUserToAdd('');
    } catch (error) {
      alert('Ekleme başarısız: ' + (error.response?.data?.error || error.message));
    }
  };

  const getTeamUsers = (teamId) => {
    if (!users) return [];
    return users.filter(u => u.ekip_id === teamId);
  };

  const getAvailableUsers = () => {
    if (!users) return [];
    return users.filter(u => u.ekip_id !== selectedTeam?.id).sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <UserGroupIcon className="w-12 h-12 text-blue-600" strokeWidth={2} />
            Ekip Yönetimi
          </h1>
          <p className="mt-2 text-gray-500 font-medium">Branşları ve personelleri gruplandırmak için ekipler oluşturun.</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 py-4 font-black text-sm uppercase tracking-widest transition-all shadow-xl hover:shadow-blue-200 active:scale-95 flex items-center gap-2"
        >
          <PlusIcon className="w-6 h-6" strokeWidth={3} />
          Yeni Ekip Oluştur
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-blue-600"></div>
        </div>
      ) : ekipler.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-20 text-center">
          <UserGroupIcon className="w-20 h-20 text-gray-100 mx-auto mb-6" />
          <h3 className="text-xl font-black text-gray-400 uppercase tracking-[0.2em]">Henüz Ekip Tanımı Yok</h3>
          <p className="mt-2 text-gray-400 font-medium italic">Sistemi yapılandırmak için ilk ekibinizi oluşturun.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ekipler.map((ekip) => (
            <div
              key={ekip.id}
              className="bg-white rounded-[2rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-gray-200/50 border border-gray-50 transition-all cursor-pointer group relative overflow-hidden"
              onClick={() => handleTeamClick(ekip)}
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                <UserGroupIcon className="w-24 h-24" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight">
                    {ekip.ekip_adi}
                  </h3>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEdit(ekip)} className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition">
                      <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(ekip.id)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <p className="text-gray-500 text-sm font-medium leading-relaxed italic min-h-[3rem]">
                  {ekip.aciklama || 'Bu ekip için henüz bir açıklama girilmemiş.'}
                </p>

                <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-gray-50">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-1">
                      <BookOpenIcon className="w-3 h-3" /> Branşlar
                    </span>
                    <span className="font-black text-2xl text-gray-800">{ekip.brans_sayisi || 0}</span>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-1 justify-end">
                      <UsersIcon className="w-3 h-3" /> Personeller
                    </span>
                    <span className="font-black text-2xl text-gray-800">{ekip.kullanici_sayisi || 0}</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between text-blue-600 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  <span className="text-xs font-black uppercase tracking-widest">Ekip Detaylarını Gör</span>
                  <ChevronRightIcon className="w-5 h-5" strokeWidth={3} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTeam && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-6">
                <div className="bg-blue-600 text-white p-4 rounded-[1.5rem] shadow-lg shadow-blue-200">
                  <UserGroupIcon className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">{selectedTeam.ekip_adi}</h2>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Ekip Detayları & Mevcut Üyeler</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg hover:shadow-blue-200 active:scale-95 flex items-center gap-2"
                >
                  <UserPlusIcon className="w-5 h-5" />
                  Üye Ekle
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-3 hover:bg-white rounded-2xl transition"
                >
                  <XMarkIcon className="w-7 h-7 text-gray-400" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="p-10 overflow-y-auto no-scrollbar flex-1 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Künye</h4>
                  <p className="text-gray-600 font-bold leading-relaxed">{selectedTeam.aciklama || 'Açıklama girilmemiş.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-50 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Branş Sayısı</span>
                    <span className="text-3xl font-black text-blue-700">{selectedTeam.brans_sayisi || 0}</span>
                  </div>
                  <div className="bg-indigo-50/50 rounded-3xl p-6 border border-indigo-50 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Aktif Personel</span>
                    <span className="text-3xl font-black text-indigo-700">{getTeamUsers(selectedTeam.id).length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <UsersIcon className="w-6 h-6 text-blue-500" />
                  Kayıtlı Personel Listesi
                </h3>

                {getTeamUsers(selectedTeam.id).length === 0 ? (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2rem] p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-sm italic">
                    Erişim yetkisi olan herhangi bir personel bulunamadı.
                  </div>
                ) : (
                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-50">
                      <thead className="bg-gray-100/50">
                        <tr>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Kullanıcı</th>
                          <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Sistem Rolü</th>
                          <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Ana Branşı</th>
                          <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Eylem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {getTeamUsers(selectedTeam.id).map(user => (
                          <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center font-black text-xs uppercase">
                                  {user.ad_soyad.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-sm font-black text-gray-900">{user.ad_soyad}</div>
                                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 bg-blue-50 text-blue-700`}>
                                {user.rol === 'admin' ? 'Yönetici' : user.rol === 'soru_yazici' ? 'Branş' : user.rol}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <span className="text-sm font-bold text-gray-600">{user.brans_adi || '-'}</span>
                            </td>
                            <td className="px-8 py-5 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleRemoveMember(user.id)}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                              >
                                EKİPTEN ÇIKAR
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowDetailModal(false)} className="px-10 py-4 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all">
                KAPAT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-8">Ekibe Üye Dahil Et</h3>
            <form onSubmit={handleAddMemberToTeam} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Personel Seçin</label>
                <select
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  value={selectedUserToAdd}
                  onChange={e => setSelectedUserToAdd(e.target.value)}
                  required
                >
                  <option value="">Seçiniz...</option>
                  {getAvailableUsers().map(u => (
                    <option key={u.id} value={u.id}>
                      {u.ad_soyad} ({u.ekip_adi ? `Aktif: ${u.ekip_adi}` : 'EKİPSİZ'})
                    </option>
                  ))}
                </select>

              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowAddMemberModal(false)} className="flex-1 px-4 py-4 bg-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest">İptal</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white rounded-2xl py-4 font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-200">EKLE</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl border border-gray-100 animate-scale-up">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-8 flex items-center gap-3">
              <Squares2X2Icon className="w-8 h-8 text-blue-600" />
              {editingEkip ? 'Ekibi Güncelle' : 'Yeni Ekip Tanımı'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Ekip Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Sivas İl Milli Eğitim"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  value={formData.ekip_adi}
                  onChange={(e) => setFormData({ ...formData, ekip_adi: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Ekip Misyonu / Açıklama</label>
                <textarea
                  rows="4"
                  placeholder="Ekip hakkında kısa bir tanıtım girin..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-3xl px-6 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  value={formData.aciklama}
                  onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-4 bg-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                >
                  VAZGEÇ
                </button>
                <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl hover:shadow-blue-200 active:scale-95 flex items-center justify-center gap-2">
                  <CloudArrowUpIcon className="w-5 h-5" />
                  {editingEkip ? 'Ayarları Güncelle' : 'Ekibi Sisteme Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
