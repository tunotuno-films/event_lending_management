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
  const [selectedEvent, setSelectedEvent] = useState<{ event_id: string; name: string } | null>(null);

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

  // 追加: localStorage から選択済みイベント情報を取得
  useEffect(() => {
    const storedEventInfo = localStorage.getItem('selectedEventInfo');
    if (storedEventInfo) {
      try {
        setSelectedEvent(JSON.parse(storedEventInfo));
      } catch (error) {
        console.error('selectedEventInfoのパースエラー:', error);
      }
    }
  }, []);

  useEffect(() => {
    // selectedEventが既にセットされていなければ localStorage から selectedEventId を取得し、supabase でイベント情報を取得する
    if (!selectedEvent) {
      const storedEventId = localStorage.getItem('selectedEventId');
      if (storedEventId) {
        supabase
          .from('events')
          .select('event_id, name')
          .eq('event_id', storedEventId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (data) {
              setSelectedEvent({ event_id: data.event_id, name: data.name });
            } else if (error) {
              console.error('イベント情報の取得エラー:', error);
            }
          });
      }
    }
  }, [selectedEvent]);

  // 追加: カスタムイベントリスナーで非同期に選択イベント情報を更新
  useEffect(() => {
    const handleSelectedEventChanged = () => {
      const storedEventId = localStorage.getItem('selectedEventId');
      if (storedEventId) {
        supabase
          .from('events')
          .select('event_id, name')
          .eq('event_id', storedEventId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('イベント情報の取得エラー:', error);
            } else if (data) {
              setSelectedEvent({ event_id: data.event_id, name: data.name });
            } else {
              setSelectedEvent(null);
            }
          });
      } else {
        setSelectedEvent(null);
      }
    };
    window.addEventListener('selectedEventChanged', handleSelectedEventChanged);
    return () => window.removeEventListener('selectedEventChanged', handleSelectedEventChanged);
  }, []);

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
      {/* ヘッダー：fixedに変更 */}
      <div className="fixed top-0 z-50 bg-white shadow-sm w-full">
        <div className="px-4 py-3">
          {/* ヘッダーの1行目：タイトルとユーザー情報を横並びに */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="text-gray-500 hover:text-gray-700 md:hidden"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">
                貸出管理システム
              </h1>
              {/* PC画面用: タイトルの右横にイベント情報を表示 */}
              {selectedEvent && (
                <div className="hidden md:block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm whitespace-nowrap">
                  {selectedEvent.event_id} - {selectedEvent.name} 選択中
                </div>
              )}
            </div>
            <div className="flex items-center">
              {isAuthenticated ? (
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
        </div>
        {/* パンくずリスト */}
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <Link to="/" className="text-gray-500 hover:text-gray-700">ホーム</Link>
            {getBreadcrumbInfo().category && getBreadcrumbInfo().category !== 'メニュー' && (
              <>
                <span className="mx-2">›</span>
                <span className="text-gray-500">{getBreadcrumbInfo().category}</span>
              </>
            )}
            {getBreadcrumbInfo().title && location.pathname !== '/' && (
              <>
                <span className="mx-2">›</span>
                <span className="font-medium text-gray-800">{getBreadcrumbInfo().title}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* ヘッダー高さ分のプレースホルダー */}
      <div className="h-[5rem]"></div>
      
      {/* main container：サイドバーは固定、メインコンテンツのみスクロール */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar：fixedで左に固定 */}
        <div className="hidden md:block fixed top-0 left-0 h-screen w-64 bg-white shadow-sm z-30 pt-20">
          {/* サイドバーコンテンツ - ログイン状態に関わらず全て表示 */}
          <div className="py-4">
            {/* メニュー - ホームだけを残す */}
            <div className="px-4 mb-6">
              <div className="mt-4 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
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

        {/* Mobile Sidebar */}
        <div className="md:hidden">
          <div className={`
            bg-white shadow-sm fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            {/* スマホ用閉じるボタン */}
            <div className="px-4 py-3 flex justify-between items-center border-b">
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
        </div>

        {/* Main Content：デスクトップ時には左余白を設ける */}
        <div className="flex-1 overflow-y-auto ml-0 md:ml-64">
          {/* 修正: 内側背景をbg-gray-100に変更 */}
          <div className="bg-gray-100 p-4 rounded-lg">
            {children}
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