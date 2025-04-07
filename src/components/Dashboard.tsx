import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, getCurrentUserId, formatJSTDateTime } from '../lib/supabase';
import { 
  Barcode, 
  LayoutList, 
  Calendar, 
  Shuffle, 
  History, 
  BarChart, 
  ChevronRight,
  Clock,
  Package,
  HelpCircle,
  BarChart2,
  User,
  ArrowUpRight, // 貸出用の新しいアイコン
  ArrowDownRight, // 返却用の新しいアイコン
  Lock, // ログインが必要な場合のアイコン
} from 'lucide-react';

// stats型定義の修正
interface DashboardStats {
  itemsCount: number;
  eventsCount: number;
  activeLoansCount: number;
  completedLoansCount: number;
  totalUsers: number;
  pendingReturns: number;
  mostBorrowedItems: Array<{id: string, name: string, image: string | null, count: number}>;
  recentActivity: Array<{id: number, action: string, item: string, time: string, user: string}>;
}

// ユーザー情報の型定義を追加
interface UserProfile {
  name: string;
  email: string;
  avatar_url: string | null;
}

// Supabaseのデータ型定義
interface ResultItem {
  result_id: number;
  start_datetime: string;
  end_datetime: string | null;
  item_id: string;
  event_id: string;
  item_id_ref?: number;
  event_id_ref?: number;
  items?: {
    name: string;
  } | null;
  events?: {
    name: string;
  } | null;
}

// mostBorrowed の型定義を追加
interface MostBorrowedItem {
  item_id: string;
  item_id_ref?: number;
  items?: {
    name?: string;
    image?: string;
  } | null;
}

// コンポーネントの型定義に必要なpropsを追加
interface DashboardProps {
  setShowAuthModal?: (show: boolean) => void;
  setAuthMode?: (mode: 'signin' | 'signup') => void;
}

// カウントアップアニメーション用のカスタムフック
function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const timeRef = useRef<number | null>(null);
  
  useEffect(() => {
    countRef.current = 0;
    setCount(0);
    
    if (end === 0) return;
    
    const startTime = Date.now();
    const step = () => {
      const currentTime = Date.now();
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      countRef.current = Math.floor(progress * end);
      setCount(countRef.current);
      
      if (progress < 1) {
        timeRef.current = requestAnimationFrame(step);
      } else {
        setCount(end); // 確実に最終値にする
      }
    };
    
    timeRef.current = requestAnimationFrame(step);
    
    return () => {
      if (timeRef.current) {
        cancelAnimationFrame(timeRef.current);
      }
    };
  }, [end, duration]);
  
  return count;
}

// アニメーション表示用のコンポーネント
const AnimatedCounter: React.FC<{value: number, duration?: number}> = ({ value, duration = 1000 }) => {
  const count = useCountUp(value, duration);
  return <>{count.toLocaleString()}</>;
};

// コンポーネント定義を修正
const Dashboard: React.FC<DashboardProps> = ({ setShowAuthModal, setAuthMode }) => {
  const [stats, setStats] = useState<DashboardStats>({
    itemsCount: 0,
    eventsCount: 0,
    activeLoansCount: 0,
    completedLoansCount: 0,
    totalUsers: 0,
    pendingReturns: 0,
    mostBorrowedItems: [],
    recentActivity: []
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    
    checkAuth();
    fetchDashboardData();
    fetchUserProfile();
    
    // 認証状態の変更を監視するリスナー
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (session) => {
        setIsAuthenticated(!!session);
        
        if (session) {
          fetchUserProfile();
          fetchDashboardData();
        } else {
          setUserProfile(null);
          setStats({
            itemsCount: 0,
            eventsCount: 0,
            activeLoansCount: 0,
            completedLoansCount: 0,
            totalUsers: 0,
            pendingReturns: 0,
            mostBorrowedItems: [],
            recentActivity: []
          });
        }
      }
    );

    // テーブル変更のリアルタイムサブスクリプションを追加
    const controlSubscription = supabase
      .channel('control-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'control' }, 
        () => {
          console.log('control table changed, refreshing dashboard data');
          fetchDashboardData();
        }
      )
      .subscribe();
      
    const resultSubscription = supabase
      .channel('result-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'result' }, 
        () => {
          console.log('result table changed, refreshing dashboard data');
          fetchDashboardData();
        }
      )
      .subscribe();

    // クリーンアップ関数でリスナーとサブスクリプションを解除
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
      
      controlSubscription.unsubscribe();
      resultSubscription.unsubscribe();
    };
  }, []); // 初回マウント時のみ実行

  useEffect(() => {
    if (isAuthenticated) {
      const refreshInterval = setInterval(() => {
        fetchDashboardData();
      }, 60000); // 1分ごとに更新
      return () => clearInterval(refreshInterval);
    }
  }, [isAuthenticated]);

  const fetchDashboardData = useCallback(async () => {
    try {
      // 認証チェック
      const userId = await getCurrentUserId();
      if (!isAuthenticated || !userId) {
        setStats({
          itemsCount: 0,
          eventsCount: 0,
          activeLoansCount: 0,
          completedLoansCount: 0,
          totalUsers: 0,
          pendingReturns: 0,
          mostBorrowedItems: [],
          recentActivity: []
        });
        setLoading(false);
        return;
      }
      
      // アイテム総数を取得
      const { count: itemsCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true });
      
      // イベント総数を取得
      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_deleted', false);
      
      // アクティブな貸出数を取得
      const { count: activeLoansCount } = await supabase
        .from('control')
        .select('*', { count: 'exact', head: true })
        .eq('status', true);
      
      // 完了済み貸出数を取得 - end_datetimeを使用
      const { count: completedLoansCount } = await supabase
        .from('result')
        .select('*', { count: 'exact', head: true })
        .not('end_datetime', 'is', null);
      
      // よく借りられるアイテムのTOP5を取得 - 正しいリレーションカラムを使用
      const { data: mostBorrowed, error: mostBorrowedError } = await supabase
        .from('result')
        .select(`
          item_id,
          items:item_id_ref(name, image)
        `)
        .limit(100);
      
      // 最近のアクティビティを取得 - 正しいリレーションカラムを使用
      const { data: recentResults, error: recentResultsError } = await supabase
        .from('result')
        .select(`
          result_id,
          start_datetime,
          end_datetime,
          item_id,
          event_id,
          items:item_id_ref(name),
          events:event_id_ref(name)
        `)
        .order('start_datetime', { ascending: true }) // 昇順で取得
        .limit(10) as { data: ResultItem[] | null, error: any };

      if (mostBorrowedError) {
        console.error('Error fetching most borrowed items:', mostBorrowedError);
        // リレーションに問題がある場合の修正案を表示
        console.log('Trying alternative query format for mostBorrowed...');
        // 構造の確認
        const { data: sampleResult } = await supabase
          .from('result')
          .select('*')
          .limit(1);
        console.log('Sample result record:', sampleResult);
      }

      if (recentResultsError) {
        console.error('Error fetching recent activities:', recentResultsError);
        // リレーションに問題がある場合の修正案を表示
        console.log('Trying alternative query format for recentResults...');
        // 構造の確認
        const { data: sampleResult } = await supabase
          .from('result')
          .select('*')
          .limit(1);
        console.log('Sample result record:', sampleResult);
      }

      // データ処理 - 正しいリレーションと構造を反映するよう修正
      let mostBorrowedItems: Array<{id: string, name: string, image: string, count: number}> = [];
      if (mostBorrowed) {
        const itemCounts: Record<string, {count: number, name: string, image: string | null}> = {};
        (mostBorrowed as MostBorrowedItem[]).forEach(item => {
          const id = item.item_id;
          // リレーショナルデータが正しい形式で取得できているか確認
          const name = item.items?.name || '不明な物品';
          const image = item.items?.image || null;
          
          if (!itemCounts[id]) {
            itemCounts[id] = { count: 0, name, image };
          }
          itemCounts[id].count++;
        });
        
        mostBorrowedItems = Object.entries(itemCounts)
          .map(([id, { count, name, image }]) => ({ 
            id, 
            name, 
            image: image || '', 
            count 
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      }
      
      let recentActivity: Array<{id: number, action: string, item: string, time: string, user: string}> = [];
      if (recentResults && recentResults.length > 0) {
        recentActivity = recentResults.map(result => {
          const actionType = result.end_datetime ? '返却' : '貸出';
          
          // リレーショナルデータの正しい構造を反映
          let itemName = '不明な物品';
          if (result.items) {
            // 配列の場合
            if (Array.isArray(result.items) && result.items.length > 0 && result.items[0]?.name) {
              itemName = result.items[0].name;
            } 
            // リレーショナル形式の場合
            else if (typeof result.items === 'object' && 'name' in result.items && typeof result.items.name === 'string') {
              itemName = result.items.name;
            }
          }
          
          let eventName = '不明なイベント';
          if (result.events) {
            if (Array.isArray(result.events) && result.events.length > 0 && result.events[0]?.name) {
              eventName = result.events[0].name;
            } else if (typeof result.events === 'object' && 'name' in result.events && typeof result.events.name === 'string') {
              eventName = result.events.name;
            }
          }
            
          return {
            id: result.result_id,
            action: actionType,
            item: itemName,
            time: formatJSTDateTime(actionType === '貸出' ? result.start_datetime : result.end_datetime),
            user: eventName
          };
        });
      }
      
      // プロファイル数を取得
      const { count: totalUsers = 0 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      // 返却待ちアイテム数
      const pendingReturns = activeLoansCount || 0;
      
      setStats({
        itemsCount: itemsCount || 0,
        eventsCount: eventsCount || 0,
        activeLoansCount: activeLoansCount || 0,
        completedLoansCount: completedLoansCount || 0,
        totalUsers: totalUsers || 0,
        pendingReturns: pendingReturns,
        mostBorrowedItems,
        recentActivity
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);
  
  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserProfile({
          name: user.user_metadata?.name || 
                user.user_metadata?.full_name || 
                user.email?.split('@')[0] || 'ゲスト',
          email: user.email || '',
          avatar_url: user.user_metadata?.avatar_url || null
        });
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };
  
  useEffect(() => {
    // 貸出・返却操作を監視するイベントリスナー
    const handleLoanStatusChange = () => {
      console.log('Loan status changed, refreshing dashboard');
      fetchDashboardData();
    };
  
    window.addEventListener('loan-status-changed', handleLoanStatusChange);
  
    return () => {
      window.removeEventListener('loan-status-changed', handleLoanStatusChange);
    };
  }, [fetchDashboardData]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">ダッシュボード</h1>
          
          {isAuthenticated && userProfile && (
            <div className="bg-white shadow rounded-lg p-4 flex items-center self-end sm:self-auto">
              <div className="mr-3">
                {userProfile.avatar_url ? (
                  <img 
                    src={userProfile.avatar_url} 
                    alt={userProfile.name} 
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-800">{userProfile.name}</p>
                <p className="text-xs text-gray-500">{userProfile.email}</p>
              </div>
              <Link to="/profile" className="ml-4 text-blue-600 hover:text-blue-800 text-sm">
                編集
              </Link>
            </div>
          )}
          
          {!isAuthenticated && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full sm:w-auto">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800">
                    ログインすると全ての機能が利用できます
                  </p>
                  <button
                    onClick={() => {
                      if (setAuthMode) setAuthMode('signin');
                      if (setShowAuthModal) setShowAuthModal(true);
                    }}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                  >
                    ログイン
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-blue-200 mb-2"></div>
              <div className="h-4 w-24 bg-blue-200 rounded"></div>
            </div>
          </div>
        ) : (
          <>
            {isAuthenticated && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                        <Package className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">登録物品数</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">
                              <AnimatedCounter value={stats.itemsCount} />
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link to="/item/list" className="font-medium text-blue-600 hover:text-blue-500 flex items-center">
                        物品一覧を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                        <Calendar className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">イベント数</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">
                              <AnimatedCounter value={stats.eventsCount} />
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link to="/event/list" className="font-medium text-indigo-600 hover:text-indigo-500 flex items-center">
                        イベント一覧を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                        <Barcode className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">貸出中アイテム</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">
                              <AnimatedCounter value={stats.activeLoansCount} />
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link to="/loaning/control" className="font-medium text-green-600 hover:text-green-500 flex items-center">
                        貸出管理へ
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                        <History className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">累計貸出回数</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">
                              <AnimatedCounter value={stats.completedLoansCount} />
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link to="/loaning/log" className="font-medium text-purple-600 hover:text-purple-500 flex items-center">
                        貸出履歴を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white shadow rounded-lg mb-8">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg font-medium text-gray-900">機能</h2>
              </div>
              <div className="border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 p-4">
                  <Link to="/item/regist" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                    <Package className="h-8 w-8 text-blue-500 mb-2" />
                    <span className="text-sm text-gray-700">物品登録</span>
                  </Link>
                  
                  {isAuthenticated ? (
                    <Link to="/item/list" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                      <LayoutList className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">物品一覧</span>
                    </Link>
                  ) : (
                    <div 
                      className="flex flex-col items-center p-4 rounded-lg cursor-not-allowed opacity-50"
                      onClick={() => {
                        if (setAuthMode) setAuthMode('signin');
                        if (setShowAuthModal) setShowAuthModal(true);
                      }}
                    >
                      <LayoutList className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">物品一覧</span>
                      <span className="text-xs text-red-500 mt-1">ログインが必要</span>
                    </div>
                  )}
                  
                  {isAuthenticated ? (
                    <Link to="/event/regist" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                      <Calendar className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">イベント登録</span>
                    </Link>
                  ) : (
                    <div 
                      className="flex flex-col items-center p-4 rounded-lg cursor-not-allowed opacity-50"
                      onClick={() => {
                        if (setAuthMode) setAuthMode('signin');
                        if (setShowAuthModal) setShowAuthModal(true);
                      }}
                    >
                      <Calendar className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">イベント登録</span>
                      <span className="text-xs text-red-500 mt-1">ログインが必要</span>
                    </div>
                  )}
                  
                  {isAuthenticated ? (
                    <Link to="/event/list" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                      <LayoutList className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">イベント一覧</span>
                    </Link>
                  ) : (
                    <div 
                      className="flex flex-col items-center p-4 rounded-lg cursor-not-allowed opacity-50"
                      onClick={() => {
                        if (setAuthMode) setAuthMode('signin');
                        if (setShowAuthModal) setShowAuthModal(true);
                      }}
                    >
                      <LayoutList className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">イベント一覧</span>
                      <span className="text-xs text-red-500 mt-1">ログインが必要</span>
                    </div>
                  )}
                  
                  {isAuthenticated ? (
                    <Link to="/event/daily" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                      <Shuffle className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">当日物品登録</span>
                    </Link>
                  ) : (
                    <div 
                      className="flex flex-col items-center p-4 rounded-lg cursor-not-allowed opacity-50"
                      onClick={() => {
                        if (setAuthMode) setAuthMode('signin');
                        if (setShowAuthModal) setShowAuthModal(true);
                      }}
                    >
                      <Shuffle className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">当日物品登録</span>
                      <span className="text-xs text-red-500 mt-1">ログインが必要</span>
                    </div>
                  )}
                  
                  {isAuthenticated ? (
                    <Link to="/loaning/control" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                      <Barcode className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">貸出管理</span>
                    </Link>
                  ) : (
                    <div 
                      className="flex flex-col items-center p-4 rounded-lg cursor-not-allowed opacity-50"
                      onClick={() => {
                        if (setAuthMode) setAuthMode('signin');
                        if (setShowAuthModal) setShowAuthModal(true);
                      }}
                    >
                      <Barcode className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">貸出管理</span>
                      <span className="text-xs text-red-500 mt-1">ログインが必要</span>
                    </div>
                  )}
                  
                  {isAuthenticated ? (
                    <Link to="/loaning/log" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                      <History className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">貸出履歴</span>
                    </Link>
                  ) : (
                    <div 
                      className="flex flex-col items-center p-4 rounded-lg cursor-not-allowed opacity-50"
                      onClick={() => {
                        if (setAuthMode) setAuthMode('signin');
                        if (setShowAuthModal) setShowAuthModal(true);
                      }}
                    >
                      <History className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">貸出履歴</span>
                      <span className="text-xs text-red-500 mt-1">ログインが必要</span>
                    </div>
                  )}
                  
                  {isAuthenticated ? (
                    <Link to="/loaning/statistics" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                      <BarChart className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">貸出統計</span>
                    </Link>
                  ) : (
                    <div 
                      className="flex flex-col items-center p-4 rounded-lg cursor-not-allowed opacity-50"
                      onClick={() => {
                        if (setAuthMode) setAuthMode('signin');
                        if (setShowAuthModal) setShowAuthModal(true);
                      }}
                    >
                      <BarChart className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-sm text-gray-700">貸出統計</span>
                      <span className="text-xs text-red-500 mt-1">ログインが必要</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">人気物品ランキング</h2>
                  <BarChart2 className="h-6 w-6 text-gray-400" />
                </div>
                <div className="border-t border-gray-200 flex-grow">
                  <div className="h-full">
                    {isAuthenticated && stats.mostBorrowedItems.length > 0 ? (
                      <div className="p-4 space-y-3">
                        {stats.mostBorrowedItems.map((item, index) => (
                          <div key={item.id} className="flex items-center py-2">
                            <div className="font-bold text-xl text-gray-400 w-10 text-center mr-2">
                              {index + 1}
                            </div>
                            
                            <div className="mx-3 h-12 w-12 flex-shrink-0 rounded-md overflow-hidden flex items-center justify-center bg-white">
                              {item.image ? (
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="max-h-full max-w-full object-contain" 
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-md bg-gray-50 flex items-center justify-center">
                                  <Package className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            
                            <div className="ml-3 flex-1">
                              <div className="font-medium text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-500">貸出回数: {item.count}回</div>
                            </div>
                            
                            {index === 0 ? (
                              <div className="flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                最も人気
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-60 py-12 text-center text-gray-500">
                        {isAuthenticated ? (
                          <>
                            <div className="flex flex-col items-center">
                              <HelpCircle className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                              <p>貸出データがありません</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-col items-center">
                              <Lock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                              <p>ログインするとデータが表示されます</p>
                              <button
                                onClick={() => {
                                  if (setAuthMode) setAuthMode('signin');
                                  if (setShowAuthModal) setShowAuthModal(true);
                                }}
                                className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                              >
                                ログイン
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6 mt-auto">
                  <div className="text-sm">
                    {isAuthenticated ? (
                      <Link to="/loaning/statistics" className="font-medium text-blue-600 hover:text-blue-500 flex items-center">
                        詳細な統計を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => {
                          if (setAuthMode) setAuthMode('signin');
                          if (setShowAuthModal) setShowAuthModal(true);
                        }}
                        className="font-medium text-blue-600 hover:text-blue-500 flex items-center opacity-75"
                      >
                        詳細な統計を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {isAuthenticated ? (
                <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">最近のアクティビティ</h2>
                    <Clock className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="border-t border-gray-200 flex-grow">
                    <div className="h-full">
                      {stats.recentActivity.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                          {stats.recentActivity.map((activity) => (
                            <li key={activity.id} className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                                    activity.action === '貸出' ? 'bg-green-100' : 'bg-orange-100'
                                  }`}>
                                    {activity.action === '貸出' ? (
                                      <ArrowUpRight className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <ArrowDownRight className="h-4 w-4 text-orange-500" />
                                    )}
                                  </div>
                                  <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900">{activity.item}</p>
                                    <p className="text-xs text-gray-500">
                                      {activity.action} - {activity.time} - {activity.user}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </li>
                          )).reverse()} {/* 下から貸出→返却の順番になるよう反転表示 */}
                        </ul>
                      ) : (
                        <div className="flex items-center justify-center h-60 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <HelpCircle className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                            <p>アクティビティがありません</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6 mt-auto">
                    <div className="text-sm">
                      <Link to="/loaning/log" className="font-medium text-blue-600 hover:text-blue-500 flex items-center">
                        すべての履歴を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">最近のアクティビティ</h2>
                    <Clock className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="border-t border-gray-200 flex-grow">
                    <div className="flex items-center justify-center h-60 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Lock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p>ログインするとデータが表示されます</p>
                        <button
                          onClick={() => {
                            if (setAuthMode) setAuthMode('signin');
                            if (setShowAuthModal) setShowAuthModal(true);
                          }}
                          className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                        >
                          ログイン
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6 mt-auto">
                    <div className="text-sm">
                      <button
                        onClick={() => {
                          if (setAuthMode) setAuthMode('signin');
                          if (setShowAuthModal) setShowAuthModal(true);
                        }}
                        className="font-medium text-blue-600 hover:text-blue-500 flex items-center opacity-75"
                      >
                        すべての履歴を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;