import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Barcode, LayoutList, LogIn, Menu, UserPlus } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  setAuthModalMode: (mode: 'signin' | 'signup') => void;
  setIsAuthModalOpen: (isOpen: boolean) => void;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  setAuthModalMode,
  setIsAuthModalOpen
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

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

          {/* ユーザー情報 - ログインボタンのみ表示 */}
          <div className="flex items-center">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAuthModalMode('signin');
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center text-sm text-gray-600 hover:text-gray-800"
              >
                <LogIn size={16} className="mr-1" />
                <span className="hidden sm:inline">ログイン</span>
              </button>
              <button
                onClick={() => {
                  setAuthModalMode('signup');
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center text-sm text-gray-600 hover:text-gray-800"
              >
                <UserPlus size={16} className="mr-1" />
                <span className="hidden sm:inline">会員登録</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* サイドバー - 非認証時は物品登録と認証関連のみ表示 */}
        <div
          className={`
          bg-white shadow-sm fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}
        >
          <div className="py-4">
            <div className="px-4 mb-6">
              <nav className="space-y-1">
                <Link
                  to="/"
                  className={`flex items-center px-3 py-2 rounded-md ${
                    location.pathname === '/'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Barcode className="mr-3" size={20} />
                  <span>物品登録</span>
                </Link>

                {/* 制限されたページのサンプル - クリックするとログイン促進メッセージ */}
                <button
                  onClick={() => {
                    alert('この機能を利用するにはログインしてください');
                    setAuthModalMode('signin');
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center px-3 py-2 rounded-md text-gray-400"
                >
                  <LayoutList className="mr-3" size={20} />
                  <span>物品一覧 (要ログイン)</span>
                </button>
              </nav>
            </div>

            <div className="px-4 mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                アカウント
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setAuthModalMode('signin');
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  <LogIn className="mr-3" size={20} />
                  <span>ログイン</span>
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('signup');
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  <UserPlus className="mr-3" size={20} />
                  <span>会員登録</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;