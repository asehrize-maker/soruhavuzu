import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import {
    Cog6ToothIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    CloudArrowUpIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

export default function Settings() {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await userAPI.getSettings();
            if (res.data.success) {
                setSettings(res.data.data || []);
            }
        } catch (error) {
            console.error('Ayarlar yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleChange = (anahtar, deger) => {
        setSettings(prev => prev.map(s =>
            s.anahtar === anahtar ? { ...s, deger } : s
        ));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const res = await userAPI.updateSettings({ ayarlar: settings });
            if (res.data.success) {
                setMessage({ type: 'success', text: 'Sistem konfigürasyonu başarıyla güncellendi.' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Konfigürasyon kaydedilirken bir hata oluştu.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Cog6ToothIcon className="w-12 h-12 text-gray-900" strokeWidth={2.5} />
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Sistem Ayarları</h1>
                    </div>
                    <p className="text-gray-500 font-medium">Sistem çekirdek ayarlarını, görünüm ve güvenlik tercihlerini buradan yapılandırın.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Genel Konfigürasyon</div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-96 bg-white rounded-[3rem] border border-gray-100 shadow-sm">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-gray-900"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* SETTINGS FORM */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSave} className="bg-white p-10 rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50 space-y-10">
                            <div className="space-y-8">
                                {settings.map((setting) => (
                                    <div key={setting.anahtar} className="group transition-all">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                            <div className="space-y-1">
                                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-900 transition-colors">
                                                    {setting.anahtar.replace(/_/g, ' ')}
                                                </label>
                                                <p className="text-xs text-gray-400 font-medium leading-relaxed italic pr-10">
                                                    {setting.aciklamalar}
                                                </p>
                                            </div>

                                            <div className="flex-shrink-0">
                                                {setting.deger === 'true' || setting.deger === 'false' ? (
                                                    <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleChange(setting.anahtar, setting.deger === 'true' ? 'false' : 'true')}
                                                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${setting.deger === 'true' ? 'bg-blue-600' : 'bg-gray-300'}`}
                                                        >
                                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${setting.deger === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                                                        </button>
                                                        <span className={`text-[10px] pr-2 font-black uppercase tracking-widest ${setting.deger === 'true' ? 'text-blue-600' : 'text-gray-400'}`}>
                                                            {setting.deger === 'true' ? 'AKTİF' : 'PASİF'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="relative min-w-[200px]">
                                                        <input
                                                            type="text"
                                                            value={setting.deger}
                                                            onChange={(e) => handleChange(setting.anahtar, e.target.value)}
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none group-hover:bg-white"
                                                            placeholder="Değer..."
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-px bg-gray-50 w-full"></div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                                {message && (
                                    <div className={`flex-1 p-4 rounded-2xl flex items-center gap-3 animate-bounce-short w-full ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                                        }`}>
                                        {message.type === 'success' ? <CheckBadgeIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                                        <span className="text-xs font-black uppercase tracking-widest">{message.text}</span>
                                    </div>
                                )}
                                <div className="flex gap-4 w-full sm:w-auto ml-auto">
                                    <button
                                        type="button"
                                        onClick={fetchSettings}
                                        className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-700 transition active:scale-95"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-gray-900 border border-black hover:bg-black text-white px-10 py-5 rounded-3xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CloudArrowUpIcon className="w-5 h-5" />}
                                        Değişiklikleri Yayınla
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* TIPS / INFO */}
                    <div className="space-y-8">
                        <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 space-y-4">
                            <ExclamationTriangleIcon className="w-10 h-10 text-amber-600 mb-2" strokeWidth={2} />
                            <h4 className="text-lg font-black text-amber-900 tracking-tight">Kritik Uyarı</h4>
                            <p className="text-sm text-amber-700 font-bold leading-relaxed italic opacity-80 uppercase tracking-tight">
                                Bu sayfada yaptığınız tüm değişiklikler sunucu seviyesinde anında devreye girer. <br /><br />
                                <b>Bakım Modu:</b> Adminler hariç herkesin erişimini keser. <br />
                                <b>Kayıt Durumu:</b> Login sayfasındaki kayıt ol butonunu kontrol eder.
                            </p>
                        </div>

                        <div className="bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 space-y-4">
                            <AdjustmentsHorizontalIcon className="w-10 h-10 text-blue-600 mb-2" strokeWidth={2} />
                            <h4 className="text-lg font-black text-blue-900 tracking-tight">Site Kimliği</h4>
                            <p className="text-sm text-blue-700 font-medium leading-relaxed italic">
                                Site Başlığı ayarı tarayıcı sekme adını ve sistem genelindeki ana başlıkları dinamik olarak değiştirir. Kurumsal kimlik için bu alanı düzenli tutunuz.
                            </p>
                        </div>

                        <div className="bg-gray-50 border border-gray-100 p-8 rounded-[2.5rem] text-center space-y-2">
                            <InformationCircleIcon className="w-8 h-8 text-gray-300 mx-auto" />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sistem Versiyonu 1.4.2 (Stable)</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to keep icon imports happy
function CheckBadgeIcon(props) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
    );
}
