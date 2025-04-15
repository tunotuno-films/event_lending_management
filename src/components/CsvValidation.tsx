import React, { useState, useEffect, useCallback, useMemo } from 'react'; // useCallback, useMemo を追加
import { useNavigate } from 'react-router-dom';
import { supabase, insertWithOwnerId, getCurrentUserId } from '../lib/supabase'; // insertWithOwnerId, getCurrentUserId をインポート
import { AlertCircle, X, CheckCircle, Loader2 } from 'lucide-react'; // アイコン追加
import LoadingIndicator from './LoadingIndicator'; // LoadingIndicator をインポート

// CsvItem インターフェース (変更なし)
interface CsvItem {
  item_id: string;
  name: string;
  genre: string;
  manager: string;
  image?: string;
  isValid: boolean;
  errors: string[];
}

// Notification コンポーネント
interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose?: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-md flex items-center gap-2 ${
      type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
      'bg-red-50 text-red-800 border border-red-200'
    }`}>
      {type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

// CsvValidationProps から userEmail を削除
interface CsvValidationProps {
  csvData: CsvItem[]; // 受け取るCSVデータの型を定義（パース済みの想定）
  // setCsvData はこのコンポーネントでは不要かもしれないので削除 (親で管理)
}

const CsvValidation: React.FC<CsvValidationProps> = ({ csvData }) => {
  const navigate = useNavigate();
  // items 状態の型を CsvItem[] に指定
  const [items, setItems] = useState<CsvItem[]>([]);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [isProcessing, setIsProcessing] = useState(false); // 登録処理中フラグ
  const [isValidating, setIsValidating] = useState(false); // ★ バリデーション中フラグを追加
  const [sortColumn, setSortColumn] = useState<string>('item_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 並び替え済みの items を生成
  const sortedItems = useMemo(() => {
    if (!items.length) return items;
    return items.slice().sort((a, b) => {
      const aVal = (a as any)[sortColumn] as string;
      const bVal = (b as any)[sortColumn] as string;
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

  // --- バリデーション関数 (useCallbackでラップ、ログ追加) ---
  const validateItems = useCallback(async () => {
    // csvData が空または未定義の場合は何もしない
    if (!csvData || csvData.length === 0) {
      console.log('validateItems: No CSV data to validate.');
      setItems([]); // データがない場合は空にする
      return;
    }

    console.log('Validating CSV data...', csvData);
    setIsValidating(true); // バリデーション開始
    setItems([]); // バリデーション開始時にリストをクリア

    try {
      // 現在のユーザーIDを取得 (バリデーション開始前に一度だけ取得)
      const userId = await getCurrentUserId();
      if (!userId) {
        console.error('Validation failed: User not authenticated.');
        setNotification({ show: true, message: 'バリデーションに失敗しました: ユーザー認証が必要です。', type: 'error'});
        setIsValidating(false);
        setItems(csvData.map(item => ({ ...item, isValid: false, errors: ['ユーザー認証エラー'] }))); // 全て無効として表示
        return;
      }
      console.log('Current User ID for validation:', userId);

      // ★ CSVファイル内の item_id 重複チェック用 Set
      const csvItemIds = new Set<string>();

      // 各行のバリデーションを並列実行
      const validatedItemsPromises = csvData.map(async (item, index) => {
        const errors: string[] = [];

        // --- 同期的なバリデーション ---
        if (!item.item_id) {
          errors.push('物品IDは必須です');
        } else if (!/^\d{8}$|^\d{13}$/.test(item.item_id)) {
          errors.push('物品IDは8桁または13桁の数字形式です');
        } else {
          // ★ CSVファイル内での重複チェック
          if (csvItemIds.has(item.item_id)) {
            errors.push('物品IDがCSVファイル内で重複しています');
          } else {
            csvItemIds.add(item.item_id); // 重複がなければSetに追加
          }
        }

        if (!item.name) errors.push('物品名は必須です');
        else if (item.name.length > 50) errors.push('物品名は50文字以内です');

        if (!item.genre) errors.push('ジャンルは必須です');
        if (!item.manager) errors.push('管理者は必須です');
        // 画像(image)は任意なのでチェック不要

        // --- 非同期的なバリデーション (重複チェック) の条件も修正 ---
        if (item.item_id && /^\d{8}$|^\d{13}$/.test(item.item_id) && !errors.some(e => e.includes('重複'))) { // ★ CSV内重複がない場合のみDBチェック
          try {
              // registered_by と item_id の組み合わせで既存データを検索
              const { data: existingItem, error: dbError } = await supabase
                .from('items')
                .select('id') // 存在確認だけなので id など軽いカラムを取得
                .eq('item_id', item.item_id)
                .eq('registered_by', userId) // ★ 自分のデータだけチェック
                .eq('item_deleted', false) // 削除されていないもの
                .maybeSingle(); // 結果は1件かnull

              if (dbError) {
                console.error(`DB Error checking duplicate for item ${index} (item_id: ${item.item_id}):`, dbError);
                errors.push(`DB重複チェックエラー: ${dbError.message}`); // エラーメッセージ修正
              } else if (existingItem) {
                console.log(`Duplicate found for item ${index} (item_id: ${item.item_id})`);
                errors.push('この物品IDは既にあなたが登録済みです');
              }
          } catch (dupError) {
              console.error(`Error during duplicate check for item ${index}:`, dupError);
              errors.push('DB重複チェック中に予期せぬエラーが発生しました'); // エラーメッセージ修正
          }
        }

        // バリデーション結果を返す
        return {
          ...item, // 元のデータ
          isValid: errors.length === 0, // エラーがなければ有効
          errors
        };
      });

      // 全てのバリデーションPromiseが完了するのを待つ
      const validatedItems = await Promise.all(validatedItemsPromises);
      console.log('Validation complete:', validatedItems);
      setItems(validatedItems); // ★ バリデーション結果をstateにセット

    } catch (error) {
      console.error('Error validating items:', error);
      setNotification({ show: true, message: 'データ検証中に予期せぬエラーが発生しました', type: 'error' });
      // エラー時は元のデータを無効として表示するなどのフォールバックも検討
      setItems(csvData.map(item => ({ ...item, isValid: false, errors: ['検証エラー'] })));
    } finally {
      setIsValidating(false); // バリデーション終了
    }
  }, [csvData]); // ★ csvData が変更されたら再実行

  // --- csvData が変更されたらバリデーションを実行 ---
  useEffect(() => {
    validateItems();
  }, [validateItems]); // validateItems (useCallbackでラップ済み) が変更されたら実行

  // --- 登録処理 (修正) ---
  const handleRegister = async () => {
    if (isProcessing || isValidating) return; // 処理中・バリデーション中は実行しない
    setIsProcessing(true);

    try {
      const userId = await getCurrentUserId(); // 念のためユーザーIDを再取得
      if (!userId) {
          setNotification({ show: true, message: '登録エラー: ユーザー認証が必要です。', type: 'error' });
          setIsProcessing(false);
          return;
      }

      // バリデーション済みデータから有効なものだけを抽出
      const validItems = items.filter(item => item.isValid);

      if (validItems.length === 0) {
        setNotification({ show: true, message: '登録可能な有効なアイテムがありません', type: 'error' });
        setIsProcessing(false);
        return;
      }

      // 登録用データ形式に変換 (registered_by は insertWithOwnerId が付与)
      const itemsToInsert = validItems.map(item => ({
        item_id: item.item_id,
        name: item.name,
        image: item.image || null, // nullを許容
        genre: item.genre,
        manager: item.manager,
        registered_date: new Date().toISOString(),
        item_deleted: false // デフォルト値
        // registered_by はヘルパー関数が自動で追加
      }));

      console.log('Items to insert:', itemsToInsert);

      // ★ insertWithOwnerId を使用して登録 (所有者IDが自動で付与される)
      const { error } = await insertWithOwnerId(
        'items',          // テーブル名
        itemsToInsert,    // 挿入データ配列
        { ownerColumn: 'registered_by' } // itemsテーブルの所有者カラム名を指定
      );

      if (error) {
          // 複合UNIQUE制約違反 (duplicate key value violates unique constraint) などもここで捕捉
          console.error('Error inserting items:', error);
          let userMessage = '登録エラー: 不明なエラーが発生しました';
          
          // 型安全にエラーメッセージにアクセス
          if (typeof error === 'object' && error !== null && 'message' in error) {
            userMessage = `登録エラー: ${(error as { message: string }).message}`;
            
            // messageプロパティが存在する場合にのみ実行
            const errorMessage = (error as { message: string }).message;
            if (errorMessage.includes('duplicate key value violates unique constraint "items_registered_by_item_id_key"')) {
                userMessage = '登録エラー: 既に登録済みの物品IDが含まれています。CSVファイルを確認してください。';
                // エラーになったIDを特定する処理を追加することも可能
            } else if (errorMessage.includes('violates row-level security policy')) {
                userMessage = '登録エラー: 登録権限がありません。';
            }
          }
          setNotification({ show: true, message: userMessage, type: 'error' });
          throw error; // エラーを再スローして catch へ
      }

      // 成功した場合
      setNotification({
        show: true,
        message: `${validItems.length}件のアイテムを正常に登録しました`,
        type: 'success'
      });

      // 登録成功後、アイテム一覧ページなどに遷移
      setTimeout(() => {
        navigate('/item/list'); // 適切なパスに変更してください
      }, 2000); // 2秒後に遷移
    } catch (error) {
      console.error('Error during registration process:', error);
      // catchブロックでの最終エラー表示 (重複を避ける)
      if (!notification.show || notification.type !== 'error') {
        setNotification({
          show: true,
          message: '登録処理中に予期せぬエラーが発生しました。',
          type: 'error'
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // --- レンダリング ---
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Notification */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        />
      )}

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold">CSVデータの検証結果</h2>
          {!isValidating && ( // isValidating が false の時だけ件数を表示
            <p className="text-sm text-gray-500 mt-1">
              全{items.length}件中 {items.filter(item => item.isValid).length}件が登録可能です
            </p>
          )}
        </div>
      </div>

      {/* バリデーション結果テーブル */}
      {isValidating ? ( // テーブル表示前のローディング表示は残す
        <LoadingIndicator />
      ) : items.length === 0 && csvData.length > 0 ? (
        <div className="text-center py-10 text-red-500">検証処理に失敗したか、有効なデータがありませんでした。</div>
      ) : items.length === 0 && csvData.length === 0 ? (
        <div className="text-center py-10 text-gray-500">CSVデータが読み込まれていません。</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  状態
                </th>
                <th
                  onClick={() => handleSort('item_id')}
                  className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 ${
                    sortColumn === 'item_id'
                      ? sortDirection === 'asc' ? 'bg-green-100' : 'bg-orange-100'
                      : ''
                  }`}
                >
                  物品ID {sortColumn === 'item_id' && (<span className="ml-1 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 ${
                    sortColumn === 'name'
                      ? sortDirection === 'asc' ? 'bg-green-100' : 'bg-orange-100'
                      : ''
                  }`}
                >
                  物品名 {sortColumn === 'name' && (<span className="ml-1 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                </th>
                <th
                  onClick={() => handleSort('genre')}
                  className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 ${
                    sortColumn === 'genre'
                      ? sortDirection === 'asc' ? 'bg-green-100' : 'bg-orange-100'
                      : ''
                  }`}
                >
                  ジャンル {sortColumn === 'genre' && (<span className="ml-1 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                </th>
                <th
                  onClick={() => handleSort('manager')}
                  className={`cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 ${
                    sortColumn === 'manager'
                      ? sortDirection === 'asc' ? 'bg-green-100' : 'bg-orange-100'
                      : ''
                  }`}
                >
                  管理者 {sortColumn === 'manager' && (<span className="ml-1 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">
                  エラー内容
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedItems.map((item, index) => (
                <tr key={index} className={item.isValid ? '' : 'bg-red-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {item.isValid ? (
                      <CheckCircle className="h-5 w-5 text-green-500 inline-block" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500 inline-block" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">{item.item_id || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.name || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.genre || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.manager || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {item.errors.length > 0 ? (
                      <ul className="list-disc list-inside text-red-600 space-y-1">
                        {item.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-green-600">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 移動したボタンブロック：ボタンを左寄せに修正 */}
      <div className="flex gap-2 justify-start mt-4">
        <button
          onClick={() => navigate('/')} // または前のページに戻るなど
          disabled={isProcessing || isValidating}
          className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 flex items-center gap-1 text-gray-600 hover:text-gray-800"
        >
          <X className="h-4 w-4" />
          <span>キャンセル</span>
        </button>
        <button
          onClick={handleRegister}
          disabled={isProcessing || isValidating || !items.some(item => item.isValid)}
          className={`px-4 py-2 rounded-md flex items-center justify-center min-w-[100px] gap-1 ${
            isProcessing || isValidating || !items.some(item => item.isValid)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          <span>一括登録</span>
        </button>
      </div>
    </div>
  );
};

export default CsvValidation;