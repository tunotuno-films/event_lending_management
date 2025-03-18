import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AlertCircle, X } from 'lucide-react';

interface CsvItem {
  item_id: string;
  name: string;
  genre: string;
  manager: string;
  image?: string;
  isValid: boolean;
  errors: string[];
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

export default function CsvValidation({ csvData }: { csvData: CsvItem[] }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<CsvItem[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    validateItems();
  }, []);

  const validateItems = async () => {
    try {
      const validatedItems = await Promise.all(
        csvData.map(async (item) => {
          const errors: string[] = [];

          // Check if item_id is numeric and 13 characters
          if (!/^\d{13}$/.test(item.item_id)) {
            errors.push('物品IDは13桁の数字である必要があります');
          }

          // Check if name is not empty and within 50 characters
          if (!item.name || item.name.length > 50) {
            errors.push('物品名は1-50文字である必要があります');
          }

          // Check if genre and manager are not empty
          if (!item.genre) {
            errors.push('ジャンルは必須です');
          }
          if (!item.manager) {
            errors.push('管理者は必須です');
          }

          // Check if item_id already exists
          const { data: existingItem } = await supabase
            .from('items')
            .select('item_id')
            .eq('item_id', item.item_id)
            .eq('item_deleted', false)
            .single();

          if (existingItem) {
            errors.push('この物品IDは既に登録されています');
          }

          return {
            ...item,
            isValid: errors.length === 0,
            errors
          };
        })
      );

      setItems(validatedItems);
    } catch (error) {
      console.error('Error validating items:', error);
      setNotification({
        show: true,
        message: 'データの検証中にエラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleRegister = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const validItems = items.filter(item => item.isValid);
      
      if (validItems.length === 0) {
        setNotification({
          show: true,
          message: '登録可能なアイテムがありません',
          type: 'error'
        });
        return;
      }

      const { error } = await supabase
        .from('items')
        .insert(
          validItems.map(item => ({
            item_id: item.item_id,
            name: item.name,
            image: item.image || null,
            genre: item.genre,
            manager: item.manager,
            registered_date: new Date().toISOString()
          }))
        );

      if (error) throw error;

      setNotification({
        show: true,
        message: `${validItems.length}件のアイテムを登録しました`,
        type: 'success'
      });

      // Redirect to items list after successful registration
      setTimeout(() => {
        navigate('/items');
      }, 2000);
    } catch (error) {
      console.error('Error registering items:', error);
      setNotification({
        show: true,
        message: '登録中にエラーが発生しました',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
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

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">CSVデータの検証</h2>
          <p className="text-sm text-gray-500 mt-1">
            全{items.length}件中 {items.filter(item => item.isValid).length}件が有効です
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
          >
            キャンセル
          </button>
          <button
            onClick={handleRegister}
            disabled={isProcessing || !items.some(item => item.isValid)}
            className={`px-4 py-2 rounded-md ${
              isProcessing || !items.some(item => item.isValid)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isProcessing ? '処理中...' : '一括登録'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                物品ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                物品名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ジャンル
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                管理者
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                エラー
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index} className={item.isValid ? 'bg-green-50' : 'bg-red-50'}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono">{item.item_id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">{item.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">{item.genre}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">{item.manager}</div>
                </td>
                <td className="px-6 py-4">
                  {item.errors.length > 0 ? (
                    <div className="space-y-1">
                      {item.errors.map((error, i) => (
                        <div key={i} className="text-sm text-red-600 flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
                          {error}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-green-600">エラーなし</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}