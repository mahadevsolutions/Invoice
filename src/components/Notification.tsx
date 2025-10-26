import React, { useEffect } from 'react';

interface NotificationProps {
    message: string;
    type: string;
    onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
    if (!message) return null;

    const baseStyle = "fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300";
    const typeStyle = type === 'success' ? 'bg-green-600' : 'bg-red-600';

    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [message, onClose]);

    return (
        <div className={`${baseStyle} ${typeStyle}`}>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 font-bold text-lg leading-none">&times;</button>
        </div>
    );
};

export default Notification;