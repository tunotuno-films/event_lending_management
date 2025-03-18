// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// プロフィールデータの型
interface ProfileData {
  user_id: string
  name: string
  department: string
  phone_number: string
  updated_at: string
}

// 環境変数からSupabaseの接続情報を取得
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  // CORSヘッダー
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // CORS プリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // リクエストボディを解析
    const { profile } = await req.json() as { profile: ProfileData }
    
    if (!profile || !profile.user_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: profile or user_id missing' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // サービスロールで接続（管理者権限でDB操作を行う）
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // プロフィールテーブルの存在確認とその作成
    await ensureProfilesTable(supabase)
    
    // プロフィールが存在するか確認
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', profile.user_id)
      .maybeSingle()
    
    if (fetchError && !fetchError.message.includes('does not exist')) {
      return new Response(
        JSON.stringify({ error: `Error checking profile: ${fetchError.message}` }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    
    let result
    
    if (existingProfile) {
      // 既存のプロフィールを更新
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          department: profile.department,
          phone_number: profile.phone_number,
          updated_at: profile.updated_at || new Date().toISOString()
        })
        .eq('user_id', profile.user_id)
        .select()
      
      if (updateError) {
        return new Response(
          JSON.stringify({ error: `Error updating profile: ${updateError.message}` }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      
      result = { data, action: 'updated' }
    } else {
      // 新しいプロフィールを作成
      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert([{
          user_id: profile.user_id,
          name: profile.name,
          department: profile.department,
          phone_number: profile.phone_number,
          created_at: new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString()
        }])
        .select()
      
      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Error creating profile: ${insertError.message}` }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      
      result = { data, action: 'created' }
    }
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// プロフィールテーブルの存在を確認し、存在しない場合は作成する関数
async function ensureProfilesTable(supabase) {
  try {
    // テーブルのチェック
    const { error: checkError } = await supabase
      .from('profiles')
      .select('count(*)', { count: 'exact', head: true })
    
    // テーブルが存在しない場合は作成
    if (checkError && checkError.message.includes('does not exist')) {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS profiles (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          name TEXT,
          department TEXT,
          phone_number TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- インデックスの作成
        CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);
        
        -- RLSポリシーの設定
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
        
        -- 自分のプロファイルを操作するためのポリシー
        CREATE POLICY "Users can view their own profile" ON profiles
          FOR SELECT USING (auth.uid() = user_id);
          
        CREATE POLICY "Users can update their own profile" ON profiles
          FOR UPDATE USING (auth.uid() = user_id);
          
        CREATE POLICY "Users can insert their own profile" ON profiles
          FOR INSERT WITH CHECK (auth.uid() = user_id);
      `
      
      // スキーマを作成するためのRPCは必要ありません - サービスロールで直接実行します
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: createTableSQL
      })
      
      if (createError) {
        console.error('Error creating profiles table:', createError)
      }
    }
  } catch (error) {
    console.error('Error in ensureProfilesTable:', error)
  }
} 