import { useState, useEffect, useMemo } from 'react';
import { userAPI, ekipAPI, bransAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import {
  UserPlusIcon,
  UserIcon,
  EnvelopeIcon,
  IdentificationIcon,
  BriefcaseIcon,
  CheckBadgeIcon,
  XCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export default function Kullanicilar() {
  const { user } = useAuthStore();
  const [kullanicilar, setKullanicilar] = useState([]);
  const [ekipler, setEkipler] = useState([]);
  const [branslar, setBranslar] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [userResponse, ekipResponse, bransResponse] = await Promise.all([
        userAPI.getAll(),
        ekipAPI.getAll(),
        bransAPI.getAll(),
      ]);
      setKullanicilar(userResponse.data.data || []);
      setEkipler(ekipResponse.data.data || []);
      setBranslar(bransResponse.data.data || []);
    } catch (error) {
      console.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return kullanicilar.filter(u =>
      u.ad_soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [kullanicilar, searchTerm]);

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
      } else {
        if (!payload.sifre) throw new Error('Şifre gerekli');
        await userAPI.adminCreate(payload);
      }

      setShowModal(false);
      setEditingUser(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || error.message || 'İşlem başarısız');
    }
  };

  const handleDelete = async (id) => {
    const kullanici = kullanicilar.find(u => u.id === id);
    if (kullanici?.email === 'servetgenc@windowslive.com') {
      alert('Bu ana yönetici hesabı silinemez!');
      return;
    }
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    try {
      await userAPI.delete(id);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Silme işlemi başarısız');
    }
  };

  const getRolBadge = (kullanici) => {
    let label = '';
    let color = '';
    switch (kullanici.rol) {
      case 'admin': label = 'Admin'; color = 'bg-purple-100 text-purple-700 border-purple-200'; break;
      case 'soru_yazici': label = 'Branş Yazarı'; color = 'bg-blue-50 text-blue-700 border-blue-100'; break;
      case 'koordinator': label = 'Koordinatör'; color = 'bg-rose-50 text-rose-700 border-rose-100'; break;
      case 'dizgici': label = 'Dizgi Ekibi'; color = 'bg-emerald-50 text-emerald-700 border-emerald-100'; break;
      case 'incelemeci':
        if (kullanici.inceleme_dilci && !kullanici.inceleme_alanci) { label = 'Dil İncelemeci'; color = 'bg-teal-50 text-teal-700 border-teal-100'; }
        else if (kullanici.inceleme_alanci && !kullanici.inceleme_dilci) { label = 'Alan İncelemeci'; color = 'bg-indigo-50 text-indigo-700 border-indigo-100'; }
        else { label = 'Genel İncelemeci'; color = 'bg-orange-50 text-orange-700 border-orange-100'; }
        break;
      default: label = kullanici.rol; color = 'bg-gray-100 text-gray-700 border-gray-200';
    }
    return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${color}`}>{label}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Kullanıcı Yönetimi</h1>
          <p className="mt-2 text-gray-500 font-medium">Sistemdeki tüm kullanıcıları, rollerini ve yetkilerini yönetin.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              className="bg-white border border-gray-200 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={handleAddNew}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 py-4 font-black text-sm uppercase tracking-widest transition-all shadow-lg hover:shadow-blue-200 active:scale-95 flex items-center gap-2"
          >
            <UserPlusIcon className="w-5 h-5" />
            Yeni Kullanıcı
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-8 py-5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Kullanıcı</th>
                  <th className="px-6 py-5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Yetki & Rol</th>
                  <th className="px-6 py-5 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Bağlı Olduğu Ekip</th>
                  <th className="px-6 py-5 text-center text-xs font-black text-gray-400 uppercase tracking-widest">Durum</th>
                  <th className="px-8 py-5 text-right text-xs font-black text-gray-400 uppercase tracking-widest">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filteredUsers.map((kullanici) => (
                  <tr key={kullanici.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm ${kullanici.rol === 'admin' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'
                          }`}>
                          {kullanici.ad_soyad.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-black text-gray-900">{kullanici.ad_soyad}</div>
                          <div className="text-xs font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                            <EnvelopeIcon className="w-3.5 h-3.5" />
                            {kullanici.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      {getRolBadge(kullanici)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1.5">
                        <div className="text-xs font-black text-gray-700 uppercase tracking-wide">
                          {kullanici.rol === 'admin' ? <span className="text-purple-600">TÜM EKİPLER (ADMİN)</span> : (kullanici.ekip_adi || '-')}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {kullanici.branslar?.map(b => (
                            <span key={b.id} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold group-hover:bg-white transition-colors">{b.brans_adi}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      <div className="flex justify-center">
                        {kullanici.aktif ? (
                          <div className="flex flex-col items-center">
                            <CheckBadgeIcon className="w-6 h-6 text-green-500" />
                            <span className="text-[10px] font-black text-green-600 uppercase mt-1">AKTİF</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <XCircleIcon className="w-6 h-6 text-red-500 opacity-30" />
                            <span className="text-[10px] font-black text-gray-400 uppercase mt-1 tracking-widest">PASİF</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => handleEdit(kullanici)}
                          className="p-2.5 bg-white border border-gray-100 text-blue-600 hover:text-white hover:bg-blue-600 rounded-xl shadow-sm transition-all"
                          title="Düzenle"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(kullanici.id)}
                          className="p-2.5 bg-white border border-gray-100 text-red-600 hover:text-white hover:bg-red-600 rounded-xl shadow-sm transition-all"
                          title="Sil"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-200 mx-auto" strokeWidth={1} />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm italic">Aranan kriterlere uygun kullanıcı bulunamadı.</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">{editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Kaydı'}</h2>
                <p className="text-gray-400 text-sm font-medium mt-1">Sistem erişim yetkilerini belirleyin.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition">
                <XCircleIcon className="w-6 h-6 text-gray-300" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tam Ad Soyad</label>
                  <div className="relative">
                    <UserIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      placeholder="Örn: Ahmet Yılmaz"
                      value={formData.ad_soyad}
                      onChange={(e) => setFormData({ ...formData, ad_soyad: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">E-Posta Adresi</label>
                  <div className="relative">
                    <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      required
                      type="email"
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      placeholder="kullanici@sistem.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                {!editingUser && (
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Başlangıç Şifresi</label>
                    <div className="relative">
                      <IdentificationIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        value={formData.sifre}
                        onChange={(e) => setFormData({ ...formData, sifre: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {user?.rol === 'admin' && (
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Bağlı Ekip</label>
                    <select
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      value={formData.ekip_id}
                      onChange={(e) => setFormData({ ...formData, ekip_id: e.target.value })}
                    >
                      <option value="">Ekip Seçin</option>
                      {ekipler.map(e => <option key={e.id} value={e.id}>{e.ekip_adi}</option>)}
                    </select>
                  </div>
                )}

                <div className="col-span-1">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Sistem Rolü</label>
                  <select
                    className={`w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all ${formData.email === 'servetgenc@windowslive.com' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    value={formData.rol}
                    onChange={e => setFormData({ ...formData, rol: e.target.value })}
                    disabled={formData.email === 'servetgenc@windowslive.com'}
                  >
                    <option value="soru_yazici">Branş Yazarı</option>
                    <option value="dizgici">Dizgici</option>
                    <option value="incelemeci">İncelemeci</option>
                    <option value="koordinator">Koordinatör</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1 flex justify-between">
                  Yetkili Branşlar
                  <span className="text-blue-500">{formData.brans_ids.length} seçili</span>
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-[1.5rem] p-4 grid grid-cols-2 gap-2 bg-gray-50/50">
                  {branslar.map(b => (
                    <label key={b.id} className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all border ${formData.brans_ids.includes(b.id) ? 'bg-white border-blue-500 shadow-sm' : 'bg-transparent border-transparent'
                      }`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={formData.brans_ids.includes(b.id)}
                        onChange={e => {
                          const newIds = e.target.checked ? [...formData.brans_ids, b.id] : formData.brans_ids.filter(id => id !== b.id);
                          setFormData({ ...formData, brans_ids: newIds, brans_id: newIds[0] || '' });
                        }}
                      />
                      <span className={`text-xs font-black uppercase tracking-tight ${formData.brans_ids.includes(b.id) ? 'text-blue-600' : 'text-gray-400'}`}>
                        {b.brans_adi}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.rol === 'incelemeci' && (
                <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 space-y-4">
                  <p className="text-xs font-black text-blue-800 uppercase tracking-widest leading-none">İnceleme Yetki Sınırları</p>
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-center gap-3 p-4 bg-white rounded-2xl border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors">
                      <input type="checkbox" className="w-5 h-5 rounded-lg text-blue-600" checked={formData.inceleme_alanci} onChange={e => setFormData({ ...formData, inceleme_alanci: e.target.checked })} />
                      <span className="text-sm font-black text-blue-900 uppercase tracking-tight">ALAN</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-3 p-4 bg-white rounded-2xl border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors">
                      <input type="checkbox" className="w-5 h-5 rounded-lg text-blue-600" checked={formData.inceleme_dilci} onChange={e => setFormData({ ...formData, inceleme_dilci: e.target.checked })} />
                      <span className="text-sm font-black text-blue-900 uppercase tracking-tight">DİL</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex-1">
                  <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest">Erişim Durumu</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-bold">Kullanıcı sisteme giriş yapabilsin mi?</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, aktif: !formData.aktif })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.aktif ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.aktif ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl hover:shadow-blue-200 active:scale-95"
                >
                  {editingUser ? 'Güncelle' : 'Kullanıcıyı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div >
      )}
    </div>
  );
}
