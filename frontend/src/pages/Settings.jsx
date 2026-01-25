import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import {
    Cog6ToothIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    CloudArrowUpIcon,
    ArrowPathIcon
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
                setSettings(res.data.data);
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
                setMessage({ type: 'success', text: 'Sistem ayarları başarıyla güncellendi.' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Ayarlar kaydedilirken bir hata oluştu.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Site Ayarları</h1>
                    <p className="text-gray-500 mt-1">Sistemin genel işleyişini ve görünümünü buradan yönetebilirsiniz.</p>
                </div>
                <Cog6ToothIcon className="w-10 h-10 text-gray-300" />
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-bounce-short ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                    <span className="font-bold">{message.text}</span>
                </div>
            )}

            <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8">
                <div className="space-y-6">
                    {settings.map((setting) => (
                        <div key={setting.anahtar} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                            <div className="space-y-1">
                                <label className="block text-sm font-black text-gray-700 uppercase tracking-wider">
                                    {setting.anahtar.replace(/_/g, ' ')}
                                </label>
                                <p className="text-xs text-gray-400 leading-relaxed italic">
                                    {setting.aciklamalar}
                                </p>
                            </div>
                            <div className="md:col-span-2">
                                {setting.deger === 'true' || setting.deger === 'false' ? (
                                    <div className="flex items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => handleChange(setting.anahtar, setting.deger === 'true' ? 'false' : 'true')}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${setting.deger === 'true' ? 'bg-blue-600' : 'bg-gray-200'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${setting.deger === 'true' ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                        <span className={`text-sm font-bold uppercase ${setting.deger === 'true' ? 'text-blue-600' : 'text-gray-400'}`}>
                                            {setting.deger === 'true' ? 'AÇIK' : 'KAPALI'}
                                        </span>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={setting.deger}
                                        onChange={(e) => handleChange(setting.anahtar, e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                        placeholder="Değer giriniz..."
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={fetchSettings}
                        className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition"
                    >
                        İptal
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary flex items-center gap-2 px-10"
                    >
                        {saving ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CloudArrowUpIcon className="w-5 h-5" />}
                        Ayarları Kaydet
                    </button>
                </div>
            </form>

            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                <div className="flex items-start gap-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                    <div className="space-y-2">
                        <h4 className="font-black text-amber-800 uppercase tracking-widest text-sm">Dikkat</h4>
                        <p className="text-sm text-amber-700 leading-relaxed">
                            Bu sayfadaki değişiklikler tüm sistemi etkiler. Özellikle <b>Bakım Modu</b> ve <b>Kayıt Durumu</b> gibi ayarları değiştirirken dikkatli olunuz.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
