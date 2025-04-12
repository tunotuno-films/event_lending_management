import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatJSTDateTime } from '../lib/supabase';
import { AlertCircle, X, Download } from 'lucide-react';

// ★ デフォルト画像URLを追加
const DEFAULT_IMAGE = 'https://placehold.jp/3b82f6/ffffff/150x150.png?text=No+Image';

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

// ★ 画像URLヘルパー関数を追加
const getItemImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl || imageUrl.trim() === '') return DEFAULT_IMAGE;
  try {
    new URL(imageUrl);
    return imageUrl;
  } catch (e) {
    return DEFAULT_IMAGE;
  }
};

export default function LoaningLog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loanRecords, setLoanRecords] = useState<LoanRecord[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof LoanRecord | 'item_info';
    direction: 'asc' | 'desc';
  } | null>(null);
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
    }
  };

  const handleSort = (column: keyof LoanRecord | 'item_info') => {
    setSortConfig(prevConfig => {
      const isCurrentColumn = prevConfig?.key === column;
      const currentDirection = prevConfig?.direction;

      if (isWideScreen) {
        if (column === 'item_info') return prevConfig;

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

  const getSortIndicator = (targetKey: keyof LoanRecord | 'item_info') => {
    if (!sortConfig) return null;

    let isActive = false;
    let direction = sortConfig.direction;
    let displayKey: string = '';

    if (isWideScreen) {
      isActive = sortConfig.key === targetKey;
      displayKey = '';
    } else {
      if (targetKey === 'item_info') {
        isActive = sortConfig.key === 'item_id' || sortConfig.key === 'item';
        displayKey = sortConfig.key === 'item_id' ? '物品ID' : sortConfig.key === 'item' ? '物品名' : '';
      } else {
        isActive = sortConfig.key === targetKey;
        displayKey = '';
      }
    }

    if (!isActive) return null;

    const arrow = direction === 'asc' ? '↑' : '↓';
    return <span className="ml-1 font-bold">{displayKey && !isWideScreen ? `${displayKey}${arrow}` : arrow}</span>;
  };

  const getSortBgColor = (targetKey: keyof LoanRecord | 'item_info') => {
    if (!sortConfig) return '';

    let isActive = false;
    if (isWideScreen) {
       isActive = sortConfig.key === targetKey;
    } else {
      if (targetKey === 'item_info') {
        isActive = sortConfig.key === 'item_id' || sortConfig.key === 'item';
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
        durationInSeconds = ((end - start) / 1000).toFixed(0);
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
                    className={`hidden min-[1800px]:table-cell cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('item')}`}
                  >
                     <button className="flex items-center gap-1 hover:text-gray-700">
                       物品名 {getSortIndicator('item')}
                     </button>
                  </th>
                  <th className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('start_datetime')}`}>
                    <button
                      onClick={() => handleSort('start_datetime')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      貸出時間
                      {getSortIndicator('start_datetime')}
                    </button>
                  </th>
                  <th className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('end_datetime')}`}>
                    <button
                      onClick={() => handleSort('end_datetime')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      返却時間
                      {getSortIndicator('end_datetime')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedLoanRecords.map((record) => (
                  <tr key={record.result_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center bg-white border">
                        <img
                          src={getItemImageUrl(record.item?.image)}
                          alt={record.item?.name || 'アイテム画像'}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_IMAGE }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap min-[1800px]:hidden">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono">{record.item_id || '-'}</span>
                        <span className="text-xs text-gray-600">{record.item?.name || '不明なアイテム'}</span>
                      </div>
                    </td>
                    <td className="hidden min-[1800px]:table-cell px-6 py-4 whitespace-nowrap">
                       <div className="text-sm font-mono">
                        {record.item_id || '-'}
                      </div>
                    </td>
                    <td className="hidden min-[1800px]:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{record.item?.name || '不明なアイテム'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm">
                        {formatJSTDateTime(record.start_datetime)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm">
                        {record.end_datetime
                          ? formatJSTDateTime(record.end_datetime)
                          : <span className="text-yellow-500">未返却</span>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}