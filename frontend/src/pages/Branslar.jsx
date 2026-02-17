import { useState, useEffect } from 'react';
import { bransAPI, userAPI, ekipAPI, authAPI } from '../services/api';
import {
  AcademicCapIcon,
  PlusIcon,
  CloudArrowUpIcon,
  FolderArrowDownIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronRightIcon,
  UserPlusIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  IdentificationIcon,
  BookOpenIcon,
  EnvelopeIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const BRANCH_COLORS = [
  'from-rose-500 to-rose-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-blue-500 to-blue-600',
  'from-violet-500 to-violet-600',
  'from-indigo-500 to-indigo-600',
  'from-cyan-500 to-cyan-600',
  'from-teal-500 to-teal-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600'
];

const BRANCH_ICONS = {
  'TÜRKÇE': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'FEN BİLİMLERİ': 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  'SOSYAL BİLGİLER': 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'MATEMATİK': 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  'İNGİLİZCE': 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
  'DEFAULT': 'M12 6.03a6.03 6.03 0 100 12.06 6.03 6.03 0 000-12.06zM2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.154-1.262a.5.5 0 00.153-.081l.37-.37a9.042 9.042 0 01-1.094-1.094l-.37.37a.5.5 0 00-.081.153zM21.305 14.763l1.262 3.154a.5.5 0 01-.65.65l-3.154-1.262a.5.5 0 01-.153-.081l-.37-.37a9.042 9.042 0 001.094-1.094l.37.37a.5.5 0 01.081.153z'
};

export default function Branslar() {
  const [branslar, setBranslar] = useState([]);
  const [users, setUsers] = useState([]);
  const [ekipler, setEkipler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [importBranchId, setImportBranchId] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  // New User Form State
  const [newUser, setNewUser] = useState({ ad_soyad: '', email: '', sifre: '' });
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'create'
  const [selectedRole, setSelectedRole] = useState('soru_yazici');
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [showAddBranchForm, setShowAddBranchForm] = useState(false);
  const [newBranchData, setNewBranchData] = useState({ brans_adi: '', aciklama: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bransResponse, userResponse, ekipResponse] = await Promise.all([
        bransAPI.getAll(),
        userAPI.getAll(),
        ekipAPI.getAll(),
      ]);
      setBranslar(bransResponse.data.data || []);
      setUsers(userResponse.data.data || []);
      setEkipler(ekipResponse.data.data || []);
      if (!importBranchId && bransResponse.data.data?.length > 0) {
        setImportBranchId(String(bransResponse.data.data[0].id));
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importBranchId || !importFile) {
      alert('Branş ve Excel dosyası seçin');
      return;
    }
    setImporting(true);
    setImportMessage('');
    try {
      const res = await bransAPI.importKazanims(importBranchId, importFile);
      setImportMessage({ type: 'success', text: res.data.message || 'Kazanımlar içe aktarıldı' });
      await loadData();
    } catch (error) {
      setImportMessage({ type: 'error', text: error.response?.data?.error || 'Kazanımlar içe aktarılamadı' });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Public klasördeki hazır Excel şablonunu indir
    const link = document.createElement("a");
    link.href = "/kazanim_sablon.xlsx";
    link.download = "kazanim_sablon.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBranchClick = async (branchName) => {
    const foundBranch = branslar.find(b =>
      b.brans_adi.toLowerCase() === branchName.toLowerCase() ||
      (branchName === 'TÜRKÇE' && b.brans_adi.toLowerCase().includes('turkce')) ||
      (branchName === 'İNGİLİZCE' && b.brans_adi.toLowerCase().includes('ingilizce'))
    );

    if (foundBranch) {
      setSelectedBranch(foundBranch);
      setShowModal(true);
      resetTeacherForm();
      return;
    }

    if (confirm(`"${branchName}" branşı sisteme eklensin mi?`)) {
      createBranchAuto(branchName);
    }
  };

  const resetTeacherForm = () => {
    setSelectedTeacherId('');
    setNewUser({ ad_soyad: '', email: '', sifre: '' });
    setSelectedRole('soru_yazici');
    setActiveTab('add');
  };

  const handleDeleteBranch = async (branchId, branchName) => {
    if (!confirm(`"${branchName}" branşını ve bu branşa ait tüm verileri silmek istediğinize emin misiniz?`)) return;
    try {
      await bransAPI.delete(branchId);
      await loadData();
    } catch (error) {
      alert('Silme işlemi başarısız: ' + (error.response?.data?.error || error.message));
    }
  };

  const createBranchAuto = async (branchName) => {
    setCreatingBranch(true);
    try {
      await bransAPI.create({
        brans_adi: branchName,
        aciklama: 'Otomatik oluşturulan branş'
      });
      const res = await bransAPI.getAll();
      setBranslar(res.data.data);
      const newBranch = res.data.data.find(b =>
        b.brans_adi.toLowerCase() === branchName.toLowerCase()
      );
      if (newBranch) {
        setSelectedBranch(newBranch);
        setShowModal(true);
        resetTeacherForm();
      }
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreatingBranch(false);
    }
  };

  const getBranchTeachers = (branchId) => {
    return users.filter(u => ['soru_yazici', 'dizgici', 'incelemeci'].includes(u.rol) && u.brans_id === branchId);
  };

  const getAvailableTeachers = (currentBranchId) => {
    return users.filter(u => ['soru_yazici', 'dizgici', 'incelemeci'].includes(u.rol) && u.brans_id !== currentBranchId);
  };

  const handleAssignTeacher = async () => {
    if (!selectedTeacherId || !selectedBranch) return;
    setAssigningLoading(true);
    try {
      const userToUpdate = users.find(u => u.id === parseInt(selectedTeacherId));
      if (!userToUpdate) return;
      await userAPI.update(selectedTeacherId, {
        ...userToUpdate,
        brans_id: selectedBranch.id,
        rol: selectedRole
      });
      await loadData();
      setSelectedTeacherId('');
    } catch (error) {
      alert(error.response?.data?.error || 'Atama işlemi başarısız');
    } finally {
      setAssigningLoading(false);
    }
  };

  const handleCreateAndAssignTeacher = async (e) => {
    e.preventDefault();
    if (!selectedBranch) return;
    setAssigningLoading(true);
    try {
      const defaultTeamId = ekipler.length > 0 ? ekipler[0].id : null;
      await authAPI.register({
        ...newUser,
        rol: selectedRole,
        brans_id: selectedBranch.id,
        ekip_id: defaultTeamId
      });
      setNewUser({ ad_soyad: '', email: '', sifre: '' });
      await loadData();
      setActiveTab('add');
    } catch (error) {
      alert(error.response?.data?.error || 'Kayıt başarısız');
    } finally {
      setAssigningLoading(false);
    }
  };

  const handleRemoveTeacher = async (userId) => {
    if (!confirm('Bu öğretmeni branştan çıkarmak istediğinize emin misiniz?')) return;
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) return;
      await userAPI.update(userId, { ...userToUpdate, brans_id: null });
      await loadData();
    } catch (error) {
      alert('Kullanıcı branştan çıkarılırken bir hata oluştu.');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingTeacher) return;
    try {
      setAssigningLoading(true);
      await userAPI.update(editingTeacher.id, { rol: editingTeacher.rol });
      await loadData();
      setEditingTeacher(null);
    } catch (error) {
      alert('Rol güncellenemedi.');
    } finally {
      setAssigningLoading(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    try {
      setCreatingBranch(true);
      await bransAPI.create(newBranchData);
      setNewBranchData({ brans_adi: '', aciklama: '' });
      setShowAddBranchForm(false);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Branş oluşturulamadı');
    } finally {
      setCreatingBranch(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <AcademicCapIcon className="w-10 h-10 text-blue-600" strokeWidth={2.5} />
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Branş Personel Listesi</h1>
          </div>
          <p className="text-gray-500 font-medium tracking-tight">Sistemdeki branşları yönetin, kazanımları aktarın ve personel listesini görüntüleyin.</p>
        </div>
        <button
          onClick={() => setShowAddBranchForm(!showAddBranchForm)}
          className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl active:scale-95 ${showAddBranchForm ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
            }`}
        >
          {showAddBranchForm ? <XMarkIcon className="w-6 h-6" strokeWidth={2.5} /> : <PlusIcon className="w-6 h-6" strokeWidth={3} />}
          {showAddBranchForm ? 'İPTAL' : 'YENİ BRANŞ'}
        </button>
      </div>

      {/* QUICK ACTIONS / IMPORT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ADD BRANCH FORM */}
        {showAddBranchForm && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6 animate-scale-up">
            <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <BookOpenIcon className="w-6 h-6 text-blue-500" /> Yeni Branş Tanımla
            </h3>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Branş Adı *</label>
                <input
                  required
                  placeholder="Örn: MATEMATİK"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  value={newBranchData.brans_adi}
                  onChange={e => setNewBranchData({ ...newBranchData, brans_adi: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Kısa Açıklama</label>
                <input
                  placeholder="Branş hakkında not..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  value={newBranchData.aciklama}
                  onChange={e => setNewBranchData({ ...newBranchData, aciklama: e.target.value })}
                />
              </div>
              <button type="submit" disabled={creatingBranch} className="w-full bg-gray-900 text-white rounded-2xl py-4 font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">
                {creatingBranch ? 'KAYDEDİLİYOR...' : 'SİSTEME KAYDET'}
              </button>
            </form>
          </div>
        )}

        {/* EXCEL IMPORT */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <FolderArrowDownIcon className="w-6 h-6 text-green-500" /> Kazanım İçe Aktar (Excel)
            </h3>
            <button
              onClick={downloadTemplate}
              className="group flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded-xl border border-gray-100 transition-all active:scale-95"
              title="Örnek Excel şablonunu indir"
            >
              <ArrowPathIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Örnek Şablon</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Hedef Branş</label>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                value={importBranchId}
                onChange={(e) => setImportBranchId(e.target.value)}
              >
                {branslar.map((b) => (
                  <option key={b.id} value={b.id}>{b.brans_adi}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Dosya Seçin (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-xs font-bold text-gray-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <button
            onClick={handleImport}
            disabled={importing || !importFile}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CloudArrowUpIcon className="w-5 h-5" />}
            {importing ? 'AKTARILIYOR...' : 'VERİLERİ İÇE AKTAR'}
          </button>
          {importMessage && (
            <div className={`p-4 rounded-2xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${importMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
              {importMessage.type === 'success' ? <CheckBadgeIcon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
              {importMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* BRANCH GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {branslar.map((branch, index) => {
          const colorClass = BRANCH_COLORS[index % BRANCH_COLORS.length];
          const iconD = BRANCH_ICONS[branch.brans_adi.toUpperCase()] || BRANCH_ICONS['DEFAULT'];
          return (
            <div
              key={branch.id}
              onClick={() => { setSelectedBranch(branch); setShowModal(true); }}
              className={`relative group cursor-pointer overflow-hidden rounded-[2rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all p-8 bg-gradient-to-br ${colorClass}`}
            >
              <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-125">
                <svg className="w-24 h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconD} />
                </svg>
              </div>

              <div className="relative z-10 text-white h-24 flex flex-col justify-between">
                <h3 className="text-xl font-black tracking-tight uppercase">{branch.brans_adi}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                      Kişileri Listele
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBranch(branch.id, branch.brans_adi);
                      }}
                      className="p-2 hover:bg-white/20 rounded-xl transition-all"
                      title="Branşı Sil"
                    >
                      <TrashIcon className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={2.5} />
                    </button>
                    <ChevronRightIcon className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" strokeWidth={3} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>



      {/* TEACHER ASSIGNMENT MODAL */}
      {
        showModal && selectedBranch && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-[3rem] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up border border-gray-50">
              <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-6">
                  <div className="bg-blue-600 text-white p-4 rounded-3xl shadow-lg shadow-blue-200">
                    <UserGroupIcon className="w-8 h-8" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">{selectedBranch.brans_adi}</h2>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Sorumlu Personel & Atama Paneli</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white rounded-2xl transition">
                  <XMarkIcon className="w-8 h-8 text-gray-300" strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-10 bg-white">
                {/* PERSONNEL LIST */}
                <div className="space-y-8 max-w-4xl mx-auto">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-6">
                    <h4 className="flex items-center gap-3 text-xl font-black text-gray-900 tracking-tight uppercase">
                      <CheckBadgeIcon className="w-7 h-7 text-green-500" /> Aktif Personel Listesi
                    </h4>
                    <div className="bg-gray-100 px-4 py-2 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Toplam: {getBranchTeachers(selectedBranch.id).length} Kişi
                    </div>
                  </div>

                  <div className="space-y-12 pb-20">
                    {Object.entries(
                      getBranchTeachers(selectedBranch.id).reduce((acc, user) => {
                        const teamName = user.ekip_adi || 'EKİPSİZ / GENEL';
                        if (!acc[teamName]) acc[teamName] = [];
                        acc[teamName].push(user);
                        return acc;
                      }, {})
                    ).sort(([a], [b]) => a.localeCompare(b)).map(([teamName, teamUsers]) => (
                      <div key={teamName} className="space-y-5">
                        <div className="flex items-center gap-4 px-2">
                          <div className="w-1 h-6 bg-blue-600 rounded-full" />
                          <h5 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <UserGroupIcon className="w-5 h-5 text-gray-400" />
                            {teamName}
                            <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{teamUsers.length} Üye</span>
                          </h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                          {teamUsers.map(teacher => (
                            <div key={teacher.id} className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between group transition-all hover:bg-white hover:shadow-lg hover:shadow-gray-200/50">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center font-black text-xs uppercase transition-all shadow-sm">
                                  {teacher.ad_soyad.charAt(0)}{teacher.ad_soyad.split(' ').pop().charAt(0)}
                                </div>
                                <div>
                                  <div className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{teacher.ad_soyad}</div>
                                  <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mt-1.5">
                                    {teacher.rol === 'soru_yazici' ? 'BRANŞ YAZARI' : teacher.rol === 'dizgici' ? 'DİZGİ' : 'İNCELEME'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {getBranchTeachers(selectedBranch.id).length === 0 && (
                      <div className="p-20 text-center border-2 border-dashed border-gray-100 rounded-[3rem] bg-gray-50/30">
                        <UserGroupIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Bu branşa henüz personel atanmamış.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                <button onClick={() => setShowModal(false)} className="px-10 py-4 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all">KAPAT</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
