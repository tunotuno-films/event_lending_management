import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// デバッグのために変数を出力
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key exists:', !!supabaseAnonKey);

// 環境変数が取得できなかった場合はフォールバック値を使用 (本番環境では推奨しません)
const finalSupabaseUrl = supabaseUrl || 'YOUR_FALLBACK_SUPABASE_URL'; // ここに実際のフォールバックURLを設定してください
const finalSupabaseAnonKey = supabaseAnonKey || 'YOUR_FALLBACK_SUPABASE_ANON_KEY'; // ここに実際のフォールバックキーを設定してください

// Supabase client options
const options = {
  db: {
    schema: "public" as const,
  },
  global: {
    headers: { 'x-timezone': 'Asia/Tokyo' },
  },
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined, // サーバーサイドレンダリング考慮
    autoRefreshToken: true,
    detectSessionInUrl: true, // OAuthコールバック用
  },
};

// Create Supabase client with options
export const supabase: SupabaseClient = createClient(finalSupabaseUrl, finalSupabaseAnonKey, options);

// サービスロールを使用する管理者用クライアント（通常はクライアントサイドで使用しないこと）
// export const adminSupabase = (serviceRoleKey?: string): SupabaseClient | null => { ... };

// Helper function to check if Supabase is properly configured
export const checkSupabaseConfig = (): boolean => {
  if (!finalSupabaseUrl || finalSupabaseUrl === 'YOUR_FALLBACK_SUPABASE_URL' ||
      !finalSupabaseAnonKey || finalSupabaseAnonKey === 'YOUR_FALLBACK_SUPABASE_ANON_KEY') {
    console.error(
      'Supabase configuration is missing or using fallback values. ' +
      'Please check your environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).'
    );
    return false;
  }
  return true;
};

// Helper function to initialize Supabase with new credentials (あまり使わないかも)
export const initializeSupabase = (url: string, key: string): SupabaseClient => {
  return createClient(url, key, options);
};

// サポートテーブルを作成するRPC関数 (変更なし)
export const createSupportTable = async () => {
  try {
    const { error: rpcError } = await supabase.rpc('create_support_table');
    if (rpcError) {
      const createRpcSQL = `...`; // (省略)
      console.log('Creating support table RPC function:', createRpcSQL);
      alert('サポートテーブルの作成が必要です。管理者にお問い合わせください。');
      return { success: false, error: 'RPC function not available' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error creating support table:', error);
    return { success: false, error };
  }
};

// プロフィールテーブルを作成するRPC関数 (変更なし)
export const createProfilesTable = async () => {
  try {
    const { error: rpcError } = await supabase.rpc('create_profiles_table');
    if (rpcError) {
      const createRpcSQL = `...`; // (省略 - RLSポリシーは UUID(user_id) ベースが前提)
      console.log('Creating profiles table RPC function:', createRpcSQL);
      alert('プロフィールテーブルの作成が必要です。管理者にお問い合わせください。');
      return { success: false, error: 'RPC function not available' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error creating profiles table:', error);
    return { success: false, error };
  }
};

// 認証状態を確認する関数 (変更なし)
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

// サインイン関数 (変更なし)
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
    throw error; // エラーを呼び出し元に伝える
  }
};

// サインアップ関数 (変更なし)
export const signUp = async (email: string, password: string, name?: string, phoneNumber?: string) => {
  try {
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

// 日付をJST形式でフォーマットする関数 (変更なし)
export const formatJSTDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return 'Invalid Date';
  }
};

// Export configuration helper (変更なし)
export const exportSupabaseConfig = () => {
  return {
    url: finalSupabaseUrl,
    anonKey: finalSupabaseAnonKey,
    options
  };
};

// サポート関数：テーブルからデータを安全に取得 (変更なし、RLSに依存)
export const safelyFetchData = async (tableName: string) => {
  try {
    console.log(`Fetching data from ${tableName}...`);
    const response = await supabase.from(tableName).select('*');

    if (response.error) {
      console.error(`Error fetching from ${tableName}:`, response.error);
      if (response.status === 401 || response.status === 403 || response.error.message.includes('permission denied')) {
        console.error('RLS policy error. Check RLS policies or if the user is logged in.');
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

// Google認証などOAuthからのリダイレクト処理 (修正なし)
export const handleAuthRedirect = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) { console.error('Auth redirect error during getSession:', error); }
    if (typeof window !== 'undefined' &&
        (window.location.hash.includes('access_token'))) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return { data: { session }, error };
  } catch (err) {
    console.error('Exception during handleAuthRedirect:', err);
    return { data: { session: null }, error: err as any };
  }
};

// --- RLS診断関数 (UUIDベース、所有者カラム指定可能、型アサーションで修正) ---
export const diagnoseSecurity = async (tableName: string, ownerColumnInput?: string) => {
  // テーブルに応じたデフォルトの所有者カラム名
  let defaultOwnerColumn: string;
  switch (tableName) {
    case 'items': defaultOwnerColumn = 'registered_by'; break;
    case 'events': case 'control': case 'result': defaultOwnerColumn = 'created_by'; break;
    case 'profiles': defaultOwnerColumn = 'user_id'; break;
    default: console.warn(`Unknown table "${tableName}" for owner column diagnosis. Defaulting to 'created_by'.`); defaultOwnerColumn = 'created_by'; break;
  }
  const ownerColumn = ownerColumnInput || defaultOwnerColumn;

  console.log(`Diagnosing RLS for ${tableName} using owner column '${ownerColumn}'...`);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    console.log('Current user ID:', currentUserId);

    if (!currentUserId) {
      console.error('No authenticated user found for diagnosis.');
      return { success: false, error: 'No authenticated user' };
    }

    // データ取得試行
    const { data, error } = await supabase
      .from(tableName)
      .select(`*, ${ownerColumn}`)
      .limit(10);

    if (error) {
      console.error(`Error accessing ${tableName} as authenticated user (${currentUserId}):`, error);
      if (error.code === '42501' || error.message.includes('permission denied')) {
         console.error('RLS Policy Error: Access denied. Check SELECT policy.');
      }
      return { success: false, error };
    }

    console.log(`Successfully fetched ${data?.length || 0} records from ${tableName} as user ${currentUserId}`);
    if (!data || data.length === 0) {
        console.log('No records found.');
        // 空でも診断情報はある程度返す
        return {
          success: true,
          data: [],
          diagnostics: {
            currentUserId: currentUserId,
            ownerColumn: ownerColumn,
            recordsFetched: 0,
            ownRecordsCount: 0,
            otherOwnerCount: 0,
            missingOwnerCount: 0
          }
        };
    }

    // 所有者情報の診断 (UUIDで比較) - 型アサーションを使用
    const missingOwnerRecords = data.filter(record => {
        if (!record) return false;
        return !(record as Record<string, any>)[ownerColumn];
    });
    const otherOwnerRecords = data.filter(record => {
        if (!record) return false;
        const rec = record as Record<string, any>;
        return rec[ownerColumn] !== undefined && rec[ownerColumn] !== null && rec[ownerColumn] !== currentUserId;
    });
    const ownRecords = data.filter(record => {
        if (!record) return false;
        const rec = record as Record<string, any>;
        return rec[ownerColumn] === currentUserId;
    });

    // 結果表示の部分を修正 - オプショナルチェイニングと型アサーション
    if (otherOwnerRecords.length > 0) {
      console.warn(`[RLS DIAGNOSIS] CRITICAL: Found ${otherOwnerRecords.length} records owned by others! RLS SELECT policy is likely NOT working correctly.`);
      const firstOtherRecord = otherOwnerRecords[0] ? otherOwnerRecords[0] as Record<string, any> : undefined;
      console.log('Sample record from another owner:', firstOtherRecord);
      const sampleOwnerId = firstOtherRecord?.[ownerColumn] ?? 'unknown';
      console.log(`Current User ID: ${currentUserId}, Record Owner ID: ${sampleOwnerId}`);
    } else {
      console.log(`[RLS DIAGNOSIS] OK: No records owned by others were fetched (within limit).`);
    }
    if (missingOwnerRecords.length > 0) {
       console.warn(`[RLS DIAGNOSIS] ${missingOwnerRecords.length} records found without owner information ('${ownerColumn}').`);
       const firstMissingRecord = missingOwnerRecords[0] ? missingOwnerRecords[0] as Record<string, any> : undefined;
       if (firstMissingRecord) {
         console.log('Sample record missing owner:', firstMissingRecord);
       }
    }
    console.log(`[RLS DIAGNOSIS] Found ${ownRecords.length} records owned by the current user.`);
    console.table({
      'Table': tableName,
      'Owner Column': ownerColumn,
      'Owner Type': 'UUID',
      'Fetched': data.length,
      'Owned by Current User': ownRecords.length,
      'Owned by Others (Problem!)': otherOwnerRecords.length,
      'Missing Owner (Potential Problem)': missingOwnerRecords.length,
    });

    return {
      success: otherOwnerRecords.length === 0,
      data,
      diagnostics: {
        currentUserId: currentUserId,
        ownerColumn: ownerColumn,
        recordsFetched: data.length,
        ownRecordsCount: ownRecords.length,
        otherOwnerCount: otherOwnerRecords.length,
        missingOwnerCount: missingOwnerRecords.length
      }
    };

  } catch (error) {
      console.error(`Error during diagnosis for ${tableName}:`, error);
      return { success: false, error };
  }
};

// --- ユーティリティ関数 ---

// 現在のユーザーID (UUID) を取得する関数 (変更なし)
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) { console.error('Error getting session:', error); return null; }
    return session?.user?.id || null;
  } catch (error) {
    console.error('Exception getting current user ID:', error);
    return null;
  }
};

// 現在のユーザーメールアドレスを取得する関数 (変更なし)
export const getCurrentUserEmail = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.email || null;
  } catch (error) {
    console.error('Error getting current user email:', error);
    return null;
  }
};

// --- 汎用的な UUID 所有者付き挿入関数 ---
export const insertWithOwnerId = async (
  table: string,
  data: any | any[],
  options?: { userId?: string; ownerColumn?: string }
) => {
  try {
    const userId = options?.userId || await getCurrentUserId();
    if (!userId) { throw new Error('User not authenticated or user ID could not be retrieved.'); }

    let defaultOwnerColumn: string;
    switch (table) {
      case 'items': defaultOwnerColumn = 'registered_by'; break;
      case 'events': case 'control': case 'result': defaultOwnerColumn = 'created_by'; break;
      case 'profiles': defaultOwnerColumn = 'user_id'; break;
      default: console.warn(`Unknown table "${table}" for owner column. Defaulting to 'created_by'.`); defaultOwnerColumn = 'created_by'; break;
    }
    const ownerColumn = options?.ownerColumn || defaultOwnerColumn;

    const isArray = Array.isArray(data);
    const dataWithOwner = isArray
      ? data.map(item => ({ ...item, [ownerColumn]: userId }))
      : { ...data, [ownerColumn]: userId };

    console.log(`Attempting to insert into ${table} with owner (${ownerColumn} = ${userId.substring(0,8)}...)`);

    const result = await supabase.from(table).insert(dataWithOwner).select();

    if (result.error) {
      console.error(`Error inserting into ${table}:`, result.error);
      if (result.error.message.includes('check constraint') || result.error.message.includes('policy violation')) {
         console.error('Potential RLS policy violation during insert.');
      }
    } else {
       console.log(`Successfully inserted ${result.data?.length || 0} record(s) into ${table}.`);
    }
    return result;
  } catch (error) {
    console.error(`Exception caught in insertWithOwnerId for table ${table}:`, error);
    return { data: null, error };
  }
};

// -- updateItemsTableConstraints 関数は削除されました --