import { useState, useEffect } from 'react';
import { denemeAPI } from '../services/api';
import {
    CalendarIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentTextIcon,
    ClockIcon,
    EyeIcon
} from '@heroicons/react/24/outline';

export default function Ajanda() {
    const [agendaData, setAgendaData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAgenda = async () => {
        setLoading(true);
        try {
            const res = await denemeAPI.getAgenda();
            if (res.data.success) {
                setAgendaData(res.data.data || []);
            }
        } catch (error) {
            console.error('Ajanda verileri yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgenda();
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <CalendarIcon className="w-12 h-12 text-indigo-600" strokeWidth={2.5} />
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Deneme Takvimi</h1>
                    </div>
                    <p className="text-gray-500 font-medium">Planlanan denemeler ve branş bazlı yükleme durumları.</p>
                </div>
                <button
                    onClick={fetchAgenda}
                    disabled={loading}
                    className="bg-white hover:bg-gray-50 text-gray-700 rounded-2xl px-6 py-4 transition-all shadow-sm border border-gray-100 active:scale-95 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    DURUMLARI GÜNCELLE
                </button>
            </div>

            {/* AGENDA LIST */}
            <div className="space-y-8">
                {loading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">VERİLER YÜKLENİYOR...</p>
                    </div>
                ) : agendaData.length === 0 ? (
                    <div className="p-20 text-center bg-white rounded-[3rem] border border-gray-100 shadow-xl shadow-gray-200/50">
                        <CalendarIcon className="w-20 h-20 text-gray-200 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">Planlanmış deneme bulunamadı.</h3>
                    </div>
                ) : (
                    agendaData.map((item, index) => {
                        const deneme = item.deneme;
                        const planDate = new Date(deneme.planlanan_tarih);
                        const isPast = planDate < new Date().setHours(0, 0, 0, 0);

                        return (
                            <div key={deneme.id || index} className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden">
                                <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            {isPast && <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">TAMAMLANDI</span>}
                                        </div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">{deneme.ad}</h2>
                                        <p className="text-sm text-gray-500 font-medium">{deneme.aciklama}</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <ClockIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">PLANLANAN TARİH</p>
                                            <p className="text-lg font-black text-gray-900">
                                                {planDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">{planDate.toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8">
                                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <DocumentTextIcon className="w-4 h-4" /> BRANŞ YÜKLEME DURUMLARI
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {item.details.map((det, i) => (
                                            <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${det.completed
                                                ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-200'
                                                : (isPast ? 'bg-rose-50 border-rose-100 hover:border-rose-200' : 'bg-gray-50 border-gray-100 hover:border-gray-200')
                                                }`}>
                                                <div>
                                                    <p className={`text-xs font-black uppercase tracking-wide ${det.completed ? 'text-emerald-700' : (isPast ? 'text-rose-700' : 'text-gray-700')}`}>
                                                        {det.brans.brans_adi}
                                                    </p>
                                                    <p className="text-[9px] font-bold opacity-60 mt-1">
                                                        {det.completed
                                                            ? `Yüklendi: ${new Date(det.upload.yukleme_tarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                                                            : (isPast ? 'Yükleme Yapılmadı' : 'Bekleniyor')
                                                        }
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {det.completed && det.upload?.dosya_url && (
                                                        <a
                                                            href={det.upload.dosya_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                                                            title="Dosyayı Gör"
                                                        >
                                                            <EyeIcon className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${det.completed
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : (isPast ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-400')
                                                        }`}>
                                                        {det.completed
                                                            ? <CheckCircleIcon className="w-5 h-5" />
                                                            : (isPast ? <XCircleIcon className="w-5 h-5" /> : <ClockIcon className="w-5 h-5" />)
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>


        </div>
    );
}
