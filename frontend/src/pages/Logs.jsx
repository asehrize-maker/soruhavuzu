import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import {
    ShieldCheckIcon,
    ArrowPathIcon,
    CircleStackIcon,
    UserCircleIcon,
    ComputerDesktopIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

export default function Logs() {
    const [loginLogs, setLoginLogs] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('login'); // 'login' or 'activity'
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            if (activeTab === 'login') {
                const res = await userAPI.getLoginLogs();
                if (res.data.success) setLoginLogs(res.data.data);
            } else {
                const res = await userAPI.getActivityLogs();
                if (res.data.success) setActivityLogs(res.data.data);
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

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Sistem Logları</h1>
                    <p className="text-gray-500 mt-1">Sisteme giriş ve işlem geçmişini buradan takip edebilirsiniz.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="btn btn-secondary flex items-center gap-2"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Yenile
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 max-w-md">
                <button
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'login'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <ComputerDesktopIcon className="w-5 h-5" />
                    Giriş Kayıtları
                </button>
                <button
                    onClick={() => setActiveTab('activity')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'activity'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <CircleStackIcon className="w-5 h-5" />
                    İşlem Kayıtları
                </button>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                        <p className="mt-4 text-gray-500 font-medium">Loglar getiriliyor...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                {activeTab === 'login' ? (
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kullanıcı</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">IP Adresi</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tarih / Saat</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tarayıcı</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kullanıcı</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">İşlem</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Açıklama</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tarih / Saat</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50 bg-white">
                                {activeTab === 'login' ? (
                                    loginLogs.length > 0 ? loginLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                        {log.ad_soyad?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900">{log.ad_soyad}</div>
                                                        <div className="text-xs text-gray-500">{log.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                    {log.ip_adresi || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="w-4 h-4 text-gray-400" />
                                                    {new Date(log.tarih).toLocaleDateString('tr-TR')} {new Date(log.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 max-w-xs truncate">
                                                {log.user_agent}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="4" className="p-8 text-center text-gray-500 italic">Giriş kaydı bulunamadı.</td></tr>
                                    )
                                ) : (
                                    activityLogs.length > 0 ? activityLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs text-center uppercase">
                                                        {log.ad_soyad?.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900">{log.ad_soyad}</div>
                                                        <div className="text-xs text-purple-600 font-medium">{log.rol}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${log.islem_turu.includes('silme') ? 'bg-red-100 text-red-700' :
                                                        log.islem_turu.includes('ekleme') ? 'bg-green-100 text-green-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {log.islem_turu.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {log.aciklama}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(log.tarih).toLocaleDateString('tr-TR')} {new Date(log.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="4" className="p-8 text-center text-gray-500 italic">İşlem kaydı bulunamadı.</td></tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
