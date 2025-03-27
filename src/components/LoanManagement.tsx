import React, { useState, useEffect } from 'react';
import { supabase, formatJSTDateTime } from '../lib/supabase';
import { AlertCircle, X, Barcode, StopCircle } from 'lucide-react';
import { useZxing } from 'react-zxing';

interface Event {
  event_id: string;
  name: string;
}

interface Item {
  item_id: string;
  name: string;
  image: string;
}

interface Control {
  control_id: number;
  event_id: string;
  item_id: string;
  status: boolean;
  control_datetime: string;
  item: Item;
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

export default function LoanManagement() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [waitingItems, setWaitingItems] = useState<Control[]>([]);
  const [loanedItems, setLoanedItems] = useState<Control[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showItemIdModal, setShowItemIdModal] = useState(false);
  const [, setCurrentTime] = useState(new Date());
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
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchItems();
    }
  }, [selectedEventId]);

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
        item.item_id.toLowerCase().includes(barcodeInput.toLowerCase())
      );
      setMatchingItems(matches);
    } else {
      setMatchingItems([]);
    }
  }, [barcodeInput, waitingItems, loanedItems, selectedEventId]);

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

  const fetchItems = async () => {
    try {
      const { data: controlData, error: controlError } = await supabase
        .from('control')
        .select(`
          *,
          item:items(*)
        `)
        .eq('event_id', selectedEventId);

      if (controlError) throw controlError;

      const waiting = controlData?.filter(item => !item.status) || [];
      const loaned = controlData?.filter(item => item.status) || [];

      setWaitingItems(waiting);
      setLoanedItems(loaned);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const handleStatusUpdate = async (controlId: number, newStatus: boolean) => {
    try {
      // Use JST for timestamps
      const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      const jstDate = new Date(now);

      // ユーザーのメールアドレスを取得
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      if (!userEmail) {
        setNotification({
          show: true,
          message: 'ユーザー情報が取得できません。再ログインしてください。',
          type: 'error'
        });
        return;
      }

      // Get the control record to access event_id and item_id
      const { data: controlData, error: controlError } = await supabase
        .from('control')
        .select('*')
        .eq('control_id', controlId)
        .single();

      if (controlError) throw controlError;

      // Update control status
      const { error: updateError } = await supabase
        .from('control')
        .update({ 
          status: newStatus,
          control_datetime: jstDate.toISOString()
        })
        .eq('control_id', controlId);

      if (updateError) throw updateError;

      if (newStatus) {
        // Item is being loaned out - create new result record
        const { error: insertError } = await supabase
          .from('result')
          .insert({
            event_id: controlData.event_id,
            item_id: controlData.item_id,
            start_datetime: jstDate.toISOString(),
            created_by: userEmail // ユーザーのメールアドレスを設定
          });

        if (insertError) throw insertError;
      } else {
        // Item is being returned - update the latest result record
        const { error: updateResultError } = await supabase
          .from('result')
          .update({ end_datetime: jstDate.toISOString() })
          .eq('event_id', controlData.event_id)
          .eq('item_id', controlData.item_id)
          .is('end_datetime', null);

        if (updateResultError) throw updateResultError;
      }

      setNotification({
        show: true,
        message: `物品を${newStatus ? '貸出' : '返却'}しました`,
        type: 'success'
      });

      fetchItems();
      setMatchingItems([]);
      setBarcodeInput('');
      setShowBarcodeModal(false);
      setShowItemIdModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
      setNotification({
        show: true,
        message: '更新中にエラーが発生しました',
        type: 'error'
      });
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
        .select('*')
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

      setBarcodeInput(barcode);
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

  const formatElapsedTime = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const elapsed = Math.floor((now - start) / 1000);

    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

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
        <h2 className="text-xl font-semibold mb-6">イベント選択</h2>
        <div className="mb-6">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
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
      </div>

      {selectedEventId && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowBarcodeModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              バーコードで貸出/返却
            </button>
            <button
              onClick={() => setShowItemIdModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              アイテムIDで貸出/返却
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">待機中のアイテム</h3>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">物品ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">物品名</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {waitingItems.map((control) => (
                        <tr key={control.control_id}>
                          <td className="px-4 py-2">
                            <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                              <img
                                src={control.item.image || 'https://via.placeholder.com/150'}
                                alt={control.item.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm font-mono">{control.item_id}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm">{control.item.name}</span>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleStatusUpdate(control.control_id, true)}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                            >
                              貸出
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">貸出中のアイテム</h3>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">物品ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">物品名</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">経過時間</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loanedItems.map((control) => (
                        <tr key={control.control_id}>
                          <td className="px-4 py-2">
                            <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                              <img
                                src={control.item.image || 'https://via.placeholder.com/150'}
                                alt={control.item.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm font-mono">{control.item_id}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm">{control.item.name}</span>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleStatusUpdate(control.control_id, false)}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm"
                            >
                              返却
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm text-red-500">
                              {formatElapsedTime(control.control_datetime)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
                <div className="space-y-2">
                  {matchingItems.map((item) => (
                    <div key={item.control_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded overflow-hidden flex items-center justify-center bg-white">
                          <img
                            src={item.item.image || 'https://via.placeholder.com/150'}
                            alt={item.item.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-sm font-mono">{item.item_id}</span>
                        <span className="text-sm">{item.item.name}</span>
                      </div>
                      <button
                        onClick={() => handleStatusUpdate(item.control_id, !item.status)}
                        className={`px-2 py-1 text-xs rounded text-white ${
                          item.status ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      >
                        {item.status ? '返却' : '貸出'}
                      </button>
                    </div>
                  ))}
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
                <div className="space-y-2">
                  {matchingItems.map((item) => (
                    <div key={item.control_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded overflow-hidden flex items-center justify-center bg-white">
                          <img
                            src={item.item.image || 'https://via.placeholder.com/150'}
                            alt={item.item.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-sm font-mono">{item.item_id}</span>
                        <span className="text-sm">{item.item.name}</span>
                      </div>
                      <button
                        onClick={() => handleStatusUpdate(item.control_id, !item.status)}
                        className={`px-2 py-1 text-xs rounded text-white ${
                          item.status ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      >
                        {item.status ? '返却' : '貸出'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}