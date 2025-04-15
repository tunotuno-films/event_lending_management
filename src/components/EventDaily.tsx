import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, insertWithOwnerId, getCurrentUserId } from '../lib/supabase';
import { AlertCircle, X, Package } from 'lucide-react';
import LoadingIndicator from './LoadingIndicator';

interface Event {
  id: number;
  event_id: string;
  name: string;
}

interface Item {
  id: number;
  item_id: string;
  name: string;
  image: string | null;
  genre: string;
  manager: string;
}

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  return (
    <div className={`p-4 mb-4 rounded-md flex justify-between items-center ${
      type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
    }`}>
      <div className="flex items-center">
        {type === 'error' && <AlertCircle className="h-5 w-5 mr-2" />}
        <span>{message}</span>
      </div>
      <button 
        onClick={onClose} 
        className="text-gray-500 hover:text-gray-700"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default function EventDaily() {
  const [events, setEvents] = useState<Event[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  const [sortColumn, setSortColumn] = useState<string>('item_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;
    return items.slice().sort((a, b) => {
      let aVal = a[sortColumn as keyof Item];
      let bVal = b[sortColumn as keyof Item];
      const safeAVal = aVal ?? '';
      const safeBVal = bVal ?? '';
      if (safeAVal < safeBVal) return sortDirection === 'asc' ? -1 : 1;
      if (safeAVal > safeBVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.error('ユーザー情報が取得できません (fetchEvents)');
        setNotification({ show: true, message: 'ユーザー認証が必要です。', type: 'error' });
        setLoadingEvents(false);
        return;
      }

      const { data, error } = await supabase
        .from('events')
        .select('id, event_id, name')
        .eq('event_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setNotification({ show: true, message: 'イベントの読み込みに失敗しました。', type: 'error' });
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const fetchAvailableItems = useCallback(async () => {
    if (!selectedEventId) return;

    setLoadingItems(true);
    setSelectedItemIds([]);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.error('ユーザー情報が取得できません (fetchAvailableItems)');
        setLoadingItems(false);
        return;
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('event_id', selectedEventId)
        .eq('created_by', userId)
        .maybeSingle();

      if (eventError || !eventData) {
        console.error('選択されたイベントが見つかりません。', eventError);
        setItems([]);
        setLoadingItems(false);
        return;
      }
      const currentEventRefId = eventData.id;

      const { data: registeredRefs, error: controlError } = await supabase
        .from('control')
        .select('item_id_ref')
        .eq('event_id_ref', currentEventRefId);

      if (controlError) throw controlError;

      const registeredItemRefIds: number[] = registeredRefs?.map(ref => ref.item_id_ref).filter(id => id !== null) || [];

      let query = supabase
        .from('items')
        .select('id, item_id, name, image, genre, manager')
        .eq('item_deleted', false)
        .eq('registered_by', userId)
        .order('name');

      if (registeredItemRefIds.length > 0) {
        query = query.not('id', 'in', `(${registeredItemRefIds.join(',')})`);
      }

      const { data: availableItems, error: itemsError } = await query;

      if (itemsError) throw itemsError;
      setItems(availableItems || []);
    } catch (error) {
      console.error('Error fetching available items:', error);
      setNotification({ show: true, message: 'アイテムの読み込みに失敗しました。', type: 'error' });
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchAvailableItems();
  }, [fetchAvailableItems]);

  useEffect(() => {
    const storedEventId = localStorage.getItem('selectedEventId');
    if (storedEventId) {
      setSelectedEventId(storedEventId);
      handleEventChange(storedEventId);
    }
  }, []);

  useEffect(() => {
    const handleSelectedEventChanged = () => {
      const storedEventId = localStorage.getItem('selectedEventId');
      if (storedEventId) {
        setSelectedEventId(storedEventId);
      } else {
        setSelectedEventId('');
      }
    };
    window.addEventListener('selectedEventChanged', handleSelectedEventChanged);
    return () => window.removeEventListener('selectedEventChanged', handleSelectedEventChanged);
  }, []);

  const handleEventChange = useCallback((selectedOldEventId: string) => {
    setSelectedEventId(selectedOldEventId);
    localStorage.setItem('selectedEventId', selectedOldEventId);
    if (selectedOldEventId) {
      fetchAvailableItems();
    }
    window.dispatchEvent(new CustomEvent('selectedEventChanged'));
  }, [fetchAvailableItems]);

  const handleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const handleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map(item => item.item_id));
    }
  };

  const handleSubmit = async () => {
    if (!selectedEventId || selectedItemIds.length === 0) {
      setNotification({ show: true, message: 'イベントと登録するアイテムを選択してください', type: 'error' });
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        setNotification({ show: true, message: 'ユーザー認証が必要です。再ログインしてください。', type: 'error' });
        setIsSubmitting(false);
        return;
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('event_id', selectedEventId)
        .eq('created_by', userId)
        .maybeSingle();

      if (eventError || !eventData) {
        console.error('選択されたイベントが見つかりません (handleSubmit)。', eventError);
        setNotification({ show: true, message: '選択されたイベントが見つかりません。', type: 'error' });
        setIsSubmitting(false);
        return;
      }
      const eventIdRef = eventData.id;

      const { data: itemDataMap, error: itemError } = await supabase
        .from('items')
        .select('id, item_id')
        .in('item_id', selectedItemIds)
        .eq('registered_by', userId);

      if (itemError) {
        console.error('選択されたアイテムの情報取得に失敗しました。', itemError);
        setNotification({ show: true, message: 'アイテム情報の取得エラー。', type: 'error' });
        setIsSubmitting(false);
        return;
      }

      const itemIdToIdRefMap = new Map<string, number>();
      itemDataMap?.forEach(item => {
        if (item.id && item.item_id) {
          itemIdToIdRefMap.set(item.item_id, item.id);
        }
      });

      const controlRecords = selectedItemIds.map(oldItemId => {
        const itemIdRef = itemIdToIdRefMap.get(oldItemId);
        if (!itemIdRef) {
          console.warn(`Skipping item with old ID ${oldItemId} because its new ID could not be found.`);
          return null;
        }
        return {
          event_id: selectedEventId,
          item_id: oldItemId,
          event_id_ref: eventIdRef,
          item_id_ref: itemIdRef,
          status: false
        };
      }).filter((record): record is NonNullable<typeof record> => record !== null);

      if (controlRecords.length === 0 && selectedItemIds.length > 0) {
        setNotification({ show: true, message: '有効なアイテムが見つからず、登録できませんでした。', type: 'error'});
        setIsSubmitting(false);
        return;
      }
      if (controlRecords.length === 0 && selectedItemIds.length === 0) {
        setNotification({ show: true, message: '登録するアイテムがありません。', type: 'error'});
        setIsSubmitting(false);
        return;
      }

      console.log('Inserting control records:', controlRecords);
      const { error: insertError } = await insertWithOwnerId('control', controlRecords, { userId });

      if (insertError) {
        console.error('Error inserting control records:', insertError);
        let userMessage = '登録エラー';
        if (typeof insertError === 'object' && insertError !== null && 'message' in insertError) {
          userMessage = `登録エラー: ${insertError.message}`;
          if (typeof insertError.message === 'string' && insertError.message.includes('violates foreign key constraint')) {
            userMessage = '登録エラー: 関連データが見つかりません。';
          }
        }
        setNotification({ show: true, message: userMessage, type: 'error' });
        throw insertError;
      }

      setNotification({ show: true, message: `${controlRecords.length}件のアイテムをイベントに登録しました`, type: 'success' });
      setSelectedItemIds([]);
      fetchAvailableItems();

    } catch (error) {
      console.error('Error during handleSubmit:', error);
      if (!notification.show || notification.type !== 'error') {
        setNotification({
          show: true,
          message: '登録中に予期せぬエラーが発生しました。',
          type: 'error'
        });
      }
    } finally {
      setIsSubmitting(false);
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
        <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-2">
          イベント選択
        </label>
        <select
          id="event-select"
          value={selectedEventId}
          onChange={(e) => handleEventChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loadingEvents}
        >
          <option value="">{loadingEvents ? '読み込み中...' : 'イベントを選択してください'}</option>
          {events.map(event => (
            <option key={event.id} value={event.event_id}>
              {event.event_id} - {event.name}
            </option>
          ))}
        </select>
      </div>

      {selectedEventId && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
            <h3 className="text-lg font-medium text-gray-800">アイテム選択</h3>
            {items.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                disabled={loadingItems}
              >
              </button>
            )}
          </div>

          {loadingItems ? (
            <div className="flex justify-center items-center min-h-[100px] my-8">
              <LoadingIndicator />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-500 my-8">
              このイベントに登録可能なアイテムがありません。
            </p>
          ) : (
            <div className="w-full overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full min-w-[800px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 w-16 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input 
                        type="checkbox" 
                        checked={selectedItemIds.length === items.length && items.length > 0} 
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 w-20 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">画像</th>
                    <th
                      onClick={() => handleSort('item_id')}
                      className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='item_id' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
                    >
                      物品ID {sortColumn==='item_id' && (<span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>)}
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='name' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
                    >
                      物品名 {sortColumn==='name' && (<span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>)}
                    </th>
                    <th
                      onClick={() => handleSort('genre')}
                      className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='genre' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
                    >
                      ジャンル {sortColumn==='genre' && (<span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>)}
                    </th>
                    <th
                      onClick={() => handleSort('manager')}
                      className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='manager' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
                    >
                      管理者 {sortColumn==='manager' && (<span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>)}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedItems.map((item) => (
                    <tr key={item.item_id} className={`hover:bg-gray-50 ${selectedItemIds.includes(item.item_id) ? 'bg-blue-100' : ''}`}>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.item_id)}
                          onChange={() => handleItemSelection(item.item_id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center border bg-white">
                          {item.image && item.image.trim() !== '' ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                              <Package className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-700">{item.item_id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {item.genre}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {item.manager}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleSubmit}
                disabled={selectedItemIds.length === 0 || isSubmitting || loadingItems}
                className={`px-6 py-2 rounded-md text-white transition-colors ${
                  selectedItemIds.length === 0 || loadingItems
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isSubmitting
                    ? 'bg-blue-400 cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? '登録中...' : `選択した ${selectedItemIds.length} 件のアイテムを登録`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}