import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import {
    ArrowPathIcon,
    CircleStackIcon,
    ComputerDesktopIcon,
    ClockIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { translateKey } from '../utils/helpers';

export default function Logs() {
    const [loginLogs, setLoginLogs] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('login'); // 'login' or 'activity'
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const fetchLogs = async () => {
        setLoading(true);
        setCurrentPage(1);
        try {
            if (activeTab === 'login') {
                const res = await userAPI.getLoginLogs();
                if (res.data.success) setLoginLogs(res.data.data || []);
            } else {
                const res = await userAPI.getActivityLogs();
                if (res.data.success) setActivityLogs(res.data.data || []);
            }
        } catch (error) {
            console.error('Loglar yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [activeTab]);

    const currentLogs = activeTab === 'login' ? loginLogs : activityLogs;
    const totalPages = Math.ceil(currentLogs.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const paginatedLogs = currentLogs.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Sistem Denetimi</h1>
                    <p className="mt-2 text-gray-500 font-medium">Tüm kullanıcı hareketlerini ve sistem loglarını şeffaf bir şekilde izleyin.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-sm">
                        <button
                            onClick={() => setActiveTab('login')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <ComputerDesktopIcon className="w-4 h-4" />
                            Giriş Kayıtları
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'activity' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <CircleStackIcon className="w-4 h-4" />
                            İşlem Kayıtları
                        </button>
                    </div>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="bg-white hover:bg-gray-50 text-gray-700 rounded-2xl p-4 transition-all shadow-sm border border-gray-100 active:scale-95 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* TABLE CARD */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="p-32 text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-blue-600 mx-auto"></div>
                        <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em]">Veriler İşleniyor...</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-50">
                                <thead className="bg-gray-50/50">
                                    {activeTab === 'login' ? (
                                        <tr>
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Kullanıcı</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Zaman Damgası</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Sorumlu</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">İşlem Türü</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Detay / Açıklama</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Tarih</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-gray-50 bg-white">
                                    {activeTab === 'login' ? (
                                        paginatedLogs.length > 0 ? paginatedLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-black text-xs group-hover:bg-white transition-colors">
                                                            {log.ad_soyad?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-gray-900">{log.ad_soyad}</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{log.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                                        <ClockIcon className="w-4 h-4 text-gray-300" />
                                                        {new Date(log.tarih).toLocaleDateString('tr-TR')} <span className="text-gray-300 font-medium">|</span> {new Date(log.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="2" className="p-20 text-center text-gray-300 font-bold uppercase tracking-widest text-xs italic">Kayıt Bulunamadı.</td></tr>
                                        )
                                    ) : (
                                        paginatedLogs.length > 0 ? paginatedLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-purple-50/30 transition-colors group">
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-black text-xs text-center uppercase group-hover:bg-white transition-colors">
                                                            {log.ad_soyad?.substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-gray-900">{log.ad_soyad}</div>
                                                            <div className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-0.5">{log.rol}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border ${log.islem_turu.includes('silme') ? 'bg-red-50 text-red-600 border-red-100' :
                                                        log.islem_turu.includes('ekleme') || log.islem_turu.includes('create') ? 'bg-green-50 text-green-600 border-green-100' :
                                                            'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                        }`}>
                                                        {translateKey(log.islem_turu)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-bold text-gray-600 leading-relaxed">
                                                    {log.aciklama}
                                                </td>
                                                <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-bold text-gray-400">
                                                    {new Date(log.tarih).toLocaleDateString('tr-TR')} <span className="text-gray-200 font-medium mx-1">/</span> {new Date(log.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="p-20 text-center text-gray-300 font-bold uppercase tracking-widest text-xs italic">Kayıt Bulunamadı.</td></tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">
                                Toplam <span className="text-gray-900">{currentLogs.length}</span> olay kaydı <span className="mx-2">|</span> Sayfa <span className="text-gray-900">{currentPage} / {totalPages || 1}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeftIcon className="w-5 h-5" />
                                </button>

                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                        const pageNum = i + 1;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 text-[11px] font-black rounded-lg transition-all ${currentPage === pageNum
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRightIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>


        </div>
    );
}
