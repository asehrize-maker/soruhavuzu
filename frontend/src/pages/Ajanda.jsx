import { useState, useEffect } from 'react';
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
    SparklesIcon
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
        <div className="max-w-7xl mx-auto md:h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-8 animate-fade-in overflow-y-auto md:overflow-hidden pb-10 md:pb-0">
            {/* SIDEBAR - CALENDAR WIDGET */}
            <aside className="w-full md:w-[380px] shrink-0 space-y-8 flex flex-col overflow-y-auto pb-10">
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-4 sm:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-black text-gray-900 leading-tight">{MONTHS[currentDate.getMonth()]}</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{currentDate.getFullYear()}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-all"><ChevronLeftIcon className="w-5 h-5" /></button>
                            <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-all"><ChevronRightIcon className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-y-4 text-center">
                        {DAYS.map(day => (
                            <div key={day} className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2">{day}</div>
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
                                        relative group p-2 sm:p-3 rounded-2xl transition-all flex flex-col items-center justify-center gap-1
                                        ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-gray-50 text-gray-700'}
                                    `}
                                >
                                    <span className={`text-sm font-black ${isSelected ? 'text-white' : ''}`}>
                                        {date.getDate()}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : (new Date(date) >= new Date().setHours(0, 0, 0, 0) ? 'bg-blue-500' : 'bg-gray-300')} animate-pulse`} />
                                    )}
                                    {isToday && !isSelected && (
                                        <div className="absolute top-1 right-1 w-1 h-1 bg-rose-500 rounded-full" />
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
                            className="w-full mt-10 py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 group active:scale-95"
                        >
                            <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                            GÖREV TANIMLA
                        </button>
                    )}
                </div>

                {/* FILTERS / STATUS SUMMARY */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-2">Ajanda Özeti</h3>
                    <p className="text-[10px] font-bold text-indigo-100 opacity-70 uppercase tracking-widest mb-6">Branş bazlı görev takibi</p>
                    <div className="space-y-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
                            <span className="text-[11px] font-bold">Toplam Görev</span>
                            <span className="text-lg font-black">{events.length}</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
                            <span className="text-[11px] font-bold">Tamamlanan</span>
                            <span className="text-lg font-black">{events.filter(e => e.toplam_yukleme > 0).length}</span>
                        </div>
                    </div>
                </div>

                {/* YAKLAŞAN İŞLER LİSTESİ */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Yaklaşan İşler</h3>
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                    </div>
                    {upcomingEvents.length === 0 ? (
                        <div className="bg-white rounded-3xl p-6 text-center border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-300 uppercase">Planlanmış iş yok</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {upcomingEvents.map((event, idx) => (
                                <button
                                    key={event.id || idx}
                                    onClick={() => {
                                        setCurrentDate(new Date(event.planlanan_tarih));
                                        setSelectedDate(new Date(event.planlanan_tarih));
                                    }}
                                    className="w-full bg-white hover:bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 group transition-all text-left"
                                >
                                    <div className="shrink-0 w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">
                                        {new Date(event.planlanan_tarih).getDate()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[11px] font-black text-gray-900 uppercase truncate leading-tight">{event.ad}</h4>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">
                                            {new Date(event.planlanan_tarih).toLocaleDateString('tr-TR', { month: 'long', weekday: 'short' })}
                                        </p>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-500 transition-colors" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </aside>

            {/* MAIN PANEL - EVENTS FOR SELECTED DATE */}
            <main className="flex-1 overflow-y-auto space-y-8 pb-20">
                <div className="flex items-center justify-between px-4">
                    <div>
                        <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                            {selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                        </h2>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">Gününün Planlanan İşleri</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4">
                        <ArrowPathIcon className="w-10 h-10 text-indigo-100 animate-spin" strokeWidth={3} />
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Yükleniyor...</p>
                    </div>
                ) : selectedEvents.length === 0 ? (
                    <div className="bg-white rounded-[3.5rem] border-2 border-dashed border-gray-100 p-32 text-center space-y-6">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CalendarIcon className="w-12 h-12 text-gray-200" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-gray-300 uppercase tracking-tight">Kayıt Bulunmuyor</h3>
                            <p className="text-xs text-gray-400 font-medium">Bu tarihe ait planlanmış bir görev veya deneme yok.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 px-2">
                        {selectedEvents.map((event, idx) => (
                            <div key={event.id || idx} className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col md:flex-row items-center justify-between gap-8 group hover:border-indigo-100 transition-all duration-500">
                                <div className="flex items-center gap-8">
                                    <div className={`w-20 h-20 rounded-[2rem] flex flex-col items-center justify-center border-2 transition-all group-hover:scale-110 shadow-sm
                                        ${event.gorev_tipi === 'deneme' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                                            event.gorev_tipi === 'fasikul' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                'bg-emerald-50 border-emerald-100 text-emerald-600'}
                                    `}>
                                        <DocumentTextIcon className="w-8 h-8" strokeWidth={2.5} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{event.ad}</h3>
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border
                                                ${event.gorev_tipi === 'deneme' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' :
                                                    event.gorev_tipi === 'fasikul' ? 'bg-amber-100 border-amber-200 text-amber-700' :
                                                        'bg-emerald-100 border-emerald-200 text-emerald-700'}
                                            `}>
                                                {event.gorev_tipi.toUpperCase()}
                                            </span>
                                            {event.brans_id && (
                                                <span className="px-4 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[9px] font-black uppercase tracking-[0.2em]">
                                                    {branslar.find(b => b.id === event.brans_id)?.brans_adi || 'ÖZEL'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium max-w-xl">{event.aciklama}</p>
                                        <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">
                                            <span className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4" /> {new Date(event.olusturma_tarihi).toLocaleDateString()} OLUŞTURULDU</span>
                                            <span className="w-1.5 h-1.5 bg-gray-200 rounded-full"></span>
                                            <span className="flex items-center gap-1.5 text-indigo-500"><SparklesIcon className="w-4 h-4" /> {event.toplam_yukleme || 0} DOSYA YÜKLENDİ</span>
                                        </div>
                                        {isManagement && event.all_uploads && event.all_uploads.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50 mt-4">
                                                {event.all_uploads.map((up, i) => (
                                                    <div key={i} className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-tighter">{up.brans_adi}:</span>
                                                        <span className="text-[9px] font-bold text-gray-400 capitalize">{up.yukleyen_ad}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => navigate('/denemeler')} className="bg-gray-50 hover:bg-indigo-600 hover:text-white text-gray-600 p-4 rounded-2xl transition-all shadow-sm group-hover:scale-105 active:scale-95 group/btn flex items-center gap-2">
                                        <EyeIcon className="w-6 h-6" />
                                        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover/btn:block">Detayı Gör</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

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
