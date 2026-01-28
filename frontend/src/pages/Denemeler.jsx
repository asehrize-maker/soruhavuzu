import { useState, useEffect, useRef } from 'react';
import { denemeAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import {
    DocumentTextIcon,
    CloudArrowUpIcon,
    PlusIcon,
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
    EyeIcon,
    TrashIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline'; // ArrowDownTrayIcon removed as unused

export default function Denemeler() {
    const { user: authUser, viewRole } = useAuthStore();
    const effectiveRole = viewRole || authUser?.rol;
    const canCreatePlan = effectiveRole === 'admin';

    const [denemeler, setDenemeler] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create Form
    const [newPlan, setNewPlan] = useState({ ad: '', planlanan_tarih: '', aciklama: '', gorev_tipi: 'deneme' });

    // Upload State
    const [uploadingId, setUploadingId] = useState(null);
    const fileInputRefs = useRef({});

    const fetchDenemeler = async () => {
        setLoading(true);
        try {
            const res = await denemeAPI.getAll();
            if (res.data.success) {
                setDenemeler(res.data.data || []);
            }
        } catch (error) {
            console.error('Görevler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDenemeler();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            await denemeAPI.createPlan(newPlan);
            setShowCreateModal(false);
            setNewPlan({ ad: '', planlanan_tarih: '', aciklama: '', gorev_tipi: 'deneme' });
            alert('Görev planı başarıyla oluşturuldu.');
            fetchDenemeler();
        } catch (error) {
            console.error('Plan oluşturulamadı:', error);
            const msg = error.response?.data?.message || error.message || 'Bilinmeyen Hata';
            alert(`HATA: Plan oluşturulamadı!\nDetay: ${msg}\nStatus: ${error.response?.status}`);
        } finally {
            setCreateLoading(false);
        }
    };

    const handlePlanDelete = async (id, ad) => {
        if (!confirm(`"${ad}" görev planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve bu plana ait tüm yüklemeler silinir.`)) return;
        try {
            await denemeAPI.deletePlan(id);
            alert('Görev planı silindi.');
            fetchDenemeler();
        } catch (error) {
            console.error('Plan silinemedi:', error);
            alert('Silme işlemi başarısız: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleFileSelect = async (denemeId, e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Lütfen sadece PDF dosyası yükleyin.');
            return;
        }

        if (!confirm(`${file.name} dosyasını yüklemek istediğinize emin misiniz?`)) return;

        setUploadingId(denemeId);
        const formData = new FormData();
        formData.append('pdf_dosya', file);

        try {
            await denemeAPI.upload(denemeId, formData);
            alert('Dosya başarıyla yüklendi!');
            fetchDenemeler();
        } catch (error) {
            console.error('Yükleme hatası:', error);
            alert('Yükleme başarısız: ' + (error.response?.data?.message || error.message));
        } finally {
            setUploadingId(null);
            e.target.value = null; // Reset input
        }
    };

    const getGorevTipiLabel = (tip) => {
        switch (tip) {
            case 'yaprak_test': return 'Yaprak Test';
            case 'fasikul': return 'Fasikül';
            case 'deneme': return 'Deneme';
            default: return 'Genel Görev';
        }
    };

    const getGorevTipiColor = (tip) => {
        switch (tip) {
            case 'yaprak_test': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'fasikul': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'deneme': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const handleDeleteUpload = async (uploadId) => {
        if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
        try {
            await denemeAPI.deleteUpload(uploadId);
            alert('Dosya silindi.');
            fetchDenemeler();
        } catch (error) {
            console.error('Dosya silinemedi:', error);
            alert('Silme işlemi başarısız: ' + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <DocumentTextIcon className="w-10 h-10 text-indigo-600" />
                        Görev Yönetimi
                    </h1>
                    <p className="text-gray-500 font-medium mt-2">Deneme, fasikül ve yaprak test görevlerini planlayın ve takibini yapın.</p>
                </div>
                {canCreatePlan && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" /> YENİ GÖREV PLANLA
                    </button>
                )}
            </div>

            {/* LIST */}
            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="text-center py-20 text-gray-400 font-bold">Yükleniyor...</div>
                ) : denemeler.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm text-gray-400 font-bold">
                        Henüz planlanmış görev yok.
                    </div>
                ) : (
                    denemeler.map(deneme => (
                        <div key={deneme.id} className="bg-white p-8 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 group hover:border-indigo-100 transition-all">
                            <div className="flex items-start gap-6">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex flex-col items-center justify-center border border-indigo-100 shrink-0">
                                    <span className="text-2xl font-black">{new Date(deneme.planlanan_tarih).getDate()}</span>
                                    <span className="text-[10px] uppercase font-black tracking-widest">{new Date(deneme.planlanan_tarih).toLocaleDateString('tr-TR', { month: 'short' })}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-black text-gray-900">{deneme.ad}</h3>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getGorevTipiColor(deneme.gorev_tipi)}`}>
                                            {getGorevTipiLabel(deneme.gorev_tipi)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500">{deneme.aciklama}</p>
                                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                                        <span className="flex items-center gap-1"><CloudArrowUpIcon className="w-4 h-4" /> {deneme.toplam_yukleme} Branş Yükledi</span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4" /> {new Date(deneme.olusturma_tarihi).toLocaleDateString()} oluşturuldu</span>
                                        {canCreatePlan && (
                                            <>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                <button
                                                    onClick={() => handlePlanDelete(deneme.id, deneme.ad)}
                                                    className="flex items-center gap-1 text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest text-[9px] font-black"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" /> PLANI SİL
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                                <div className="flex flex-wrap justify-end gap-3 w-full">
                                    {deneme.my_upload_url && (
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={deneme.my_upload_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="py-3 px-4 bg-green-50 text-green-600 rounded-xl font-black text-[9px] uppercase tracking-widest border border-green-100 hover:bg-green-100 transition-all flex items-center gap-1.5"
                                                title="Tarayıcıda Aç"
                                            >
                                                <EyeIcon className="w-4 h-4" /> GÖR
                                            </a>
                                            <a
                                                href={deneme.my_upload_url.replace('/upload/', '/upload/fl_attachment/')}
                                                className="py-3 px-4 bg-amber-50 text-amber-600 rounded-xl font-black text-[9px] uppercase tracking-widest border border-amber-100 hover:bg-amber-100 transition-all flex items-center gap-1.5"
                                                title="Bilgisayara İndir"
                                            >
                                                <ArrowDownTrayIcon className="w-4 h-4" /> İNDİR
                                            </a>
                                            <button
                                                onClick={() => handleDeleteUpload(deneme.my_upload_id)}
                                                className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all"
                                                title="Yüklemeyi Sil"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {effectiveRole === 'admin' && deneme.all_uploads && deneme.all_uploads.length > 0 && (
                                        <div className="flex flex-wrap gap-2 justify-end w-full mt-2">
                                            {deneme.all_uploads.map((up, idx) => (
                                                <div key={idx} className="flex items-center bg-indigo-50 rounded-xl border border-indigo-100 overflow-hidden">
                                                    <a
                                                        href={up.dosya_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2 py-2 text-indigo-600 text-[9px] font-black hover:bg-indigo-100 transition-all flex items-center gap-1"
                                                        title={`${up.brans_adi} yüklemesi - Gör`}
                                                    >
                                                        <EyeIcon className="w-3 h-3" /> {up.brans_adi}
                                                    </a>
                                                    <a
                                                        href={up.dosya_url.replace('/upload/', '/upload/fl_attachment/')}
                                                        className="px-2 py-2 text-amber-600 text-[9px] font-black hover:bg-amber-100 border-l border-indigo-100 transition-all flex items-center gap-1"
                                                        title="İndir"
                                                    >
                                                        <ArrowDownTrayIcon className="w-3 h-3" />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDeleteUpload(up.id)}
                                                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all border-l border-indigo-100"
                                                        title="Bu Yüklemeyi Sil"
                                                    >
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    ref={el => fileInputRefs.current[deneme.id] = el}
                                    className="hidden"
                                    accept="application/pdf"
                                    onChange={(e) => handleFileSelect(deneme.id, e)}
                                />
                                <button
                                    onClick={() => fileInputRefs.current[deneme.id]?.click()}
                                    disabled={uploadingId === deneme.id}
                                    className={`w-full md:w-auto py-4 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 border shadow-sm ${uploadingId === deneme.id
                                        ? 'bg-gray-100 text-gray-400 animate-pulse'
                                        : (deneme.my_upload_url ? 'bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200')}`}
                                >
                                    {uploadingId === deneme.id ? (
                                        <>YÜKLENİYOR...</>
                                    ) : (
                                        <><CloudArrowUpIcon className="w-5 h-5" /> {deneme.my_upload_url ? 'YENİDEN YÜKLE' : 'PDF YÜKLE'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* CREATE MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-scale-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Yeni Görev Planla</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><PlusIcon className="w-6 h-6 rotate-45" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Görev Tipi</label>
                                <select
                                    value={newPlan.gorev_tipi}
                                    onChange={e => setNewPlan({ ...newPlan, gorev_tipi: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                >
                                    <option value="deneme">Deneme Sınavı</option>
                                    <option value="fasikul">Fasikül Yüklemesi</option>
                                    <option value="yaprak_test">Yaprak Test Yüklemesi</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Görev Adı</label>
                                <input required type="text" value={newPlan.ad} onChange={e => setNewPlan({ ...newPlan, ad: e.target.value })} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Örn: 2025 LGS Deneme 1" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Planlanan Tarih</label>
                                <input required type="date" value={newPlan.planlanan_tarih} onChange={e => setNewPlan({ ...newPlan, planlanan_tarih: e.target.value })} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Açıklama</label>
                                <textarea value={newPlan.aciklama} onChange={e => setNewPlan({ ...newPlan, aciklama: e.target.value })} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" rows="3" placeholder="Opsiyonel açıklama..."></textarea>
                            </div>
                            <button disabled={createLoading} type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 transition-all flex justify-center">
                                {createLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'GÖREVİ OLUŞTUR'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

