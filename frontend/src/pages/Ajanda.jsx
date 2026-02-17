import { useState, useEffect, useRef } from 'react';
import { denemeAPI, bransAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import {
    CalendarIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentTextIcon,
    ClockIcon,
    EyeIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    PlusIcon,
    MapPinIcon,
    SparklesIcon,
    CloudArrowUpIcon
} from '@heroicons/react/24/outline';

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const formatDateForInput = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function Ajanda() {
    const { user: authUser, viewRole } = useAuthStore();
    const effectiveRole = viewRole || authUser?.rol;
    const isManagement = effectiveRole === 'admin' || effectiveRole === 'koordinator';
    const isAdmin = effectiveRole === 'admin';

    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    const [branslar, setBranslar] = useState([]);
    const [ekipler, setEkipler] = useState([]);

    // Upload State
    const fileInputRef = useRef(null);
    const [uploadingEventId, setUploadingEventId] = useState(null);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [newPlan, setNewPlan] = useState({ ad: '', planlanan_tarih: '', aciklama: '', gorev_tipi: 'deneme', brans_id: '', ekip_id: '' });

    const fetchAll = async () => {
        setLoading(true);
        try {
            const { ekipAPI } = await import('../services/api');
            const [agendaRes, bransRes, ekipRes] = await Promise.all([
                denemeAPI.getAll(),
                bransAPI.getAll(),
                ekipAPI.getAll()
            ]);
            setEvents(agendaRes.data.data || []);
            setBranslar(bransRes.data.data || []);
            setEkipler(ekipRes.data.data || []);
        } catch (error) {
            console.error('Veriler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            await denemeAPI.createPlan(newPlan);
            setShowCreateModal(false);
            setNewPlan({ ad: '', planlanan_tarih: '', aciklama: '', gorev_tipi: 'deneme', brans_id: '', ekip_id: '' });
            fetchAll();
        } catch (error) {
            alert('Görev oluşturulamadı: ' + (error.response?.data?.message || error.message));
        } finally {
            setCreateLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !uploadingEventId) return;

        if (file.type !== 'application/pdf') {
            alert('Sadece PDF dosyaları yüklenebilir.');
            return;
        }

        const confirmMsg = "Dosyayı yüklemek istediğinize emin misiniz? Varsa eski dosyanın üzerine yazılacaktır.";
        if (!window.confirm(confirmMsg)) {
            e.target.value = null;
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('pdf_dosya', file);
            await denemeAPI.upload(uploadingEventId, formData);
            alert('Dosya başarıyla yüklendi.');
            fetchAll();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Yükleme başarısız: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
            setUploadingEventId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleViewFile = (uploadId) => {
        const token = localStorage.getItem('token');
        const url = `${import.meta.env.VITE_API_URL || '/api'}/denemeler/view/${uploadId}?token=${token}`;
        window.open(url, '_blank');
    };

    // Calendar Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Adjust to start from Monday
    };

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDayIndex = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

    const dates = [];
    for (let i = 0; i < firstDayIndex; i++) dates.push(null);
    for (let i = 1; i <= daysInMonth; i++) dates.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));

    const isSameDay = (d1, d2) => {
        if (!d1 || !d2) return false;
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const getEventsForDate = (date) => {
        if (!date) return [];
        return events.filter(e => {
            const ed = new Date(e.planlanan_tarih);
            return isSameDay(ed, date);
        });
    };

    const selectedEvents = getEventsForDate(selectedDate);

    const upcomingEvents = events
        .filter(e => new Date(e.planlanan_tarih) >= new Date().setHours(0, 0, 0, 0))
        .sort((a, b) => new Date(a.planlanan_tarih) - new Date(b.planlanan_tarih))
        .slice(0, 5); // İlk 5 gelecek işi göster

    return (
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 animate-fade-in pb-20 p-4">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" className="hidden" />

            {/* LEFT SIDE - CALENDAR & MAIN PLAN (COL 1-9) */}
            <div className="md:col-span-9 space-y-8">
                <div className="flex flex-col xl:flex-row gap-8 items-start">
                    {/* CALENDAR WIDGET (Sticky) */}
                    <aside className="w-full xl:w-[320px] shrink-0 xl:sticky xl:top-8">
                        <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-5">
                            <div className="flex items-center justify-between mb-6 px-1">
                                <div>
                                    <h2 className="text-base font-black text-gray-900 leading-tight">{MONTHS[currentDate.getMonth()]}</h2>
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{currentDate.getFullYear()}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={prevMonth} className="p-1.5 hover:bg-gray-50 rounded-lg transition-all"><ChevronLeftIcon className="w-4 h-4" /></button>
                                    <button onClick={nextMonth} className="p-1.5 hover:bg-gray-50 rounded-lg transition-all"><ChevronRightIcon className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-y-1 text-center">
                                {DAYS.map(day => (
                                    <div key={day} className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">{day}</div>
                                ))}
                                {dates.map((date, idx) => {
                                    if (!date) return <div key={`empty-${idx}`} />;
                                    const dayEvents = getEventsForDate(date);
                                    const isSelected = isSameDay(date, selectedDate);
                                    const isToday = isSameDay(date, new Date());

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedDate(date)}
                                            className={`
                                                relative group p-1.5 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5
                                                ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-gray-50 text-gray-700'}
                                            `}
                                        >
                                            <span className={`text-[10px] font-black ${isSelected ? 'text-white' : ''}`}>
                                                {date.getDate()}
                                            </span>
                                            {dayEvents.length > 0 && (
                                                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : (new Date(date) >= new Date().setHours(0, 0, 0, 0) ? 'bg-blue-500' : 'bg-gray-300')} animate-pulse`} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {isManagement && (
                                <button
                                    onClick={() => {
                                        setNewPlan({ ...newPlan, planlanan_tarih: formatDateForInput(selectedDate) });
                                        setShowCreateModal(true);
                                    }}
                                    className="w-full mt-6 py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 group active:scale-95"
                                >
                                    <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                    GÖREV TANIMLA
                                </button>
                            )}
                        </div>

                        {/* SUMMARY CARD */}
                        <div className="mt-6 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2rem] p-6 text-white shadow-xl hidden xl:block">
                            <h3 className="text-[11px] font-black uppercase tracking-tight mb-4">Özet</h3>
                            <div className="space-y-3">
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center justify-between">
                                    <span className="text-[9px] font-bold">Toplam Görev</span>
                                    <span className="text-sm font-black">{events.length}</span>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* DAY'S PLAN (Main Content) */}
                    <main className="flex-1 space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                                    {selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                                </h2>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Günün Planlanan İşleri</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <ArrowPathIcon className="w-10 h-10 text-indigo-100 animate-spin" strokeWidth={3} />
                                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Yükleniyor...</p>
                            </div>
                        ) : selectedEvents.length === 0 ? (
                            <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 p-16 text-center space-y-6">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                    <CalendarIcon className="w-8 h-8 text-gray-200" />
                                </div>
                                <h3 className="text-base font-black text-gray-300 uppercase tracking-tight">Kayıt Bulunmuyor</h3>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {selectedEvents.map((event, idx) => (
                                    <div key={event.id || idx} className="bg-white rounded-[2rem] p-5 shadow-lg shadow-gray-200/50 border border-gray-50 flex flex-col group hover:border-indigo-100 transition-all duration-500">
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
                                            <div className="flex items-center gap-6 flex-1">
                                                <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border-2 transition-all group-hover:scale-110
                                                    ${event.gorev_tipi === 'deneme' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                                                        event.gorev_tipi === 'fasikul' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                            'bg-emerald-50 border-emerald-100 text-emerald-600'}
                                                `}>
                                                    <DocumentTextIcon className="w-6 h-6" strokeWidth={2.5} />
                                                </div>
                                                <div className="space-y-1 flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-lg font-black text-gray-900 tracking-tight truncate">{event.ad}</h3>
                                                        <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.1em] border
                                                            ${event.gorev_tipi === 'deneme' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' :
                                                                event.gorev_tipi === 'fasikul' ? 'bg-amber-100 border-amber-200 text-amber-700' :
                                                                    'bg-emerald-100 border-emerald-200 text-emerald-700'}
                                                        `}>
                                                            {event.gorev_tipi.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 font-medium line-clamp-2">{event.aciklama}</p>
                                                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest pt-1">
                                                        {event.toplam_yukleme > 0 ? (
                                                            <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                                <CheckCircleIcon className="w-3.5 h-3.5" /> {event.toplam_yukleme} YÜKLEME
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-gray-400">
                                                                <ClockIcon className="w-3.5 h-3.5" /> DOSYA BEKLENİYOR
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                {/* BRANCH TEACHER VIEW FILE */}
                                                {event.my_upload_id && (
                                                    <button
                                                        onClick={() => handleViewFile(event.my_upload_id)}
                                                        className="shrink-0 px-4 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                                    >
                                                        <EyeIcon className="w-4 h-4" /> DOSYAYI GÖR
                                                    </button>
                                                )}

                                                {/* UPLOAD BUTTON FOR BRANCH TEACHERS */}
                                                {!isManagement && (
                                                    <button
                                                        onClick={() => {
                                                            setUploadingEventId(event.id);
                                                            if (fileInputRef.current) fileInputRef.current.click();
                                                        }}
                                                        className="shrink-0 px-4 py-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                                    >
                                                        <CloudArrowUpIcon className="w-4 h-4" /> DOSYA YÜKLE
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ADMIN/MANAGEMENT VIEW ALL UPLOADS LIST */}
                                        {isManagement && event.all_uploads && event.all_uploads.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-dashed border-gray-100 w-full animate-fade-in">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Yüklenen Dosyalar ({event.all_uploads.length})</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {event.all_uploads.map(upload => (
                                                        <div key={upload.id} className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 p-3 rounded-xl transition-colors group/item">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-gray-100 text-gray-400 font-bold text-[10px]">PDF</div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-gray-700 uppercase">{upload.brans_adi}</p>
                                                                    <p className="text-[9px] text-gray-400 font-bold">{upload.yukleyen_ad}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleViewFile(upload.id)}
                                                                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                                            >
                                                                <EyeIcon className="w-3 h-3" /> GÖRÜNTÜLE
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* RIGHT SIDEBAR - UPCOMING TASKS (Sticky) */}
            <aside className="md:col-span-3 space-y-4 md:sticky md:top-8 self-start">
                <div className="flex items-center justify-between px-4 mt-2">
                    <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Yaklaşan İşler</h3>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                </div>
                {upcomingEvents.length === 0 ? (
                    <div className="bg-white rounded-[2rem] p-6 text-center border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-300 uppercase">Planlanmış iş yok</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {upcomingEvents.map((event, idx) => (
                            <button
                                key={event.id || idx}
                                onClick={() => {
                                    setCurrentDate(new Date(event.planlanan_tarih));
                                    setSelectedDate(new Date(event.planlanan_tarih));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="w-full bg-white hover:bg-gray-50 p-4 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center gap-3 group transition-all text-left"
                            >
                                <div className="shrink-0 w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs">
                                    {new Date(event.planlanan_tarih).getDate()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[10px] font-black text-gray-900 uppercase truncate leading-tight">{event.ad}</h4>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                        {MONTHS[new Date(event.planlanan_tarih).getMonth()]}
                                    </p>
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-500 transition-colors" />
                            </button>
                        ))}
                    </div>
                )}
            </aside>

            {/* CREATE MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl animate-fade-in">
                    <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-xl shadow-2xl relative overflow-hidden animate-scale-up">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                        <div className="relative">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">Yeni Görev</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Seçili tarih için yeni plan oluştur</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition-all"><PlusIcon className="w-8 h-8 rotate-45 text-gray-400" /></button>
                            </div>

                            <form onSubmit={handleCreate} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Görev Tipi</label>
                                        <select
                                            value={newPlan.gorev_tipi}
                                            onChange={e => setNewPlan({ ...newPlan, gorev_tipi: e.target.value })}
                                            className="w-full bg-gray-50 border-none p-5 rounded-2xl font-black text-xs text-gray-900 focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none shadow-inner"
                                        >
                                            <option value="deneme">Deneme Sınavı</option>
                                            <option value="fasikul">Fasikül Yüklemesi</option>
                                            <option value="yaprak_test">Yaprak Test Yüklemesi</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Branş Ataması</label>
                                        <select
                                            value={newPlan.brans_id}
                                            onChange={e => setNewPlan({ ...newPlan, brans_id: e.target.value })}
                                            className="w-full bg-gray-50 border-none p-5 rounded-2xl font-black text-xs text-gray-900 focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none shadow-inner"
                                        >
                                            <option value="">Tüm Branşlar</option>
                                            {branslar.map(b => (
                                                <option key={b.id} value={b.id}>{b.brans_adi}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Planlanan Tarih</label>
                                        <input
                                            required
                                            type="date"
                                            value={newPlan.planlanan_tarih}
                                            onChange={e => setNewPlan({ ...newPlan, planlanan_tarih: e.target.value })}
                                            className="w-full bg-gray-50 border-none p-5 rounded-2xl font-black text-xs text-gray-900 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ekip Ataması</label>
                                        <select
                                            value={newPlan.ekip_id}
                                            onChange={e => setNewPlan({ ...newPlan, ekip_id: e.target.value })}
                                            className="w-full bg-gray-50 border-none p-5 rounded-2xl font-black text-xs text-gray-900 focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none shadow-inner"
                                        >
                                            <option value="">Tüm Ekipler</option>
                                            {ekipler.map(e => (
                                                <option key={e.id} value={e.id}>{e.ekip_adi}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Görev Başlığı</label>
                                    <input required type="text" value={newPlan.ad} onChange={e => setNewPlan({ ...newPlan, ad: e.target.value })} className="w-full bg-gray-50 border-none p-5 rounded-2xl font-black text-xs text-gray-900 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-inner" placeholder="örn: LGS FASİKÜL 3" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Açıklama</label>
                                    <textarea value={newPlan.aciklama} onChange={e => setNewPlan({ ...newPlan, aciklama: e.target.value })} className="w-full bg-gray-50 border-none p-5 rounded-2xl font-black text-xs text-gray-900 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-inner min-h-[120px]" placeholder="Opsiyonel detaylı açıklama..."></textarea>
                                </div>
                                <button disabled={createLoading} type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-200 transition-all flex justify-center mt-4 active:scale-95">
                                    {createLoading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : 'GÖREVİ LİSTEYE EKLE'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
