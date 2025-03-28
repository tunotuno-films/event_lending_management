    import React, { useState, useEffect } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { supabase } from '../lib/supabase';
    import { Barcode, StopCircle, X, AlertTriangle } from 'lucide-react';
    import Notification from './Notification';
    import { useZxing } from 'react-zxing';
    import BulkUploadModal from './BulkUploadModal';

    interface RegisterItemProps {
    userEmail?: string | null;
    isAuthenticated?: boolean;
    setAuthModalMode?: (mode: 'signin' | 'signup') => void;
    setIsAuthModalOpen?: (isOpen: boolean) => void;
    setCsvData?: (data: any[]) => void;
    }

    interface FormData {
    barcode: string;
    itemName: string;
    genre: string;
    customGenre: string;
    manager: string;
    customManager: string;
    image: File | null;
    }

    const RegisterItem: React.FC<RegisterItemProps> = ({
    userEmail,
    isAuthenticated = false,
    setAuthModalMode,
    setIsAuthModalOpen,
    setCsvData
    }) => {
    const navigate = useNavigate();
    const [isScanning, setIsScanning] = useState(false);
    const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
        show: false,
        message: '',
        type: 'success'
    });
    const [genres, setGenres] = useState<string[]>([]);
    const [managers, setManagers] = useState<string[]>([]);
    const [formData, setFormData] = useState<FormData>({
        barcode: '',
        itemName: '',
        genre: '',
        customGenre: '',
        manager: '',
        customManager: '',
        image: null
    });
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [scannerError, setScannerError] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [pendingSubmission, setPendingSubmission] = useState(false);

    // バーコードスキャナーの設定 - エラーハンドリングを追加
    const { ref } = useZxing({
        onDecodeResult(result) {
        setFormData(prev => ({ ...prev, barcode: result.getText() }));
        setIsScanning(false);
        },
        paused: !isScanning,
        onError: (error) => {
        console.error('Scanner error:', error);
        setScannerError(true);
        setNotification({
            show: true,
            message: 'カメラへのアクセスができませんでした。設定を確認してください。',
            type: 'error'
        });
        },
        constraints: {
        video: {
            facingMode: 'environment'  // 背面カメラを優先使用
        }
        }
    });

    // スキャン開始時にエラー状態をリセット
    const startScanning = () => {
        setScannerError(false);
        setIsScanning(true);
    };

    useEffect(() => {
        fetchExistingData();
    }, []);

    // useEffectの部分を修正
    useEffect(() => {
        // ページリロード検出用のフラグをチェック
        const wasReloaded = sessionStorage.getItem('pageWasReloaded');
        
        // 認証済みで、保留中のデータがある場合
        if (isAuthenticated && pendingSubmission) {
        // 保留中のフォーム送信を実行
        const processPendingSubmission = async () => {
            await handleRegisterItem();
            // 処理後にフラグをリセット
            setPendingSubmission(false);
        };
        
        processPendingSubmission();
        }
        
        // コンポーネントマウント時に保存データがあれば復元
        const savedFormData = sessionStorage.getItem('pendingRegistrationData');
        const hasPendingData = sessionStorage.getItem('hasPendingRegistration');
        
        // リロードされた場合でペンディングデータがなければフォームをリセット
        if (wasReloaded === 'true' && (!savedFormData || !hasPendingData)) {
        resetForm();
        sessionStorage.removeItem('pageWasReloaded');
        return;
        }
        
        // リロードされた場合でペンディングデータがある場合は処理を続ける
        if (wasReloaded === 'true') {
        sessionStorage.removeItem('pageWasReloaded');
        }
        
        // ログイン前の入力データがあれば復元（既存の機能）
        if (savedFormData && hasPendingData === 'true') {
        try {
            const parsedData = JSON.parse(savedFormData);
            setFormData(prevData => ({
            ...prevData,
            barcode: parsedData.barcode || '',
            itemName: parsedData.itemName || '',
            genre: parsedData.genre || '',
            customGenre: parsedData.customGenre || '',
            manager: parsedData.manager || '',
            customManager: parsedData.customManager || ''
            // 画像は復元できないのでnullのままにする
            }));
            
            // 画像以外のデータが復元された場合に通知
            if (parsedData.itemName) {
            setNotification({
                show: true,
                message: '入力データを復元しました。画像は再度選択してください。',
                type: 'success'
            });
            }
            
            // ログイン済みで保留中データがある場合はフラグをセット
            if (isAuthenticated) {
            setPendingSubmission(true);
            }
        } catch (e) {
            console.error('Failed to parse saved form data:', e);
        }
        }
    }, [isAuthenticated]); // isAuthenticatedの変更でチェック

    // ページリロード検出用のイベントリスナーを追加
    useEffect(() => {
        // ページ読み込み完了時にフラグをセット
        const handleLoad = () => {
        sessionStorage.setItem('pageWasReloaded', 'false');
        };
        
        // ページリロード前にフラグをセット
        const handleBeforeUnload = () => {
        sessionStorage.setItem('pageWasReloaded', 'true');
        };
        
        // イベントリスナーの登録
        window.addEventListener('load', handleLoad);
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // クリーンアップ
        return () => {
        window.removeEventListener('load', handleLoad);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    const fetchExistingData = async () => {
        try {
        const { data: items } = await supabase
            .from('items')
            .select('genre, manager')
            .eq('item_deleted', false);

        if (items) {
            const uniqueGenres = [...new Set(items.map(item => item.genre).filter(Boolean))];
            const uniqueManagers = [...new Set(items.map(item => item.manager).filter(Boolean))];
            setGenres(uniqueGenres);
            setManagers(uniqueManagers);
        }
        } catch (error) {
        console.error('Error fetching existing data:', error);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
        const selectedFile = e.target.files[0];
        setFormData(prev => ({ ...prev, image: selectedFile }));
        
        // 画像プレビューを作成
        const reader = new FileReader();
        reader.onload = (event) => {
            setImagePreview(event.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
        }
    };

    // リセット時にプレビューもクリア
    const resetForm = () => {
        setFormData({
        barcode: '',
        itemName: '',
        genre: '',
        customGenre: '',
        manager: '',
        customManager: '',
        image: null
        });
        setImagePreview(null);
        sessionStorage.removeItem('pendingRegistrationData');
        sessionStorage.removeItem('hasPendingRegistration');
    };

    // ログインを促す関数
    const promptLogin = (message: string) => {
        if (setAuthModalMode && setIsAuthModalOpen) {
        alert(message);
        setAuthModalMode('signin');
        setIsAuthModalOpen(true);
        }
    };

    const handleRegisterItem = async () => {
        if (!formData.image) {
        setNotification({
            show: true,
            message: '画像を選択してください',
            type: 'error'
        });
        return false;
        }

        try {
        // バーコードの重複チェック
        if (formData.barcode) {
            const { data: existingItem } = await supabase
            .from('items')
            .select('item_id')
            .eq('item_id', formData.barcode)
            .eq('item_deleted', false)
            .single();

            if (existingItem) {
            setNotification({
                show: true,
                message: '既にデータが登録されています',
                type: 'error'
            });
            return false;
            }
        }

        const file = formData.image;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('items')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('items')
            .getPublicUrl(filePath);

        const finalGenre = formData.genre === 'その他' ? formData.customGenre : formData.genre;
        const finalManager = formData.manager === 'その他' ? formData.customManager : formData.manager;

        // ユーザーIDを取得（UUIDを取得）
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user || !user.id) {
            setNotification({
            show: true,
            message: 'ユーザー情報が取得できません。再ログインしてください。',
            type: 'error'
            });
            return false;
        }

        // registered_byフィールドにはUUID型のユーザーIDを設定
        const { error: insertError } = await supabase
            .from('items')
            .insert({
            item_id: formData.barcode || null,
            name: formData.itemName,
            image: publicUrl,
            genre: finalGenre,
            manager: finalManager,
            registered_by: user.id, // メールアドレスではなくUUIDを使用
            registered_date: new Date().toISOString()
            });

        if (insertError) {
            throw insertError;
        }

        // 成功時の処理
        setNotification({
            show: true,
            message: '登録が完了しました',
            type: 'success'
        });

        // 保存済みデータを削除
        sessionStorage.removeItem('pendingRegistrationData');
        sessionStorage.removeItem('hasPendingRegistration');

        // フォームとプレビューをリセット
        resetForm();

        // 新しいデータを反映するために既存データを再取得
        fetchExistingData();
        
        return true;
        } catch (error) {
        console.error('Error submitting form:', error);
        setNotification({
            show: true,
            message: 'エラーが発生しました',
            type: 'error'
        });
        return false;
        }
    };

    // 登録処理
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 非ログイン状態ではデータを保存してログインモーダルを表示
        if (!isAuthenticated) {
        // 画像以外のデータをセッションストレージに保存
        const dataToSave = {
            barcode: formData.barcode,
            itemName: formData.itemName,
            genre: formData.genre,
            customGenre: formData.customGenre,
            manager: formData.manager,
            customManager: formData.customManager
        };
        
        sessionStorage.setItem('pendingRegistrationData', JSON.stringify(dataToSave));
        sessionStorage.setItem('hasPendingRegistration', 'true');
        
        // ユーザーに通知
        setNotification({
            show: true,
            message: 'ログイン後に登録を完了します。画像は再度選択する必要があります。',
            type: 'success'
        });
        
        // ログインモーダルを表示
        if (setAuthModalMode && setIsAuthModalOpen) {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
        }
        
        return;
        }

        // ログイン済みの場合は通常の登録処理
        await handleRegisterItem();
    };

    const handleBulkUpload = async (file: File) => {
        if (!isAuthenticated) {
        promptLogin('CSVで一括登録するにはログインしてください');
        return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const rows = text.split('\n');

            // Filter out empty rows and parse CSV
            const items = rows
            .filter(row => row.trim()) // Skip empty rows
            .map(row => {
                const [item_id, name, genre, manager] = row.split(',').map(field => field.trim());
                return {
                item_id: item_id || '',
                name: name || '',
                genre: genre || '',
                manager: manager || '',
                isValid: false,
                errors: []
                };
            });

            // Remove header row if it exists
            if (items.length > 0 && items[0].item_id === 'item_id') {
            items.shift();
            }

            if (setCsvData) {
            setCsvData(items);
            }
            setShowBulkUploadModal(false);
            navigate('/csv-validation');
        } catch (error) {
            console.error('Error parsing CSV:', error);
            setNotification({
            show: true,
            message: 'CSVファイルの解析中にエラーが発生しました',
            type: 'error'
            });
        }
        };
        reader.readAsText(file);
    };

    const downloadCsvTemplate = () => {
        const csvContent = "item_id,name,genre,manager\n4912345678984,サンプル商品,サンプルジャンル,サンプル管理者\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'sample.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 手動でバーコードを入力する - 数字のみの入力に制限
    const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        // 数字以外の文字を取り除く
        const numericValue = e.target.value.replace(/[^0-9]/g, '');
        setFormData(prev => ({ ...prev, barcode: numericValue }));
    };

    return (
        <>
        {notification.show && (
            <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(prev => ({ ...prev, show: false }))}
            />
        )}

        {/* 白い背景の範囲を限定するよう修正 */}
        <div className="bg-white w-full p-6"> {/* min-h-screen を削除 */}
            <h2 className="text-xl font-semibold mb-6">物品登録</h2>

            <div className="mb-6 border p-4 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                バーコード
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
                {/* ボタンを左側に移動 */}
                <button
                type="button"
                onClick={() => isScanning ? setIsScanning(false) : startScanning()}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md w-full sm:w-auto ${
                    isScanning
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white transition-colors whitespace-nowrap order-2 sm:order-1`}
                aria-live="polite"
                >
                {isScanning ? (
                    <>
                    <StopCircle size={20} />
                    スキャン停止
                    </>
                ) : (
                    <>
                    <Barcode size={20} />
                    スキャン開始
                    </>
                )}
                </button>
                
                {/* 入力フィールドを右側に移動 - 数字のみの入力に制限 */}
                <div className="w-full order-1 sm:order-2 relative">
                <input
                    type="text"
                    inputMode="numeric" // モバイルで数字キーボードを表示
                    pattern="[0-9]*" // 数字のみ許可
                    value={formData.barcode}
                    onChange={handleBarcodeInput}
                    className="w-full border border-gray-300 rounded-md p-2 flex-grow"
                    placeholder="スキャンするか手動で入力"
                    aria-label="バーコード入力"
                />
                {/* 桁数カウンターを右下に表示 */}
                <div className="absolute bottom-1 right-2 text-xs text-gray-500">
                    {formData.barcode.length}
                </div>
                </div>
            </div>

            {/* スキャナー表示エリア - 左寄せに変更 */}
            {isScanning && (
                <div className="relative w-full max-w-md aspect-video mb-4 rounded-lg overflow-hidden border-2 border-blue-500">
                {scannerError ? (
                    <div className="h-full w-full flex flex-col items-center justify-center bg-gray-100 p-4">
                    <AlertTriangle size={48} className="text-red-500 mb-2" />
                    <p className="text-red-500 font-medium text-center">カメラへのアクセスができませんでした</p>
                    <p className="text-sm text-gray-600 mt-2 text-center">ブラウザの設定でカメラのアクセス許可を確認してください</p>
                    <p className="text-sm text-gray-600 mt-1 text-center">または下のバーコード入力欄に手動で入力してください</p>
                    </div>
                ) : (
                    <video 
                    ref={ref as React.RefObject<HTMLVideoElement>} 
                    className="w-full h-full object-cover" 
                    />
                )}
                </div>
            )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700 mb-1">
                画像 <span className="text-red-500">*必須</span>
                </label>
                
                <div className="mb-2">
                <input
                    id="image-upload"
                    type="file"
                    accept="image/jpeg, image/png, image/gif, image/webp"
                    onChange={handleImageChange}
                    className="w-full border border-gray-300 rounded-md p-2 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    required
                />
                </div>
                
                {/* 画像プレビュー表示 - アスペクト比を維持するように修正 */}
                {imagePreview && (
                <div className="mt-2 relative inline-block">
                    <div className="relative bg-gray-100 border rounded-md p-2" style={{ maxWidth: '250px' }}>
                    <img 
                        src={imagePreview} 
                        alt="画像プレビュー" 
                        className="max-h-48 object-contain" // object-cover から object-contain に変更
                        style={{ maxWidth: '100%', display: 'block' }} // 幅を親要素に合わせつつ、高さは自動調整
                    />
                    </div>
                    <button
                    type="button"
                    onClick={() => {
                        setImagePreview(null);
                        setFormData(prev => ({ ...prev, image: null }));
                    }}
                    className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-sm hover:bg-gray-100"
                    aria-label="プレビューを削除"
                    >
                    <X size={16} className="text-gray-600" />
                    </button>
                </div>
                )}
            </div>

            <div>
                <label htmlFor="item-name" className="block text-sm font-medium text-gray-700 mb-1">
                物品名 <span className="text-red-500">*必須</span>
                </label>
                <input
                id="item-name"
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
                className="w-full border border-gray-300 rounded-md p-2"
                required
                />
            </div>

            <div>
                <label htmlFor="genre-select" className="block text-sm font-medium text-gray-700 mb-1">
                ジャンル <span className="text-red-500">*必須</span>
                </label>
                <select
                id="genre-select"
                value={formData.genre}
                onChange={(e) => setFormData(prev => ({ ...prev, genre: e.target.value }))}
                className="w-full border border-gray-300 rounded-md p-2 mb-2 bg-white"
                required
                >
                <option value="">選択してください</option>
                {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                ))}
                <option value="その他">その他 (自由入力)</option>
                </select>
                {formData.genre === 'その他' && (
                <input
                    type="text"
                    value={formData.customGenre}
                    onChange={(e) => setFormData(prev => ({ ...prev, customGenre: e.target.value }))}
                    placeholder="ジャンルを入力"
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                />
                )}
            </div>

            <div>
                <label htmlFor="manager-select" className="block text-sm font-medium text-gray-700 mb-1">
                管理者 <span className="text-red-500">*必須</span>
                </label>
                <select
                id="manager-select"
                value={formData.manager}
                onChange={(e) => setFormData(prev => ({ ...prev, manager: e.target.value }))}
                className="w-full border border-gray-300 rounded-md p-2 mb-2 bg-white"
                required
                >
                <option value="">選択してください</option>
                {managers.map(manager => (
                    <option key={manager} value={manager}>{manager}</option>
                ))}
                <option value="その他">その他 (自由入力)</option>
                </select>
                {formData.manager === 'その他' && (
                <input
                    type="text"
                    value={formData.customManager}
                    onChange={(e) => setFormData(prev => ({ ...prev, customManager: e.target.value }))}
                    placeholder="管理者名を入力"
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                />
                )}
            </div>

            {/* フォーム送信ボタン部分を条件分岐で修正 */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 items-center">
                {isAuthenticated ? (
                <button
                    type="submit"
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md flex items-center justify-center"
                >
                    <span>登録する</span>
                </button>
                ) : (
                <button
                    type="button"
                    onClick={() => {
                    if (setAuthModalMode && setIsAuthModalOpen) {
                        setAuthModalMode('signin');
                        setIsAuthModalOpen(true);
                    }
                    }}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md flex items-center justify-center"
                >
                    <span>登録するにはログインが必要です</span>
                </button>
                )}
                
                {/* バルクアップロードボタン（認証済みユーザーのみ表示） */}
                {isAuthenticated && (
                <button
                    type="button"
                    onClick={() => setShowBulkUploadModal(true)}
                    className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md flex items-center justify-center"
                >
                    <span>一括登録</span>
                </button>
                )}
            </div>
            </form> 
        </div>

        {showBulkUploadModal && (
            <BulkUploadModal
            onClose={() => setShowBulkUploadModal(false)}
            onUpload={handleBulkUpload}
            />
        )}
        </>
    );
    };

    export default RegisterItem;