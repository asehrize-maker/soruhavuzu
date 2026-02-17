import { useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import useNotificationStore from '../store/notificationStore';

export default function NotificationBar() {
    const { message, type, isVisible, hideNotification } = useNotificationStore();

    if (!isVisible) return null;

    const getStyles = () => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-emerald-600',
                    border: 'border-emerald-700',
                    icon: <CheckCircleIcon className="w-6 h-6 text-white" strokeWidth={2} />,
                    title: 'BAŞARILI'
                };
            case 'error':
                return {
                    bg: 'bg-rose-600',
                    border: 'border-rose-700',
                    icon: <ExclamationCircleIcon className="w-6 h-6 text-white" strokeWidth={2} />,
                    title: 'HATA'
                };
            case 'warning':
                return {
                    bg: 'bg-amber-500',
                    border: 'border-amber-600',
                    icon: <ExclamationTriangleIcon className="w-6 h-6 text-white" strokeWidth={2} />,
                    title: 'UYARI'
                };
            default:
                return {
                    bg: 'bg-blue-600',
                    border: 'border-blue-700',
                    icon: <CheckCircleIcon className="w-6 h-6 text-white" strokeWidth={2} />,
                    title: 'BİLGİ'
                };
        }
    };

    const style = getStyles();

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] animate-fade-in-down shadow-xl">
            <div className={`${style.bg} border-b ${style.border} shadow-lg py-4 px-4 md:px-6 relative overflow-hidden`}>
                {/* Background Pattern for Texture */}
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                </div>

                <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4 text-white">
                        <div className="p-2 bg-white/20 rounded-full shrink-0 backdrop-blur-sm">
                            {style.icon}
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                            <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded text-white/90 tracking-widest uppercase w-fit">
                                {style.title}
                            </span>
                            <p className="font-bold text-sm md:text-base tracking-wide drop-shadow-sm leading-tight">
                                {message}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={hideNotification}
                        className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-95 text-white/80 hover:text-white shrink-0"
                    >
                        <XMarkIcon className="w-6 h-6" strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
}
