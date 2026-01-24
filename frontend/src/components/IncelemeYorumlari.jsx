import { useState, useEffect } from 'react';
import { soruAPI } from '../services/api';

export default function IncelemeYorumlari({ soruId }) {
    const [yorumlar, setYorumlar] = useState([]);
    const [yeniYorum, setYeniYorum] = useState('');
    const [loading, setLoading] = useState(true);

    const loadYorumlar = async () => {
        try {
            const res = await soruAPI.getComments(soruId);
            setYorumlar(res.data.data);
        } catch (e) {
            // silent error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadYorumlar(); }, [soruId]);

    const handleYorumEkle = async () => {
        if (!yeniYorum.trim()) return;
        try {
            await soruAPI.addComment(soruId, yeniYorum);
            setYeniYorum('');
            loadYorumlar();
        } catch (e) {
            // silent error
        }
    };

    return (
        <div className="flex flex-col h-full min-h-[200px]">
            <div className="flex-1 space-y-3">
                {loading ? <p className="text-center text-gray-400">Yükleniyor...</p> : yorumlar.length === 0 ? <p className="text-center text-gray-400 italic text-sm">Hiç yorum yok.</p> :
                    yorumlar.map((y) => (
                        <div key={y.id} className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="font-bold text-gray-900">{y.ad_soyad} <span className="text-[10px] font-normal text-gray-400 uppercase">({y.rol})</span></span>
                                <span className="text-[10px] text-gray-400">{new Date(y.tarih).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap">{y.yorum_metni}</p>
                        </div>
                    ))}
            </div>
            <div className="mt-6 flex gap-2">
                <input type="text" className="input shadow-inner" placeholder="İnceleme notu yazın..." value={yeniYorum} onChange={(e) => setYeniYorum(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleYorumEkle()} />
                <button onClick={handleYorumEkle} className="btn btn-primary px-8">Ekle</button>
            </div>
        </div>
    );
}
