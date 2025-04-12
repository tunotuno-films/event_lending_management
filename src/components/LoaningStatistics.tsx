import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, X, Download, ArrowUpDown } from 'lucide-react';

// ★ デフォルト画像URLを追加
const DEFAULT_IMAGE = 'https://placehold.jp/3b82f6/ffffff/150x150.png?text=No+Image';

interface Event {
  event_id: string;
  name: string;
}

interface ItemStatistics {
  item_id: string;
  item_name: string;
  image: string;
  loan_count: number;
  total_duration: number;
  average_duration: number;
  hourly_usage: number[];
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

const HOURS = Array.from({ length: 24 }, (_, i) => 
  `${i.toString().padStart(2, '0')}:00`
);

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

export default function LoaningStatistics() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [statistics, setStatistics] = useState<ItemStatistics[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [sortConfig, setSortConfig] = useState<{
    key: 'item_id' | 'loan_count' | 'total_duration' | 'average_duration';
    direction: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchStatistics();
    }
  }, [selectedEventId]);

  // 初回レンダリング時にlocalStorageから読み込み
  useEffect(() => {
    const storedEventId = localStorage.getItem('selectedEventId');
    if (storedEventId) {
      setSelectedEventId(storedEventId);
    }
  }, []);

  const fetchEvents = async () => {
    try {
      // 現在のユーザーIDで絞り込み（RLSが正しく設定されていれば不要ですが、念のため）
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

  const fetchStatistics = async () => {
    try {
      const { data: loanRecords, error: loanError } = await supabase
        .from('result')
        .select(`
          *,
          item:items(name, image)
        `)
        .eq('event_id', selectedEventId);

      if (loanError) throw loanError;

      if (!loanRecords) {
        setStatistics([]);
        return;
      }

      const itemStats = new Map<string, ItemStatistics>();

      loanRecords.forEach(record => {
        const itemId = record.item_id;
        const existingStats = itemStats.get(itemId) || {
          item_id: itemId,
          item_name: record.item.name,
          image: record.item.image,
          loan_count: 0,
          total_duration: 0,
          average_duration: 0,
          hourly_usage: new Array(24).fill(0)
        };

        existingStats.loan_count++;

        if (record.end_datetime) {
          const start = new Date(record.start_datetime);
          const end = new Date(record.end_datetime);
          const duration = (end.getTime() - start.getTime()) / 1000;
          existingStats.total_duration += duration;
          existingStats.average_duration = existingStats.total_duration / existingStats.loan_count;

          // Calculate hourly usage
          const startHour = start.getHours();
          existingStats.hourly_usage[startHour]++;
        }

        itemStats.set(itemId, existingStats);
      });

      setStatistics(Array.from(itemStats.values()));
    } catch (error) {
      console.error('Error fetching statistics:', error);
      setNotification({
        show: true,
        message: '統計データの取得中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleSort = (key: 'item_id' | 'loan_count' | 'total_duration' | 'average_duration') => {
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });

    const sortedStats = [...statistics].sort((a, b) => {
      if (key === 'item_id') {
        return direction === 'asc'
          ? a.item_id.localeCompare(b.item_id)
          : b.item_id.localeCompare(a.item_id);
      } else {
        const aValue = a[key];
        const bValue = b[key];
        return direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    setStatistics(sortedStats);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const downloadCSV = () => {
    if (statistics.length === 0) return;

    const headers = ['物品ID', '物品名', '貸出回数', '総貸出時間', '平均貸出時間', ...HOURS];
    const csvData = statistics.map(stat => [
      stat.item_id,
      stat.item_name,
      stat.loan_count.toString(),
      formatDuration(stat.total_duration),
      formatDuration(stat.average_duration),
      ...stat.hourly_usage.map(count => count.toString())
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    // ファイル名を「yyyymmdd_貸出統計_イベントid-イベント名.csv」形式に変更
    const today = new Date();
    const yyyy = today.getFullYear().toString();
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const dd = today.getDate().toString().padStart(2, '0');
    const dateString = `${yyyy}${mm}${dd}`;
    const selectedEvent = events.find(e => e.event_id === selectedEventId);
    const fileName = selectedEvent 
      ? `${dateString}_貸出統計_${selectedEvent.event_id}-${selectedEvent.name}.csv`
      : `${dateString}_貸出統計.csv`;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const getHeatmapColor = (count: number, maxCount: number) => {
    if (count === 0) return {
      backgroundColor: 'rgb(249, 250, 251)', // bg-gray-50
      color: 'rgb(156, 163, 175)' // text-gray-400
    };
    
    // Calculate opacity based on count relative to max
    const opacity = Math.max(0.1, Math.min(1, count / maxCount));
    
    return {
      backgroundColor: `rgba(59, 130, 246, ${opacity})`,
      color: opacity > 0.5 ? 'white' : 'black'
    };
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
        <h2 className="text-xl font-semibold mb-4">貸出統計</h2>
        
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
          <div className="flex justify-end mb-4">
            <button
              onClick={downloadCSV}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              CSVダウンロード
            </button>
          </div>

          {/* Regular statistics table */}
          <div className="mb-8 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    画像
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('item_id')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      物品ID
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    物品名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('loan_count')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      貸出回数
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('total_duration')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      総貸出時間
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('average_duration')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      平均貸出時間
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.map((stat) => (
                  <tr key={stat.item_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center bg-white border">
                        <img
                          src={getItemImageUrl(stat.image)}
                          alt={stat.item_name}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_IMAGE }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono">{stat.item_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{stat.item_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{stat.loan_count}回</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{formatDuration(stat.total_duration)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{formatDuration(stat.average_duration)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Heatmap section */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">ヒートマップ</h3>
            <div className="relative">
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                          画像
                        </th>
                        <th className="sticky left-[100px] z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px]">
                          物品ID
                        </th>
                        <th className="sticky left-[250px] z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">
                          物品名
                        </th>
                        {HOURS.map(hour => (
                          <th key={hour} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[50px] min-w-[50px]">
                            {hour}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {statistics.map((stat) => {
                        const maxCount = Math.max(...stat.hourly_usage);
                        
                        return (
                          <tr key={`heatmap-${stat.item_id}`} className="hover:bg-gray-50">
                            <td className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap w-[100px]">
                              <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center bg-white border">
                                <img
                                  src={getItemImageUrl(stat.image)}
                                  alt={stat.item_name}
                                  className="max-h-full max-w-full object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_IMAGE }}
                                />
                              </div>
                            </td>
                            <td className="sticky left-[100px] z-10 bg-white px-6 py-4 whitespace-nowrap w-[150px]">
                              <div className="text-sm font-mono">{stat.item_id}</div>
                            </td>
                            <td className="sticky left-[250px] z-10 bg-white px-6 py-4 whitespace-nowrap w-[200px]">
                              <div className="text-sm">{stat.item_name}</div>
                            </td>
                            {stat.hourly_usage.map((count, index) => (
                              <td key={`${stat.item_id}-${index}`} className="px-2 py-4 text-center w-[50px] min-w-[50px]">
                                <div 
                                  className="w-8 h-8 rounded flex items-center justify-center mx-auto"
                                  style={getHeatmapColor(count, maxCount)}
                                >
                                  <span>
                                    {count > 0 ? count : ''}
                                  </span>
                                </div>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
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