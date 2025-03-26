import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Barcode, StopCircle, X, Upload, AlertTriangle } from 'lucide-react';
import Notification from './Notification';

// react-zxingのインポートをtry-catchで囲む
let ZXing: any = null;
try {
  // 動的にインポートしてエラーを防ぐ
  ZXing = require('react-zxing');
} catch (error) {
  console.warn('ZXing library could not be loaded:', error);
}

interface RegisterItemProps {
  userEmail?: string | null;
  isAuthenticated?: boolean;
  setAuthModalMode?: (mode: 'signin' | 'signup') => void;
  setIsAuthModalOpen?: (isOpen: boolean) => void;
}

interface Notification {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

const RegisterItem: React.FC<RegisterItemProps> = ({ 
  userEmail,
  isAuthenticated = false,
  setAuthModalMode,
  setIsAuthModalOpen
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItem, setScannedItem] = useState('');
  const [itemName, setItemName] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [genres, setGenres] = useState<{ id: string; name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [notification, setNotification] = useState<Notification>({
    show: false,
    message: '',
    type: 'info',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scannerError, setScannerError] = useState(false);

  // ZXingライブラリが利用可能な場合のみ、参照を作成
  const zxingRef = useRef<HTMLVideoElement>(null);
  const zxingHook = ZXing ? ZXing.useZxing({
    onDecodeResult(result: any) {
      const scanned = result.getText();
      setScannedItem(scanned);
      setIsScanning(false);
    },
    paused: !isScanning,
    onError: () => {
      setScannerError(true);
    }
  }) : { ref: zxingRef };
  
  // ZXingが利用できなくても、参照だけは作っておく
  const ref = zxingHook.ref;

  useEffect(() => {
    fetchGenres();
    fetchManagers();
  }, []);

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setGenres(data || []);
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('managers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedImage(file);
      
      // 画像プレビューの作成
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `items/${fileName}`;

      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, selectedImage);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  // ログインを促す関数
  const promptLogin = (message: string) => {
    if (setAuthModalMode && setIsAuthModalOpen) {
      alert(message);
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
    }
  };

  // 登録処理 - 認証状態に応じて異なる動作
  const handleRegister = async () => {
    // 非ログイン状態ではログインモーダルを表示
    if (!isAuthenticated) {
      promptLogin('物品を登録するにはログインしてください');
      return;
    }

    // 以下は認証済みユーザーの場合の処理
    if (!itemName) {
      showNotification('物品名を入力してください', 'error');
      return;
    }

    try {
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage();
      }

      const { data, error } = await supabase.from('items').insert([
        {
          item_id: scannedItem || null,
          name: itemName,
          genre_id: selectedGenreId || null,
          manager_id: selectedManagerId || null,
          registered_by: userEmail,
          image: imageUrl,
        },
      ]);

      if (error) throw error;

      showNotification('物品が登録されました', 'success');
      resetForm();
    } catch (error) {
      console.error('Error registering item:', error);
      showNotification('物品の登録に失敗しました', 'error');
    }
  };

  // CSV一括登録ボタンを押したときの処理
  const handleCsvRegister = () => {
    if (!isAuthenticated) {
      promptLogin('CSVで一括登録するにはログインしてください');
      return;
    }
    
    // 認証済みの場合はCSV検証ページへ移動
    window.location.href = '/csv-validation';
  };

  const resetForm = () => {
    setScannedItem('');
    setItemName('');
    setSelectedGenreId('');
    setSelectedManagerId('');
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({
      show: true,
      message,
      type,
    });

    // 3秒後に通知を非表示にする
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const downloadCsvTemplate = () => {
    const headers = 'item_id,name,genre,manager\n';
    const sampleData = 'XYZ123,サンプル物品,電子機器,鈴木\n';
    const csvContent = headers + sampleData;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'items_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // スキャン機能の開始
  const startScanning = () => {
    if (!ZXing) {
      showNotification('バーコードスキャン機能を読み込めませんでした。手動で入力してください。', 'error');
      return;
    }
    setIsScanning(true);
    setScannerError(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
        />
      )}

      <h2 className="text-xl font-semibold mb-6">物品登録</h2>

      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          {isScanning ? (
            <button
              onClick={() => setIsScanning(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <StopCircle size={20} />
              Stop Scanning
            </button>
          ) : (
            <button
              onClick={startScanning}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              <Barcode size={20} />
              Start Scanning
            </button>
          )}
        </div>

        {isScanning && ZXing && (
          <div className="relative mb-4">
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setIsScanning(false)}
                className="bg-white p-1 rounded-full shadow-md"
              >
                <X size={24} className="text-gray-700" />
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border-2 border-blue-500 w-full h-64">
              {scannerError ? (
                <div className="h-full w-full flex flex-col items-center justify-center bg-gray-100">
                  <AlertTriangle size={48} className="text-red-500 mb-2" />
                  <p className="text-red-500 font-medium">カメラへのアクセスができませんでした</p>
                  <p className="text-sm text-gray-600 mt-2">ブラウザの設定でカメラのアクセス許可を確認してください</p>
                </div>
              ) : (
                <video ref={ref} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="mt-2 text-sm text-gray-600">バーコードをスキャナーに合わせてください</div>
          </div>
        )}

        {isScanning && !ZXing && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  バーコードスキャン機能が利用できません。手動でバーコードを入力してください。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            バーコード
          </label>
          <input
            type="text"
            value={scannedItem}
            onChange={(e) => setScannedItem(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
            placeholder="バーコードをスキャンしてください"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            画像アップロード
          </label>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                className="w-full border border-gray-300 rounded-md p-2"
                onChange={handleImageChange}
                ref={fileInputRef}
              />
            </div>
            {previewUrl && (
              <div className="h-20 w-20 rounded-lg overflow-hidden flex-shrink-0 relative">
                <img 
                  src={previewUrl} 
                  alt="プレビュー" 
                  className="h-full w-full object-cover" 
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-md"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            物品名
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
            placeholder="物品名を入力"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ジャンル
          </label>
          <select
            value={selectedGenreId}
            onChange={(e) => setSelectedGenreId(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 mb-2"
          >
            <option value="">選択してください</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            管理者
          </label>
          <select
            value={selectedManagerId}
            onChange={(e) => setSelectedManagerId(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 mb-2"
          >
            <option value="">選択してください</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleRegister}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors"
          >
            登録
          </button>
          <button
            type="button"
            onClick={handleCsvRegister}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-md transition-colors"
          >
            CSVで一括登録
          </button>
        </div>
      </form>

      <div className="mt-6 text-right">
        <button
          className="text-sm text-blue-500 hover:text-blue-600"
          onClick={downloadCsvTemplate}
        >
          CSVのサンプルをダウンロード
        </button>
      </div>
    </div>
  );
};

export default RegisterItem;