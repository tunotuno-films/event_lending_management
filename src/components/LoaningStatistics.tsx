import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, X, Download} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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
  original_item_ids?: string[];
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

const getItemImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl || imageUrl.trim() === '') return DEFAULT_IMAGE;
  try {
    new URL(imageUrl);
    return imageUrl;
  } catch (e) {
    return DEFAULT_IMAGE;
  }
};

const formatDuration = (seconds: number): string => {
  if (seconds < 0) return '0時間0分0秒'; // 負の値は0として扱う

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  // 0秒の場合も考慮
  if (hours === 0 && minutes === 0 && remainingSeconds === 0) {
    return '0時間0分0秒';
  }

  let result = '';
  if (hours > 0) {
    result += `${hours}時間`;
  }
  if (minutes > 0 || hours > 0) { // 時間がある場合、分が0でも表示
    result += `${minutes}分`;
  }
  result += `${remainingSeconds}秒`;

  return result;
};

// 色生成関数（HLS色空間を利用して区別しやすい色を生成）
const generateDistinctColors = (count: number): string[] => {
  const colors: string[] = [];
  const saturation = 70; // 彩度
  const lightness = 60; // 明度
  for (let i = 0; i < count; i++) {
    const hue = (i * (360 / count)) % 360; // 色相を均等に分散
    colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`); // 半透明にする
  }
  return colors;
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
  // sortConfig の初期値を貸出回数の降順に設定
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ItemStatistics | 'item_info';
    direction: 'asc' | 'desc';
  } | null>({ key: 'loan_count', direction: 'desc' });
  const [mergeByName, setMergeByName] = useState(false);
  const [animatedIdIndices, setAnimatedIdIndices] = useState<{ [itemName: string]: number }>({});
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
      fetchStatistics();
    }
  }, [selectedEventId]);

  useEffect(() => {
    const storedEventId = localStorage.getItem('selectedEventId');
    if (storedEventId) {
      setSelectedEventId(storedEventId);
    }
  }, []);

  useEffect(() => {
    if (!mergeByName) {
      setAnimatedIdIndices({});
      return;
    }

    const intervalId = setInterval(() => {
      setAnimatedIdIndices(prevIndices => {
        const newIndices: { [itemName: string]: number } = {};
        displayStatistics.forEach(stat => {
          if (stat.original_item_ids && stat.original_item_ids.length > 1) {
            const currentIndex = prevIndices[stat.item_name] ?? 0;
            newIndices[stat.item_name] = (currentIndex + 1) % stat.original_item_ids.length;
          } else if (stat.original_item_ids) {
            newIndices[stat.item_name] = 0;
          }
        });
        return newIndices;
      });
    }, 2000);

    return () => clearInterval(intervalId);
  }, [mergeByName, statistics]);

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
        const itemName = record.item?.name;
        const itemImage = record.item?.image;

        if (!itemName) {
          console.warn(`Item name not found for item_id: ${record.item_id}`);
        }

        const itemId = record.item_id;
        const existingStats = itemStats.get(itemId) || {
          item_id: itemId,
          item_name: itemName || '名前不明',
          image: itemImage || DEFAULT_IMAGE,
          loan_count: 0,
          total_duration: 0,
          average_duration: 0,
          hourly_usage: new Array(24).fill(0)
        };

        existingStats.loan_count++;

        if (record.end_datetime && record.start_datetime) {
          const start = new Date(record.start_datetime);
          const end = new Date(record.end_datetime);
          if (end.getTime() >= start.getTime()) {
            const duration = (end.getTime() - start.getTime()) / 1000;
            existingStats.total_duration += duration;

            const startHour = start.getHours();
            if (startHour >= 0 && startHour < 24) {
              existingStats.hourly_usage[startHour]++;
            }
          } else {
            console.warn(`Invalid duration for record: ${record.result_id}. Start: ${record.start_datetime}, End: ${record.end_datetime}`);
          }
        }

        itemStats.set(itemId, existingStats);
      });

      itemStats.forEach(stats => {
        if (stats.loan_count > 0) {
          stats.average_duration = stats.total_duration / stats.loan_count;
        }
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

  const displayStatistics = useMemo(() => {
    if (!mergeByName) {
      return statistics;
    }

    const mergedStats = new Map<string, ItemStatistics>();

    statistics.forEach(stat => {
      const existing = mergedStats.get(stat.item_name);
      if (existing) {
        const newHourlyUsage = existing.hourly_usage.map((count, hour) => count + stat.hourly_usage[hour]);
        const newOriginalItemIds = [...(existing.original_item_ids || [existing.item_id]), stat.item_id]
          .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

        mergedStats.set(stat.item_name, {
          ...existing,
          item_name: stat.item_name,
          loan_count: existing.loan_count + stat.loan_count,
          total_duration: existing.total_duration + stat.total_duration,
          hourly_usage: newHourlyUsage,
          original_item_ids: newOriginalItemIds,
        });
      } else {
        mergedStats.set(stat.item_name, {
          ...stat,
          original_item_ids: [stat.item_id].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        });
      }
    });

    mergedStats.forEach(stats => {
      if (stats.loan_count > 0) {
        stats.average_duration = stats.total_duration / stats.loan_count;
      } else {
        stats.average_duration = 0;
      }
    });

    return Array.from(mergedStats.values());
  }, [statistics, mergeByName]);

  const sortedDisplayStatistics = useMemo(() => {
    if (!sortConfig) return displayStatistics;

    const sortKey = sortConfig.key;

    return [...displayStatistics].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      let actualSortKey: keyof ItemStatistics = 'item_id';
      if (sortKey === 'item_id' || (sortKey === 'item_info' && (sortConfig.key === 'item_id' || !isWideScreen))) {
        actualSortKey = 'item_id';
      } else if (sortKey === 'item_name' || (sortKey === 'item_info' && sortConfig.key === 'item_name')) {
        actualSortKey = 'item_name';
      } else if (sortKey !== 'item_info') {
        actualSortKey = sortKey as keyof ItemStatistics;
      }

      if (actualSortKey === 'item_id') {
        if (mergeByName) {
          aValue = a.original_item_ids ? parseInt(a.original_item_ids[0], 10) : 0;
          bValue = b.original_item_ids ? parseInt(b.original_item_ids[0], 10) : 0;
        } else {
          aValue = parseInt(a.item_id, 10);
          bValue = parseInt(b.item_id, 10);
        }
      } else if (actualSortKey === 'item_name') {
        aValue = a.item_name;
        bValue = b.item_name;
      } else {
        const rawAValue = a[actualSortKey];
        const rawBValue = b[actualSortKey];
        aValue = (typeof rawAValue === 'string' || typeof rawAValue === 'number') ? rawAValue : 0;
        bValue = (typeof rawBValue === 'string' || typeof rawBValue === 'number') ? rawBValue : 0;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  }, [displayStatistics, sortConfig, mergeByName, isWideScreen]);

  const handleSort = (column: keyof ItemStatistics | 'item_info') => {
    setSortConfig(prevConfig => {
      const isCurrentColumn = prevConfig?.key === column;
      const currentDirection = prevConfig?.direction;

      if (isWideScreen) {
        if (column === 'item_info') return prevConfig;

        const direction = isCurrentColumn && currentDirection === 'asc' ? 'desc' : 'asc';
        return { key: column, direction: direction };
      } else {
        if (column === 'item_info') {
          if (prevConfig?.key === 'item_id' && currentDirection === 'asc') {
            return { key: 'item_id', direction: 'desc' };
          } else if (prevConfig?.key === 'item_id' && currentDirection === 'desc') {
            return { key: 'item_name', direction: 'asc' };
          } else if (prevConfig?.key === 'item_name' && currentDirection === 'asc') {
            return { key: 'item_name', direction: 'desc' };
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

  const getSortIndicator = (targetKey: keyof ItemStatistics | 'item_info') => {
    if (!sortConfig) return null;

    let isActive = false;
    let direction = sortConfig.direction;
    let displayKey: string = '';

    if (isWideScreen) {
      isActive = sortConfig.key === targetKey;
      displayKey = '';
    } else {
      if (targetKey === 'item_info') {
        isActive = sortConfig.key === 'item_id' || sortConfig.key === 'item_name';
        displayKey = sortConfig.key === 'item_id' ? '物品ID' : sortConfig.key === 'item_name' ? '物品名' : '';
      } else {
        isActive = sortConfig.key === targetKey;
        displayKey = '';
      }
    }

    if (!isActive) return null;

    const arrow = direction === 'asc' ? '↑' : '↓';
    return <span className="ml-1 font-bold">{displayKey && !isWideScreen ? `${displayKey}${arrow}` : arrow}</span>;
  };

  const getSortBgColor = (targetKey: keyof ItemStatistics | 'item_info') => {
    if (!sortConfig) return '';

    let isActive = false;
    if (isWideScreen) {
      isActive = sortConfig.key === targetKey;
    } else {
      if (targetKey === 'item_info') {
        isActive = sortConfig.key === 'item_id' || sortConfig.key === 'item_name';
      } else {
        isActive = sortConfig.key === targetKey;
      }
    }

    if (!isActive) return '';
    return sortConfig.direction === 'asc' ? 'bg-green-100' : 'bg-orange-100';
  };

  const downloadCSV = () => {
    const dataToExport = sortedDisplayStatistics;
    if (dataToExport.length === 0) return;

    const headers = ['物品ID', '物品名', '貸出回数', '総貸出時間', '平均貸出時間', ...HOURS];

    const csvData = dataToExport.map(stat => {
      const itemIdToExport = mergeByName
        ? stat.original_item_ids?.[0] ?? ''
        : stat.item_id;

      const commonData = [
        stat.loan_count.toString(),
        formatDuration(stat.total_duration),
        formatDuration(stat.average_duration),
        ...stat.hourly_usage.map(count => count.toString())
      ];
      return [itemIdToExport, stat.item_name, ...commonData];
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
    const mergeSuffix = mergeByName ? '_統合' : '';
    const fileName = selectedEvent
      ? `${dateString}_貸出統計_${selectedEvent.event_id}-${selectedEvent.name}${mergeSuffix}.csv`
      : `${dateString}_貸出統計${mergeSuffix}.csv`;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const getHeatmapColor = (count: number, maxCount: number) => {
    if (count === 0) return {
      backgroundColor: 'rgb(249, 250, 251)',
      color: 'rgb(156, 163, 175)'
    };
    
    const opacity = Math.max(0.1, Math.min(1, count / maxCount));
    
    return {
      backgroundColor: `rgba(59, 130, 246, ${opacity})`,
      color: opacity > 0.5 ? 'white' : 'black'
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '貸出回数の時間帯別分布',
      },
    },
  };

  const chartData = useMemo(() => {
    const labels = HOURS;
    // データセットの数に基づいて色を生成
    const colors = generateDistinctColors(sortedDisplayStatistics.length);

    const datasets = sortedDisplayStatistics.map((stat, index) => ({
      label: stat.item_name,
      data: stat.hourly_usage,
      // 生成した色を順番に割り当てる
      backgroundColor: colors[index % colors.length],
    }));

    return { labels, datasets };
  }, [sortedDisplayStatistics]);

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

        <div className="flex items-center justify-start mb-4">
          <button
            type="button"
            onClick={() => setMergeByName(!mergeByName)}
            className={`${
              mergeByName ? 'bg-blue-600' : 'bg-gray-200'
            } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            role="switch"
            aria-checked={mergeByName}
          >
            <span
              className={`${
                mergeByName ? 'translate-x-6' : 'translate-x-1'
              } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
            />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-700">物品名で統合して表示</span>
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

          <div className="mb-8 overflow-x-auto">
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
                    onClick={() => isWideScreen && handleSort('item_name')}
                    className={`hidden min-[1800px]:table-cell cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs ${getSortBgColor('item_name')}`}
                  >
                    <button className="flex items-center gap-1 hover:text-gray-700">
                      物品名 {getSortIndicator('item_name')}
                    </button>
                  </th>
                  <th className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('loan_count')}`}>
                    <button
                      onClick={() => handleSort('loan_count')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      貸出回数
                      {getSortIndicator('loan_count')}
                    </button>
                  </th>
                  <th className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('total_duration')}`}>
                    <button
                      onClick={() => handleSort('total_duration')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      総貸出時間
                      {getSortIndicator('total_duration')}
                    </button>
                  </th>
                  <th className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${getSortBgColor('average_duration')}`}>
                    <button
                      onClick={() => handleSort('average_duration')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      平均貸出時間
                      {getSortIndicator('average_duration')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedDisplayStatistics.map((stat) => {
                  let displayItemId: string | React.ReactNode = stat.item_id;
                  let fractionDisplay: React.ReactNode = null;

                  if (mergeByName && stat.original_item_ids && stat.original_item_ids.length > 0) {
                    const currentIdIndex = animatedIdIndices[stat.item_name] ?? 0;
                    const totalIds = stat.original_item_ids.length;
                    displayItemId = stat.original_item_ids[currentIdIndex];

                    if (totalIds > 1) {
                      displayItemId = (
                        <span key={currentIdIndex} className="animate-fade-in-out">
                          {displayItemId}
                        </span>
                      );
                      fractionDisplay = (
                        <span className="ml-1 text-xs text-gray-400">
                          {currentIdIndex + 1}/{totalIds}
                        </span>
                      );
                    }
                  }

                  return (
                    <tr key={mergeByName ? stat.item_name : stat.item_id} className="hover:bg-gray-50">
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
                      <td className="px-6 py-4 whitespace-nowrap min-[1800px]:hidden">
                        <div className="flex flex-col">
                          <div className="flex items-baseline">
                            <div className="text-sm font-mono">
                              {displayItemId}
                            </div>
                            {fractionDisplay}
                          </div>
                          <span className="text-xs text-gray-600">{stat.item_name}</span>
                        </div>
                      </td>
                      <td className="hidden min-[1800px]:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="flex items-baseline">
                          <div className="text-sm font-mono">
                            {displayItemId}
                          </div>
                          {fractionDisplay}
                        </div>
                      </td>
                      <td className="hidden min-[1800px]:table-cell px-6 py-4 whitespace-nowrap max-w-xs">
                        <div className="text-sm truncate" title={stat.item_name}>{stat.item_name}</div>
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
                  );
                })}
              </tbody>
            </table>
          </div>

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
                          物品情報
                        </th>
                        <th 
                          className="hidden min-[1800px]:table-cell sticky left-[250px] z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs"
                        >
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
                      {sortedDisplayStatistics.map((stat) => {
                        const maxCount = Math.max(...stat.hourly_usage, 1);

                        let displayItemId: string | React.ReactNode = stat.item_id;
                        let fractionDisplay: React.ReactNode = null;

                        if (mergeByName && stat.original_item_ids && stat.original_item_ids.length > 0) {
                          const currentIdIndex = animatedIdIndices[stat.item_name] ?? 0;
                          const totalIds = stat.original_item_ids.length;
                          displayItemId = stat.original_item_ids[currentIdIndex];

                          if (totalIds > 1) {
                            displayItemId = (
                              <span key={currentIdIndex} className="animate-fade-in-out">
                                {displayItemId}
                              </span>
                            );
                            fractionDisplay = (
                              <span className="ml-1 text-xs text-gray-400">
                                {currentIdIndex + 1}/{totalIds}
                              </span>
                            );
                          }
                        }

                        return (
                          <tr key={`heatmap-${mergeByName ? stat.item_name : stat.item_id}`} className="hover:bg-gray-50">
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
                              <div className="flex flex-col min-[1800px]:hidden">
                                <div className="flex items-baseline">
                                  <div className="text-sm font-mono">{displayItemId}</div>
                                  {fractionDisplay}
                                </div>
                                <span className="text-xs text-gray-600">{stat.item_name}</span>
                              </div>
                              <div className="hidden min-[1800px]:flex items-baseline">
                                <div className="text-sm font-mono">{displayItemId}</div>
                                {fractionDisplay}
                              </div>
                            </td>
                            <td 
                              className="hidden min-[1800px]:table-cell sticky left-[250px] z-10 bg-white px-6 py-4 whitespace-nowrap max-w-xs"
                            >
                              <div className="text-sm truncate" title={stat.item_name}>{stat.item_name}</div>
                            </td>
                            {stat.hourly_usage.map((count, index) => (
                              <td key={`heatmap-cell-${mergeByName ? stat.item_name : stat.item_id}-${index}`} className="px-2 py-4 text-center w-[50px] min-w-[50px]">
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

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">貸出回数の時間帯別分布</h3>
            <Bar options={chartOptions} data={chartData} />
          </div>
        </>
      )}
    </div>
  );
}