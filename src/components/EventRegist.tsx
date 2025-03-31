import React, { useState } from 'react';
import { supabase, insertWithOwnerId } from '../lib/supabase';
import { AlertCircle, X } from 'lucide-react';

interface NotificationProps {
  message: string;
  onClose: () => void;
  type?: 'success' | 'error';
}

const Notification: React.FC<NotificationProps> = ({ message, onClose, type = 'success' }) => {
  const [countdown, setCountdown] = useState(5);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const hoverColor = type === 'success' ? 'hover:bg-green-600' : 'hover:bg-red-600';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4`}>
      {type === 'error' && <AlertCircle size={20} />}
      <span>{message}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm">({countdown})</span>
        <button onClick={onClose} className={`${hoverColor} rounded-full p-1`}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default function EventRegist() {
  const [formData, setFormData] = useState({
    eventId: '',
    name: ''
  });

  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialEventFormData = {
    eventId: '',
    name: ''
  };

  const fetchEvents = async () => {
    // Fetch events logic here
  };

  const createEvent = async (eventData: typeof initialEventFormData) => {
    try {
      setIsSubmitting(true);

      // 同じevent_idが既に存在するか確認
      const { data: existingEvents, error: checkError } = await supabase
        .from('events')
        .select('event_id')
        .eq('event_id', eventData.eventId)
        .eq('event_deleted', false);

      if (checkError) {
        throw checkError;
      }

      // 既存のイベントが見つかった場合はエラー
      if (existingEvents && existingEvents.length > 0) {
        setNotification({
          show: true,
          message: `イベントID "${eventData.eventId}" は既に使用されています`,
          type: 'error'
        });
        return false;
      }

      // 重複がなければ新規登録
      const { data, error } = await insertWithOwnerId(
        'events',
        {
          event_id: eventData.eventId,  // event_idカラム
          name: eventData.name,         // nameカラム
          event_deleted: false          // event_deletedカラム
        }
      );

      if (error) throw error;

      setNotification({
        show: true,
        message: 'イベントが正常に作成されました',
        type: 'success'
      });

      setFormData(initialEventFormData);
      fetchEvents();
      return true;
    } catch (error) {
      console.error('イベント作成エラー:', error);
      
      let errorMessage = 'イベント作成中にエラーが発生しました';
      
      // Supabaseエラーメッセージがある場合は表示
      if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage += `: ${String(error.message)}`;
      }
      
      setNotification({
        show: true,
        message: errorMessage,
        type: 'error'
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const success = await createEvent(formData);
      if (success) {
        setNotification({
          show: true,
          message: 'イベントを登録しました',
          type: 'success'
        });
      }
    } catch (err: unknown) {
      console.error('Error registering event:', err);

      let errorMessage = 'Unknown error occurred';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMessage = String(err.message);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setNotification({
        show: true,
        message: `登録中にエラーが発生しました: ${errorMessage}`,
        type: 'error'
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        />
      )}

      <h2 className="text-xl font-semibold mb-6">イベント登録</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            イベントID
          </label>
          <input
            type="text"
            value={formData.eventId}
            onChange={(e) => setFormData(prev => ({ ...prev, eventId: e.target.value }))}
            className="w-full border border-gray-300 rounded-md p-2"
            maxLength={20}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            イベント名
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-md p-2"
            maxLength={50}
            required
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? '登録中...' : '登録'}
          </button>
        </div>
      </form>
    </div>
  );
}