import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, checkUser, handleAuthRedirect, diagnoseSecurity } from './lib/supabase';

// コンポーネントのインポート
import Layout from './components/Layout';
import AuthModal from './components/AuthModal';
import ItemList from './components/ItemList';
import EventRegist from './components/EventRegist';
import EventList from './components/EventList';
import EventDaily from './components/EventDaily';
import LoaningControl from './components/LoaningControl';
import LoaningLog from './components/LoaningLog';
import LoaningStatistics from './components/LoaningStatistics';
import CsvValidation from './components/CsvValidation';
import Profile from './components/Profile';
import ItemRegist from './components/ItemRegist';
import Dashboard from './components/Dashboard';
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

  // ユーザーが認証されたときに実行する関数
  const diagnoseDataAccess = async () => {
    if (isAuthenticated) {
      // 各テーブルの診断を実行
      const itemsDiagnosis = await diagnoseSecurity('items');
      const eventsDiagnosis = await diagnoseSecurity('events');
      const controlDiagnosis = await diagnoseSecurity('control');
      const resultDiagnosis = await diagnoseSecurity('result');
      
      console.log('Diagnosis Results:', {
        items: itemsDiagnosis,
        events: eventsDiagnosis,
        control: controlDiagnosis,
        result: resultDiagnosis
      });
      
      // データが空の場合、アクセス権限の問題か、データがないかをチェック
      if (itemsDiagnosis.success && itemsDiagnosis.data?.length === 0) {
        console.log('No items records found. This could be due to RLS policy or empty table.');
      }
    }
  };

  // 認証状態を確認する副作用
  useEffect(() => {
    const checkAuthStatus = async () => {
      const session = await checkUser();
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || null);
      
      // アイコン画像の初期化（リセット）
      setUserProfileImage(null);
      
      // プロフィール画像があれば設定（Google認証など）
      if (session?.user?.user_metadata?.avatar_url) {
        setUserProfileImage(session.user.user_metadata.avatar_url);
      }
      
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
      
      // ログアウト時やセッション変更時にアイコンをリセット
      if (!sessionExists) {
        setUserProfileImage(null);
      } else if (session?.user?.user_metadata?.avatar_url) {
        // Google認証などの場合、プロフィール画像を設定
        setUserProfileImage(session.user.user_metadata.avatar_url);
      } else {
        // 通常のメールアドレス認証の場合、プロフィール画像をリセット
        setUserProfileImage(null);
      }
      
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

  // 認証状態変化時にデータアクセス診断を実行
  useEffect(() => {
    if (isAuthenticated) {
      diagnoseDataAccess();
    }
  }, [isAuthenticated]);

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
              <span className="text-5xl font-bold text-white">{welcomeUserName}</span>
              <span className="text-5xl font-bold text-white">さん</span>
            </div>
            <div className="flex flex-col items-center sm:hidden">
              <span className="text-4xl font-bold text-white mb-2">ようこそ</span>
              <span className="text-4xl font-bold text-white">{welcomeUserName}</span>
              <span className="text-4xl font-bold text-white">さん</span>
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
            <Route path="/" element={<Dashboard />} /> {/* ホーム（ダッシュボード） */}
            
            {/* 物品管理カテゴリのパス変更 */}
            <Route path="/item/regist" element={
              <ItemRegist
                userEmail={userEmail}
                isAuthenticated={true}
                setAuthModalMode={setAuthModalMode}
                setIsAuthModalOpen={setIsAuthModalOpen}
                setCsvData={setCsvData}
              />
            } />
            <Route path="/item/list" element={<ItemList />} />
            
            {/* イベントカテゴリのパス変更 */}
            <Route path="/event/regist" element={<EventRegist />} />
            <Route path="/event/list" element={<EventList />} />
            <Route path="/event/daily" element={<EventDaily />} />
            
            {/* 貸出管理カテゴリのパス変更 */}
            <Route path="/loaning/control" element={<LoaningControl />} />
            <Route path="/loaning/log" element={<LoaningLog />} />
            <Route path="/loaning/statistics" element={<LoaningStatistics />} />
            
            {/* その他のパスは変更なし */}
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
        // 非認証ユーザー向け - こちらも必要ならパス変更
        <Layout
          isAuthenticated={false}
          setShowAuthModal={setIsAuthModalOpen}
          setAuthMode={setAuthModalMode}
        >
          <Routes>
            <Route path="/" element={
              <ItemRegist
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