import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// 明示的にローカルストレージをクリアする関数
export const clearAuthCache = () => {
  // Supabase関連のローカルストレージエントリをクリア
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sb-') || key.includes('supabase')) {
      localStorage.removeItem(key);
    }
  });
};

interface ProfileProps {
  userEmail: string | null;
}

const Profile: React.FC<ProfileProps> = ({ userEmail }) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  useEffect(() => {
    fetchUserProfile();
  }, [userEmail]);

  const fetchUserProfile = async () => {
    if (!userEmail) return;
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user) {
        const userMetadata = user.user_metadata || {};
        setName(userMetadata.name || '');
        setPhoneNumber(userMetadata.phone_number || '');
        const url = userMetadata.avatar_url || userMetadata.picture;
        setAvatarUrl(url || null);
      }
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const filteredValue = value.replace(/[^\d-]/g, '');
    setPhoneNumber(filteredValue);
  };

  const validateInput = () => {
    const digitCount = phoneNumber.replace(/-/g, '').length;
    if (phoneNumber && digitCount < 7) {
      setNotification({
        show: true,
        message: '電話番号は最低7桁の数字が必要です',
        type: 'error'
      });
      return false;
    }
    return true;
  };

  const updateUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;
    if (!validateInput()) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ユーザーが見つかりません');
      const metadata = {
        name,
        phone_number: phoneNumber
      };
      const { error } = await supabase.auth.updateUser({ data: metadata });
      if (error) throw error;
      setNotification({
        show: true,
        message: 'プロフィールが更新されました',
        type: 'success'
      });
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 3000);
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      setNotification({
        show: true,
        message: `プロフィールの更新に失敗しました: ${error?.message || '不明なエラー'}`,
        type: 'error'
      });
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">プロフィール設定</h1>
      
      {/* プロフィール画像の表示 */}
      {avatarUrl && (
        <div className="flex justify-start mb-4">
          <img 
            src={avatarUrl} 
            alt="Profile" 
            className="w-24 h-24 rounded-full object-cover" 
          />
        </div>
      )}
      
      {notification.show && (
        <div className={`mb-4 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {notification.message}
        </div>
      )}
      
      <form onSubmit={updateUserProfile} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            type="email"
            value={userEmail || ''}
            disabled
            className="w-full border border-gray-300 rounded-md p-2 bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">メールアドレスは変更できません</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            名前
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            電話番号
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            pattern="[0-9\-]*"
            inputMode="numeric"
            className="w-full border border-gray-300 rounded-md p-2"
            placeholder="090-1234-5678"
          />
          <p className="text-xs text-gray-500 mt-1">数字とハイフンのみ入力できます</p>
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? '更新中...' : 'プロフィールを更新'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;