import React, { useState, useEffect, useCallback } from 'react';
import { supabase, insertWithOwnerId } from '../lib/supabase';
import { AlertCircle, X, Barcode, StopCircle, Package, CheckCircle } from 'lucide-react';
import { useZxing } from 'react-zxing';
import LoadingIndicator from './LoadingIndicator'; // LoadingIndicator をインポート

// --- インターフェース定義 (修正) ---
interface Event {
  id: number; // 新しい主キー
  event_id: string; // 古い varchar ID
  name: string;
}

interface Item {
  id: number; // 新しい主キー
  item_id: string; // 古い varchar ID
  name: string;
  image: string | null; // null 許容
}

// Control インターフェースを修正
interface Control {
  control_id: number;
  status: boolean;
  control_datetime: string | null; // ★ カラム名を修正 (貸出日時として使用)
  created_by: string; // uuid
  item_id_ref: number | null; // ★ 新しい参照カラム
  event_id_ref: number | null; // ★ 新しい参照カラム
  items: Item | null; // ★ 単一のItem、null許容
  events: Pick<Event, 'id' | 'event_id' | 'name'> | null; // ★ イベント情報、null許容
  item_id?: string; // 古い varchar item_id (表示用？)
  event_id?: string; // 古い varchar event_id (表示用？)
}

// Notification コンポーネント
interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose?: () => void;
}

// Notification コンポーネントを修正
const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown(prev => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          clearInterval(timer);
          if (onClose) onClose();
          return 0;
        }
        return newCount;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [message, onClose]);

  return (
    <div className={`fixed top-4 right-4 p-4 rounded-md shadow-md z-50 flex items-center ${
      type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
    }`}>
      {type === 'success' ? (
        <div className="text-green-500 mr-2">✓</div>
      ) : (
        <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
      )}
      <span>{message}</span>
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm text-gray-500">{countdown > 0 ? `(${countdown})` : ''}</span>
        {onClose && (
          <button 
            onClick={onClose} 
            className="ml-2 rounded-full p-1 hover:bg-gray-200 transition-colors"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ★ キャンセルボタンコンポーネント
const CancelButton: React.FC<{ countdown: number; onCancel: () => void }> = ({ countdown, onCancel }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, countdown / 5)); // 0 to 1
  const offset = circumference * (1 - progress);

  return (
    <button
      onClick={onCancel}
      className="relative w-16 h-16 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors group"
      aria-label={`キャンセル (${Math.ceil(countdown)}秒)`}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 50 50">
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="none"
          stroke="#fee2e2" // bg-red-100
          strokeWidth="4"
        />
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="none"
          stroke="#ef4444" // text-red-500
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 25 25)"
          style={{ transition: 'stroke-dashoffset 0.1s linear' }} // アニメーションを滑らかに
        />
      </svg>
      <X className="w-8 h-8 text-red-500 z-10 group-hover:scale-110 transition-transform" />
    </button>
  );
};

export default function LoaningControl() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEventRefId, setSelectedEventRefId] = useState<number | null>(null);
  const [waitingItems, setWaitingItems] = useState<Control[]>([]);
  const [loanedItems, setLoanedItems] = useState<Control[]>([]);
  const [totalLoanCount, setTotalLoanCount] = useState<number>(0);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showItemIdModal, setShowItemIdModal] = useState(false);
  const [matchingItems, setMatchingItems] = useState<Control[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(true);

  // ★ 自動処理用の state を追加
  const [autoProcessInfo, setAutoProcessInfo] = useState<{ item: Control; action: 'loan' | 'return' } | null>(null);
  const [autoProcessTimerId, setAutoProcessTimerId] = useState<NodeJS.Timeout | null>(null);
  const [cancelCountdown, setCancelCountdown] = useState(5); // 5秒カウントダウン

  const { ref } = useZxing({
    onDecodeResult(result) {
      const scannedBarcode = result.getText();
      setShowCamera(false);
      setIsScanning(false);
      handleBarcodeSubmit(scannedBarcode); // ★ スキャン結果を直接渡す
    },
    paused: !isScanning
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showBarcodeModal) {
      setIsScanning(true);
      setBarcodeInput('');
      setShowCamera(true);
      setMatchingItems([]);
    } else {
      setIsScanning(false);
    }
  }, [showBarcodeModal]);

  useEffect(() => {
    if (showItemIdModal) {
      setBarcodeInput('');
      setMatchingItems([]);
    }
  }, [showItemIdModal]);

  useEffect(() => {
    if (isScanning && showCamera) {
      setBarcodeInput('');
      setMatchingItems([]);
    }
  }, [isScanning, showCamera]);

  useEffect(() => {
    if (barcodeInput && selectedEventId) {
      const allItems = [...waitingItems, ...loanedItems];
      const matches = allItems.filter(item => 
        (item.item_id && item.item_id.toLowerCase().includes(barcodeInput.toLowerCase())) ||
        (item.items?.item_id && item.items.item_id.toLowerCase().includes(barcodeInput.toLowerCase()))
      );
      setMatchingItems(matches);
    } else {
      setMatchingItems([]);
    }
  }, [barcodeInput, waitingItems, loanedItems, selectedEventId]);

  // ★ カウントダウン処理用の useEffect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (autoProcessInfo && cancelCountdown > 0) {
      intervalId = setInterval(() => {
        setCancelCountdown(prev => Math.max(0, prev - 0.1)); // 0.1秒ごとに減らす
      }, 100);
    } else if (autoProcessInfo && cancelCountdown <= 0) {
      // カウントダウン完了時に自動処理を実行 (タイマーがまだあれば)
      if (autoProcessTimerId) {
         confirmAutoProcess(); // タイマー完了を待たずに即時実行
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoProcessInfo, cancelCountdown, autoProcessTimerId]); // autoProcessTimerId も依存配列に追加

  const fetchEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { console.error('ユーザー情報が取得できません'); return; }
      const { data, error } = await supabase
        .from('events')
        .select('id, event_id, name')
        .eq('event_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (error) { console.error('Error fetching events:', error); }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fetchItems = useCallback(async (isBackgroundRefresh = false) => {
    if (!selectedEventId) return;

    if (!isBackgroundRefresh) {
      setIsLoadingItems(true);
    }
    console.log(`Fetching items and loan count for event: ${selectedEventId} (Background: ${isBackgroundRefresh})`);

    try {
      // Fetch data from Supabase
      const { data: controlData, error: controlError } = await supabase
        .from('control')
        .select(`
          control_id, event_id, item_id, status, control_datetime,
          item_id_ref, event_id_ref, created_by, items(item_id, name, image)
        `)
        .eq('event_id', selectedEventId);

      if (controlError) {
        console.error('Controlデータ取得エラー:', controlError);
        throw controlError;
      }

      // Format fetched data and create a map for quick lookup
      const fetchedItems = controlData?.map(item => ({
        ...item,
        items: Array.isArray(item.items) ? item.items[0] : item.items,
        created_by: item.created_by || '',
        events: null
      })) as Control[] || [];
      const fetchedItemsMap = new Map(fetchedItems.map(item => [item.control_id, item]));

      // --- Update waitingItems state ---
      setWaitingItems(prevWaitingItems => {
        // 1. Update existing items and preserve their order
        const updatedExistingWaiting = prevWaitingItems
          .filter(item => {
            const fetchedItem = fetchedItemsMap.get(item.control_id);
            return fetchedItem && !fetchedItem.status; // Keep if still exists and is waiting
          })
          .map(item => fetchedItemsMap.get(item.control_id)!); // Get updated data

        // 2. Find new items that should be in the waiting list
        const newWaitingItems = fetchedItems.filter(item => {
          return !item.status && !prevWaitingItems.some(prev => prev.control_id === item.control_id);
        });

        // 3. Combine: existing items (order preserved) + new items (appended)
        return [...updatedExistingWaiting, ...newWaitingItems];
      });

      // --- Update loanedItems state ---
      setLoanedItems(prevLoanedItems => {
        // 1. Update existing items and preserve their order
        const updatedExistingLoaned = prevLoanedItems
          .filter(item => {
            const fetchedItem = fetchedItemsMap.get(item.control_id);
            return fetchedItem && fetchedItem.status; // Keep if still exists and is loaned
          })
          .map(item => fetchedItemsMap.get(item.control_id)!); // Get updated data

        // 2. Find new items that should be in the loaned list
        const newLoanedItems = fetchedItems.filter(item => {
          return item.status && !prevLoanedItems.some(prev => prev.control_id === item.control_id);
        });
        
        // 3. Combine: existing items (order preserved) + new items (appended)
        //    Sort newly added items by loan time descending? Or just append? Let's just append for now.
        newLoanedItems.sort((a, b) => {
             if (!a.control_datetime || !b.control_datetime) return 0;
             return new Date(b.control_datetime).getTime() - new Date(a.control_datetime).getTime();
        });


        return [...updatedExistingLoaned, ...newLoanedItems];
      });

      // --- Update total loan count (no change needed here) ---
      const { count, error: countError } = await supabase
        .from('result')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', selectedEventId);

      if (countError) {
        console.error('貸出回数取得エラー:', countError);
        if (!isBackgroundRefresh) setTotalLoanCount(0);
      } else {
        setTotalLoanCount(count ?? 0);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      setNotification({
        show: true,
        message: 'データの取得に失敗しました',
        type: 'error'
      });
      // Avoid clearing items on background refresh error if we have existing data
      if (!isBackgroundRefresh) {
          setWaitingItems([]);
          setLoanedItems([]);
          setTotalLoanCount(0);
      }
    } finally {
      // Always set loading to false
      setIsLoadingItems(false);
    }
  }, [selectedEventId]); // Dependency

  const handleEventChange = useCallback((selectedOldEventId: string) => {
    setSelectedEventId(selectedOldEventId);
    localStorage.setItem('selectedEventId', selectedOldEventId);
    const selectedEvent = events.find(event => event.event_id === selectedOldEventId);
    setSelectedEventRefId(selectedEvent ? selectedEvent.id : null);

    if (selectedOldEventId) {
      fetchItems();
    }

    if (selectedEvent) {
      localStorage.setItem('selectedEventInfo', JSON.stringify({ event_id: selectedEvent.event_id, name: selectedEvent.name }));
    } else {
      localStorage.removeItem('selectedEventInfo');
    }

    setTotalLoanCount(0);

    window.dispatchEvent(new CustomEvent('selectedEventChanged'));
  }, [events, fetchItems]);

  useEffect(() => {
    if (selectedEventId) {
      fetchItems();
    }
  }, [selectedEventId, fetchItems]);

  useEffect(() => {
    if (!selectedEventId) return;

    const intervalId = setInterval(() => {
      fetchItems(true);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [selectedEventId, fetchItems]);

  useEffect(() => {
    const storedEventId = localStorage.getItem('selectedEventId');
    if (storedEventId) {
      handleEventChange(storedEventId);
    }
  }, []);

  const handleLoanItem = async (controlRecord: Control) => {
    if (isProcessing) return;

    const controlId = controlRecord.control_id;
    const oldItemId = controlRecord.items?.item_id;

    if (!controlId) {
      setNotification({
        show: true,
        message: '貸出処理に必要な情報が不足しています',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const loanTime = new Date().toISOString();
      const { error } = await supabase
        .from('control')
        .update({
          status: true,
          control_datetime: loanTime
        })
        .eq('control_id', controlId);

      if (error) throw error;

      // --- Local state update (Modify Loaned Items) ---
      const loanedItem = { ...controlRecord, status: true, control_datetime: loanTime };
      setWaitingItems(prev => prev.filter(item => item.control_id !== controlId));
      // Add to the beginning of the loanedItems array
      setLoanedItems(prev => [loanedItem, ...prev]); 
      // --- End local state update ---

      window.dispatchEvent(new CustomEvent('loan-status-changed', {
        detail: { type: 'loan', success: true }
      }));

      setNotification({
        show: true,
        message: `アイテム「${oldItemId || 'ID不明'}」を貸出しました`,
        type: 'success'
      });

    } catch (error) {
      console.error('貸出処理エラー:', error);
      setNotification({
        show: true,
        message: '貸出処理中にエラーが発生しました',
        type: 'error'
      });
      // ★ エラー時は自動処理をキャンセル
      cancelAutoProcess();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemReturn = async (controlRecord: Control) => {
    if (isProcessing) return;

    const controlId = controlRecord.control_id;
    const loanTime = controlRecord.control_datetime;
    const oldItemId = controlRecord.item_id || controlRecord.items?.item_id;
    const oldEventId = controlRecord.event_id;
    const itemIdRef = controlRecord.item_id_ref;
    const eventIdRef = controlRecord.event_id_ref;

    if (!controlId) {
      setNotification({
        show: true,
        message: '返却処理に必要な情報が不足しています',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);
    const returnTime = new Date().toISOString();

    try {
      const { error: updateError } = await supabase
        .from('control')
        .update({
          status: false,
          control_datetime: null
        })
        .eq('control_id', controlId);

      if (updateError) throw updateError;

      // --- Local state update (Modify Waiting Items) ---
      const returnedItem = { ...controlRecord, status: false, control_datetime: null };
      setLoanedItems(prev => prev.filter(item => item.control_id !== controlId));
      // Add to the beginning of the waitingItems array
      setWaitingItems(prev => [returnedItem, ...prev]); 
      // --- End local state update ---

      window.dispatchEvent(new CustomEvent('loan-status-changed', {
        detail: { type: 'return', success: true }
      }));

      let historyRecorded = false;
      if (loanTime && oldItemId && oldEventId) {
        try {
          const { error: resultError } = await insertWithOwnerId(
            'result',
            {
              item_id: oldItemId,
              event_id: oldEventId,
              item_id_ref: itemIdRef,
              event_id_ref: eventIdRef || selectedEventRefId,
              start_datetime: loanTime,
              end_datetime: returnTime
            }
          );
          if (resultError) {
            console.error('履歴記録エラー:', resultError);
          } else {
            historyRecorded = true; // 履歴記録成功
          }
        } catch (historyError) {
          console.error('履歴記録中にエラーが発生:', historyError);
        }
      } else {
        console.warn('履歴登録に必要な情報が不足しています:', { 
          loanTime, oldItemId, oldEventId, itemIdRef, eventIdRef 
        });
      }

      if (historyRecorded) {
        setTotalLoanCount(prev => prev + 1);
      }

      setNotification({
        show: true,
        message: `アイテム「${oldItemId || 'ID不明'}」を返却しました`,
        type: 'success'
      });

    } catch (error) {
      console.error('返却処理エラー:', error);
      setNotification({
        show: true,
        message: '返却処理中にエラーが発生しました',
        type: 'error'
      });
       // ★ エラー時は自動処理をキャンセル
      cancelAutoProcess();
    } finally {
      setIsProcessing(false);
    }
  };

  // ★ handleBarcodeSubmit を修正
  const handleBarcodeSubmit = async (barcode: string) => {
    if (!selectedEventId) {
      setNotification({ show: true, message: 'イベントを選択してください', type: 'error' });
      return;
    }
    if (isProcessing) return; // 処理中の重複実行防止

    // 既存の自動処理タイマーがあればクリア
    cancelAutoProcess(false); // 通知なしでキャンセル

    setIsProcessing(true); // 検索処理中フラグ
    setBarcodeInput(barcode); // スキャンされたバーコードを表示用に保持

    try {
      const { data, error } = await supabase
        .from('control')
        .select(`
          control_id, event_id, item_id, status, control_datetime,
          item_id_ref, event_id_ref, created_by, items(item_id, name, image)
        `)
        .eq('event_id', selectedEventId)
        .eq('item_id', barcode);

      if (error) throw error;

      if (!data || data.length === 0) {
        setNotification({ show: true, message: `物品が見つかりません (ID: ${barcode})`, type: 'error' });
        setMatchingItems([]); // 一致リストをクリア
        setAutoProcessInfo(null); // 自動処理情報をクリア
        return;
      }

      if (data.length > 1) {
        setNotification({ show: true, message: `複数の物品が見つかりました (ID: ${barcode})。手動で選択してください。`, type: 'error' });
        // 複数ヒットした場合の処理（例：matchingItems にセットして手動選択させる）
        const formattedData = data.map(item => ({
          ...item,
          items: Array.isArray(item.items) ? item.items[0] : item.items,
          events: null,
          created_by: item.created_by || ''
        })) as Control[];
        setMatchingItems(formattedData);
        setAutoProcessInfo(null); // 自動処理情報をクリア
        return;
      }

      // --- 該当アイテムが1つの場合：自動処理開始 ---
      const itemToProcess = {
        ...data[0],
        items: Array.isArray(data[0].items) ? data[0].items[0] : data[0].items,
        events: null,
        created_by: data[0].created_by || ''
      } as Control;

      const action = itemToProcess.status ? 'return' : 'loan';
      setAutoProcessInfo({ item: itemToProcess, action });
      setCancelCountdown(5); // カウントダウンリセット
      setMatchingItems([]); // 手動選択リストはクリア

      // 5秒後に confirmAutoProcess を実行するタイマーを設定
      const timerId = setTimeout(() => {
        confirmAutoProcess();
      }, 5000);
      setAutoProcessTimerId(timerId);

    } catch (error) {
      console.error('Error processing barcode:', error);
      setNotification({ show: true, message: 'バーコード処理中にエラーが発生しました', type: 'error' });
      setAutoProcessInfo(null);
      setMatchingItems([]);
    } finally {
      setIsProcessing(false); // 検索処理完了
    }
  };

  // ★ 自動処理実行関数
  const confirmAutoProcess = () => {
    if (!autoProcessInfo || isProcessing) return;

    // タイマーをクリア（手動キャンセルや完了前に呼ばれた場合）
    if (autoProcessTimerId) {
      clearTimeout(autoProcessTimerId);
      setAutoProcessTimerId(null);
    }

    const { item, action } = autoProcessInfo;

    // 貸出/返却処理を実行
    if (action === 'loan') {
      handleLoanItem(item);
    } else {
      handleItemReturn(item);
    }

    // モーダルを閉じて state をリセット
    setShowBarcodeModal(false);
    setAutoProcessInfo(null);
    setCancelCountdown(5);
    setBarcodeInput(''); // バーコード入力もクリア
  };

  // ★ 自動処理キャンセル関数
  const cancelAutoProcess = (showNotification = true) => {
    if (autoProcessTimerId) {
      clearTimeout(autoProcessTimerId);
      setAutoProcessTimerId(null);
    }
    setAutoProcessInfo(null);
    setCancelCountdown(5);
    // バーコード入力はクリアしないでおく（再スキャンや手動入力のため）
    // setBarcodeInput('');
    if (showNotification) {
      setNotification({ show: true, message: '処理をキャンセルしました', type: 'success' });
    }
  };

  const handleNumericInput = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setBarcodeInput(numericValue);
  };

  const handleCloseNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, show: false }));
  }, []);

  const formatElapsedTime = useCallback((startTime: string | null): string => {
    if (!startTime) return '-';

    try {
      const now = currentTime.getTime();
      const start = new Date(startTime).getTime();
      const elapsed = Math.max(0, Math.floor((now - start) / 1000));

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('時間計算エラー:', error);
      return '-';
    }
  }, [currentTime]);

  return (
    <div className="space-y-6">
      {notification.show && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={handleCloseNotification}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">貸出・返却管理</h2>
          {selectedEventId && (
            <span className="text-xl font-semibold font-mono text-blue-600">
              総貸出回数: {totalLoanCount}
            </span>
          )}
        </div>
        <div className="mb-6">
          <label htmlFor="loaning-event-select" className="block text-sm font-medium text-gray-700 mb-2">
            イベント選択
          </label>
          <select
            id="loaning-event-select"
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">イベントを選択してください</option>
            {events.map(event => (
              <option key={event.id} value={event.event_id}>
                {event.event_id} - {event.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEventId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setShowBarcodeModal(true)} 
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <Barcode className="h-5 w-5" />
                <span>バーコードで貸出/返却</span>
              </div>
            </button>
            <button 
              onClick={() => setShowItemIdModal(true)} 
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <span># </span>
                <span>アイテムIDで貸出/返却</span>
              </div>
            </button>
          </div>

          {showBarcodeModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> {/* モーダル外クリック防止のため padding を追加 */}
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">バーコードで貸出/返却</h3>
                  <button
                    onClick={() => {
                      setShowBarcodeModal(false);
                      setIsScanning(false);
                      cancelAutoProcess(false); // モーダルを閉じるときは自動処理もキャンセル
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* ★ 自動処理中の表示 */}
                {autoProcessInfo ? (
                  <div className="text-center space-y-4">
                    <div className="flex justify-center mb-4">
                       {autoProcessInfo.action === 'loan' ? (
                         <CheckCircle className="w-16 h-16 text-blue-500" />
                       ) : (
                         <CheckCircle className="w-16 h-16 text-yellow-500" />
                       )}
                    </div>
                    <p className="text-lg font-medium">
                      物品「<span className="font-bold">{autoProcessInfo.item.items?.name || autoProcessInfo.item.item_id}</span>」を
                      <span className={`font-bold ${autoProcessInfo.action === 'loan' ? 'text-blue-600' : 'text-yellow-600'}`}>
                        {autoProcessInfo.action === 'loan' ? '貸出' : '返却'}
                      </span>
                      します...
                    </p>
                    <p className="text-sm text-gray-500">
                      {Math.ceil(cancelCountdown)}秒後に自動実行します。キャンセルする場合はボタンを押してください。
                    </p>
                    <div className="flex justify-center mt-6">
                      <CancelButton countdown={cancelCountdown} onCancel={() => cancelAutoProcess()} />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ★ 通常のスキャンUI */}
                    <div className="mb-6">
                      <button
                        onClick={() => {
                          setIsScanning(!isScanning);
                          if (!isScanning) {
                            setShowCamera(true);
                            setBarcodeInput(''); // スキャン開始時にバーコード入力をクリア
                            setMatchingItems([]); // 一致リストもクリア
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md mb-4 ${
                          isScanning
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-blue-500 hover:bg-blue-600'
                        } text-white transition-colors w-full justify-center`} // w-full と justify-center を追加
                      >
                        {isScanning ? (
                          <>
                            <StopCircle size={20} />
                            スキャン停止
                          </>
                        ) : (
                          <>
                            <Barcode size={20} />
                            スキャン開始
                          </>
                        )}
                      </button>

                      {isScanning && showCamera && ( // isScanning 中のみカメラ表示
                        <div className="relative w-full max-w-lg mx-auto aspect-video mb-4 rounded-lg overflow-hidden border">
                          <video ref={ref as React.LegacyRef<HTMLVideoElement>} className="w-full h-full object-cover" />
                           {/* スキャン中インジケーター */}
                           <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none"></div>
                        </div>
                      )}

                      {/* バーコード手動入力フィールド */}
                       <input
                         type="text"
                         value={barcodeInput}
                         onChange={(e) => setBarcodeInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' && barcodeInput) {
                             handleBarcodeSubmit(barcodeInput);
                           }
                         }}
                         placeholder="バーコードをスキャン or 手動入力してEnter"
                         className="w-full border border-gray-300 rounded-md p-2 font-mono mt-2"
                         disabled={isScanning} // スキャン中は無効化
                       />

                      {/* ★ 複数ヒットした場合の手動選択リスト */}
                      {matchingItems.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="text-sm font-semibold mb-2 text-red-600">複数ヒットしました。手動で選択してください:</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto"> {/* 高さを制限 */}
                            {matchingItems.map((item) => {
                              const imageUrl = item.items?.image;
                              const itemName = item.items?.name || '不明な物品';
                              const itemIdDisplay = item.items?.item_id || item.item_id || 'ID不明';
                              const isLoaned = item.status;

                              return (
                                <div key={item.control_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                                    <div className="h-8 w-8 rounded overflow-hidden flex items-center justify-center bg-white border flex-shrink-0">
                                      {imageUrl && imageUrl.trim() !== '' ? (
                                        <img src={imageUrl} alt={itemName} className="max-h-full max-w-full object-contain" />
                                      ) : (
                                        <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                                          <Package className="h-5 w-5 text-gray-400" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                      <span className="text-xs font-mono text-gray-700 truncate">{itemIdDisplay}</span>
                                      <span className="text-xs text-gray-500 truncate">{itemName}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => isLoaned ? handleItemReturn(item) : handleLoanItem(item)}
                                    disabled={isProcessing}
                                    className={`px-3 py-1 rounded-md text-xs text-white disabled:opacity-50 whitespace-nowrap ${
                                      isLoaned ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'
                                    }`}
                                  >
                                    {isLoaned ? '返却' : '貸出'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {showItemIdModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">アイテムIDで貸出/返却</h3>
                  <button
                    onClick={() => setShowItemIdModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="mb-4">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => handleNumericInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && barcodeInput) {
                        handleBarcodeSubmit(barcodeInput);
                      }
                    }}
                    placeholder="アイテムIDを入力"
                    className="w-full border border-gray-300 rounded-md p-2 font-mono"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumericInput(barcodeInput + num)}
                      className="p-4 text-xl font-semibold font-mono bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => setBarcodeInput('')}
                    className="p-4 text-xl font-semibold bg-red-100 hover:bg-red-200 rounded-md"
                  >
                    C
                  </button>
                  <button
                    onClick={() => setBarcodeInput(prev => prev.slice(0, -1))}
                    className="p-4 text-xl font-semibold bg-yellow-100 hover:bg-yellow-200 rounded-md"
                  >
                    ⌫
                  </button>
                </div>

                {matchingItems.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2">一致するアイテム:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {matchingItems.map((item) => {
                        const imageUrl = item.items?.image;
                        const itemName = item.items?.name || '不明な物品';
                        const itemIdDisplay = item.items?.item_id || item.item_id || 'ID不明'; // item_id もフォールバック
                        const isLoaned = item.status;

                        return (
                          <div key={item.control_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                              {/* 画像表示 */}
                              <div className="h-8 w-8 rounded overflow-hidden flex items-center justify-center bg-white border flex-shrink-0">
                                {imageUrl && imageUrl.trim() !== '' ? (
                                  <img
                                    src={imageUrl}
                                    alt={itemName}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                                    <Package className="h-5 w-5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              {/* 物品IDと名前表示を追加 */}
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-mono text-gray-700 truncate">{itemIdDisplay}</span>
                                <span className="text-xs text-gray-500 truncate">{itemName}</span>
                              </div>
                            </div>
                            {/* 貸出/返却ボタンを追加 */}
                            <button
                              onClick={() => isLoaned ? handleItemReturn(item) : handleLoanItem(item)}
                              disabled={isProcessing}
                              className={`px-3 py-1 rounded-md text-xs text-white disabled:opacity-50 whitespace-nowrap ${
                                isLoaned
                                  ? 'bg-yellow-500 hover:bg-yellow-600'
                                  : 'bg-blue-500 hover:bg-blue-600'
                              }`}
                            >
                              {isLoaned ? '返却' : '貸出'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">待機中のアイテム</h3>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold font-mono">{waitingItems.length}</span>
                </div>
              </div>
              <div className="p-4">
                {isLoadingItems ? ( // isLoadingItems が true の場合にローディング表示
                  <LoadingIndicator />
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">物品情報</th>
                          <th className="hidden min-[1800px]:table-cell px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase max-w-xs">物品名</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {waitingItems.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-4 text-gray-500">待機中のアイテムはありません</td></tr>
                        ) : (
                          waitingItems.map((control) => {
                            const imageUrl = control.items?.image;
                            const itemName = control.items?.name || 'アイテム画像';
                            return (
                              <tr key={control.control_id}>
                                <td className="px-4 py-2">
                                  <div className="h-10 w-10 rounded overflow-hidden border flex items-center justify-center bg-white">
                                    {imageUrl && imageUrl.trim() !== '' ? (
                                      <img
                                        src={imageUrl}
                                        alt={itemName}
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                                        <Package className="h-6 w-6 text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-mono">{control.items?.item_id ?? 'N/A'}</span>
                                    <span className="text-xs text-gray-600 min-[1800px]:hidden">{control.items?.name ?? '不明な物品'}</span>
                                  </div>
                                </td>
                                <td className="hidden min-[1800px]:table-cell px-4 py-2 max-w-xs">
                                  <span className="text-sm truncate" title={control.items?.name ?? '不明な物品'}>{control.items?.name ?? '不明な物品'}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <button onClick={() => handleLoanItem(control)} disabled={isProcessing} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm disabled:opacity-50 whitespace-nowrap">貸出</button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">貸出中のアイテム</h3>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold font-mono">{loanedItems.length}</span>
                </div>
              </div>
              <div className="p-4">
                {isLoadingItems ? ( // isLoadingItems が true の場合にローディング表示
                  <LoadingIndicator />
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">物品情報</th>
                          <th className="hidden min-[1800px]:table-cell px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase max-w-xs">物品名</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">経過時間</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {loanedItems.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-4 text-gray-500">貸出中のアイテムはありません</td></tr>
                        ) : (
                          loanedItems.map((control) => {
                            const imageUrl = control.items?.image;
                            const itemName = control.items?.name || 'アイテム画像';
                            return (
                              <tr key={control.control_id}>
                                <td className="px-4 py-2">
                                  <div className="h-10 w-10 rounded overflow-hidden border flex items-center justify-center bg-white">
                                    {imageUrl && imageUrl.trim() !== '' ? (
                                      <img
                                        src={imageUrl}
                                        alt={itemName}
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                                        <Package className="h-6 w-6 text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-mono">{control.items?.item_id ?? 'N/A'}</span>
                                    <span className="text-xs text-gray-600 min-[1800px]:hidden">{control.items?.name ?? '不明な物品'}</span>
                                  </div>
                                </td>
                                <td className="hidden min-[1800px]:table-cell px-4 py-2 max-w-xs">
                                  <span className="text-sm truncate" title={control.items?.name ?? '不明な物品'}>{control.items?.name ?? '不明な物品'}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <button onClick={() => handleItemReturn(control)} disabled={isProcessing} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm disabled:opacity-50 whitespace-nowrap">
                                    返却
                                  </button>
                                </td>
                                <td className="px-4 py-2"><span className="text-sm text-red-500">{formatElapsedTime(control.control_datetime)}</span></td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}