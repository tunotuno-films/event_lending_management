import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, X, AlertCircle, Undo2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Event {
  event_id: string;
  name: string;
  created_at: string;
  event_deleted: boolean;
}

interface NotificationProps {
  message: string;
  onClose: () => void;
  type?: 'success' | 'error';
  onUndo?: () => void;
  showUndo?: boolean;
}

const Notification: React.FC<NotificationProps> = ({ message, onClose, type = 'success', onUndo, showUndo }) => {
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
        {showUndo && (
          <button
            onClick={() => {
              if (onUndo) {
                onUndo();
              }
              onClose();
            }}
            className={`${hoverColor} rounded-full p-1 flex items-center gap-1`}
          >
            <Undo2 size={16} />
            <span>戻す</span>
          </button>
        )}
        <span className="text-sm">({countdown})</span>
        <button onClick={onClose} className={`${hoverColor} rounded-full p-1`}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  event: Event;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ event, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">削除の確認</h2>
        <p className="text-gray-600 mb-6">
          イベントID「{event.event_id}」を削除してもよろしいですか？
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
};

interface EditModalProps {
  event: Event;
  onClose: () => void;
  onSave: (updatedEvent: Event) => Promise<void>;
}

const EditModal: React.FC<EditModalProps> = ({ event, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: event.name
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...event,
      name: formData.name
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-1/2">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">イベント編集</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              イベントID
            </label>
            <input
              type="text"
              value={event.event_id}
              className="w-full border border-gray-300 rounded-md p-2 bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              イベント名
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md p-2"
              maxLength={50}
              required
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error'; lastDeletedEvent?: Event }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [sortColumn, setSortColumn] = useState<string>('event_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForNavigation, setSelectedForNavigation] = useState<Event | null>(null);
  const navigate = useNavigate();

  const sortedEvents = useMemo(() => {
    if (!sortColumn) return events;
    return events.slice().sort((a, b) => {
      let aVal = a[sortColumn as keyof Event];
      let bVal = b[sortColumn as keyof Event];
      if (sortColumn === 'created_at') {
        const aDate = new Date(aVal as string);
        const bDate = new Date(bVal as string);
        if (aDate < bDate) return sortDirection === 'asc' ? -1 : 1;
        if (aDate > bDate) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [events, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('ユーザー情報が取得できません');
        setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim() === '') {
      fetchEvents();
    } else {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .or(`event_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
          .eq('event_deleted', false)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error('Error searching events:', error);
      }
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleUpdateEvent = async (updatedEvent: Event) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ name: updatedEvent.name })
        .eq('event_id', updatedEvent.event_id);

      if (error) throw error;

      fetchEvents();
      
      setNotification({
        show: true,
        message: `イベントID[${updatedEvent.event_id}]を更新しました`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating event:', error);
      setNotification({
        show: true,
        message: '更新中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ event_deleted: true })
        .eq('event_id', event.event_id);

      if (error) throw error;

      fetchEvents();
      setDeletingEvent(null);
      
      setNotification({
        show: true,
        message: `イベントID[${event.event_id}]を削除しました`,
        type: 'success',
        lastDeletedEvent: event
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      setNotification({
        show: true,
        message: '削除中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleUndoDelete = async () => {
    if (!notification.lastDeletedEvent) return;

    try {
      const { error } = await supabase
        .from('events')
        .update({ event_deleted: false })
        .eq('event_id', notification.lastDeletedEvent.event_id);

      if (error) throw error;

      fetchEvents();
      
      setNotification({
        show: true,
        message: `イベントID[${notification.lastDeletedEvent.event_id}]の削除を取り消しました`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error undoing delete:', error);
      setNotification({
        show: true,
        message: '削除の取り消しに失敗しました',
        type: 'error'
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
          onUndo={handleUndoDelete}
          showUndo={notification.lastDeletedEvent !== undefined}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">イベント一覧</h2>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="イベントIDまたはイベント名で検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort('event_id')}
                className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='event_id' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                イベントID {sortColumn==='event_id' && (<span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>)}
              </th>
              <th
                onClick={() => handleSort('name')}
                className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='name' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                イベント名 {sortColumn==='name' && (<span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>)}
              </th>
              <th
                onClick={() => handleSort('created_at')}
                className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='created_at' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                作成日時 {sortColumn==='created_at' && (<span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>)}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                編集
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                削除
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedEvents.map((event) => (
              <tr 
                key={event.event_id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedForNavigation(event)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono text-gray-900">{event.event_id}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 break-words max-w-xs" title={event.name}>{event.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(event.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingEvent(event); }}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingEvent(event); }}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingEvent && (
        <EditModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleUpdateEvent}
        />
      )}

      {deletingEvent && (
        <DeleteConfirmModal
          event={deletingEvent}
          onClose={() => setDeletingEvent(null)}
          onConfirm={() => handleDeleteEvent(deletingEvent)}
        />
      )}

      {selectedForNavigation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">貸出管理に移動しますか？</h3>
            <p className="text-gray-600 mb-6">
              イベントID「{selectedForNavigation.event_id}」の貸出管理ページに移動しますか？
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setSelectedForNavigation(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <X size={16} /> <span>キャンセル</span>
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('selectedEventId', selectedForNavigation.event_id);
                  setSelectedForNavigation(null);
                  navigate('/loaning/control');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <ArrowRight size={16} /> <span>移動する</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}