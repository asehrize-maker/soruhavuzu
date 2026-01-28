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

const MAIN_BRANCHES = [
  { name: 'TÜRKÇE', color: 'from-rose-500 to-rose-600', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { name: 'FEN BİLİMLERİ', color: 'from-emerald-500 to-emerald-600', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { name: 'SOSYAL BİLGİLER', color: 'from-amber-500 to-amber-600', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'MATEMATİK', color: 'from-blue-500 to-blue-600', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { name: 'İNGİLİZCE', color: 'from-violet-500 to-violet-600', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
];

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
    // Excel dostu CSV (Semicolon separator + BOM for Turkish characters)
    const csvContent = "\uFEFF" +
      "Kod;Kazanım Açıklaması\n" +
      "F.8.4.1.1.;Asit ve bazların genel özelliklerini ifade eder.\n" +
      "F.8.4.1.2.;Asit ve bazlara günlük yaşamdan örnekler verir.\n" +
      "F.8.4.1.3.;Günlük hayatta ulaşılabilecek malzemeleri asit-baz ayracı olarak kullanır.";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kazanim_sablonu.csv");
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
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Branş ve Personeller</h1>
          </div>
          <p className="text-gray-500 font-medium">Sistemdeki branşları yönetin, kazanım yükleyin ve personelleri branşlara atayın.</p>
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
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Excel Seçin (.xlsx)</label>
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
      <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] ml-1">Hızlı Erişim Branşları</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {MAIN_BRANCHES.map((branch) => (
          <div
            key={branch.name}
            onClick={() => handleBranchClick(branch.name)}
            className={`relative group cursor-pointer overflow-hidden rounded-[2rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all p-8 bg-gradient-to-br ${branch.color}`}
          >
            <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-125">
              <svg className="w-24 h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={branch.icon} />
              </svg>
            </div>

            <div className="relative z-10 text-white h-24 flex flex-col justify-between">
              <h3 className="text-xl font-black tracking-tight">{branch.name}</h3>
              <div className="flex items-center justify-between">
                <div className="bg-white/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                  Yönet
                </div>
                <ChevronRightIcon className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" strokeWidth={3} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ALL BRANCHES LIST */}
      <div className="space-y-6 pt-10 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Sistemdeki Tüm Branşlar ({branslar.length})</h2>
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input placeholder="Branş ara..." className="bg-gray-100 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-x divide-y divide-gray-50">
            {branslar.map((branch) => {
              const isMain = MAIN_BRANCHES.some(mb => branch.brans_adi.toUpperCase().includes(mb.name.split(' ')[0]));
              return (
                <div key={branch.id} className="p-6 hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${isMain ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {branch.brans_adi.charAt(0)}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setSelectedBranch(branch); setShowModal(true); }} className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition" title="Düzenle">
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`"${branch.brans_adi}" branşını silmek istediğinize emin misiniz?`)) {
                            try { await bransAPI.delete(branch.id); loadData(); } catch (e) { alert('Hata: ' + e.message); }
                          }
                        }}
                        className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition"
                        title="Sil"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h5 className="font-black text-gray-900 text-sm tracking-tight mb-1">{branch.brans_adi}</h5>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4 truncate italic">{branch.aciklama || 'Açıklama yok'}</p>
                  <button
                    onClick={() => { setSelectedBranch(branch); setShowModal(true); }}
                    className="w-full bg-white border border-gray-100 text-[10px] font-black text-blue-600 uppercase py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                  >
                    Atamaları Yönet
                  </button>
                </div>
              );
            })}
          </div>
          {branslar.length === 0 && (
            <div className="p-20 text-center text-gray-300 font-black uppercase tracking-[0.2em]">Veri Bulunamadı</div>
          )}
        </div>
      </div>

      {/* TEACHER ASSIGNMENT MODAL */}
      {showModal && selectedBranch && (
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

            <div className="flex-1 overflow-y-auto no-scrollbar p-10 bg-white grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* LEFT: ACTIONS */}
              <div className="space-y-8">
                <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                  <button onClick={() => setActiveTab('add')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>SİSTEMDEN ATA</button>
                  <button onClick={() => setActiveTab('create')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>YENİ KAYIT & ATA</button>
                </div>

                {activeTab === 'add' ? (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Personel Seçin</label>
                      <div className="relative">
                        <IdentificationIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <select
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
                          value={selectedTeacherId}
                          onChange={e => setSelectedTeacherId(e.target.value)}
                        >
                          <option value="">Seçiniz...</option>
                          {getAvailableTeachers(selectedBranch.id).map(u => (
                            <option key={u.id} value={u.id}>{u.ad_soyad} ({u.brans_adi || 'Branşsız'})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Yetki Rolü</label>
                      <select
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
                        value={selectedRole}
                        onChange={e => setSelectedRole(e.target.value)}
                      >
                        <option value="soru_yazici">Branş Yazarı</option>
                        <option value="dizgici">Dizgi Personeli</option>
                        <option value="incelemeci">İncelemeci</option>
                      </select>
                    </div>
                    <button
                      onClick={handleAssignTeacher}
                      disabled={!selectedTeacherId || assigningLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {assigningLoading ? 'İŞLENİYOR...' : 'BRANŞA DAHİL ET'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateAndAssignTeacher} className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ad Soyad</label>
                        <input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700" value={newUser.ad_soyad} onChange={e => setNewUser({ ...newUser, ad_soyad: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">E-Posta</label>
                        <div className="relative">
                          <EnvelopeIcon className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                          <input required type="email" className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-4 text-sm font-bold text-gray-700" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Geçici Şifre</label>
                        <div className="relative">
                          <LockClosedIcon className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                          <input required className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-4 text-sm font-bold text-gray-700" value={newUser.sifre} onChange={e => setNewUser({ ...newUser, sifre: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <button type="submit" disabled={assigningLoading} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-sm shadow-xl shadow-green-100 transition-all active:scale-95">
                      {assigningLoading ? 'PERSONEL KAYDEDİLİYOR...' : 'KAYDET VE ATAMAYI YAP'}
                    </button>
                  </form>
                )}
              </div>

              {/* RIGHT: LIST */}
              <div className="space-y-6">
                <h4 className="flex items-center gap-2 text-sm font-black text-gray-900 tracking-tight uppercase">
                  <CheckBadgeIcon className="w-5 h-5 text-green-500" /> Aktif Personel Listesi ({getBranchTeachers(selectedBranch.id).length})
                </h4>
                <div className="space-y-3">
                  {getBranchTeachers(selectedBranch.id).map(teacher => (
                    <div key={teacher.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between group transition-all hover:bg-white hover:shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[1rem] bg-gray-100 text-gray-500 flex items-center justify-center font-black text-xs uppercase group-hover:bg-blue-600 group-hover:text-white transition-colors tracking-tighter">
                          {teacher.ad_soyad.charAt(0)}{teacher.ad_soyad.split(' ').pop().charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-black text-gray-900">{teacher.ad_soyad}</div>
                          <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mt-1">
                            {teacher.rol === 'soru_yazici' ? 'BRANŞ YAZARI' : teacher.rol === 'dizgici' ? 'DİZGİ EKİBİ' : 'İNCELEMECİ'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTeacher(teacher.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {getBranchTeachers(selectedBranch.id).length === 0 && (
                    <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 font-black uppercase tracking-widest text-xs italic">Hiç personel atanmamış.</div>
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
