import React, { useState, useEffect, useCallback } from 'react';
import { supabase, insertWithOwnerId } from '../lib/supabase';
import { AlertCircle, X, Barcode, StopCircle, Package } from 'lucide-react';
import { useZxing } from 'react-zxing';

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

export default function LoaningControl() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEventRefId, setSelectedEventRefId] = useState<number | null>(null);
  const [waitingItems, setWaitingItems] = useState<Control[]>([]);
  const [loanedItems, setLoanedItems] = useState<Control[]>([]);
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

  const { ref } = useZxing({
    onDecodeResult(result) {
      const scannedBarcode = result.getText();
      setBarcodeInput(scannedBarcode);
      setShowCamera(false);
      setIsScanning(false);
      handleBarcodeSubmit(scannedBarcode);
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

  const fetchItems = useCallback(async () => {
    if (!selectedEventId) return;

    setIsLoadingItems(true);
    console.log(`Fetching items for event: ${selectedEventId}`);

    try {
      const { data, error } = await supabase
        .from('control')
        .select(`
          control_id,
          event_id,
          item_id,
          status,
          control_datetime,
          item_id_ref,
          event_id_ref,
          created_by,
          items(item_id, name, image)
        `)
        .eq('event_id', selectedEventId);

      if (error) {
        console.error('リレーショナルクエリエラー:', error);
        throw error;
      }

      const formattedData = data?.map(item => ({
        ...item,
        items: Array.isArray(item.items) ? item.items[0] : item.items,
        created_by: item.created_by || '',
        events: null
      })) as Control[] || [];

      const waiting = formattedData.filter(item => !item.status);
      const loaned = formattedData.filter(item => item.status);

      setWaitingItems(waiting);
      setLoanedItems(loaned);
    } catch (error) {
      console.error('Error fetching items:', error);
      setNotification({
        show: true,
        message: 'アイテム情報の取得に失敗しました',
        type: 'error'
      });
      setWaitingItems([]);
      setLoanedItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, [selectedEventId]);

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
      fetchItems();
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

      window.dispatchEvent(new CustomEvent('loan-status-changed', {
        detail: { type: 'loan', success: true }
      }));

      setNotification({
        show: true,
        message: `アイテム「${oldItemId || 'ID不明'}」を貸出しました`,
        type: 'success'
      });

      fetchItems();
      setBarcodeInput('');
      setMatchingItems([]);
      
      setShowBarcodeModal(false);
      setShowItemIdModal(false);
    } catch (error) {
      console.error('貸出処理エラー:', error);
      setNotification({
        show: true,
        message: '貸出処理中にエラーが発生しました',
        type: 'error'
      });
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

      window.dispatchEvent(new CustomEvent('loan-status-changed', {
        detail: { type: 'return', success: true }
      }));

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
          }
        } catch (historyError) {
          console.error('履歴記録中にエラーが発生:', historyError);
        }
      } else {
        console.warn('履歴登録に必要な情報が不足しています:', { 
          loanTime, oldItemId, oldEventId, itemIdRef, eventIdRef 
        });
      }

      setNotification({
        show: true,
        message: `アイテム「${oldItemId || 'ID不明'}」を返却しました`,
        type: 'success'
      });

      fetchItems();
      setBarcodeInput('');
      setMatchingItems([]);
      
      setShowBarcodeModal(false);
      setShowItemIdModal(false);
    } catch (error) {
      console.error('返却処理エラー:', error);
      setNotification({
        show: true,
        message: '返却処理中にエラーが発生しました',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarcodeSubmit = async (barcode: string) => {
    if (!selectedEventId) {
      setNotification({
        show: true,
        message: 'イベントを選択してください',
        type: 'error'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('control')
        .select(`
          control_id,
          event_id,
          item_id,
          status,
          control_datetime,
          item_id_ref,
          event_id_ref,
          created_by,
          items(item_id, name, image)
        `)
        .eq('event_id', selectedEventId)
        .eq('item_id', barcode);

      if (error) throw error;

      if (!data || data.length === 0) {
        setNotification({
          show: true,
          message: '該当する物品が見つかりません',
        type: 'error'
        });
        return;
      }

      const formattedData = data.map(item => ({
        ...item,
        items: Array.isArray(item.items) ? item.items[0] : item.items,
        events: null,
        created_by: item.created_by || ''
      })) as Control[];

      setBarcodeInput(barcode);
      setMatchingItems(formattedData);
    } catch (error) {
      console.error('Error processing barcode:', error);
      setNotification({
        show: true,
        message: '処理中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleNumericInput = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setBarcodeInput(numericValue);
  };

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
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6">貸出・返却管理</h2>
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">バーコードで貸出/返却</h3>
                  <button
                    onClick={() => {
                      setShowBarcodeModal(false);
                      setIsScanning(false);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6">
                  <button
                    onClick={() => {
                      setIsScanning(!isScanning);
                      if (!isScanning) {
                        setShowCamera(true);
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md mb-4 ${
                      isScanning 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    } text-white transition-colors`}
                  >
                    {isScanning ? (
                      <>
                        <StopCircle size={20} />
                        Stop
                      </>
                    ) : (
                      <>
                        <Barcode size={20} />
                        Start Scanning
                      </>
                    )}
                  </button>

                  {showCamera && (
                    <div className="relative w-full max-w-lg mx-auto aspect-video mb-4 rounded-lg overflow-hidden">
                      <video ref={ref as React.LegacyRef<HTMLVideoElement>} className="w-full h-full object-cover" />
                    </div>
                  )}

                  {barcodeInput && (
                    <div className="mb-4 p-4 bg-gray-100 rounded-md">
                      <p className="font-mono">Barcode: {barcodeInput}</p>
                    </div>
                  )}
                </div>

                {matchingItems.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2">一致するアイテム:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {matchingItems.map((item) => {
                        const imageUrl = item.items?.image;
                        const itemName = item.items?.name || '不明な物品';
                        return (
                          <div key={item.control_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
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
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
                    className="w-full border border-gray-300 rounded-md p-2"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumericInput(barcodeInput + num)}
                      className="p-4 text-xl font-semibold bg-gray-100 hover:bg-gray-200 rounded-md"
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
                        return (
                          <div key={item.control_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
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
                            </div>
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
                <h3 className="text-lg font-semibold">待機中のアイテム ({waitingItems.length})</h3>
                {isLoadingItems && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                )}
              </div>
              <div className="p-4">
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
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">貸出中のアイテム ({loanedItems.length})</h3>
                {isLoadingItems && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                )}
              </div>
              <div className="p-4">
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
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}