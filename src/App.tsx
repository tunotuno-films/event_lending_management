import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useZxing } from 'react-zxing';
import { 
  Barcode, 
  StopCircle,
  X,
  AlertCircle,
  Mail,
  Github
} from 'lucide-react';
import { supabase, signIn, signUp, checkUser, handleAuthRedirect } from './lib/supabase';
import Layout from './components/Layout';
import ItemsList from './components/ItemsList';
import RegisterEvent from './components/RegisterEvent';
import EventsList from './components/EventsList';
import DailyItemRegistration from './components/DailyItemRegistration';
import LoanManagement from './components/LoanManagement';
import LoanHistory from './components/LoanHistory';
import LoanStatistics from './components/LoanStatistics';
import BulkUploadModal from './components/BulkUploadModal';
import CsvValidation from './components/CsvValidation';
import Profile from './components/Profile';
import './index.css';

interface FormData {
  barcode: string;
  itemName: string;
  genre: string;
  customGenre: string;
  manager: string;
  customManager: string;
  image: File | null;
}

interface AuthFormData {
  email: string;
  password: string;
  name?: string;
  phoneNumber?: string;
}

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

function RegisterItem() {
  const [isScanning, setIsScanning] = useState(false);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [genres, setGenres] = useState<string[]>([]);
  const [managers, setManagers] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    barcode: '',
    itemName: '',
    genre: '',
    customGenre: '',
    manager: '',
    customManager: '',
    image: null
  });
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [csvData, setCsvData] = useState<CsvItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchExistingData();
  }, []);

  const fetchExistingData = async () => {
    try {
      const { data: items } = await supabase
        .from('items')
        .select('genre, manager')
        .eq('item_deleted', false);

      if (items) {
        const uniqueGenres = [...new Set(items.map(item => item.genre))];
        const uniqueManagers = [...new Set(items.map(item => item.manager))];
        setGenres(uniqueGenres);
        setManagers(uniqueManagers);
      }
    } catch (error) {
      console.error('Error fetching existing data:', error);
    }
  };

  const { ref } = useZxing({
    onDecodeResult(result) {
      setFormData(prev => ({ ...prev, barcode: result.getText() }));
      setIsScanning(false);
    },
    paused: !isScanning
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.image) {
      alert('画像を選択してください');
      return;
    }

    try {
      // バーコードの重複チェック
      const { data: existingItem } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_id', formData.barcode)
        .eq('item_deleted', false)
        .single();

      if (existingItem) {
        setNotification({
          show: true,
          message: '既にデータが登録されています',
          type: 'error'
        });
        return;
      }

      const file = formData.image;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('items')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('items')
        .getPublicUrl(filePath);

      const finalGenre = formData.genre === 'その他' ? formData.customGenre : formData.genre;
      const finalManager = formData.manager === 'その他' ? formData.customManager : formData.manager;

      const { error: insertError } = await supabase
        .from('items')
        .insert({
          item_id: formData.barcode,
          name: formData.itemName,
          image: publicUrl,
          genre: finalGenre,
          manager: finalManager,
          registered_date: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }

      setNotification({
        show: true,
        message: '登録が完了しました',
        type: 'success'
      });
      setFormData({
        barcode: '',
        itemName: '',
        genre: '',
        customGenre: '',
        manager: '',
        customManager: '',
        image: null
      });

      // 新しいデータを反映するために既存データを再取得
      fetchExistingData();
    } catch (error) {
      console.error('Error submitting form:', error);
      setNotification({
        show: true,
        message: 'エラーが発生しました',
        type: 'error'
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, image: e.target.files![0] }));
    }
  };

  const handleBulkUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n');
        
        // Filter out empty rows and parse CSV
        const items: CsvItem[] = rows
          .filter(row => row.trim()) // Skip empty rows
          .map(row => {
            const [item_id, name, genre, manager] = row.split(',').map(field => field.trim());
            return {
              item_id: item_id || '',
              name: name || '',
              genre: genre || '',
              manager: manager || '',
              isValid: false,
              errors: []
            };
          });

        // Remove header row if it exists
        if (items.length > 0 && items[0].item_id === 'item_id') {
          items.shift();
        }

        setCsvData(items);
        setShowBulkUploadModal(false);
        navigate('/csv-validation');
      } catch (error) {
        console.error('Error parsing CSV:', error);
        setNotification({
          show: true,
          message: 'CSVファイルの解析中にエラーが発生しました',
          type: 'error'
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6">物品登録</h2>

        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIsScanning(!isScanning)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                isScanning 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white transition-colors`}
            >
              {isScanning ? (
                <>
                  <StopCircle size={20} />
                  Stop
                </>
              ) : (
                <>
                  <Barcode size={20} />
                  Start Scanning
                </>
              )}
            </button>
          </div>

          {isScanning && (
            <div className="relative w-full max-w-lg mx-auto aspect-video mb-4 rounded-lg overflow-hidden">
              <video 
                ref={ref as React.RefObject<HTMLVideoElement>} 
                className="w-full h-full object-cover" 
              />
            </div>
          )}

          {formData.barcode && (
            <div className="mb-4 p-4 bg-gray-100 rounded-md">
              <p className="font-mono">Barcode: {formData.barcode}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              画像アップロード
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              物品名
            </label>
            <input
              type="text"
              value={formData.itemName}
              onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
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
              <option value="">選択してください</option>
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
              <option value="">選択してください</option>
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

          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors"
            >
              登録
            </button>
            <button
              type="button"
              onClick={() => setShowBulkUploadModal(true)}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md transition-colors"
            >
              CSVで一括登録
            </button>
          </div>
        </form>

        <div className="mt-6 text-right">
          <button
            className="text-sm text-blue-500 hover:text-blue-600"
            onClick={() => {
              const csvContent = "item_id,name,genre,manager\n4912345678984,サンプル商品,サンプルジャンル,サンプル管理者\n";
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = 'sample.csv';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            CSVのサンプルをダウンロード
          </button>
        </div>
      </div>

      {showBulkUploadModal && (
        <BulkUploadModal
          onClose={() => setShowBulkUploadModal(false)}
          onUpload={handleBulkUpload}
        />
      )}
    </>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authFormData, setAuthFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    name: '',
    phoneNumber: '',
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CsvItem[]>([]);
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [welcomeUserName, setWelcomeUserName] = useState('');
  const [isWelcomeAnimationFading, setIsWelcomeAnimationFading] = useState(false);
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
    
    // Google認証からのリダイレクト処理
    const handleRedirectAuth = async () => {
      const { data, error } = await handleAuthRedirect();
      if (data.session) {
        setIsAuthenticated(true);
        setUserEmail(data.session.user?.email || null);
        
        // ユーザー名を取得
        const userName = data.session.user?.user_metadata?.name || 
                          data.session.user?.user_metadata?.full_name ||
                          data.session.user?.email || '';
        setWelcomeUserName(userName);
        
        // ログイン成功、アニメーションを表示
        setShowWelcomeAnimation(true);
        setIsWelcomeAnimationFading(false);
        
        // 1.7秒後にフェードアウト開始
        setTimeout(() => {
          setIsWelcomeAnimationFading(true);
        }, 1700);
        
        // 2秒後にアニメーションを非表示にする
        setTimeout(() => {
          setShowWelcomeAnimation(false);
          setIsWelcomeAnimationFading(false);
        }, 2000);
      }
    };
    
    handleRedirectAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || null);
      
      // ユーザーが認証されていれば、プロフィール情報を取得
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfileImage(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    const session = await checkUser();
    setIsAuthenticated(!!session);
    setUserEmail(session?.user?.email || null);
    
    // ログインしていない場合は認証モーダルを表示
    if (!session) {
      setShowAuthModal(true);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'signin') {
        const { data } = await signIn(authFormData.email, authFormData.password);
        setUserEmail(data.user?.email || null);
        
        // ユーザー名を取得
        const userName = data.user?.user_metadata?.name || data.user?.email || '';
        setWelcomeUserName(userName);
        
      } else {
        const { data } = await signUp(
          authFormData.email, 
          authFormData.password, 
          authFormData.name, 
          authFormData.phoneNumber
        );
        setUserEmail(data.user?.email || null);
        
        // 登録時は入力された名前を使用
        setWelcomeUserName(authFormData.name || data.user?.email || '');
      }
      
      // ログイン成功、まずアニメーションを表示
      setShowWelcomeAnimation(true);
      setIsWelcomeAnimationFading(false);
      
      // 認証モーダルは即時非表示
      setShowAuthModal(false);
      
      // 1.7秒後にフェードアウト開始
      setTimeout(() => {
        setIsWelcomeAnimationFading(true);
      }, 1700);
      
      // 2秒後にアニメーションを非表示にし、認証済みとする
      setTimeout(() => {
        setShowWelcomeAnimation(false);
        setIsWelcomeAnimationFading(false);
        setIsAuthenticated(true);
      }, 2000);
      
    } catch (error) {
      console.error('Authentication error:', error);
      alert('認証エラーが発生しました');
    }
  };

  // メールアドレスの入力ハンドラ（英数字と一部の記号のみ許可）
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // メールアドレスで有効な文字のみを許可（英数字、@、ドット、アンダースコア、ハイフン）
    const filteredValue = value.replace(/[^\w@.-]/g, '');
    setAuthFormData(prev => ({ ...prev, email: filteredValue }));
  };

  // パスワードの入力ハンドラ（英数字と一部の記号のみ許可）
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // パスワードで有効な文字のみを許可（英数字と一般的な記号）
    const filteredValue = value.replace(/[^\w!@#$%^&*(),.?":{}|<>]/g, '');
    setAuthFormData(prev => ({ ...prev, password: filteredValue }));
  };

  // パスワードの強度を計算する関数
  const calculatePasswordStrength = (password: string): { strength: number; message: string } => {
    if (!password) {
      return { strength: 0, message: '' };
    }

    let score = 0;
    
    // 長さによるスコア
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // 文字種類によるスコア
    if (/[A-Z]/.test(password)) score += 1; // 大文字
    if (/[a-z]/.test(password)) score += 1; // 小文字
    if (/[0-9]/.test(password)) score += 1; // 数字
    if (/[^A-Za-z0-9]/.test(password)) score += 1; // 特殊文字
    
    // スコアを0-3の範囲に正規化
    const normalizedScore = Math.min(3, Math.floor(score / 2));
    
    // メッセージの設定
    let message = '';
    if (normalizedScore === 0) message = '弱いパスワード';
    else if (normalizedScore === 1) message = '普通のパスワード';
    else if (normalizedScore === 2) message = '強いパスワード';
    else message = '非常に強いパスワード';
    
    return { strength: normalizedScore, message };
  };

  // パスワードの強度を計算
  const passwordStrength = calculatePasswordStrength(authFormData.password);

  // Google認証ハンドラを修正
  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          // 以下のオプションを追加
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Google authentication error:', error);
      alert('Google認証エラーが発生しました');
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      // プロフィール情報を取得
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      if (data?.avatar_url) {
        setUserProfileImage(data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // ユーザープロフィール画像のステート
  const fetchUserProfileImage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Googleなどのプロバイダーから取得したプロフィール画像
        const avatarUrl = user.user_metadata?.avatar_url || 
                         user.user_metadata?.picture;
        
        if (avatarUrl) {
          setUserProfileImage(avatarUrl);
        } else {
          // プロフィールテーブルから取得を試みる
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
            
          if (data?.avatar_url) {
            setUserProfileImage(data.avatar_url);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user profile image:', error);
    }
  };

  // 認証状態の変更を監視
  useEffect(() => {
    // 初回ロード時にプロフィール画像を取得
    if (isAuthenticated) {
      fetchUserProfileImage();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || null);
      
      if (session?.user) {
        // ユーザー名を取得
        const userName = session.user.user_metadata?.name || 
                        session.user.user_metadata?.full_name || 
                        session.user.email?.split('@')[0] || 'ゲスト';
        setWelcomeUserName(userName);
        
        // プロフィール画像を取得
        const avatarUrl = session.user.user_metadata?.avatar_url || 
                         session.user.user_metadata?.picture;
        if (avatarUrl) {
          setUserProfileImage(avatarUrl);
        } else {
          fetchUserProfileImage();
        }
      } else {
        setUserProfileImage(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthenticated]);

  return (
    <Router>
      <div>
        {/* ようこそアニメーション */}
        {showWelcomeAnimation && (
          <div className={`fixed inset-0 bg-blue-600 flex flex-col items-center justify-between z-[100] ${isWelcomeAnimationFading ? 'animate-fade-out' : ''}`}>
            {/* 上部に余白を作るための空のdiv */}
            <div className="flex-1"></div>
            
            {/* ようこそメッセージ - 中央配置 */}
            <div className="animate-scale-up text-center px-4">
              {/* PC用レイアウト - 横並び */}
              <div className="hidden sm:flex items-center justify-center space-x-3">
                <span className="text-5xl font-bold text-white">ようこそ</span>
                <span className="text-5xl font-bold text-white">{welcomeUserName}</span>
                <span className="text-5xl font-bold text-white">さん</span>
              </div>
              
              {/* スマホ用レイアウト - 縦並び */}
              <div className="flex flex-col items-center sm:hidden">
                <span className="text-4xl font-bold text-white mb-2">ようこそ</span>
                <span className="text-4xl font-bold text-white">{welcomeUserName}</span>
                <span className="text-4xl font-bold text-white">さん</span>
              </div>
            </div>
            
            {/* 下部の余白とローディングアニメーション */}
            <div className="flex-1 flex items-end pb-24">
              <div className="textWrapper">
                <p className="text">Loading...</p>
                <div className="invertbox"></div>
              </div>
            </div>
          </div>
        )}

        {/* 認証モーダル - ログインしていないとき常に表示 */}
        {(showAuthModal || !isAuthenticated) && !showWelcomeAnimation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6">
                {authMode === 'signin' ? 'ログイン' : '会員登録'}
              </h2>
              
              {/* ソーシャルログインボタン */}
              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>{authMode === 'signin' ? 'Googleでログイン' : 'Googleで登録'}</span>
                </button>
              </div>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-500">または</span>
                </div>
              </div>
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={authFormData.email}
                    onChange={handleEmailChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                    placeholder="example@email.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">英数字と記号のみ入力できます</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={authFormData.password}
                    onChange={handlePasswordChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                    minLength={8}
                  />
                  
                  {/* パスワード強度インジケーター - 会員登録時のみ表示 */}
                  {authFormData.password && authMode === 'signup' && (
                    <div className="mt-2">
                      <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            passwordStrength.strength === 0 ? 'w-1/3 bg-red-500' : 
                            passwordStrength.strength === 1 ? 'w-2/3 bg-yellow-500' : 
                            'w-full bg-green-500'
                          }`} 
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {passwordStrength.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        英数字と記号のみ入力できます（8文字以上）
                      </p>
                    </div>
                  )}
                  {(!authFormData.password || authMode === 'signin') && (
                    <p className="text-xs text-gray-500 mt-1">英数字と記号のみ入力できます（8文字以上）</p>
                  )}
                </div>
                
                {authMode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        名前 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={authFormData.name}
                        onChange={(e) => setAuthFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md p-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        電話番号
                      </label>
                      <input
                        type="tel"
                        value={authFormData.phoneNumber}
                        onChange={(e) => {
                          const value = e.target.value;
                          const filteredValue = value.replace(/[^\d-]/g, '');
                          setAuthFormData(prev => ({ ...prev, phoneNumber: filteredValue }));
                        }}
                        pattern="[0-9\-]*"
                        inputMode="numeric"
                        className="w-full border border-gray-300 rounded-md p-2"
                        placeholder="090-1234-5678"
                      />
                      <p className="text-xs text-gray-500 mt-1">数字とハイフンのみ入力できます</p>
                    </div>
                  </>
                )}
                
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2"
                  >
                    <Mail size={16} />
                    {authMode === 'signin' ? 'メールでログイン' : 'メールで登録'}
                  </button>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(false)}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              </form>
              <div className="mt-4 text-center">
                <button
                  onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  className="text-blue-500 hover:text-blue-600"
                >
                  {authMode === 'signin' ? '会員登録はこちら' : 'ログインはこちら'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ログインしている場合のみメインコンテンツを表示 */}
        {isAuthenticated && (
          <Layout
            isAuthenticated={isAuthenticated}
            setShowAuthModal={setShowAuthModal}
            setAuthMode={setAuthMode}
            userEmail={userEmail}
            setIsAuthenticated={setIsAuthenticated}
            userProfileImage={userProfileImage}
          >
            <Routes>
              <Route path="/" element={<RegisterItem />} />
              <Route path="/items" element={<ItemsList />} />
              <Route path="/events/register" element={<RegisterEvent />} />
              <Route path="/events" element={<EventsList />} />
              <Route path="/daily-registration" element={<DailyItemRegistration />} />
              <Route path="/loan-management" element={<LoanManagement />} />
              <Route path="/loan-history" element={<LoanHistory />} />
              <Route path="/loan-statistics" element={<LoanStatistics />} />
              <Route path="/csv-validation" element={<CsvValidation csvData={csvData} />} />
              <Route path="/profile" element={<Profile userEmail={userEmail} />} />
            </Routes>
          </Layout>
        )}
      </div>
    </Router>
  );
}

export default App;