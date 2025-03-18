import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, X } from 'lucide-react';

interface Event {
  event_id: string;
  name: string;
}

interface Item {
  item_id: string;
  name: string;
  image: string;
}

interface NotificationProps {
  message: string;
  onClose: () => void;
  type?: 'success' | 'error';
}

const Notification: React.FC<NotificationProps> = ({ message, onClose, type = 'success' }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
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

export default function DailyItemRegistration() {
  const [events, setEvents] = useState<Event[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchAvailableItems();
    }
  }, [selectedEventId]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      // Get items that are not already registered for the selected event
      const { data: registeredItems } = await supabase
        .from('control')
        .select('item_id')
        .eq('event_id', selectedEventId);

      const registeredItemIds = registeredItems?.map(item => item.item_id) || [];

      const { data: availableItems, error } = await supabase
        .from('items')
        .select('*')
        .eq('item_deleted', false)
        .not('item_id', 'in', `(${registeredItemIds.join(',')})`)
        .order('item_id');

      if (error) throw error;
      setItems(availableItems || []);
    } catch (error) {
      console.error('Error fetching available items:', error);
    }
  };

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedItems([]);
  };

  const handleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.item_id));
    }
  };

  const handleSubmit = async () => {
    if (!selectedEventId || selectedItems.length === 0) {
      setNotification({
        show: true,
        message: 'イベントとアイテムを選択してください',
        type: 'error'
      });
      return;
    }

    try {
      const controlRecords = selectedItems.map(itemId => ({
        event_id: selectedEventId,
        item_id: itemId,
        status: false
      }));

      const { error } = await supabase
        .from('control')
        .insert(controlRecords);

      if (error) throw error;

      setNotification({
        show: true,
        message: '物品を登録しました',
        type: 'success'
      });

      // Reset selections and refresh available items
      setSelectedItems([]);
      fetchAvailableItems();
    } catch (error) {
      console.error('Error registering items:', error);
      setNotification({
        show: true,
        message: '登録中にエラーが発生しました',
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

      <h2 className="text-xl font-semibold mb-6">当日物品登録</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          イベント選択
        </label>
        <select
          value={selectedEventId}
          onChange={(e) => handleEventChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
        >
          <option value="">イベントを選択してください</option>
          {events.map(event => (
            <option key={event.event_id} value={event.event_id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      {selectedEventId && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">アイテム選択</h3>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedItems.length === items.length ? '全選択解除' : '全選択'}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-center text-gray-500 my-8">
              登録可能なアイテムがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      選択
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      画像
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      物品ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      物品名
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.item_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.item_id)}
                          onChange={() => handleItemSelection(item.item_id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-12 w-12 rounded-lg overflow-hidden">
                          <img
                            src={item.image || 'https://via.placeholder.com/150'}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono">{item.item_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">{item.name}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={selectedItems.length === 0}
              className={`px-6 py-2 rounded-md ${
                selectedItems.length === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white transition-colors`}
            >
              選択したアイテムを登録
            </button>
          </div>
        </div>
      )}
    </div>
  );
}