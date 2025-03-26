import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { supabase, checkUser, handleAuthRedirect } from './lib/supabase';
import Layout from './components/Layout';
import AuthLayout from './components/AuthLayout';
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
import RegisterItem from './components/RegisterItem';
import './index.css';

// インターフェースの定義（一部抜粋）
interface CsvItem {
  item_id: string;
  name: string;
  genre: string;
  manager: string;
  image?: string;
  isValid: boolean;
  errors: string[];
}

// AppContentsコンポーネントを作成して、ルーターの内部で実行される部分を分離
function AppContents() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CsvItem[]>([]);
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [welcomeUserName, setWelcomeUserName] = useState('');
  const [isWelcomeAnimationFading, setIsWelcomeAnimationFading] = useState(false);
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const location = useLocation(); // これは<Router>の中で実行される

  useEffect(() => {
    checkAuthStatus();
    handleRedirectAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || null);
      
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
      
      showWelcomeMessage();
    }
  };

  // 認証状態確認
  const checkAuthStatus = async () => {
    const session = await checkUser();
    setIsAuthenticated(!!session);
    setUserEmail(session?.user?.email || null);
    
    if (session?.user) {
      fetchUserProfile(session.user.id);
    }
  };

  // ユーザープロフィール画像取得
  const fetchUserProfile = async (userId: string) => {
    try {
      // Googleなどの外部認証から取得したプロフィール画像を優先
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.avatar_url || user?.user_metadata?.picture) {
        setUserProfileImage(
          user.user_metadata.avatar_url || user.user_metadata.picture
        );
        return;
      }
      
      // プロフィールテーブルから取得
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

  // ようこそアニメーション表示
  const showWelcomeMessage = () => {
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

  // 認証成功時の処理
  const handleAuthSuccess = (userName: string) => {
    setWelcomeUserName(userName);
    setIsAuthenticated(true);
    showWelcomeMessage();
  };

  return (
    <div>
      {/* ようこそアニメーション */}
      {showWelcomeAnimation && (
        <div className={`fixed inset-0 bg-blue-600 flex flex-col items-center justify-between z-[100] ${isWelcomeAnimationFading ? 'animate-fade-out' : ''}`}>
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
          <div className="flex-1 flex items-end pb-24">
            <div className="textWrapper">
              <p className="text">Loading...</p>
              <div className="invertbox"></div>
            </div>
          </div>
        </div>
      )}

      {/* 認証モーダル */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* 認証状態に応じたレイアウト */}
      {isAuthenticated ? (
        // 認証済みの場合は完全なレイアウトを表示
        <Layout
          isAuthenticated={isAuthenticated}
          setShowAuthModal={() => setIsAuthModalOpen(true)}
          setAuthMode={setAuthModalMode}
          userEmail={userEmail}
          setIsAuthenticated={setIsAuthenticated}
          userProfileImage={userProfileImage}
        >
          <Routes>
            <Route path="/" element={<RegisterItem userEmail={userEmail} isAuthenticated={true} />} />
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
      ) : (
        // 非認証時は簡易版のレイアウトを表示
        <AuthLayout
          setAuthModalMode={setAuthModalMode}
          setIsAuthModalOpen={setIsAuthModalOpen}
        >
          {location.pathname === '/' && (
            <RegisterItem 
              isAuthenticated={false}
              setAuthModalMode={setAuthModalMode}
              setIsAuthModalOpen={setIsAuthModalOpen}
            />
          )}
        </AuthLayout>
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