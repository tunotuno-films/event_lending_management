import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  // 自動で閉じるためのeffect
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    // コンポーネントがアンマウントされた場合、タイマーをクリア
    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  // タイプに応じたスタイルとアイコンを設定
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          containerClass: 'bg-green-50 border-green-500 text-green-700',
          iconClass: 'text-green-500',
          icon: <CheckCircle size={20} />
        };
      case 'error':
        return {
          containerClass: 'bg-red-50 border-red-500 text-red-700',
          iconClass: 'text-red-500',
          icon: <AlertTriangle size={20} />
        };
      case 'info':
      default:
        return {
          containerClass: 'bg-blue-50 border-blue-500 text-blue-700',
          iconClass: 'text-blue-500',
          icon: <Info size={20} />
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`fixed top-4 right-4 z-50 w-full max-w-sm p-4 rounded-lg shadow-lg border-l-4 ${styles.containerClass} animate-slide-in`}>
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${styles.iconClass}`}>
          {styles.icon}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg p-1.5 inline-flex h-8 w-8 items-center justify-center"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Notification;