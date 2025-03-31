import React, { useState, useEffect, useCallback } from 'react'; // useCallback を追加
import { supabase, insertWithOwnerId, getCurrentUserId } from '../lib/supabase'; // insertWithOwnerId, getCurrentUserId をインポート
import { AlertCircle, X } from 'lucide-react';

interface Event {
  id: number; // ★ 主キー id (int8) を追加
  event_id: string; // 古い varchar ID も保持 (表示や初期選択用)
  name: string;
}

interface Item {
  id: number; // ★ 主キー id (int8) を追加
  item_id: string; // 古い varchar ID も保持 (表示や初期選択用)
  name: string;
  image: string | null; // null許容かも？
}

// Notification コンポーネント
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
  const [selectedEventId, setSelectedEventId] = useState(''); // 古いvarchar IDを保持
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]); // 古いvarchar IDのリストを保持
  const [loadingEvents, setLoadingEvents] = useState(true); // ローディング状態を分割
  const [loadingItems, setLoadingItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 登録処理中フラグ
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // --- イベント取得 ---
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

      // ★ select で新しい主キー id も取得する
      const { data, error } = await supabase
        .from('events')
        .select('id, event_id, name') // id を追加
        .eq('event_deleted', false)
        // RLSが効くので created_by でのフィルタは不要
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setNotification({ show: true, message: 'イベントの読み込みに失敗しました。', type: 'error' });
    } finally {
      setLoadingEvents(false);
    }
  }, []); // useCallbackでラップ

  // --- 登録可能アイテム取得 (修正) ---
  const fetchAvailableItems = useCallback(async () => {
    if (!selectedEventId) return; // イベント未選択時は何もしない

    setLoadingItems(true);
    setSelectedItemIds([]); // 選択状態をリセット
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.error('ユーザー情報が取得できません (fetchAvailableItems)');
        setLoadingItems(false);
        return;
      }

      // 選択されたイベントの *新しい* 主キー(id) を取得
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('event_id', selectedEventId) // 古いIDで検索
        .eq('created_by', userId) // 所有者確認
        .maybeSingle();

      if (eventError || !eventData) {
          console.error('選択されたイベントが見つかりません。', eventError);
          setItems([]); // アイテムリストを空にする
          setLoadingItems(false);
          return;
      }
      const currentEventRefId = eventData.id; // これが events.id (int8)

      // そのイベントに既に登録されているアイテムの *新しい参照ID (item_id_ref)* を取得
      const { data: registeredRefs, error: controlError } = await supabase
        .from('control')
        .select('item_id_ref') // ★ item_id_ref を取得
        .eq('event_id_ref', currentEventRefId); // ★ event_id_ref で絞り込み

      if (controlError) throw controlError;

      const registeredItemRefIds: number[] = registeredRefs?.map(ref => ref.item_id_ref).filter(id => id !== null) || []; // nullを除外

      // 登録されていないアイテムを取得 (新しい主キー id で比較)
      let query = supabase
        .from('items')
        .select('id, item_id, name, image') // ★ id を取得
        .eq('item_deleted', false)
        .eq('registered_by', userId) // ログインユーザーが所有するアイテムのみ表示
        .order('name'); // 名前順などに変更

      // 既に登録されているアイテムがある場合のみ除外条件を追加
      if (registeredItemRefIds.length > 0) {
        query = query.not('id', 'in', `(${registeredItemRefIds.join(',')})`);
      }

      const { data: availableItems, error: itemsError } = await query;

      if (itemsError) throw itemsError;
      setItems(availableItems || []);
    } catch (error) {
      console.error('Error fetching available items:', error);
      setNotification({ show: true, message: 'アイテムの読み込みに失敗しました。', type: 'error' });
      setItems([]); // エラー時はリストを空にする
    } finally {
      setLoadingItems(false);
    }
  }, [selectedEventId]); // selectedEventId が変更されたら実行

  // --- 初期表示 & イベント変更時のアイテム取得 ---
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchAvailableItems();
  }, [fetchAvailableItems]); // fetchAvailableItems が変更されたら実行

  // --- イベント選択ハンドラ ---
  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId); // 古い varchar ID をステートに保持
    // fetchAvailableItems が useEffect で自動的に呼び出される
  };

  // --- アイテム選択ハンドラ ---
  const handleItemSelection = (itemId: string) => { // 古い varchar ID を受け取る
    setSelectedItemIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  // --- 全選択ハンドラ ---
  const handleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map(item => item.item_id)); // 古い varchar ID のリストを設定
    }
  };

  // --- 登録処理 (大幅修正) ---
  const handleSubmit = async () => {
    if (!selectedEventId || selectedItemIds.length === 0) {
      setNotification({ show: true, message: 'イベントと登録するアイテムを選択してください', type: 'error' });
      return;
    }
    if (isSubmitting) return; // 処理中の多重実行防止

    setIsSubmitting(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        setNotification({ show: true, message: 'ユーザー認証が必要です。再ログインしてください。', type: 'error' });
        setIsSubmitting(false);
        return;
      }

      // 1. 選択されたイベントの新しい主キー(id)を取得
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('event_id', selectedEventId) // 古いIDで検索
        .eq('created_by', userId) // 所有者確認
        .maybeSingle();

      if (eventError || !eventData) {
        console.error('選択されたイベントが見つかりません (handleSubmit)。', eventError);
        setNotification({ show: true, message: '選択されたイベントが見つかりません。', type: 'error' });
        setIsSubmitting(false);
        return;
      }
      const eventIdRef = eventData.id; // これが events.id (int8)

      // 2. 選択されたアイテムの新しい主キー(id)を Map<古いitem_id, 新しいid> で取得
      const { data: itemDataMap, error: itemError } = await supabase
        .from('items')
        .select('id, item_id') // 新旧IDを取得
        .in('item_id', selectedItemIds) // 選択された古いIDリストで絞込
        .eq('registered_by', userId); // 所有者確認

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

      // 3. control テーブルに挿入するレコード配列を作成
      const controlRecords = selectedItemIds.map(oldItemId => {
        const itemIdRef = itemIdToIdRefMap.get(oldItemId);
        if (!itemIdRef) {
          console.warn(`Skipping item with old ID ${oldItemId} because its new ID could not be found.`);
          return null; // 見つからない場合はスキップ（またはエラー処理）
        }
        return {
          event_id: selectedEventId,     // ★ 古い event_id もセット (必須)
          item_id: oldItemId,           // ★ 古い item_id もセット (必須)
          event_id_ref: eventIdRef,      // 新しい event.id をセット
          item_id_ref: itemIdRef,       // 新しい item.id をセット
          status: false                  // 初期ステータスなど
          // created_by は insertWithOwnerId が自動で設定
        };
      }).filter((record): record is NonNullable<typeof record> => record !== null); // nullを除外し型ガード

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


      // 4. insertWithOwnerId で control テーブルに一括挿入
      console.log('Inserting control records:', controlRecords);
      const { error: insertError } = await insertWithOwnerId('control', controlRecords, { userId });

      if (insertError) {
         // 外部キー制約違反などもここでキャッチされる可能性がある
         console.error('Error inserting control records:', insertError);
         let userMessage = '登録エラー';
         if (typeof insertError === 'object' && insertError !== null && 'message' in insertError) {
            userMessage = `登録エラー: ${insertError.message}`;
            if (typeof insertError.message === 'string' && insertError.message.includes('violates foreign key constraint')) {
               userMessage = '登録エラー: 関連データが見つかりません。';
            }
         }
         setNotification({ show: true, message: userMessage, type: 'error' });
         throw insertError; // エラーを再スローして catch ブロックへ
      }

      // 成功した場合
      setNotification({ show: true, message: `${controlRecords.length}件のアイテムをイベントに登録しました`, type: 'success' });
      setSelectedItemIds([]); // 選択解除
      fetchAvailableItems(); // 利用可能アイテムリストを再読み込み

    } catch (error) {
      console.error('Error during handleSubmit:', error);
      // catch ブロックで最終的なエラー表示 (重複しないように)
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

  // handleCreateEvent は insertWithOwnerId を使う点は良いが、
  // イベント作成時に event_id (varchar) をどう設定するかの考慮が必要かも
  // (必須でなければ設定不要、必要なら別途生成ロジック)
  const handleCreateEvent = async (eventData: { name: string; date: string; location: string; description: string }) => { /* ... */ };

  // --- レンダリング ---
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Notification */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        />
      )}

      <h2 className="text-xl font-semibold mb-6">当日物品登録</h2>

      {/* イベント選択 */}
      <div className="mb-6">
        <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-2">
          イベント選択
        </label>
        <select
          id="event-select"
          value={selectedEventId} // 古いIDで選択
          onChange={(e) => handleEventChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loadingEvents}
        >
          <option value="">{loadingEvents ? '読み込み中...' : 'イベントを選択してください'}</option>
          {events.map(event => (
            // key は新しい主キー id、value は古い event_id を使う
            <option key={event.id} value={event.event_id}>
              {event.name} ({event.event_id}) {/* 必要なら古いIDも表示 */}
            </option>
          ))}
        </select>
      </div>

      {/* アイテム選択 */}
      {selectedEventId && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
            <h3 className="text-lg font-medium text-gray-800">アイテム選択</h3>
            {items.length > 0 && ( // アイテムがある時だけ表示
              <button
                onClick={handleSelectAll}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                disabled={loadingItems}
              >
                {selectedItemIds.length === items.length ? '全選択解除' : '全選択'}
              </button>
            )}
          </div>

          {loadingItems ? (
            <div className="text-center text-gray-500 my-8 flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span>アイテムを読み込み中...</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-500 my-8">
              このイベントに登録可能なアイテムがありません。
            </p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 w-16 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">選択</th>
                    <th className="px-4 py-3 w-20 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">画像</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">物品ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">物品名</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50"> {/* keyは新しいid */}
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.item_id)} // 選択は古いIDで管理
                          onChange={() => handleItemSelection(item.item_id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          aria-labelledby={`item-name-${item.id}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-10 w-10 rounded-md overflow-hidden flex items-center justify-center border border-gray-200">
                           {/* 画像がない場合の代替表示 */}
                           {item.image ? (
                              <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain"/>
                           ) : (
                              <span className="text-xs text-gray-400">No Image</span>
                           )}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-700">{item.item_id}</td>
                      <td id={`item-name-${item.id}`} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 登録ボタン */}
          {items.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleSubmit}
                disabled={selectedItemIds.length === 0 || isSubmitting || loadingItems} // ローディング中も無効化
                className={`px-6 py-2 rounded-md text-white transition-colors ${
                  selectedItemIds.length === 0 || loadingItems
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isSubmitting
                    ? 'bg-blue-400 cursor-wait' // 処理中スタイル
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