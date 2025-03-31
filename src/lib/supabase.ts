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
export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
  },
  global: {
    headers: { 'x-timezone': 'Asia/Tokyo' },
  },
});

// サービスロールを使用する管理者用クライアント（使用しないこと）
// 注意: このクライアントはRLSをバイパスします
// export const adminSupabase = (serviceRoleKey?: string) => {
//   if (!serviceRoleKey) {
//     console.error('Service role key is required for admin operations');
//     return null;
//   }
//   return createClient(finalSupabaseUrl, serviceRoleKey, {
//     auth: {
//       persistSession: false,
//     },
//   });
// };

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
      
      // SQLを管理者権限で実行するためのエンドポイントを提案
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

// Google認証からのリダイレクト処理を修正
export const handleAuthRedirect = async () => {
  const { data, error } = await supabase.auth.getSession();
  
  // OAuthのリダイレクト処理
  // セッション確立を試みる
  try {
    // Supabaseの内部リダイレクト処理を実行（プラグイン等を起動する可能性あり）
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    // エラーログを出力（デバッグ用）
    if (authError) {
      console.error('Auth redirect error:', authError);
    }
    
    // URLからハッシュを削除（クリーンアップ）
    if (window.location.hash.includes('access_token') || 
        window.location.hash.includes('error') || 
        window.location.hash.includes('type=recovery')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    
    return { data: authData, error: authError };
  } catch (err) {
    console.error('Error handling redirect:', err);
    return { data, error: err as any };
  }
};

// RLS診断関数を修正してUUID型の所有者フィールドに対応
export const diagnoseSecurity = async (tableName: string) => {
  console.log(`Diagnosing RLS for ${tableName}...`);
  
  try {
    // 現在のユーザーを取得
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user?.email, 'User ID:', user?.id);
    
    if (!user) {
      console.error('No authenticated user found');
      return { success: false, error: 'No authenticated user' };
    }
    
    // テーブルからデータ取得を試みる
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(10);
    
    if (error) {
      console.error(`Error accessing ${tableName}:`, error);
      return { success: false, error };
    }
    
    console.log(`Successfully fetched ${data.length} records from ${tableName}`);
    
    // 所有者フィールドの名前とタイプを決定
    let ownerField = 'registered_by';
    let isUuid = false;
    
    // テーブル固有の設定
    if (tableName === 'items') {
      ownerField = 'registered_by';
      isUuid = false; // TEXTタイプ (メールアドレス)
    } else {
      ownerField = 'created_by';
      isUuid = true; // UUIDタイプ
    }
    
    // 所有者が一致するか確認する際の比較値
    const ownerValue = isUuid ? user.id : user.email;
    
    // データが存在するが所有者情報がない場合は警告
    const missingOwnerRecords = data.filter(record => !record[ownerField]);
    if (missingOwnerRecords.length > 0) {
      console.warn(`${missingOwnerRecords.length} records without owner information in ${tableName}`);
    }
    
    // 所有者が異なるレコード数
    const otherOwnerRecords = data.filter(record => 
      record[ownerField] && record[ownerField] !== ownerValue
    );
    
    if (otherOwnerRecords.length > 0) {
      console.warn(`Found ${otherOwnerRecords.length} records owned by others - RLS might not be working!`);
    }
    
    // 所有者が自分のレコード
    const ownRecords = data.filter(record => record[ownerField] === ownerValue);
    console.log(`Found ${ownRecords.length} records owned by current user`);
    
    // 診断情報をコンソールにテーブル形式で表示
    console.table({
      'tableName': tableName,
      'totalRecords': data.length,
      'ownerFieldType': isUuid ? 'UUID' : 'TEXT (Email)',
      'ownedByCurrentUser': ownRecords.length,
      'ownedByOthers': otherOwnerRecords.length,
      'withoutOwner': missingOwnerRecords.length
    });
    
    return { 
      success: true, 
      data,
      diagnostics: {
        currentUser: user.email,
        userId: user.id,
        ownerFieldType: isUuid ? 'UUID' : 'TEXT',
        recordsCount: data.length,
        ownRecordsCount: ownRecords.length,
        missingOwnerCount: missingOwnerRecords.length,
        otherOwnerCount: otherOwnerRecords.length
      }
    };
  } catch (error) {
    console.error(`Error during diagnosis:`, error);
    return { success: false, error };
  }
};

// ユーティリティ関数を追加

// 現在のユーザーメールアドレスを取得する関数
export const getCurrentUserEmail = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// ユーザーIDを取得する関数
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};

// テーブルに挿入するときに所有者フィールドを自動的に追加する関数
export const insertWithOwner = async (
  table: string,
  data: any | any[],
  options?: { userEmail?: string }
) => {
  try {
    const userEmail = options?.userEmail || await getCurrentUserEmail();
    
    if (!userEmail) {
      throw new Error('User not authenticated or email not available');
    }
    
    const ownerField = table === 'items' ? 'registered_by' : 'created_by';
    
    // 配列かどうかをチェック
    const isArray = Array.isArray(data);
    const dataWithOwner = isArray
      ? data.map(item => ({ ...item, [ownerField]: userEmail }))
      : { ...data, [ownerField]: userEmail };
    
    // 挿入操作を実行
    const result = await supabase.from(table).insert(dataWithOwner);
    
    if (result.error) {
      console.error(`Error inserting into ${table}:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`Error in insertWithOwner for ${table}:`, error);
    throw error;
  }
};

// UUID型の所有者フィールドを持つテーブルにデータを挿入するヘルパー関数
export const insertWithUuidOwner = async (
  table: string,
  data: any | any[],
  options?: { userId?: string }
) => {
  try {
    const userId = options?.userId || await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User not authenticated or ID not available');
    }
    
    // 配列かどうかをチェック
    const isArray = Array.isArray(data);
    const dataWithOwner = isArray
      ? data.map(item => ({ ...item, created_by: userId }))
      : { ...data, created_by: userId };
    
    // 挿入操作を実行
    const result = await supabase.from(table).insert(dataWithOwner);
    
    if (result.error) {
      console.error(`Error inserting into ${table}:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`Error in insertWithUuidOwner for ${table}:`, error);
    throw error;
  }
};

// itemsテーブルの制約を更新する関数
export const updateItemsTableConstraints = async () => {
  try {
    // Supabaseで実行するSQL
    const { error } = await supabase.rpc('update_items_constraints');
    
    if (error) {
      console.error('制約の更新時にエラーが発生しました:', error);
      
      // RPC関数が存在しない場合のSQLを提案
      const createRpcSQL = `
        -- この関数はitemsテーブルの制約を更新します
        CREATE OR REPLACE FUNCTION update_items_constraints()
        RETURNS void AS $$
        BEGIN
          -- まず既存のユニーク制約を削除（存在する場合）
          ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_id_key;
          
          -- registered_byとitem_idの組み合わせでユニーク制約を作成
          ALTER TABLE items ADD CONSTRAINT items_registered_by_item_id_key 
            UNIQUE (registered_by, item_id);
          
          -- item_deletedがfalseの場合のみ適用されるユニーク制約を追加
          CREATE UNIQUE INDEX IF NOT EXISTS idx_items_active_id 
            ON items (item_id) 
            WHERE item_deleted = false;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `;
      
      console.log('制約更新用のRPC関数を作成する必要があります:', createRpcSQL);
      alert('データベーステーブルの制約を更新する必要があります。管理者に連絡してください。');
      
      return { success: false, error: 'RPC function not available' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('制約の更新中にエラーが発生しました:', error);
    return { success: false, error };
  }
};