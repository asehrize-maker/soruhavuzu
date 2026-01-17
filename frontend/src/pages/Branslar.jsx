import { useState, useEffect } from 'react';
import { bransAPI, userAPI, ekipAPI, authAPI } from '../services/api';

const MAIN_BRANCHES = [
  { name: 'TÜRKÇE', color: 'from-red-500 to-red-600', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { name: 'FEN BİLİMLERİ', color: 'from-green-500 to-green-600', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { name: 'SOSYAL BİLGİLER', color: 'from-yellow-500 to-yellow-600', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'MATEMATİK', color: 'from-blue-500 to-blue-600', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { name: 'İNGİLİZCE', color: 'from-purple-500 to-purple-600', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
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

  // New User Form State
  const [newUser, setNewUser] = useState({ ad_soyad: '', email: '', sifre: '' });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [activeTab, setActiveTab] = useState('add'); // 'add' (existing) or 'create' (new)

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bransResponse, userResponse, ekipResponse] = await Promise.all([
        bransAPI.getAll(),
        userAPI.getAll(),
        ekipAPI.getAll(),
      ]);
      setBranslar(bransResponse.data.data);
      setUsers(userResponse.data.data);
      setEkipler(ekipResponse.data.data);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      alert('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchClick = async (branchName) => {
    // Find the real branch object from DB (case insensitive match)
    let foundBranch = branslar.find(b =>
      b.brans_adi.toLowerCase() === branchName.toLowerCase() ||
      (branchName === 'TÜRKÇE' && b.brans_adi.toLowerCase().includes('turkce')) ||
      (branchName === 'İNGİLİZCE' && b.brans_adi.toLowerCase().includes('ingilizce'))
    );

    // If branch doesn't exist, try to create it automatically
    if (!foundBranch) {
      // Since the user wants to remove "Teams" UI but create users, we might need a default team.
      // We'll proceed even if no teams exist (sending null for team_id if allowed, or alert if needed).
      // But Brans MUST have an ekip_id usually.

      let defaultTeamId = ekipler.length > 0 ? ekipler[0].id : null;

      // If no teams exist, and we must create one?
      // For now, let's assume we can create a branch without teams IF the backend allows, OR warn.
      // But wait, the previous code warned if teams=0.
      // User said "ekipleri de kaldır". This means UI removal. Data might remain.

      if (!defaultTeamId) {
        // If absolutely no team, try to create a dummy one?
        // Or just alert.
        alert('Sistem altyapısı için en az bir Ekip gereklidir. Bu aşamada otomatik oluşturulamıyor.');
        return;
      }

      if (confirm(`"${branchName}" branşı sistemde bulunamadı. Otomatik oluşturulsun mu?`)) {
        setCreatingBranch(true);
        try {
          await bransAPI.create({
            brans_adi: branchName,
            ekip_id: defaultTeamId,
            aciklama: 'Otomatik oluşturulan branş'
          });

          // Refresh data
          const [bransResponse] = await Promise.all([bransAPI.getAll()]);
          setBranslar(bransResponse.data.data);
          const newBranchList = bransResponse.data.data;

          // Find the newly created branch in the refreshed list
          foundBranch = newBranchList.find(b => b.brans_adi.toLowerCase() === branchName.toLowerCase());

          if (!foundBranch) {
            // Try looser match
            foundBranch = newBranchList.find(b => b.brans_adi.toUpperCase().includes(branchName.toUpperCase()));
          }

          if (!foundBranch) {
            alert('Branş oluşturuldu ancak listelenemedi. Lütfen sayfayı yenileyin.');
            return;
          }
        } catch (error) {
          console.error('Branş oluşturma hatası:', error);
          alert('Branş oluşturulamadı: ' + (error.response?.data?.error || error.message));
          return;
        } finally {
          setCreatingBranch(false);
        }
      } else {
        return;
      }
    }

    if (foundBranch) {
      setSelectedBranch(foundBranch);
      setShowModal(true);
      setSelectedTeacherId('');
      setNewUser({ ad_soyad: '', email: '', sifre: '' });
      setActiveTab('add');
    }
  };

  const getBranchTeachers = (branchId) => {
    return users.filter(u => u.rol === 'soru_yazici' && u.brans_id === branchId);
  };

  const getAvailableTeachers = (currentBranchId) => {
    // Show teachers who are NOT in this branch
    return users.filter(u => u.rol === 'soru_yazici' && u.brans_id !== currentBranchId);
  };

  const handleAssignTeacher = async () => {
    if (!selectedTeacherId || !selectedBranch) return;

    setAssigningLoading(true);
    try {
      const userToUpdate = users.find(u => u.id === parseInt(selectedTeacherId));
      if (!userToUpdate) return;

      const updateData = {
        ...userToUpdate,
        brans_id: selectedBranch.id,
        brans_ids: userToUpdate.brans_ids || [],
      };

      await userAPI.update(selectedTeacherId, updateData);

      alert('Öğretmen ataması başarılı!');
      await loadData();
      setSelectedTeacherId('');
    } catch (error) {
      console.error('Atama hatası:', error);
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

      const registerData = {
        ...newUser,
        rol: 'soru_yazici',
        brans_id: selectedBranch.id,
        ekip_id: defaultTeamId // Use default team if available
      };

      await authAPI.register(registerData);

      alert('Yeni öğretmen oluşturuldu ve atandı!');
      setNewUser({ ad_soyad: '', email: '', sifre: '' });
      await loadData(); // Reload users
      setActiveTab('add'); // Switch back to add/list view potentially, or stay? Stay is fine.
    } catch (error) {
      console.error('Kayıt hatası:', error);
      let errMsg = 'Kayıt başarısız';
      if (error.response?.data?.errors) {
        errMsg = error.response.data.errors.map(e => e.msg).join(', ');
      } else if (error.response?.data?.error) {
        errMsg = error.response.data.error;
      }
      alert(errMsg);
    } finally {
      setAssigningLoading(false);
    }
  };

  const handleRemoveTeacher = async (userId) => {
    if (!confirm('Bu öğretmeni branştan çıkarmak istediğinize emin misiniz?')) return;

    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) return;

      const updateData = {
        ...userToUpdate,
        brans_id: null
      };

      await userAPI.update(userId, updateData);
      await loadData();
    } catch (error) {
      console.error('Kaldırma hatası:', error);
      alert('İşlem başarısız');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Branş ve Öğretmen Yönetimi</h1>
        <p className="text-gray-500">Branş seçerek öğretmen ataması yapabilirsiniz.</p>
      </div>

      {loading || creatingBranch ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          {creatingBranch && <p className="text-gray-500">Branş oluşturuluyor...</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {MAIN_BRANCHES.map((branch) => {
            return (
              <div
                key={branch.name}
                onClick={() => handleBranchClick(branch.name)}
                className={`relative group cursor-pointer overflow-hidden rounded-xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl bg-gradient-to-br ${branch.color}`}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg className="w-24 h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d={branch.icon} />
                  </svg>
                </div>

                <div className="p-6 relative z-10 text-white h-40 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">{branch.name}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                      Yönet &rarr;
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Teacher Assignment Modal */}
      {showModal && selectedBranch && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-xl leading-6 font-bold text-gray-900 border-b pb-4 mb-4 flex items-center" id="modal-title">
                      <span className={`w-3 h-8 rounded-r mr-3 bg-gradient-to-b ${MAIN_BRANCHES.find(b => selectedBranch.brans_adi.toUpperCase().includes(b.name.split(' ')[0]))?.color || 'from-blue-500 to-blue-600'}`}></span>
                      {selectedBranch.brans_adi} - Öğretmen Yönetimi
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column: Actions */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        {/* Tabs */}
                        <div className="flex space-x-2 mb-4">
                          <button
                            onClick={() => setActiveTab('add')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md ${activeTab === 'add' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            Varolanı Ekle
                          </button>
                          <button
                            onClick={() => setActiveTab('create')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md ${activeTab === 'create' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            Yeni Oluştur
                          </button>
                        </div>

                        {activeTab === 'add' ? (
                          <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-2">
                              Sistemde kayıtlı branşsız öğretmenleri buradan atayabilirsiniz.
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">Öğretmen Seç</label>
                              <select
                                value={selectedTeacherId}
                                onChange={(e) => setSelectedTeacherId(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                              >
                                <option value="">Öğretmen Seçiniz...</option>
                                {getAvailableTeachers(selectedBranch.id).map(teacher => (
                                  <option key={teacher.id} value={teacher.id}>
                                    {teacher.ad_soyad} {teacher.brans_adi ? `(${teacher.brans_adi})` : '(Branşsız)'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={handleAssignTeacher}
                              disabled={!selectedTeacherId || assigningLoading}
                              className={`w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-blue-600 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm ${(!selectedTeacherId || assigningLoading) ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                              {assigningLoading ? 'Atanıyor...' : 'Atama Yap'}
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleCreateAndAssignTeacher} className="space-y-4">
                            <div className="bg-green-50 p-3 rounded text-sm text-green-800 mb-2">
                              Sisteme yeni bir öğretmen kaydedip doğrudan bu branşa atayın.
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
                              <input
                                type="text"
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                value={newUser.ad_soyad}
                                onChange={e => setNewUser({ ...newUser, ad_soyad: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Email</label>
                              <input
                                type="email"
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Şifre</label>
                              <input
                                type="text"
                                required
                                minLength="6"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                value={newUser.sifre}
                                onChange={e => setNewUser({ ...newUser, sifre: e.target.value })}
                                placeholder="En az 6 karakter"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={assigningLoading}
                              className={`w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-green-600 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:text-sm ${assigningLoading ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                              {assigningLoading ? 'Oluşturuluyor...' : 'Oluştur ve Ata'}
                            </button>
                          </form>
                        )}
                      </div>

                      {/* Right Column: Existing Teachers */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm overflow-y-auto max-h-[400px]">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center sticky top-0 bg-white pb-2 border-b">
                          <svg className="w-5 h-5 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Bu Branştaki Öğretmenler ({getBranchTeachers(selectedBranch.id).length})
                        </h4>

                        <div className="space-y-2">
                          {getBranchTeachers(selectedBranch.id).length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">Bu branşa henüz öğretmen atanmamış.</p>
                          ) : (
                            getBranchTeachers(selectedBranch.id).map(teacher => (
                              <div key={teacher.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-gray-100 transition-colors">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold mr-3">
                                    {teacher.ad_soyad.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{teacher.ad_soyad}</p>
                                    <p className="text-xs text-gray-500">{teacher.email}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveTeacher(teacher.id)}
                                  className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"
                                  title="Branştan Çıkar"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Other Branches Section */}
      {branslar.filter(b => !MAIN_BRANCHES.some(mb =>
        b.brans_adi.toUpperCase().trim() === mb.name.toUpperCase().trim() ||
        (mb.name === 'TÜRKÇE' && b.brans_adi.toUpperCase().includes('TURKCE')) ||
        (mb.name === 'İNGİLİZCE' && b.brans_adi.toUpperCase().includes('INGILIZCE'))
      )).length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Diğer Branşlar</h2>
            <p className="text-sm text-gray-500 mb-4">Sistem dışı veya manuel eklenmiş diğer branşlar.</p>
            <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
              <ul className="divide-y divide-gray-200">
                {branslar.filter(b => !MAIN_BRANCHES.some(mb =>
                  b.brans_adi.toUpperCase().trim() === mb.name.toUpperCase().trim() ||
                  (mb.name === 'TÜRKÇE' && b.brans_adi.toUpperCase().includes('TURKCE')) ||
                  (mb.name === 'İNGİLİZCE' && b.brans_adi.toUpperCase().includes('INGILIZCE'))
                )).map(branch => (
                  <li key={branch.id} className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{branch.brans_adi}</p>
                      <p className="text-xs text-gray-500">
                        {ekipler.find(e => e.id === branch.ekip_id)?.ekip_adi || 'Ekip Yok'}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`"${branch.brans_adi}" branşını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
                          try {
                            await bransAPI.delete(branch.id);
                            loadData();
                          } catch (e) {
                            alert('Silme başarısız: ' + (e.response?.data?.error || e.message));
                          }
                        }
                      }}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
    </div>
  );
}
