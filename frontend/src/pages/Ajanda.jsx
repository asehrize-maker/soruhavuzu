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
    SparklesIcon,
    InformationCircleIcon
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
        <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20 pt-10 text-center">
            <CalendarIcon className="w-20 h-20 text-gray-200 mx-auto" />
            <h1 className="text-2xl font-black text-gray-300 uppercase tracking-widest">İçerik Hazırlanıyor...</h1>
        </div>
    );
}
