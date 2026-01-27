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
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

export default function Denemeler() {
    const { user: authUser, viewRole } = useAuthStore();
    const effectiveRole = viewRole || authUser?.rol;
    const canCreatePlan = effectiveRole === 'admin';

    const [denemeler, setDenemeler] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create Form
    const [newPlan, setNewPlan] = useState({ ad: '', planlanan_tarih: '', aciklama: '' });

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
            console.error('Denemeler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDenemeler();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await denemeAPI.createPlan(newPlan);
            setShowCreateModal(false);
            setNewPlan({ ad: '', planlanan_tarih: '', aciklama: '' });
            fetchDenemeler();
        } catch (error) {
            console.error('Plan oluşturulamadı:', error);
            alert('Plan oluşturulamadı: ' + error.response?.data?.message || error.message);
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

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
            {/* HERDER */}
            <div className="flex flex-col md:flex-row items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <DocumentTextIcon className="w-10 h-10 text-indigo-600" />
                        Deneme Yönetimi
                    </h1>
                    <p className="text-gray-500 font-medium mt-2">Deneme sınavlarını planlayın ve branş kitapçıklarını yükleyin.</p>
                </div>
                {canCreatePlan && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" /> YENİ DENEME PLANLA
                    </button>
                )}
            </div>

            {/* LIST */}
            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="text-center py-20 text-gray-400 font-bold">Yükleniyor...</div>
                ) : denemeler.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm text-gray-400 font-bold">
                        Henüz planlanmış deneme yok.
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
                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest">#{deneme.id}</span>
                                        <h3 className="text-xl font-black text-gray-900">{deneme.ad}</h3>
                                    </div>
                                    <p className="text-sm text-gray-500">{deneme.aciklama}</p>
                                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                                        <span className="flex items-center gap-1"><CloudArrowUpIcon className="w-4 h-4" /> {deneme.toplam_yukleme} Branş Yükledi</span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4" /> {new Date(deneme.olusturma_tarihi).toLocaleDateString()} oluşturuldu</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 w-full md:w-auto">
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
                                    className={`flex-1 md:flex-none py-4 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 border shadow-sm ${uploadingId === deneme.id
                                        ? 'bg-gray-100 text-gray-400 animate-pulse'
                                        : 'bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-200'}`}
                                >
                                    {uploadingId === deneme.id ? (
                                        <>YÜKLENİYOR...</>
                                    ) : (
                                        <><CloudArrowUpIcon className="w-5 h-5" /> PDF YÜKLE</>
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
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Yeni Deneme Planla</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><PlusIcon className="w-6 h-6 rotate-45" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Deneme Adı</label>
                                <input required type="text" value={newPlan.ad} onChange={e => setNewPlan({ ...newPlan, ad: e.target.value })} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Örn: 2025-2026 LGS Deneme 1" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Planlanan Tarih</label>
                                <input required type="date" value={newPlan.planlanan_tarih} onChange={e => setNewPlan({ ...newPlan, planlanan_tarih: e.target.value })} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Açıklama</label>
                                <textarea value={newPlan.aciklama} onChange={e => setNewPlan({ ...newPlan, aciklama: e.target.value })} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" rows="3" placeholder="Opsiyonel açıklama..."></textarea>
                            </div>
                            <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 transition-all">OLUŞTUR</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
