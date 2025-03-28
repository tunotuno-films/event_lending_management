import React, { useEffect, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthFormData {
  email: string;
  password: string;
  name?: string;
  phoneNumber?: string;
}

// AuthModalコンポーネントの型定義を修正
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (email: string, name?: string) => void;
  initialMode: 'signin' | 'signup';
  setMode: (mode: 'signin' | 'signup') => void; // 親コンポーネントのstate更新関数
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onAuthSuccess, 
  initialMode, 
  setMode
}) => {
  // 内部stateとしてのauthModeを削除し、propsから受け取ったinitialModeを使用
  const [authFormData, setAuthFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    name: '',
    phoneNumber: '',
  });

  // initialModeが変更されたらフォームをリセット
  useEffect(() => {
    setAuthFormData({
      email: '',
      password: '',
      name: '',
      phoneNumber: '',
    });
  }, [initialMode]);

  useEffect(() => {
    // ESCキーでモーダルを閉じられるようにする
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // メールアドレスの入力ハンドラ（英数字と一部の記号のみ許可）
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // メールアドレスで有効な文字のみを許可（英数字、@、ドット、アンダースコア、ハイフン）
    const filteredValue = value.replace(/[^\w@.-]/g, '');
    setAuthFormData(prev => ({ ...prev, email: filteredValue }));
  };

  // パスワードの入力ハンドラ（英数字と一部の記号のみ許可）
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // パスワードで有効な文字のみを許可（英数字と一般的な記号）
    const filteredValue = value.replace(/[^\w!@#$%^&*(),.?":{}|<>]/g, '');
    setAuthFormData(prev => ({ ...prev, password: filteredValue }));
  };

  // パスワードの強度を計算する関数
  const calculatePasswordStrength = (password: string): { strength: number; message: string } => {
    if (!password) {
      return { strength: 0, message: '' };
    }

    let score = 0;
    
    // 長さによるスコア
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // 文字種類によるスコア
    if (/[A-Z]/.test(password)) score += 1; // 大文字
    if (/[a-z]/.test(password)) score += 1; // 小文字
    if (/[0-9]/.test(password)) score += 1; // 数字
    if (/[^A-Za-z0-9]/.test(password)) score += 1; // 特殊文字
    
    // スコアを0-3の範囲に正規化
    const normalizedScore = Math.min(3, Math.floor(score / 2));
    
    // メッセージの設定
    let message = '';
    if (normalizedScore === 0) message = '弱いパスワード';
    else if (normalizedScore === 1) message = '普通のパスワード';
    else if (normalizedScore === 2) message = '強いパスワード';
    else message = '非常に強いパスワード';
    
    return { strength: normalizedScore, message };
  };

  // パスワードの強度を計算
  const passwordStrength = calculatePasswordStrength(authFormData.password);

  // Google認証ハンドラ
  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      
      if (error) throw error;
      onClose();
    } catch (error) {
      console.error('Google authentication error:', error);
      alert('Google認証エラーが発生しました');
    }
  };

  // 認証処理
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authFormData.email,
          password: authFormData.password,
        });

        if (error) throw error;
        
        // ユーザー名を取得
        const userName = data.user?.user_metadata?.name || 
                         data.user?.user_metadata?.full_name || 
                         data.user?.email?.split('@')[0] || 'ゲスト';
        onAuthSuccess(authFormData.email, userName);
        
      } else {
        // サインアップ処理
        const { data, error } = await supabase.auth.signUp({
          email: authFormData.email,
          password: authFormData.password,
          options: {
            data: {
              name: authFormData.name,
              phone: authFormData.phoneNumber
            }
          }
        });

        if (error) throw error;
        
        // 登録時は入力された名前を使用
        const userName = authFormData.name || 
                         data.user?.email?.split('@')[0] || 'ゲスト';
        onAuthSuccess(authFormData.email, userName);
      }
      
      onClose();
    } catch (error) {
      console.error('Authentication error:', error);
      alert('認証エラーが発生しました');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold">
              {initialMode === 'signin' ? 'ログイン' : '会員登録'}
            </h2>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* ソーシャルログインボタン */}
          <div className="space-y-4 mb-6 sm:mb-8">
            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 flex items-center justify-center gap-3 px-5 py-3 rounded-md transition duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-base">{initialMode === 'signin' ? 'Googleでログイン' : 'Googleで登録'}</span>
            </button>
          </div>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">または</span>
            </div>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={authFormData.email}
                onChange={handleEmailChange}
                className="w-full border border-gray-300 rounded-md p-3"
                required
                placeholder="example@email.com"
              />
              <p className="text-xs text-gray-500 mt-2">英数字と記号のみ入力できます</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                パスワード <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={authFormData.password}
                onChange={handlePasswordChange}
                className="w-full border border-gray-300 rounded-md p-3"
                required
                minLength={8}
              />
              
              {/* パスワード強度インジケーター */}
              {authFormData.password && initialMode === 'signup' && (
                <div className="mt-3">
                  <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        passwordStrength.strength === 0 ? 'w-1/3 bg-red-500' : 
                        passwordStrength.strength === 1 ? 'w-2/3 bg-yellow-500' : 
                        'w-full bg-green-500'
                      }`} 
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {passwordStrength.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    英数字と記号のみ入力できます（8文字以上）
                  </p>
                </div>
              )}
              {(!authFormData.password || initialMode === 'signin') && (
                <p className="text-xs text-gray-500 mt-2">英数字と記号のみ入力できます（8文字以上）</p>
              )}
            </div>
            
            {initialMode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={authFormData.name}
                    onChange={(e) => setAuthFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md p-3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    電話番号
                  </label>
                  <input
                    type="tel"
                    value={authFormData.phoneNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      const filteredValue = value.replace(/[^\d-]/g, '');
                      setAuthFormData(prev => ({ ...prev, phoneNumber: filteredValue }));
                    }}
                    pattern="[0-9\-]*"
                    inputMode="numeric"
                    className="w-full border border-gray-300 rounded-md p-3"
                    placeholder="090-1234-5678"
                  />
                  <p className="text-xs text-gray-500 mt-2">数字とハイフンのみ入力できます</p>
                </div>
              </>
            )}
            
            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-5 py-3 rounded-md flex items-center justify-center gap-2 text-base"
              >
                <Mail size={18} />
                {initialMode === 'signin' ? 'メールでログイン' : 'メールで登録'}
              </button>
            </div>
          </form>
          <div className="mt-6 text-center">
            <button
              onClick={() => setMode(initialMode === 'signin' ? 'signup' : 'signin')}
              className="text-blue-500 hover:text-blue-600 text-base"
            >
              {initialMode === 'signin' ? '会員登録はこちら' : 'ログインはこちら'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;