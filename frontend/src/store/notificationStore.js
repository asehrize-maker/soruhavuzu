import { create } from 'zustand';
import toast from 'react-hot-toast';

const useNotificationStore = create((set) => ({
    showNotification: (message, type = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    },
    hideNotification: () => toast.dismiss(),
    // Keep dummy state properties to prevent crashes in components that might destructure them
    message: null,
    type: 'success',
    isVisible: false,
}));

export default useNotificationStore;
