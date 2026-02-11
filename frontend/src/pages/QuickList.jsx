import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { soruAPI, bransAPI, userAPI, ekipAPI } from '../services/api';
import { getDurumBadge } from '../utils/helpers';
import {
    ListBulletIcon,
    ArrowPathIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';

export default function QuickList() {
    const { type } = useParams();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const getTitle = () => {
        switch (type) {
            case 'soru': return 'Tüm Sorular Listesi';
            case 'kullanici': return 'Kullanıcı Listesi';
            case 'brans': return 'Branş Listesi';
            case 'ekip': return 'Ekip Listesi';
            default: return 'Liste';
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let res;
                if (type === 'soru') res = await soruAPI.getAll();
                else if (type === 'kullanici') res = await userAPI.getAll();
                else if (type === 'brans') res = await bransAPI.getAll();
                else if (type === 'ekip') res = await ekipAPI.getAll();

                setData(res.data.data || []);
            } catch (err) {
                console.error("QuickView error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [type]);

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-xl flex flex-col overflow-hidden border border-gray-100">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase italic flex items-center gap-3">
                            <ListBulletIcon className="w-8 h-8 text-blue-600" /> {getTitle()}
                        </h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Toplam {data.length} kayıt listelendi</p>
                    </div>
                    <button onClick={() => window.close()} className="p-3 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all font-bold text-xs flex items-center gap-2 border border-gray-100">
                        Pencereyi Kapat <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-4">
                            <ArrowPathIcon className="w-12 h-12 text-blue-600 animate-spin" />
                            <p className="text-gray-400 font-black text-xs uppercase tracking-widest animate-pulse">Veriler yükleniyor...</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 font-bold italic bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                            Kayıt bulunamadı.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {data.map((item, idx) => (
                                <div key={item.id || idx} className="p-5 bg-white rounded-2xl border border-gray-100 flex items-center justify-between group hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-sm font-black text-gray-800 leading-tight">
                                            {type === 'soru' ? (item.soru_metni?.replace(/<[^>]*>?/gm, '').substring(0, 120) || 'Metinsiz Soru') :
                                                type === 'kullanici' ? item.ad_soyad :
                                                    type === 'brans' ? item.brans_adi :
                                                        item.ekip_adi || 'İsimsiz Ekip'}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="px-2 py-0.5 bg-gray-100 text-[9px] font-black text-gray-500 uppercase tracking-widest rounded-md">
                                                {type === 'soru' ? `ID: #${item.id} | ${item.brans_adi || 'Branşsız'}` :
                                                    type === 'kullanici' ? `${item.rol?.toUpperCase()} | ${item.email}` :
                                                        type === 'brans' ? (item.ekip_adi || 'Ekipsiz') :
                                                            'Sistem Ekibi'}
                                            </span>
                                            {type === 'soru' && getDurumBadge(item.durum)}
                                            {type === 'kullanici' && (
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${item.aktif ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                    {item.aktif ? 'AKTİF' : 'PASİF'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50/50 text-center border-t border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        Salt Okunur Görünüm (İşlem yapılamaz)
                    </p>
                </div>
            </div>
        </div>
    );
}
