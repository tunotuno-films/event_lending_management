import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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

// 型定義の修正
interface DashboardStats {
  itemsCount: number;
  eventsCount: number;
  activeLoansCount: number;
  completedLoansCount: number;
  totalUsers: number;
  pendingReturns: number;
  mostBorrowedItems: Array<{id: string, name: string, count: number}>;
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
  items?: {
    name?: string;
  } | null;
}

// コンポーネントの型定義に必要なpropsを追加
interface DashboardProps {
  setShowAuthModal?: (show: boolean) => void;
  setAuthMode?: (mode: 'signin' | 'signup') => void;
}

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
    
    // 認証状態の変更を監視するリスナーを追加
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // ログアウト時や認証状態の変更時に実行
        setIsAuthenticated(!!session);
        
        if (session) {
          // ログイン時
          fetchUserProfile();
          fetchDashboardData();
        } else {
          // ログアウト時
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

    // クリーンアップ関数でリスナーを解除
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 認証状態を確認
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticated = !!session;
      
      // 非認証時は最小限のデータのみ表示（またはデモデータを表示）
      if (!isAuthenticated) {
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
      const { count: itemsCount, error: itemsError } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true });
      
      // イベント総数を取得
      const { count: eventsCount, error: eventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_deleted', false);
      
      // アクティブな貸出数を取得
      const { count: activeLoansCount, error: activeLoansError } = await supabase
        .from('control')
        .select('*', { count: 'exact', head: true })
        .eq('status', true);
      
      // 完了済み貸出数を取得
      const { count: completedLoansCount, error: completedLoansError } = await supabase
        .from('result')
        .select('*', { count: 'exact', head: true })
        .not('end_datetime', 'is', null);
      
      // 要返却アイテム数を取得
      const { count: pendingReturns, error: pendingReturnsError } = await supabase
        .from('control')
        .select('*', { count: 'exact', head: true })
        .eq('status', true);
      
      // よく借りられるアイテムのTOP5を取得
      const { data: mostBorrowed, error: mostBorrowedError } = await supabase
        .from('result')
        .select(`
          item_id,
          items:item_id (name)
        `)
        .limit(100);
      
      let mostBorrowedItems: Array<{id: string, name: string, count: number}> = [];
      if (mostBorrowed) {
        // アイテムごとの貸出回数をカウント
        const itemCounts: Record<string, {count: number, name: string}> = {};
        (mostBorrowed as MostBorrowedItem[]).forEach(item => {
          const id = item.item_id;
          // 明示的な型アサーションとオプショナルチェーン
          const name = item.items?.name || '不明な物品';
          if (!itemCounts[id]) {
            itemCounts[id] = { count: 0, name };
          }
          itemCounts[id].count++;
        });
        
        // カウント数でソートして上位5件を取得
        mostBorrowedItems = Object.entries(itemCounts)
          .map(([id, { count, name }]) => ({ id, name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      }
      
      // 最近のアクティビティを取得 - 両方のアクティビティを表示するよう修正
      const { data: recentResults, error: recentResultsError } = await supabase
        .from('result')
        .select(`
          result_id,
          start_datetime,
          end_datetime,
          items:item_id (name),
          events:event_id (name)
        `)
        .order('start_datetime', { ascending: false })
        .limit(10); // 取得数を増やして加工後に絞り込む

      // nullチェックと型の安全な処理
      let recentActivity: Array<{id: number, action: string, item: string, time: string, user: string}> = [];

      if (recentResults) {
        // 貸出と返却を別々のアクティビティとして処理
        const activities: Array<{id: number, action: string, item: string, time: string, user: string}> = [];
        
        (recentResults as any[]).forEach(loan => {
          // 貸出アクティビティを追加
          activities.push({
            id: loan.result_id * 10, // ユニークIDを確保するため乗算
            action: '貸出',
            item: loan.items?.name || '不明な物品',
            time: new Date(loan.start_datetime).toLocaleString('ja-JP'),
            user: loan.events?.name || `未指定のイベント`
          });
          
          // 返却済みなら返却アクティビティも追加
          if (loan.end_datetime) {
            activities.push({
              id: loan.result_id * 10 + 1, // 貸出と区別するため+1
              action: '返却',
              item: loan.items?.name || '不明な物品',
              time: new Date(loan.end_datetime).toLocaleString('ja-JP'),
              user: loan.events?.name || `未指定のイベント`
            });
          }
        });
        
        // 日時で新しい順にソートして上位5件を取得
        recentActivity = activities
          .sort((a, b) => {
            const dateA = new Date(a.time);
            const dateB = new Date(b.time);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5);
      }
      
      // ユーザー数を取得
      // 実際のユーザー数取得ロジックに置き換える必要があります
      // 仮にSupabaseのユーザー数を取得
      const { count: totalUsers = 0 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      setStats({
        itemsCount: itemsCount || 0,
        eventsCount: eventsCount || 0,
        activeLoansCount: activeLoansCount || 0,
        completedLoansCount: completedLoansCount || 0,
        totalUsers: totalUsers || 0,
        pendingReturns: pendingReturns || 0,
        mostBorrowedItems,
        recentActivity
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ユーザープロフィール情報を取得する関数を追加
  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // ユーザー情報を設定
        setUserProfile({
          name: user.user_metadata?.name || 
                user.user_metadata?.full_name || 
                user.email?.split('@')[0] || 'ゲスト',
          email: user.email || '',
          avatar_url: user.user_metadata?.avatar_url || null
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー部分を修正：フレックスボックスの方向をスマホでは縦方向に */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">ダッシュボード</h1>
          
          {/* 認証済みの場合のみプロフィール情報を表示 */}
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
          
          {/* 非認証時にはログインプロモーションを表示 */}
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
            {/* 主要指標 - 認証済みユーザーにのみ表示 */}
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
                            <div className="text-2xl font-semibold text-gray-900">{stats.itemsCount}</div>
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
                            <div className="text-2xl font-semibold text-gray-900">{stats.eventsCount}</div>
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
                            <div className="text-2xl font-semibold text-gray-900">{stats.activeLoansCount}</div>
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
                            <div className="text-2xl font-semibold text-gray-900">{stats.completedLoansCount}</div>
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
            
            {/* 主な機能へのショートカット - 全てのユーザーに表示 */}
            <div className="bg-white shadow rounded-lg mb-8">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg font-medium text-gray-900">機能</h2>
              </div>
              <div className="border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 p-4">
                  {/* 1行目: 物品とイベント関連の5機能 */}
                  <Link to="/item/regist" className="flex flex-col items-center p-4 hover:bg-blue-50 rounded-lg transition-colors">
                    <Package className="h-8 w-8 text-blue-500 mb-2" />
                    <span className="text-sm text-gray-700">物品登録</span>
                  </Link>
                  
                  {/* 以下のボタンは未ログイン時にグレーアウト */}
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
                  
                  {/* 2行目: 貸出関連の3機能 */}
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
            
            {/* データ可視化セクション - 人気物品ランキングと最近のアクティビティ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* よく借りられる物品 - 常に表示 */}
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">人気物品ランキング</h2>
                  <BarChart2 className="h-6 w-6 text-gray-400" />
                </div>
                <div className="border-t border-gray-200">
                  {isAuthenticated && stats.mostBorrowedItems.length > 0 ? (
                    <div className="p-4 space-y-3">
                      {stats.mostBorrowedItems.map((item, index) => (
                        <div key={item.id} className="flex items-center py-2">
                          <div className="font-bold text-xl text-gray-400 w-8 text-center">{index + 1}</div>
                          <div className="ml-4 flex-1">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-500">貸出回数: {item.count}回</div>
                          </div>
                          <div className="flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {index === 0 ? '最も人気' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-500">
                      {isAuthenticated ? (
                        <>
                          <HelpCircle className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                          <p>貸出データがありません</p>
                        </>
                      ) : (
                        <>
                          <Lock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                          <p>ログインするとデータが表示されます</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
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
              
              {/* 最近のアクティビティ - 認証済みユーザーのみに表示 */}
              {isAuthenticated ? (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">最近のアクティビティ</h2>
                    <Clock className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="border-t border-gray-200">
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
                        ))}
                      </ul>
                    ) : (
                      <div className="py-12 text-center text-gray-500">
                        <HelpCircle className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p>アクティビティがありません</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link to="/loaning/log" className="font-medium text-blue-600 hover:text-blue-500 flex items-center">
                        すべての履歴を見る
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                // 未ログイン時の「最近のアクティビティ」カードのプレースホルダー
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">最近のアクティビティ</h2>
                    <Clock className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="border-t border-gray-200">
                    <div className="py-12 text-center text-gray-500">
                      <Lock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                      <p>ログインするとデータが表示されます</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
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