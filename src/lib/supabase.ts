import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// デバッグのために変数を出力
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key exists:', !!supabaseAnonKey);

// 環境変数が取得できなかった場合はフォールバック値を使用
const finalSupabaseUrl = supabaseUrl || 'https://iyibyeursmqyjuqfoxks.supabase.co';
const finalSupabaseAnonKey = supabaseAnonKey;

// Supabase client options
const options = {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-timezone': 'Asia/Tokyo' },
  },
  auth: {
    // Ensure auth persistence across sessions
    persistSession: true,
    // Store auth data in localStorage
    storage: window.localStorage,
    // Auto refresh token
    autoRefreshToken: true,
  },
};

// Create Supabase client with options
export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey, options);

// Helper function to check if Supabase is properly configured
export const checkSupabaseConfig = () => {
  if (!finalSupabaseUrl || !finalSupabaseAnonKey) {
    console.error('Supabase configuration is missing. Please check your environment variables.');
    return false;
  }
  return true;
};

// Helper function to initialize Supabase with new credentials
export const initializeSupabase = (url: string, key: string) => {
  return createClient(url, key, options);
};

// サポートテーブルを作成するRPC関数
export const createSupportTable = async () => {
  try {
    // サポート用のRPC関数を作成
    const { error: rpcError } = await supabase.rpc('create_support_table');
    
    if (rpcError) {
      // RPC関数が存在しない場合は、この関数を作成するSQLを実行
      const createRpcSQL = `
        CREATE OR REPLACE FUNCTION create_support_table()
        RETURNS void AS $$
        BEGIN
          -- Create support table
          CREATE TABLE IF NOT EXISTS _support (
            id SERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          -- Disable RLS for support table (admin only)
          ALTER TABLE _support DISABLE ROW LEVEL SECURITY;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `;
      
      // SQLを実行（実際にはここでは実行できないのでログだけ出力）
      console.log('Creating support table RPC function:', createRpcSQL);
      
      // SQLを管理者権限で実行するためのエンドポイントを呼び出す方法を提案
      alert('サポートテーブルの作成が必要です。管理者にお問い合わせください。');
      
      return { success: false, error: 'RPC function not available' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error creating support table:', error);
    return { success: false, error };
  }
};

// プロフィールテーブルを作成するRPC関数
export const createProfilesTable = async () => {
  try {
    // サポート用のRPC関数を作成
    const { error: rpcError } = await supabase.rpc('create_profiles_table');
    
    if (rpcError) {
      // RPC関数が存在しない場合は、この関数を作成するSQLを提案
      const createRpcSQL = `
        CREATE OR REPLACE FUNCTION create_profiles_table()
        RETURNS void AS $$
        BEGIN
          -- Create profiles table
          CREATE TABLE IF NOT EXISTS profiles (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            name TEXT,
            department TEXT,
            phone_number TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          -- Create index
          CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);
          
          -- Enable RLS
          ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
          
          -- Create policies
          CREATE POLICY "Users can view their own profile" ON profiles
            FOR SELECT USING (auth.uid() = user_id);
            
          CREATE POLICY "Users can update their own profile" ON profiles
            FOR UPDATE USING (auth.uid() = user_id);
            
          CREATE POLICY "Users can insert their own profile" ON profiles
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `;
      
      // SQLを実行（実際にはここでは実行できないのでログだけ出力）
      console.log('Creating profiles table RPC function:', createRpcSQL);
      
      // SQLを管理者権限で実行するためのエンドポイントを呼び出す方法を提案
      alert('プロフィールテーブルの作成が必要です。管理者にお問い合わせください。');
      
      return { success: false, error: 'RPC function not available' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error creating profiles table:', error);
    return { success: false, error };
  }
};

// 認証状態を確認する関数
export const checkUser = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return null;
  }
};

// サインイン関数
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { data };
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// サインアップ関数
export const signUp = async (email: string, password: string, name?: string, phoneNumber?: string) => {
  try {
    // ユーザー登録
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone_number: phoneNumber
        }
      }
    });
    
    if (error) throw error;
    return { data };
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// 日付をJST形式でフォーマットする関数
export const formatJSTDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Export configuration helper
export const exportSupabaseConfig = () => {
  return {
    url: finalSupabaseUrl,
    anonKey: finalSupabaseAnonKey,
    options
  };
};

// サポート関数：テーブルからデータを安全に取得
export const safelyFetchData = async (tableName: string, query = {}) => {
  try {
    console.log(`Fetching data from ${tableName}...`);
    const response = await supabase.from(tableName).select('*');
    
    if (response.error) {
      console.error(`Error fetching from ${tableName}:`, response.error);
      // RLSエラーの可能性をチェック
      if (response.error.code === '42501' || response.error.message.includes('permission denied')) {
        console.error('This appears to be an RLS policy error. You may need to adjust your RLS policies or sign in.');
      }
      return { data: null, error: response.error };
    }
    
    console.log(`Successfully fetched ${response.data?.length || 0} records from ${tableName}`);
    return response;
  } catch (error) {
    console.error(`Exception while fetching from ${tableName}:`, error);
    return { data: null, error };
  }
};

// Google認証からのリダイレクト処理を追加
export const handleAuthRedirect = async () => {
  const { data, error } = await supabase.auth.getSession();
  
  // URLからハッシュパラメータを取得
  const hashParams = window.location.hash;
  if (hashParams && (hashParams.includes('access_token') || hashParams.includes('error'))) {
    // セッション確立を試みる
    const { data, error } = await supabase.auth.getSession();
    
    // URLからハッシュを削除（クリーンアップ）
    window.history.replaceState(null, '', window.location.pathname);
    
    return { data, error };
  }
  
  return { data, error };
};