import React, { useState, useEffect } from 'react';
import { supabase, formatJSTDateTime } from '../lib/supabase';
import { AlertCircle, X, Download, ArrowUpDown } from 'lucide-react';

interface Event {
  event_id: string;
  name: string;
}

interface LoanRecord {
  result_id: number;
  event_id: string;
  item_id: string;
  start_datetime: string;
  end_datetime: string | null;
  item: {
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

export default function LoanHistory() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loanRecords, setLoanRecords] = useState<LoanRecord[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [sortConfig, setSortConfig] = useState<{
    key: 'item_id' | 'start_datetime' | 'end_datetime';
    direction: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchLoanRecords();
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
      setNotification({
        show: true,
        message: 'イベントの取得中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const fetchLoanRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('result')
        .select(`
          *,
          item:items(name, image)
        `)
        .eq('event_id', selectedEventId)
        .order('start_datetime', { ascending: false });

      if (error) throw error;
      setLoanRecords(data || []);
    } catch (error) {
      console.error('Error fetching loan records:', error);
      setNotification({
        show: true,
        message: '貸出履歴の取得中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleSort = (key: 'item_id' | 'start_datetime' | 'end_datetime') => {
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });

    const sortedRecords = [...loanRecords].sort((a, b) => {
      if (key === 'item_id') {
        return direction === 'asc'
          ? a.item_id.localeCompare(b.item_id)
          : b.item_id.localeCompare(a.item_id);
      } else {
        const aValue = a[key] || '';
        const bValue = b[key] || '';
        return direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
    });

    setLoanRecords(sortedRecords);
  };

  const handleDeleteShortLoans = async () => {
    if (!selectedEventId) return;

    try {
      // First, find records with less than 60 seconds between start and end
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

      // Delete the records using a direct SQL query
      const { error } = await supabase
        .from('result')
        .delete()
        .eq('event_id', selectedEventId)
        .in('result_id', shortLoans.map(record => record.result_id));

      if (error) throw error;

      // Refresh the loan records to reflect the changes
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

    const headers = ['物品ID', '物品名', '貸出時間', '返却時間'];
    const csvData = loanRecords.map(record => [
      record.item_id,
      record.item.name,
      formatJSTDateTime(record.start_datetime),
      record.end_datetime ? formatJSTDateTime(record.end_datetime) : '未返却'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `loan_history_${selectedEventId}_${new Date().toISOString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={handleDeleteShortLoans}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <X size={16} />
                60秒未満の貸出を削除
              </button>
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
                      onClick={() => handleSort('start_datetime')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      貸出時間
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('end_datetime')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      返却時間
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loanRecords.map((record) => (
                  <tr key={record.result_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                        <img
                          src={record.item.image || 'https://via.placeholder.com/150'}
                          alt={record.item.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono">{record.item_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{record.item.name}</div>
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