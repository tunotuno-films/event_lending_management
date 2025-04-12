import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, X, AlertCircle, Undo2, Download } from 'lucide-react';

const DEFAULT_IMAGE = 'https://placehold.jp/3b82f6/ffffff/150x150.png?text=No+Image';

interface Item {
  item_id: string;
  name: string;
  image: string;
  genre: string;
  manager: string;
  registered_date: string;
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
              onUndo?.();
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
  item: Item;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ item, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">削除の確認</h2>
        <p className="text-gray-600 mb-6">
          物品ID「{item.item_id}」を削除してもよろしいですか？
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
  item: Item;
  onClose: () => void;
  onSave: (updatedItem: Item) => Promise<void>;
  genres: string[];
  managers: string[];
}

const EditModal: React.FC<EditModalProps> = ({ item, onClose, onSave, genres, managers }) => {
  const [formData, setFormData] = useState({
    name: item.name,
    genre: item.genre,
    customGenre: '',
    manager: item.manager,
    customManager: '',
    image: null as File | null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let imageUrl = item.image;

      if (formData.image) {
        const file = formData.image;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('items')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('items')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const finalGenre = formData.genre === 'その他' ? formData.customGenre : formData.genre;
      const finalManager = formData.manager === 'その他' ? formData.customManager : formData.manager;

      await onSave({
        ...item,
        name: formData.name,
        image: imageUrl,
        genre: finalGenre,
        manager: finalManager
      });

      onClose();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('更新中にエラーが発生しました');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, image: e.target.files![0] }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">物品編集</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              物品ID
            </label>
            <input
              type="text"
              value={item.item_id}
              className="w-full border border-gray-300 rounded-md p-2 bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              画像
            </label>
            <div className="flex items-center gap-4">
              <img
                src={getItemImageUrl(item.image)}
                alt={item.name}
                className="h-20 w-20 object-cover rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_IMAGE }}
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="flex-1 border border-gray-300 rounded-md p-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              物品名
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ジャンル
            </label>
            <select
              value={formData.genre}
              onChange={(e) => setFormData(prev => ({ ...prev, genre: e.target.value }))}
              className="w-full border border-gray-300 rounded-md p-2 mb-2"
              required
            >
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
              <option value="その他">その他</option>
            </select>
            {formData.genre === 'その他' && (
              <input
                type="text"
                value={formData.customGenre}
                onChange={(e) => setFormData(prev => ({ ...prev, customGenre: e.target.value }))}
                placeholder="ジャンルを入力"
                className="w-full border border-gray-300 rounded-md p-2"
                required
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              管理者
            </label>
            <select
              value={formData.manager}
              onChange={(e) => setFormData(prev => ({ ...prev, manager: e.target.value }))}
              className="w-full border border-gray-300 rounded-md p-2 mb-2"
              required
            >
              {managers.map(manager => (
                <option key={manager} value={manager}>{manager}</option>
              ))}
              <option value="その他">その他</option>
            </select>
            {formData.manager === 'その他' && (
              <input
                type="text"
                value={formData.customManager}
                onChange={(e) => setFormData(prev => ({ ...prev, customManager: e.target.value }))}
                placeholder="管理者名を入力"
                className="w-full border border-gray-300 rounded-md p-2"
                required
              />
            )}
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

// 画像URLのヘルパー関数を追加
const getItemImageUrl = (imageUrl: string | null): string => {
  if (!imageUrl) return DEFAULT_IMAGE;
  
  // 空文字やundefinedの場合
  if (imageUrl.trim() === '') return DEFAULT_IMAGE;
  
  // 有効なURLでない場合
  try {
    new URL(imageUrl);
    return imageUrl;
  } catch (e) {
    return DEFAULT_IMAGE;
  }
};

export default function ItemList() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [managers, setManagers] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error'; lastDeletedItem?: Item }>({
    show: false,
    message: '',
    type: 'success'
  });
  // 初期値を item_id の昇順に設定
  const [sortColumn, setSortColumn] = useState<string>('item_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // 新規: 検索用の状態を追加
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ソート状態に基づいてitemsを整列
  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;
    return items.slice().sort((a, b) => {
      let aVal = a[sortColumn as keyof Item];
      let bVal = b[sortColumn as keyof Item];
      if (sortColumn === 'registered_date') {
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
  }, [items, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('item_deleted', false)
        .order('registered_date', { ascending: false });

      if (error) throw error;

      setItems(data || []);

      if (data) {
        const uniqueGenres = [...new Set(data.map(item => item.genre))];
        const uniqueManagers = [...new Set(data.map(item => item.manager))];
        setGenres(uniqueGenres);
        setManagers(uniqueManagers);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  // 新規: 非同期で検索する関数
  const handleSearch = async () => {
    if (searchQuery.trim() === '') {
      fetchItems();
    } else {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .or(`item_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
          .eq('item_deleted', false)
          .order('registered_date', { ascending: false });
        if (error) throw error;
        setItems(data || []);
      } catch (error) {
        console.error('Error searching items:', error);
      }
    }
  };

  // 新規: 検索入力の変化を監視して非同期で検索
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleUpdateItem = async (updatedItem: Item) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({
          name: updatedItem.name,
          image: updatedItem.image || null, // 空文字列の場合はnullに
          genre: updatedItem.genre,
          manager: updatedItem.manager
        })
        .eq('item_id', updatedItem.item_id);

      if (error) throw error;

      fetchItems();
      
      setNotification({
        show: true,
        message: `物品ID[${updatedItem.item_id}]を更新しました`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating item:', error);
      setNotification({
        show: true,
        message: '更新中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleDeleteItem = async (item: Item) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ item_deleted: true })
        .eq('item_id', item.item_id);

      if (error) throw error;

      fetchItems();
      setDeletingItem(null);
      
      setNotification({
        show: true,
        message: `物品ID[${item.item_id}]を削除しました`,
        type: 'success',
        lastDeletedItem: item
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      setNotification({
        show: true,
        message: '削除中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleUndoDelete = async () => {
    if (!notification.lastDeletedItem) return;

    try {
      const { error } = await supabase
        .from('items')
        .update({ item_deleted: false })
        .eq('item_id', notification.lastDeletedItem.item_id);

      if (error) throw error;

      fetchItems();
      
      setNotification({
        show: true,
        message: `物品ID[${notification.lastDeletedItem.item_id}]の削除を取り消しました`,
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
      day: '2-digit'
    });
  };

  // CSV用エスケープ関数を修正：nullの場合は空文字を返す
  const escapeCSV = (value: string | null): string => {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // CSVエクスポート処理の実装を修正
  const handleCSVExport = () => {
    let csv = "物品ID,物品名,ジャンル,管理者,登録日\n";
    items.forEach(item => {
      csv += `${item.item_id},${escapeCSV(item.name)},${escapeCSV(item.genre)},${escapeCSV(item.manager)},${formatDate(item.registered_date)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // ファイル名をyyyyMMdd_物品一覧.csv形式で作成
    const today = new Date();
    const yyyy = today.getFullYear().toString();
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const dd = today.getDate().toString().padStart(2, '0');
    a.download = `${yyyy}${mm}${dd}_物品一覧.csv`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          showUndo={notification.lastDeletedItem !== undefined}
        />
      )}
  
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">登録物品一覧</h2>
        <div className="flex gap-2">
            <button
            onClick={handleCSVExport}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
            <Download size={16} />
            CSVダウンロード
            </button>
        </div>
      </div>
  
      {/* 新規: タイトル直後、表の上に検索入力欄を配置 */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="物品IDまたは物品名で検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
        />
      </div>
  
      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full min-w-[800px] divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="align-middle">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                画像
              </th>
              {/* ★ ヘッダーを「物品情報」に変更 */}
              <th
                onClick={() => handleSort('item_id')}
                className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='item_id' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                物品情報 {sortColumn==='item_id' && (
                  <span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>
                )}
              </th>
              {/* ★ 物品名ヘッダーを1800px以上で表示 */}
              <th
                onClick={() => handleSort('name')}
                className={`hidden min-[1800px]:table-cell cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='name' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                物品名 {sortColumn==='name' && (
                  <span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                onClick={() => handleSort('genre')}
                className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='genre' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                ジャンル {sortColumn==='genre' && (
                  <span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                onClick={() => handleSort('manager')}
                className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='manager' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                管理者 {sortColumn==='manager' && (
                  <span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                onClick={() => handleSort('registered_date')}
                className={`cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortColumn==='registered_date' ? (sortDirection==='asc' ? 'bg-green-100' : 'bg-orange-100') : ''}`}
              >
                登録日 {sortColumn==='registered_date' && (
                  <span className="ml-1 font-bold">{sortDirection==='asc' ? '↑' : '↓'}</span>
                )}
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
            {sortedItems.map((item) => (
              <tr key={item.item_id} className="hover:bg-gray-50 align-middle">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                    <img
                      src={getItemImageUrl(item.image)}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_IMAGE }}
                    />
                  </div>
                </td>
                {/* ★ 物品情報セル */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {/* 1800px未満での表示 (縦積み) */}
                  <div className="flex flex-col min-[1800px]:hidden">
                    <span className="text-sm font-mono">{item.item_id}</span>
                    <span className="text-xs text-gray-600">{item.name}</span>
                  </div>
                  {/* 1800px以上での表示 (IDのみ) */}
                  <div className="hidden min-[1800px]:block text-sm font-mono">
                    {item.item_id}
                  </div>
                </td>
                {/* ★ 物品名セル (1800px以上で表示) */}
                <td className="hidden min-[1800px]:table-cell px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{item.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {item.genre}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                    {item.manager}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(item.registered_date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <button
                    onClick={() => setDeletingItem(item)}
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
  
      {/* モーダル部分 */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateItem}
          genres={genres}
          managers={managers}
        />
      )}
  
      {deletingItem && (
        <DeleteConfirmModal
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onConfirm={() => handleDeleteItem(deletingItem)}
        />
      )}
    </div>
  );
}