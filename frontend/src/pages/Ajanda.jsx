import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import {
    CalendarIcon,
    ArrowPathIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    TrashIcon,
    ArrowsRightLeftIcon,
    ClockIcon,
    ChartBarIcon,
    TrophyIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';

export default function Ajanda() {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await userAPI.getAgendaStats();
            if (res.data.success) {
                setStats(res.data.data || []);
            }
        } catch (error) {
            console.error('Ajanda istatistikleri yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const totalActivity = stats.reduce((acc, curr) => acc + parseInt(curr.toplam_aktivite), 0);
    const averageActivity = stats.length > 0 ? (totalActivity / stats.length).toFixed(1) : 0;
    const peakActivity = (stats.length > 0 && Math.max(...stats.map(s => parseInt(s.toplam_aktivite)))) || 0;

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <CalendarIcon className="w-12 h-12 text-blue-600" strokeWidth={2.5} />
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Sistem Ajandası</h1>
                    </div>
                    <p className="text-gray-500 font-medium">Son 30 günün işlem özetlerini, sistem yoğunluğunu ve verimlilik grafiklerini takip edin.</p>
                </div>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="bg-white hover:bg-gray-50 text-gray-700 rounded-2xl px-6 py-4 transition-all shadow-sm border border-gray-100 active:scale-95 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    VERİLERİ GÜNCELLE
                </button>
            </div>

            {/* PREVIEW CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-50 relative overflow-hidden group hover:-translate-y-1 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <ClockIcon className="w-20 h-20" />
                    </div>
                    <div className="relative z-10 space-y-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-fit border border-blue-100">
                            <ChartBarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">GÜNLÜK ORTALAMA</p>
                            <h3 className="text-4xl font-black text-gray-900">{averageActivity}</h3>
                        </div>
                        <p className="text-xs text-gray-400 font-medium italic">Günde tamamlanan ortalama işlem hacmi.</p>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-50 relative overflow-hidden group hover:-translate-y-1 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform text-emerald-500">
                        <SparklesIcon className="w-20 h-20" />
                    </div>
                    <div className="relative z-10 space-y-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit border border-emerald-100">
                            <TrophyIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ZİRVE PERFORMANS</p>
                            <h3 className="text-4xl font-black text-gray-900">{peakActivity}</h3>
                        </div>
                        <p className="text-xs text-gray-400 font-medium italic">30 günlük dönemdeki en yüksek işlem sayısı.</p>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-50 relative overflow-hidden group hover:-translate-y-1 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform text-indigo-500">
                        <ArrowsRightLeftIcon className="w-20 h-20" />
                    </div>
                    <div className="relative z-10 space-y-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit border border-indigo-100">
                            <CalendarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">TOPLAM ETKİLEŞİM</p>
                            <h3 className="text-4xl font-black text-gray-900">{totalActivity}</h3>
                        </div>
                        <p className="text-xs text-gray-400 font-medium italic">Son bir ayda kaydedilen toplam veritabanı hareketi.</p>
                    </div>
                </div>
            </div>

            {/* MAIN CHART TABLE */}
            <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden flex flex-col">
                <div className="p-10 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <SparklesIcon className="w-8 h-8 text-blue-500" />
                        İşlem Trafik Panosu
                    </h2>
                    <div className="px-5 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest">SON 30 GÜN</div>
                </div>

                {loading ? (
                    <div className="p-32 text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-blue-600 mx-auto"></div>
                        <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">Veriler Analiz Ediliyor...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-50">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tarih</th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Soru Üretimi</th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Süreç Yönetimi</th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Finalizasyon</th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Veri Temizliği</th>
                                    <th className="px-10 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">GÜNLÜK TOPLAM</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.map((row) => (
                                    <tr key={row.tarih} className="hover:bg-blue-50/20 transition-all group">
                                        <td className="px-10 py-6 whitespace-nowrap">
                                            <div className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {new Date(row.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(row.tarih).toLocaleDateString('tr-TR', { weekday: 'long' })}</div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xl font-black ${parseInt(row.soru_ekleme) > 0 ? 'text-emerald-500' : 'text-gray-200'}`}>
                                                    {row.soru_ekleme}
                                                </span>
                                                <PencilSquareIcon className={`w-4 h-4 mt-1 ${parseInt(row.soru_ekleme) > 0 ? 'text-emerald-200' : 'text-gray-100'}`} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xl font-black ${parseInt(row.durum_degisikligi) > 0 ? 'text-blue-500' : 'text-gray-200'}`}>
                                                    {row.durum_degisikligi}
                                                </span>
                                                <ArrowsRightLeftIcon className={`w-4 h-4 mt-1 ${parseInt(row.durum_degisikligi) > 0 ? 'text-blue-200' : 'text-gray-100'}`} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xl font-black ${parseInt(row.dizgi_isleri) > 0 ? 'text-violet-500' : 'text-gray-200'}`}>
                                                    {row.dizgi_isleri}
                                                </span>
                                                <CheckCircleIcon className={`w-4 h-4 mt-1 ${parseInt(row.dizgi_isleri) > 0 ? 'text-violet-200' : 'text-gray-100'}`} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xl font-black ${parseInt(row.soru_silme) > 0 ? 'text-rose-500' : 'text-gray-200'}`}>
                                                    {row.soru_silme}
                                                </span>
                                                <TrashIcon className={`w-4 h-4 mt-1 ${parseInt(row.soru_silme) > 0 ? 'text-rose-200' : 'text-gray-100'}`} />
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right whitespace-nowrap">
                                            <span className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-black bg-gray-900 text-white shadow-lg shadow-gray-200">
                                                {row.toplam_aktivite}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 flex items-start gap-4 mx-4">
                <InformationCircleIcon className="w-8 h-8 text-indigo-600 mt-1 flex-shrink-0" />
                <div className="space-y-2">
                    <h6 className="text-[11px] font-black text-indigo-900 uppercase tracking-[0.2em]">Veri Analizi Notu</h6>
                    <p className="text-sm text-indigo-700 font-medium leading-relaxed italic pr-10">Bu grafiklerdeki veriler her gün gece yarısı 00:00'da veritabanı loglarından senkronize edilmektedir. Anlık yapılan işlemler takip eden günün istatistiklerine yansır.</p>
                </div>
            </div>
        </div>
    );
}
