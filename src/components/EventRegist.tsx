import React, { useState, useEffect } from 'react';
import { supabase, insertWithOwnerId } from '../lib/supabase';
// AlertTriangle アイコンをインポート
import { AlertCircle, X, CheckCircle, AlertTriangle } from 'lucide-react';

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

// Event インターフェースを定義
interface Event {
  event_id: string;
  name: string;
}

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
  // 部分一致するイベントID候補を保持する state
  const [matchingEventsById, setMatchingEventsById] = useState<Event[]>([]);
  // 部分一致するイベント名候補を保持する state
  const [matchingEventsByName, setMatchingEventsByName] = useState<Event[]>([]);

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
      const { error } = await insertWithOwnerId(
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

  // イベントID入力時に部分一致検索を実行する useEffect
  useEffect(() => {
    const searchExistingEventsById = async () => {
      if (formData.eventId.trim() === '') {
        setMatchingEventsById([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('events')
          .select('event_id, name')
          .ilike('event_id', `%${formData.eventId}%`)
          .eq('event_deleted', false)
          .limit(5);

        if (error) throw error;
        setMatchingEventsById(data || []);
      } catch (error) {
        console.error('Error searching existing events by ID:', error);
        setMatchingEventsById([]);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchExistingEventsById();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [formData.eventId]);

  // イベント名入力時に部分一致検索を実行する useEffect
  useEffect(() => {
    const searchExistingEventsByName = async () => {
      if (formData.name.trim() === '') {
        setMatchingEventsByName([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('events')
          .select('event_id, name')
          .ilike('name', `%${formData.name}%`)
          .eq('event_deleted', false)
          .limit(5);

        if (error) throw error;
        setMatchingEventsByName(data || []);
      } catch (error) {
        console.error('Error searching existing events by name:', error);
        setMatchingEventsByName([]);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchExistingEventsByName();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [formData.name]);

  // イベントIDの入力ハンドラを修正 (数字のみ許可)
  const handleEventIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ ...prev, eventId: numericValue }));
  };

  // 候補選択処理関数 (イベント名用)
  const handleSelectEventName = (name: string) => {
    setFormData(prev => ({ ...prev, name: name }));
    setMatchingEventsByName([]); // 候補をクリア
    setNotification({ show: true, message: 'イベント名を入力しました', type: 'success' });
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
            inputMode="numeric"
            pattern="[0-9]*"
            value={formData.eventId}
            onChange={handleEventIdChange}
            className="w-full border border-gray-300 rounded-md p-2 font-mono"
            maxLength={20}
            required
          />
          {/* イベントIDの部分一致候補表示 */}
          {matchingEventsById.length > 0 && (
            <div className="mt-2 border rounded-md p-2 bg-gray-50 max-h-40 overflow-y-auto">
              <h4 className="text-xs font-semibold mb-1 text-orange-600 flex items-center">
                <AlertTriangle size={14} className="inline mr-1" />
                既存のイベントID候補:
              </h4>
              <div className="space-y-1">
                {matchingEventsById.map((event) => (
                  <div key={event.event_id} className="flex items-center justify-between bg-white p-1 rounded text-sm">
                    {/* 表示形式を "eventId - eventName" に変更 */}
                    <span className="truncate mr-2 font-mono">{event.event_id} - {event.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          {/* イベント名の部分一致候補表示 */}
          {matchingEventsByName.length > 0 && (
            <div className="mt-2 border rounded-md p-2 bg-gray-50 max-h-40 overflow-y-auto">
              <h4 className="text-xs font-semibold mb-1 text-gray-600">
                既存のイベント名候補:
              </h4>
              <div className="space-y-1">
                {matchingEventsByName.map((event) => (
                  <div key={event.event_id} className="flex items-center justify-between bg-white p-1 rounded text-sm">
                    {/* 表示形式を "eventName" のみに変更 */}
                    <span className="truncate mr-2">{event.name}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectEventName(event.name)}
                      className="text-blue-500 hover:text-blue-700 p-1 rounded flex-shrink-0 text-xs font-semibold"
                      title="選択"
                    >
                      選択
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors flex items-center gap-2"
            disabled={isSubmitting}
          >
            <CheckCircle size={18} />
            {isSubmitting ? '登録中...' : '登録'}
          </button>
        </div>
      </form>
    </div>
  );
}