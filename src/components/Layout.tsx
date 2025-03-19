import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Barcode, 
  Home, 
  LayoutList, 
  CreditCard, 
  Settings, 
  User, 
  LogIn, 
  UserPlus,
  History,
  BarChart,
  Menu,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  setShowAuthModal: (show: boolean) => void;
  setAuthMode: (mode: 'signin' | 'signup') => void;
  userEmail: string | null;
  setIsAuthenticated: (authenticated: boolean) => void;
}

export default function Layout({
  children,
  isAuthenticated,
  setShowAuthModal,
  setAuthMode,
  userEmail,
  setIsAuthenticated
}: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ユーザーの名前を取得
  useEffect(() => {
    const fetchUserName = async () => {
      if (isAuthenticated && userEmail) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.user_metadata && user.user_metadata.name) {
            setUserName(user.user_metadata.name);
          } else {
            setUserName(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserName(null);
        }
      }
    };

    fetchUserName();
  }, [isAuthenticated, userEmail]);

  // サイドバーを閉じる（モバイル画面でリンクをクリックした時に閉じる）
  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setShowLogoutModal(false);
    navigate('/');
  };

  // 表示名を決定（名前があればそれを、なければメールアドレスを使用）
  const displayName = userName || userEmail;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* オーバーレイ (モバイル画面でサイドバーが開いている時に表示) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* サイドバー */}
      <aside className={`fixed h-full bg-white shadow-md z-30 w-64 transition-all duration-300 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Barcode className="w-6 h-6" />
            <span className="font-semibold">貸出管理システム</span>
          </div>
          {/* モバイル画面での閉じるボタン */}
          <button className="md:hidden" onClick={closeSidebar}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="p-4 h-[calc(100vh-80px)] overflow-y-auto">
          <div className="space-y-2">
            <Link
              to="/"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <Home size={18} />
              <span>物品登録</span>
            </Link>
            <Link
              to="/items"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/items' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <LayoutList size={18} />
              <span>物品一覧</span>
            </Link>
            <Link
              to="/events/register"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/events/register' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <CreditCard size={18} />
              <span>イベント登録</span>
            </Link>
            <Link
              to="/events"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/events' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <LayoutList size={18} />
              <span>イベント一覧</span>
            </Link>
            <Link
              to="/daily-registration"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/daily-registration' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <Settings size={18} />
              <span>当日物品登録</span>
            </Link>
            <Link
              to="/loan-management"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/loan-management' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <Settings size={18} />
              <span>貸出管理</span>
            </Link>
            <Link
              to="/loan-history"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/loan-history' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <History size={18} />
              <span>貸出履歴</span>
            </Link>
            <Link
              to="/loan-statistics"
              className={`flex items-center gap-2 p-2 ${
                location.pathname === '/loan-statistics' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              } rounded`}
              onClick={closeSidebar}
            >
              <BarChart size={18} />
              <span>貸出統計</span>
            </Link>
          </div>

          <div className="mt-8">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-4">Account pages</div>
            <div className="space-y-2">
              <Link
                to="/profile"
                className={`flex items-center gap-2 p-2 ${
                  location.pathname === '/profile' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                } rounded`}
                onClick={closeSidebar}
              >
                <User size={18} />
                <span>プロフィール</span>
              </Link>
              {!isAuthenticated ? (
                <>
                  <button
                    onClick={() => {
                      setAuthMode('signin');
                      setShowAuthModal(true);
                      closeSidebar();
                    }}
                    className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-50 rounded w-full"
                  >
                    <LogIn size={18} />
                    <span>ログイン</span>
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode('signup');
                      setShowAuthModal(true);
                      closeSidebar();
                    }}
                    className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-50 rounded w-full"
                  >
                    <UserPlus size={18} />
                    <span>会員登録</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowLogoutModal(true);
                    closeSidebar();
                  }}
                  className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-50 rounded w-full"
                >
                  <LogIn size={18} />
                  <span>ログアウト</span>
                </button>
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 mt-auto">
          <div className="text-center text-sm text-gray-600">
            {new Date().toLocaleString('ja-JP')}
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 transition-all duration-300 md:ml-64">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm p-4 sticky top-0 z-10 flex justify-between items-center">
          {/* ハンバーガーメニューアイコン (モバイル画面のみ表示) */}
          <button 
            className="md:hidden flex items-center justify-center p-2"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          {/* タイトル */}
          <div className="md:hidden text-lg font-semibold">
            {location.pathname === '/' && '物品登録'}
            {location.pathname === '/items' && '物品一覧'}
            {location.pathname === '/events/register' && 'イベント登録'}
            {location.pathname === '/events' && 'イベント一覧'}
            {location.pathname === '/daily-registration' && '当日物品登録'}
            {location.pathname === '/loan-management' && '貸出管理'}
            {location.pathname === '/loan-history' && '貸出履歴'}
            {location.pathname === '/loan-statistics' && '貸出統計'}
          </div>

          {/* ユーザー情報 */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="px-3 py-1 text-sm border border-blue-500 text-blue-500 rounded-lg truncate max-w-xs">
                ようこそ {displayName} さん
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('signin');
                  setShowAuthModal(true);
                }}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="p-4 md:p-8">
          {/* パンくずリスト (モバイル以外で表示) */}
          <div className="hidden md:flex mb-8 justify-between items-center">
            <nav className="text-sm">
              <ol className="flex items-center space-x-2">
                <li><Link to="/" className="text-gray-500">貸出管理システム</Link></li>
                <li className="text-gray-400">/</li>
                <li className="text-gray-900">
                  {location.pathname === '/' && '物品登録'}
                  {location.pathname === '/items' && '物品一覧'}
                  {location.pathname === '/events/register' && 'イベント登録'}
                  {location.pathname === '/events' && 'イベント一覧'}
                  {location.pathname === '/daily-registration' && '当日物品登録'}
                  {location.pathname === '/loan-management' && '貸出管理'}
                  {location.pathname === '/loan-history' && '貸出履歴'}
                  {location.pathname === '/loan-statistics' && '貸出統計'}
                </li>
              </ol>
            </nav>
          </div>

          {children}
        </main>
      </div>

      {/* ログアウト確認モーダル */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4">ログアウト確認</h3>
            <p className="mb-6">ログアウトしますか？</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}