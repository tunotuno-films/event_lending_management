import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatJSTDateTime } from '../lib/supabase';
import { AlertCircle, X, Download, Clock, Package } from 'lucide-react';
import LoadingIndicator from './LoadingIndicator'; // LoadingIndicator をインポート

interface Event {
  event_id: string;
  name: string;
}

interface LoanRecord {
  result_id: number;
  event_id: string;
  item_id: string;
  event_id_ref?: number;
  item_id_ref?: number;
  start_datetime: string;
  end_datetime: string | null;
  item?: {
    name: string;
    image: string;
  };
  items?: {
    name: string;
    image: string;
  };
}

interface NotificationProps {
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'info';
}

const Notification: React.FC<NotificationProps> = ({ message, onClose, type = 'success' }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          clearInterval(timer);
          if (onClose) onClose();
          return 0;
        }
        return newCount;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [message, onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const hoverColor = type === 'success' ? 'hover:bg-green-600' : type === 'error' ? 'hover:bg-red-600' : 'hover:bg-blue-600';

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

export default function LoaningLog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loanRecords, setLoanRecords] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(false); // loading state を追加
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof LoanRecord | 'item_info' | 'loan_period' | 'duration';
    direction: 'asc' | 'desc';
  } | null>({ key: 'start_datetime', direction: 'desc' });
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth >= 1800);

  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 1800);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchLoanRecords();
    }
  }, [selectedEventId]);

  useEffect(() => {
    const storedEventId = localStorage.getItem('selectedEventId');
    if (storedEventId) {
      setSelectedEventId(storedEventId);
    }
  }, []);

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('ユーザー情報が取得できません');
        return;
      }
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setNotification({
        show: true,
        message: 'イベントの取得中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const fetchLoanRecords = async () => {
    setLoading(true); // データ取得開始時に loading を true に設定
    try {
      const { data: basicData, error: basicError } = await supabase
        .from('result')
        .select('*')
        .eq('event_id', selectedEventId)
        .limit(1);
      
      if (basicError) {
        console.error('基本クエリエラー:', basicError);
        throw basicError;
      }
      
      console.log('基本クエリ結果（構造確認）:', basicData);
      
      const { data, error } = await supabase
        .from('result')
        .select(`
          *,
          items:item_id_ref(item_id, name, image)
        `)
        .eq('event_id', selectedEventId)
        .order('start_datetime', { ascending: false });

      if (error) {
        console.error('リレーショナルクエリエラー:', error);
        throw error;
      }

      console.log('取得したデータ:', data);
      
      const formattedRecords = (data || []).map(record => {
        const itemInfo = record.items ? 
          (Array.isArray(record.items) ? record.items[0] : record.items) : null;
        
        return {
          ...record,
          item: itemInfo || {
            name: '不明なアイテム',
            image: null
          }
        };
      });

      setLoanRecords(formattedRecords);
      setSortConfig({ key: 'start_datetime', direction: 'desc' });
    } catch (error) {
      console.error('Error fetching loan records:', error);
      setNotification({
        show: true,
        message: '貸出履歴の取得中にエラーが発生しました',
        type: 'error'
      });
    } finally {
      setLoading(false); // データ取得完了時（成功・失敗問わず）に loading を false に設定
    }
  };

  const formatLoanDuration = (start: string, end: string | null): string => {
    if (!end) {
      return '-';
    }
    try {
      const startDate = new Date(start).getTime();
      const endDate = new Date(end).getTime();
      const durationInSeconds = Math.max(0, Math.floor((endDate - startDate) / 1000));

      if (durationInSeconds < 60) {
        return `${durationInSeconds}秒`;
      } else {
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = durationInSeconds % 60;
        return `${minutes}分${seconds}秒`;
      }
    } catch (e) {
      console.error("Error calculating duration:", e);
      return '計算エラー';
    }
  };

  const handleSort = (column: keyof LoanRecord | 'item_info' | 'loan_period' | 'duration') => {
    setSortConfig(prevConfig => {
      const isCurrentColumn = prevConfig?.key === column;
      const currentDirection = prevConfig?.direction;

      if (isWideScreen) {
        if (column === 'item_info') return prevConfig;

        if (column === 'loan_period') {
          const direction = prevConfig?.key === 'start_datetime' && currentDirection === 'asc' ? 'desc' : 'asc';
          return { key: 'start_datetime', direction: direction };
        } else if (column === 'duration') {
          const direction = prevConfig?.key === 'duration' && currentDirection === 'asc' ? 'desc' : 'asc';
          return { key: 'duration', direction: direction };
        }

        const sortKey = column === 'item' ? 'item' : column;
        const direction = isCurrentColumn && currentDirection === 'asc' ? 'desc' : 'asc';
        return { key: sortKey as keyof LoanRecord, direction: direction };

      } else {
        if (column === 'item_info') {
          if (prevConfig?.key === 'item_id' && currentDirection === 'asc') {
            return { key: 'item_id', direction: 'desc' };
          } else if (prevConfig?.key === 'item_id' && currentDirection === 'desc') {
            return { key: 'item', direction: 'asc' };
          } else if (prevConfig?.key === 'item' && currentDirection === 'asc') {
            return { key: 'item', direction: 'desc' };
          } else {
            return { key: 'item_id', direction: 'asc' };
          }
        } else if (column === 'loan_period') {
          const direction = prevConfig?.key === 'start_datetime' && currentDirection === 'asc' ? 'desc' : 'asc';
          return { key: 'start_datetime', direction: direction };
        } else if (column === 'duration') {
          const direction = prevConfig?.key === 'duration' && currentDirection === 'asc' ? 'desc' : 'asc';
          return { key: 'duration', direction: direction };
        } else {
          const direction = isCurrentColumn && currentDirection === 'asc' ? 'desc' : 'asc';
          return { key: column, direction: direction };
        }
      }
    });
  };

  const sortedLoanRecords = useMemo(() => {
    if (!sortConfig) return loanRecords;

    const sortKey = sortConfig.key;

    return [...loanRecords].sort((a, b) => {
      if (sortKey === 'duration') {
        const getDuration = (record: LoanRecord): number => {
          if (!record.end_datetime) return -1;
          try {
            return (new Date(record.end_datetime).getTime() - new Date(record.start_datetime).getTime()) / 1000;
          } catch {
            return -2;
          }
        };
        const aDur = getDuration(a);
        const bDur = getDuration(b);

        if (aDur < 0 && bDur < 0) return 0;
        if (aDur < 0) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bDur < 0) return sortConfig.direction === 'asc' ? 1 : -1;

        return sortConfig.direction === 'asc' ? aDur - bDur : bDur - aDur;
      }

      let aVal: any;
      let bVal: any;

      if (sortKey === 'item') {
        aVal = a.item?.name || '';
        bVal = b.item?.name || '';
      } else if (sortKey === 'item_id') {
        aVal = a.item_id || '';
        bVal = b.item_id || '';
      } else {
        aVal = a[sortKey as keyof LoanRecord] || '';
        bVal = b[sortKey as keyof LoanRecord] || '';
      }

      if (sortKey === 'start_datetime' || sortKey === 'end_datetime') {
        const aDate = aVal ? new Date(aVal).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
        const bDate = bVal ? new Date(bVal).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
        return aDate - bDate;
      } else if (sortKey === 'item_id') {
        const numA = parseInt(aVal, 10);
        const numB = parseInt(bVal, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }
        return sortConfig.direction === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }, [loanRecords, sortConfig]);

  const getSortIndicator = (targetKey: keyof LoanRecord | 'item_info' | 'loan_period' | 'duration') => {
    if (!sortConfig) return null;

    let isActive = false;
    let direction = sortConfig.direction;
    let displayKey: string = '';
    const isLoanPeriodTarget = targetKey === 'loan_period';
    const isDurationTarget = targetKey === 'duration';
    const activeSortKey = isLoanPeriodTarget ? 'start_datetime' : isDurationTarget ? 'duration' : targetKey;

    if (isWideScreen) {
      isActive = sortConfig.key === activeSortKey;
      displayKey = '';
    } else {
      if (targetKey === 'item_info') {
        isActive = sortConfig.key === 'item_id' || sortConfig.key === 'item';
        displayKey = sortConfig.key === 'item_id' ? '物品ID' : sortConfig.key === 'item' ? '物品名' : '';
      } else if (isLoanPeriodTarget) {
        isActive = sortConfig.key === 'start_datetime';
        displayKey = '';
      } else if (isDurationTarget) {
        isActive = sortConfig.key === 'duration';
        displayKey = '';
      } else {
        isActive = sortConfig.key === targetKey;
        displayKey = '';
      }
    }

    if (!isActive) return null;

    const arrow = direction === 'asc' ? '↑' : '↓';
    return <span className="ml-1 font-bold">{displayKey && !isWideScreen ? `${displayKey}${arrow}` : arrow}</span>;
  };

  const getSortBgColor = (targetKey: keyof LoanRecord | 'item_info' | 'loan_period' | 'duration') => {
    if (!sortConfig) return '';

    let isActive = false;
    const isLoanPeriodTarget = targetKey === 'loan_period';
    const isDurationTarget = targetKey === 'duration';
    const activeSortKey = isLoanPeriodTarget ? 'start_datetime' : isDurationTarget ? 'duration' : targetKey;

    if (isWideScreen) {
      isActive = sortConfig.key === activeSortKey;
    } else {
      if (targetKey === 'item_info') {
        isActive = sortConfig.key === 'item_id' || sortConfig.key === 'item';
      } else if (isLoanPeriodTarget) {
        isActive = sortConfig.key === 'start_datetime';
      } else if (isDurationTarget) {
        isActive = sortConfig.key === 'duration';
      } else {
        isActive = sortConfig.key === targetKey;
      }
    }

    if (!isActive) return '';
    return sortConfig.direction === 'asc' ? 'bg-green-100' : 'bg-orange-100';
  };

  const handleDeleteShortLoans = async () => {
    if (!selectedEventId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.id) {
        setNotification({
          show: true,
          message: 'ユーザー情報が取得できません。再ログインしてください。',
          type: 'error'
        });
        return;
      }

      const shortLoans = loanRecords.filter(record => {
        if (!record.end_datetime) return false;
        const start = new Date(record.start_datetime).getTime();
        const end = new Date(record.end_datetime).getTime();
        const durationInSeconds = (end - start) / 1000;
        return durationInSeconds < 60;
      });

      if (shortLoans.length === 0) {
        setNotification({
          show: true,
          message: '60秒未満の貸出記録は見つかりませんでした',
          type: 'info'
        });
        return;
      }

      const { error } = await supabase
        .from('result')
        .delete()
        .eq('event_id', selectedEventId)
        .in('result_id', shortLoans.map(record => record.result_id));

      if (error) throw error;

      await fetchLoanRecords();

      setNotification({
        show: true,
        message: `${shortLoans.length}件の60秒未満の貸出記録を削除しました`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting short loans:', error);
      setNotification({
        show: true,
        message: '削除中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const downloadCSV = () => {
    if (loanRecords.length === 0) return;

    const headers = ['物品ID', '物品名', '貸出時間', '返却時間', '貸出時間(秒)'];
    const csvData = loanRecords.map(record => {
      let durationInSeconds = '-';

      if (record.start_datetime && record.end_datetime) {
        const start = new Date(record.start_datetime).getTime();
        const end = new Date(record.end_datetime).getTime();
        const durationSec = Math.max(0, (end - start) / 1000);
        durationInSeconds = durationSec.toFixed(0);
      }

      return [
        record.item_id,
        record.item?.name || '不明なアイテム',
        formatJSTDateTime(record.start_datetime),
        record.end_datetime ? formatJSTDateTime(record.end_datetime) : '未返却',
        durationInSeconds
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const today = new Date();
    const yyyy = today.getFullYear().toString();
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const dd = today.getDate().toString().padStart(2, '0');
    const dateString = `${yyyy}${mm}${dd}`;
    const selectedEvent = events.find(e => e.event_id === selectedEventId);
    const fileName = selectedEvent 
      ? `${dateString}_貸出履歴_${selectedEvent.event_id}-${selectedEvent.name}.csv`
      : `${dateString}_貸出履歴.csv`;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const formatTimeOnly = (dateTimeString: string | null): string => {
    if (!dateTimeString) return '-';
    try {
      const formatted = formatJSTDateTime(dateTimeString);
      const timePart = formatted.split(' ')[1];
      return timePart || '-';
    } catch (e) {
      return 'エラー';
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

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">貸出履歴</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            イベント選択
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              localStorage.setItem('selectedEventId', e.target.value);
              window.dispatchEvent(new CustomEvent('selectedEventChanged'));
            }}
            className="w-full border border-gray-300 rounded-md p-2"
          >
            <option value="">イベントを選択してください</option>
            {events.map(event => (
              <option key={event.event_id} value={event.event_id}>
                {event.event_id} - {event.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEventId && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <button
                onClick={handleDeleteShortLoans}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <X size={16} />
                60秒未満の貸出を削除
              </button>
            </div>
            <div>
              <button
                onClick={downloadCSV}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                CSVダウンロード
              </button>
            </div>
          </div>

          {loading ? ( // loading が true の場合にローディングインジケーターを表示
            <LoadingIndicator />
          ) : loanRecords.length === 0 ? ( // データがない場合の表示
            <div className="text-center py-10 text-gray-500">
              貸出履歴がありません。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      画像
                    </th>
                    <th
                      onClick={() => !isWideScreen && handleSort('item_info')}
                      className={`min-[1800px]:hidden cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('item_info')}`}
                    >
                      <button className="flex items-center gap-1 hover:text-gray-700">
                        {!getSortIndicator('item_info') && '物品情報'} {getSortIndicator('item_info')}
                      </button>
                    </th>
                    <th
                      onClick={() => isWideScreen && handleSort('item_id')}
                      className={`hidden min-[1800px]:table-cell cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('item_id')}`}
                    >
                      <button className="flex items-center gap-1 hover:text-gray-700">
                        物品ID {getSortIndicator('item_id')}
                      </button>
                    </th>
                    <th
                      onClick={() => isWideScreen && handleSort('item')}
                      className={`hidden min-[1800px]:table-cell cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs ${getSortBgColor('item')}`}
                    >
                      <button className="flex items-center gap-1 hover:text-gray-700">
                        物品名 {getSortIndicator('item')}
                      </button>
                    </th>
                    <th className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('loan_period')}`}>
                      <button
                        onClick={() => handleSort('loan_period')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        貸出時間
                        {getSortIndicator('loan_period')}
                      </button>
                    </th>
                    <th className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('duration')}`}>
                      <button
                        onClick={() => handleSort('duration')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        <Clock size={14} className="mr-1" />
                        貸出期間
                        {getSortIndicator('duration')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedLoanRecords.map((record) => {
                    const item = record.item || record.items;
                    const imageUrl = item?.image;
                    const itemName = item?.name || '名前不明';
                    const startTimeStr = formatTimeOnly(record.start_datetime);
                    const endTimeStr = record.end_datetime ? formatTimeOnly(record.end_datetime) : '未返却';
                    const durationStr = formatLoanDuration(record.start_datetime, record.end_datetime);

                    return (
                      <tr key={record.result_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center border bg-white">
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
                        <td className="px-6 py-4 min-[1800px]:hidden">
                          <div className="flex flex-col">
                            <span className="text-sm font-mono">{record.item_id || '-'}</span>
                            <span className="text-xs text-gray-600">{itemName}</span>
                          </div>
                        </td>
                        <td className="hidden min-[1800px]:table-cell px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono">
                            {record.item_id || '-'}
                          </div>
                        </td>
                        <td className="hidden min-[1800px]:table-cell px-6 py-4 max-w-xs">
                          <div className="text-sm truncate" title={itemName}>{itemName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm font-mono">
                            <span className="text-green-600">{startTimeStr}</span>
                            <span>→</span>
                            <span className={record.end_datetime ? "text-red-600" : "text-yellow-500 text-xs"}>
                              {endTimeStr}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">{durationStr}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}