import { create } from 'zustand';

const useNotificationStore = create((set, get) => ({
    message: null,
    type: 'success', // 'success' | 'error'
    isVisible: false,
    timerId: null,

    showNotification: (message, type = 'success', duration = 3000) => {
        const { timerId } = get();
        if (timerId) clearTimeout(timerId);

        const newTimerId = setTimeout(() => {
            set({ isVisible: false, timerId: null });
        }, duration);

        set({ message, type, isVisible: true, timerId: newTimerId });
    },

    hideNotification: () => {
        const { timerId } = get();
        if (timerId) clearTimeout(timerId);
        set({ isVisible: false, timerId: null });
    }
}));

export default useNotificationStore;
