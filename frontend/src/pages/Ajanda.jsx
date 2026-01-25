import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import {
    CalendarIcon,
    ArrowPathIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    TrashIcon,
    ArrowsRightLeftIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

export default function Ajanda() {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await userAPI.getAgendaStats();
            if (res.data.success) {
                setStats(res.data.data);
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

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Sistem Ajandası</h1>
                    <p className="text-gray-500 mt-1">Son 30 günün işlem özetlerini ve yoğunluğunu takip edin.</p>
                </div>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="btn btn-secondary flex items-center gap-2"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Güncelle
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                            <ClockIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-400 uppercase">ORTALAMA İŞLEM</p>
                            <h3 className="text-3xl font-black text-gray-800">
                                {stats.length > 0 ? (stats.reduce((acc, curr) => acc + parseInt(curr.toplam_aktivite), 0) / stats.length).toFixed(1) : 0}
                            </h3>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">Günlük ortalama tamamlanan işlem sayısı</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                            <PencilSquareIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-400 uppercase">EN VERİMLİ GÜN</p>
                            <h3 className="text-3xl font-black text-gray-800">
                                {(stats.length > 0 && stats.sort((a, b) => b.toplam_aktivite - a.toplam_aktivite)[0]?.toplam_aktivite) || 0}
                            </h3>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">30 gün içindeki maksimum işlem hacmi</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                            <CalendarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-400 uppercase">TOPLAM ETKİLEŞİM</p>
                            <h3 className="text-3xl font-black text-gray-800">
                                {stats.reduce((acc, curr) => acc + parseInt(curr.toplam_aktivite), 0)}
                            </h3>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">Son 30 günde kaydedilen toplam hareket</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6 text-indigo-600" />
                        Günlük İşlem Panosu
                    </h2>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Tarih</th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">Soru Ekleme</th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">Durum Değişikliği</th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">Dizgi İşleri</th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">Silme</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.map((row) => (
                                    <tr key={row.tarih} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                                            {new Date(row.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-base font-black ${parseInt(row.soru_ekleme) > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                                                    {row.soru_ekleme}
                                                </span>
                                                <PencilSquareIcon className={`w-4 h-4 mt-1 ${parseInt(row.soru_ekleme) > 0 ? 'text-green-400' : 'text-gray-200'}`} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-base font-black ${parseInt(row.durum_degisikligi) > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                                    {row.durum_degisikligi}
                                                </span>
                                                <ArrowsRightLeftIcon className={`w-4 h-4 mt-1 ${parseInt(row.durum_degisikligi) > 0 ? 'text-blue-400' : 'text-gray-200'}`} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-base font-black ${parseInt(row.dizgi_isleri) > 0 ? 'text-purple-600' : 'text-gray-300'}`}>
                                                    {row.dizgi_isleri}
                                                </span>
                                                <CheckCircleIcon className={`w-4 h-4 mt-1 ${parseInt(row.dizgi_isleri) > 0 ? 'text-purple-400' : 'text-gray-200'}`} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-base font-black ${parseInt(row.soru_silme) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                                    {row.soru_silme}
                                                </span>
                                                <TrashIcon className={`w-4 h-4 mt-1 ${parseInt(row.soru_silme) > 0 ? 'text-red-400' : 'text-gray-200'}`} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-black bg-gray-100 text-gray-800 border border-gray-200">
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
        </div>
    );
}
