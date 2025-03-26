import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom'; // Navigate を追加
import { supabase, checkUser, handleAuthRedirect } from './lib/supabase';
import { Barcode, StopCircle, X, AlertCircle, AlertTriangle } from 'lucide-react'; // AlertTriangle を追加
import { useZxing } from 'react-zxing';

// コンポーネントのインポート
import Notification from './components/Notification';
import BulkUploadModal from './components/BulkUploadModal';
import Layout from './components/Layout';
import AuthModal from './components/AuthModal';
import ItemsList from './components/ItemsList';
import RegisterEvent from './components/RegisterEvent';
import EventsList from './components/EventsList';
import DailyItemRegistration from './components/DailyItemRegistration';
import LoanManagement from './components/LoanManagement';
import LoanHistory from './components/LoanHistory';
import LoanStatistics from './components/LoanStatistics';
import CsvValidation from './components/CsvValidation';
import Profile from './components/Profile';
import RegisterItem from './components/RegisterItem'; // RegisterItem コンポーネントをインポート
import './index.css';

// --- 型定義 ---
interface CsvItem {
  item_id: string;
  name: string;
  genre: string;
  manager: string;
  isValid: boolean;
  errors: string[];
}

// AppContents コンポーネント - Router 内で実行される部分
function AppContents() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CsvItem[]>([]);
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [welcomeUserName, setWelcomeUserName] = useState('');
  const [isWelcomeAnimationFading, setIsWelcomeAnimationFading] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // 認証状態を確認
    const checkAuthStatus = async () => {
      const session = await checkUser();
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || null);
      setIsLoadingAuth(false);
    };

    checkAuthStatus();

    // Google認証などからのリダイレクトを処理
    const handleRedirectAuth = async () => {
      try {
        const { data, error } = await handleAuthRedirect();
        if (data.session) {
          setIsAuthenticated(true);
          setUserEmail(data.session.user?.email || null);
          
          // ユーザー名を取得
          const userName = data.session.user?.user_metadata?.name || 
                          data.session.user?.user_metadata?.full_name ||
                          data.session.user?.email || '';
          setWelcomeUserName(userName);
          
          displayWelcomeAnimation();
        }
      } catch (error) {
        console.error("Error handling auth redirect:", error);
      }
    };

    handleRedirectAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionExists = !!session;
      setIsAuthenticated(sessionExists);
      setUserEmail(session?.user?.email || null);
      if (isLoadingAuth) {
        setIsLoadingAuth(false);
      }
    });

    // クリーンアップ
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // プロフィール画像が更新されたとき
  useEffect(() => {
    const handleProfileImageUpdate = (event: CustomEvent<{ profileImageUrl: string }>) => {
      const { profileImageUrl } = event.detail;
      if (profileImageUrl && profileImageUrl !== userProfileImage) {
        setUserProfileImage(profileImageUrl);
        console.log('Updated profile image from auth provider:', profileImageUrl);
      }
    };

    // カスタムイベントをリッスン
    window.addEventListener('userProfileImageUpdated', handleProfileImageUpdate as EventListener);

    // クリーンアップ関数
    return () => {
      window.removeEventListener('userProfileImageUpdated', handleProfileImageUpdate as EventListener);
    };
  }, [userProfileImage]);

  // ウェルカムアニメーション表示制御
  const displayWelcomeAnimation = () => {
    setShowWelcomeAnimation(true);
    setIsWelcomeAnimationFading(false);
    
    setTimeout(() => {
      setIsWelcomeAnimationFading(true);
    }, 1700);
    
    setTimeout(() => {
      setShowWelcomeAnimation(false);
      setIsWelcomeAnimationFading(false);
    }, 2000);
  };

  // AuthModal での認証成功時の処理
  const handleAuthSuccess = (email: string, name?: string) => {
    setUserEmail(email);
    setWelcomeUserName(name || email);
    setIsAuthModalOpen(false);
    
    // ウェルカムアニメーション表示
    displayWelcomeAnimation();
    
    // アニメーション表示後に認証状態をtrueにする
    setTimeout(() => {
      setIsAuthenticated(true);
    }, 500);
  };

  // 認証状態確認中のローディング表示
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-[100]">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">認証情報を確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ようこそアニメーション */}
      {showWelcomeAnimation && (
        <div className={`fixed inset-0 bg-blue-600 flex flex-col items-center justify-between z-[100] transition-opacity duration-300 ${isWelcomeAnimationFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex-1"></div>
          <div className="animate-scale-up text-center px-4">
            <div className="hidden sm:flex items-center justify-center space-x-3">
              <span className="text-5xl font-bold text-white">ようこそ</span>
              <span className="text-5xl font-bold text白">{welcomeUserName}</span>
              <span className="text-5xl font-bold text白">さん</span>
            </div>
            <div className="flex flex-col items-center sm:hidden">
              <span className="text-4xl font-bold text白 mb-2">ようこそ</span>
              <span className="text-4xl font-bold text白">{welcomeUserName}</span>
              <span className="text-4xl font-bold text白">さん</span>
            </div>
          </div>
          <div className="flex-1 flex items-end pb-24 overflow-hidden">
            {!isWelcomeAnimationFading && (
              <div className="textWrapper">
                <p className="text">Loading...</p>
                <div className="invertbox"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 認証モーダル */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        setMode={setAuthModalMode}
      />

      {/* 認証状態に応じたレイアウト */}
      {isAuthenticated ? (
        // 認証済みユーザー向け
        <Layout
          isAuthenticated={isAuthenticated}
          setShowAuthModal={setIsAuthModalOpen}
          setAuthMode={setAuthModalMode}
          userEmail={userEmail}
          setIsAuthenticated={setIsAuthenticated}
          userProfileImage={userProfileImage}
        >
          <Routes>
            <Route path="/" element={
              <RegisterItem
                userEmail={userEmail}
                isAuthenticated={true}
                setAuthModalMode={setAuthModalMode}
                setIsAuthModalOpen={setIsAuthModalOpen}
                setCsvData={setCsvData}
              />
            } />
            <Route path="/items" element={<ItemsList />} />
            <Route path="/events/register" element={<RegisterEvent />} />
            <Route path="/events" element={<EventsList />} />
            <Route path="/daily-registration" element={<DailyItemRegistration />} />
            <Route path="/loan-management" element={<LoanManagement />} />
            <Route path="/loan-history" element={<LoanHistory />} />
            <Route path="/loan-statistics" element={<LoanStatistics />} />
            <Route path="/csv-validation" element={
              <CsvValidation 
                csvData={csvData} 
                setCsvData={setCsvData}
                userEmail={userEmail}
              />
            } />
            <Route path="/profile" element={<Profile userEmail={userEmail} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      ) : (
        // 非認証ユーザー向け - Layoutコンポーネントを使用
        <Layout
          isAuthenticated={false}
          setShowAuthModal={setIsAuthModalOpen}
          setAuthMode={setAuthModalMode}
        >
          <Routes>
            <Route path="/" element={
              <RegisterItem
                isAuthenticated={false}
                setAuthModalMode={setAuthModalMode}
                setIsAuthModalOpen={setIsAuthModalOpen}
              />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </div>
  );
}

// メインのAppコンポーネント
function App() {
  return (
    <Router>
      <AppContents />
    </Router>
  );
}

export default App;