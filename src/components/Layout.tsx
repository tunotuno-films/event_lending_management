import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Barcode, 
  LayoutList, 
  User, 
  LogIn, 
  UserPlus,
  History,
  BarChart,
  Menu,
  X,
  LogOut, // LogOutアイコンを追加
  Calendar, // イベント登録用のカレンダーアイコン
  Shuffle,         // 交差する矢印（シャッフル）
  Home, // ホームアイコンを追加
  Package // 物品登録アイコンを変更
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  setShowAuthModal: (show: boolean) => void;
  setAuthMode: (mode: 'signin' | 'signup') => void;
  userEmail?: string | null;
  setIsAuthenticated?: (isAuthenticated: boolean) => void;
  userProfileImage?: string | null; // プロフィール画像URL
}

const UserIcon = ({ userProfileImage, userEmail }: { userProfileImage?: string | null; userEmail?: string | null }) => {
  // ユーザーアイコンの表示ロジック
  if (userProfileImage) {
    // プロフィール画像がある場合はそれを表示
    return (
      <img 
        src={userProfileImage} 
        alt="User Profile" 
        className="w-8 h-8 rounded-full object-cover"
      />
    );
  } else {
    // プロフィール画像がない場合はデフォルトアイコンを表示
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-600 font-semibold">
          {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
        </span>
      </div>
    );
  }
};

export default function Layout({
  children,
  isAuthenticated,
  setShowAuthModal,
  setAuthMode,
  userEmail,
  setIsAuthenticated,
  userProfileImage,
}: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ログインが必要な機能をクリックしたときの共通処理
  const handleAuthRequired = () => {
    // アラートを表示せず、直接ログインモーダルを表示
    setAuthMode('signin');
    setShowAuthModal(true);
  };

  // ユーザーの名前とプロフィール画像を取得 (認証済みの場合のみ)
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (isAuthenticated && userEmail) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // ユーザー名を設定
            if (user.user_metadata) {
              setUserName(user.user_metadata.name || 
                          user.user_metadata.full_name || 
                          user.email?.split('@')[0] || 'ゲスト');
            } else {
              setUserName(user.email?.split('@')[0] || 'ゲスト');
            }
            
            // プロフィール画像を取得（Googleのavatar_urlなど）
            const avatarUrl = user.user_metadata?.avatar_url || 
                            user.user_metadata?.picture;
            
            // プロフィール画像がメタデータにあり、かつApp.tsxから渡されたものと異なる場合
            if (avatarUrl && avatarUrl !== userProfileImage) {
              // window オブジェクトにカスタムイベントを発火して親コンポーネントに通知
              // これにより、App.tsx側でuserProfileImageを更新できる
              const event = new CustomEvent('userProfileImageUpdated', { 
                detail: { profileImageUrl: avatarUrl } 
              });
              window.dispatchEvent(event);
              
              console.log('Profile image found in metadata:', avatarUrl);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserName(null);
        }
      }
    };

    fetchUserInfo();
  }, [isAuthenticated, userEmail, userProfileImage]);

  const handleLogout = async () => {
    if (!setIsAuthenticated) return;
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setIsAuthenticated(false);
      setShowLogoutModal(false);
      navigate('/');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // getBreadcrumbInfo関数を修正
  const getBreadcrumbInfo = () => {
    const path = location.pathname;
    
    // カテゴリとページタイトルのマッピング
    const pageInfo: Record<string, { category: string; title: string }> = {
      // ホームはメニューカテゴリ
      '/': { category: 'メニュー', title: 'ホーム' },
      
      // 物品管理カテゴリ
      '/item/regist': { category: '物品管理', title: '物品登録' },
      '/item/list': { category: '物品管理', title: '物品一覧' },
      
      // イベントカテゴリ
      '/event/regist': { category: 'イベント', title: 'イベント登録' },
      '/event/list': { category: 'イベント', title: 'イベント一覧' },
      '/event/daily': { category: 'イベント', title: '当日物品登録' },
      
      // 貸出管理カテゴリ
      '/loaning/control': { category: '貸出管理', title: '貸出管理' },
      '/loaning/log': { category: '貸出管理', title: '貸出履歴' },
      '/loaning/statistics': { category: '貸出管理', title: '貸出統計' },
      
      // アカウントカテゴリ
      '/profile': { category: 'アカウント', title: 'プロフィール' },
    };
    
    // TypeScriptエラーを修正するために型を明示的に指定して返す
    if (path in pageInfo) {
      return pageInfo[path];
    }
    return { category: '', title: '' };
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm w-full">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="text-gray-500 hover:text-gray-700 md:hidden mr-3"
            >
              <Menu size={24} />
            </button>
            
            {/* 固定のシステム名を表示 */}
            <h1 className="text-lg font-semibold text-gray-800 truncate">
              貸出管理システム
            </h1>
          </div>
          
          {/* ユーザー情報 */}
          <div className="flex items-center">
            {isAuthenticated ? (
              // ユーザー情報クリックでログアウトモーダルを表示
              <div 
                onClick={() => setShowLogoutModal(true)}
                className="relative flex items-center space-x-2 cursor-pointer group"
              >
                <span className="font-medium truncate max-w-[120px] group-hover:text-blue-600 transition-colors">
                  {userName || userEmail?.split('@')[0] || 'ゲスト'}
                </span>
                <UserIcon userProfileImage={userProfileImage} userEmail={userEmail} />
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setAuthMode('signin');
                    setShowAuthModal(true);
                  }}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                >
                  <LogIn size={16} className="mr-1" />
                  <span className="hidden sm:inline">ログイン</span>
                </button>
                <button 
                  onClick={() => {
                    setAuthMode('signup');
                    setShowAuthModal(true);
                  }}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                >
                  <UserPlus size={16} className="mr-1" />
                  <span className="hidden sm:inline">会員登録</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* パンくずリスト - PC・スマホ両方で表示 */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {/* ホームへのリンク - 常に表示 */}
            <Link to="/" className="text-gray-500 hover:text-gray-700">
              ホーム
            </Link>
            
            {/* カテゴリ部分（存在する場合のみ表示） */}
            {getBreadcrumbInfo().category && getBreadcrumbInfo().category !== 'メニュー' && (
              <>
                <span className="mx-2">›</span>
                <span className="text-gray-500">{getBreadcrumbInfo().category}</span>
              </>
            )}
            
            {/* ページタイトル部分（存在する場合のみ表示、ホームページは除外） */}
            {getBreadcrumbInfo().title && location.pathname !== '/' && (
              <>
                <span className="mx-2">›</span>
                <span className="font-medium text-gray-800">{getBreadcrumbInfo().title}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* サイドバー - 共通化 */}
        <div className={`
          bg-white shadow-sm fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}>
          {/* スマホ用閉じるボタン */}
          <div className="px-4 py-3 flex justify-between items-center border-b md:hidden">
            <h1 className="text-xl font-semibold text-gray-800">メニュー</h1>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* サイドバーコンテンツ - ログイン状態に関わらず全て表示 */}
          <div className="py-4">
            {/* メニュー - ホームだけを残す */}
            <div className="px-4 mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                メニュー
              </div>
              <nav className="space-y-1">
                <Link 
                  to="/"
                  className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Home className="mr-3" size={20} />
                  <span>ホーム</span>
                </Link>
              </nav>
            </div>
            
            {/* 物品管理メニュー */}
            <div className="px-4 mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                物品管理
              </div>
              <nav className="space-y-1">
                <Link 
                  to="/item/regist"
                  className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/item/regist' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Package className="mr-3" size={20} />
                  <span>物品登録</span>
                </Link>

                {isAuthenticated ? (
                  <Link 
                    to="/item/list"
                    className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/item/list' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <LayoutList className="mr-3" size={20} />
                    <span>物品一覧</span>
                  </Link>
                ) : (
                  <button
                    onClick={handleAuthRequired}
                    className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 opacity-75"
                  >
                    <LayoutList className="mr-3" size={20} />
                    <span>物品一覧</span>
                  </button>
                )}
              </nav>
            </div>
            
            {/* イベントメニュー */}
            <div className="px-4 mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                イベント
              </div>
              <nav className="space-y-1">
                {isAuthenticated ? (
                  <>
                    <Link 
                      to="/event/regist"
                      className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/event/regist' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <Calendar className="mr-3" size={20} />
                      <span>イベント登録</span>
                    </Link>
                    <Link 
                      to="/event/list"
                      className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/event/list' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <LayoutList className="mr-3" size={20} />
                      <span>イベント一覧</span>
                    </Link>
                    <Link 
                      to="/event/daily"
                      className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/event/daily' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <Shuffle className="mr-3" size={20} />
                      <span>当日物品登録</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleAuthRequired}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 opacity-75"
                    >
                      <Calendar className="mr-3" size={20} />
                      <span>イベント登録</span>
                    </button>
                    <button
                      onClick={handleAuthRequired}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 opacity-75"
                    >
                      <LayoutList className="mr-3" size={20} />
                      <span>イベント一覧</span>
                    </button>
                    <button
                      onClick={handleAuthRequired}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 opacity-75"
                    >
                      <Shuffle className="mr-3" size={20} />
                      <span>当日物品登録</span>
                    </button>
                  </>
                )}
              </nav>
            </div>
            
            {/* 貸出管理メニュー */}
            <div className="px-4 mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                貸出管理
              </div>
              <nav className="space-y-1">
                {isAuthenticated ? (
                  <>
                    <Link 
                      to="/loaning/control"
                      className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/loaning/control' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <Barcode className="mr-3" size={20} />
                      <span>貸出管理</span>
                    </Link>
                    <Link 
                      to="/loaning/log"
                      className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/loaning/log' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <History className="mr-3" size={20} />
                      <span>貸出履歴</span>
                    </Link>
                    <Link 
                      to="/loaning/statistics"
                      className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/loaning/statistics' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <BarChart className="mr-3" size={20} />
                      <span>貸出統計</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleAuthRequired}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 opacity-75"
                    >
                      <Barcode className="mr-3" size={20} />
                      <span>貸出管理</span>
                    </button>
                    <button
                      onClick={handleAuthRequired}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 opacity-75"
                    >
                      <History className="mr-3" size={20} />
                      <span>貸出履歴</span>
                    </button>
                    <button
                      onClick={handleAuthRequired}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 opacity-75"
                    >
                      <BarChart className="mr-3" size={20} />
                      <span>貸出統計</span>
                    </button>
                  </>
                )}
              </nav>
            </div>
            
            {/* アカウントメニュー */}
            <div className="px-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                アカウント
              </div>
              <nav className="space-y-1">
                {isAuthenticated ? (
                  <>
                    <Link 
                      to="/profile"
                      className={`flex items-center px-3 py-2 rounded-md ${location.pathname === '/Profile' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <User className="mr-3" size={20} />
                      <span>プロフィール</span>
                    </Link>
                    <button 
                      onClick={() => setShowLogoutModal(true)}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="mr-3" size={20} />
                      <span>ログアウト</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        setAuthMode('signin');
                        setShowAuthModal(true);
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                    >
                      <LogIn className="mr-3" size={20} />
                      <span>ログイン</span>
                    </button>
                    <button 
                      onClick={() => {
                        setAuthMode('signup');
                        setShowAuthModal(true);
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                    >
                      <UserPlus className="mr-3" size={20} />
                      <span>会員登録</span>
                    </button>
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
        
        {/* オーバーレイバックドロップ - スマホでサイドバーが開いた時 */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}
        
        {/* メインコンテンツ */}
        <div className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </div>
      </div>

      {/* ログアウト確認モーダル */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">ログアウト確認</h3>
            <p className="text-gray-600 mb-6">ログアウトしてもよろしいですか？</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center"
              >
                <LogOut size={18} className="mr-2" />
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}