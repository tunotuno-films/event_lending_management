    import React, { useState, useEffect } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { supabase, insertWithOwnerId } from '../lib/supabase';
    import { Barcode, StopCircle, X, AlertTriangle, Download, Upload, CheckCircle, Package } from 'lucide-react';
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

    interface Item {
    item_id: string;
    name: string;
    image: string | null;
    }

    const RegisterItem: React.FC<RegisterItemProps> = ({
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
    const [matchingItems, setMatchingItems] = useState<Item[]>([]);
    const [matchingItemsByName, setMatchingItemsByName] = useState<Item[]>([]);

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
            facingMode: 'environment'
        }
        }
    });

    const startScanning = () => {
        setScannerError(false);
        setIsScanning(true);
    };

    useEffect(() => {
        fetchExistingData();
    }, []);

    useEffect(() => {
        const wasReloaded = sessionStorage.getItem('pageWasReloaded');

        if (isAuthenticated && pendingSubmission) {
        const processPendingSubmission = async () => {
            await handleRegisterItem();
            setPendingSubmission(false);
        };

        processPendingSubmission();
        }

        const savedFormData = sessionStorage.getItem('pendingRegistrationData');
        const hasPendingData = sessionStorage.getItem('hasPendingRegistration');

        if (wasReloaded === 'true' && (!savedFormData || !hasPendingData)) {
        resetForm();
        sessionStorage.removeItem('pageWasReloaded');
        return;
        }

        if (wasReloaded === 'true') {
        sessionStorage.removeItem('pageWasReloaded');
        }

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
            }));

            if (parsedData.itemName) {
            setNotification({
                show: true,
                message: '入力データを復元しました。画像は再度選択してください。',
                type: 'success'
            });
            }

            if (isAuthenticated) {
            setPendingSubmission(true);
            }
        } catch (e) {
            console.error('Failed to parse saved form data:', e);
        }
        }
    }, [isAuthenticated]);

    useEffect(() => {
        const handleLoad = () => {
        sessionStorage.setItem('pageWasReloaded', 'false');
        };

        const handleBeforeUnload = () => {
        sessionStorage.setItem('pageWasReloaded', 'true');
        };

        window.addEventListener('load', handleLoad);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
        window.removeEventListener('load', handleLoad);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        const searchExistingItems = async () => {
        if (formData.barcode.trim() === '') {
            setMatchingItems([]);
            return;
        }
        try {
            const { data, error } = await supabase
            .from('items')
            .select('item_id, name, image')
            .ilike('item_id', `%${formData.barcode}%`)
            .eq('item_deleted', false)
            .limit(5);

            if (error) throw error;
            setMatchingItems(data || []);
        } catch (error) {
            console.error('Error searching existing items:', error);
            setMatchingItems([]);
        }
        };

        const debounceTimer = setTimeout(() => {
        searchExistingItems();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [formData.barcode]);

    useEffect(() => {
        const searchExistingItemsByName = async () => {
        if (formData.itemName.trim() === '') {
            setMatchingItemsByName([]);
            return;
        }
        try {
            const { data, error } = await supabase
            .from('items')
            .select('item_id, name, image')
            .ilike('name', `%${formData.itemName}%`)
            .eq('item_deleted', false)
            .limit(5);

            if (error) throw error;
            setMatchingItemsByName(data || []);
        } catch (error) {
            console.error('Error searching existing items by name:', error);
            setMatchingItemsByName([]);
        }
        };

        const debounceTimer = setTimeout(() => {
        searchExistingItemsByName();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [formData.itemName]);

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

        const reader = new FileReader();
        reader.onload = (event) => {
            setImagePreview(event.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
        }
    };

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

    const promptLogin = (message: string) => {
        if (setAuthModalMode && setIsAuthModalOpen) {
        alert(message);
        setAuthModalMode('signin');
        setIsAuthModalOpen(true);
        }
    };

    const handleRegisterItem = async () => {
        try {
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

        let publicUrl: string | null = null;

        if (formData.image) {
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

            const { data: urlData } = supabase.storage
            .from('items')
            .getPublicUrl(filePath);
            publicUrl = urlData?.publicUrl || null;
        }

        const finalGenre = formData.genre === 'その他' ? formData.customGenre : formData.genre;
        const finalManager = formData.manager === 'その他' ? formData.customManager : formData.manager;

        const { error: insertError } = await insertWithOwnerId(
            'items',
            {
            item_id: formData.barcode || null,
            name: formData.itemName,
            image: publicUrl,
            genre: finalGenre,
            manager: finalManager,
            registered_date: new Date().toISOString(),
            item_deleted: false
            }
        );

        if (insertError) {
            throw insertError;
        }

        setNotification({
            show: true,
            message: '登録が完了しました',
            type: 'success'
        });

        sessionStorage.removeItem('pendingRegistrationData');
        sessionStorage.removeItem('hasPendingRegistration');

        resetForm();

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated) {
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

        setNotification({
            show: true,
            message: 'ログイン後に登録を完了します。画像は再度選択する必要があります。',
            type: 'success'
        });

        if (setAuthModalMode && setIsAuthModalOpen) {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
        }

        return;
        }

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

            const items = rows
            .filter(row => row.trim())
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

    const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numericValue = e.target.value.replace(/[^0-9]/g, '');
        setFormData(prev => ({ ...prev, barcode: numericValue }));
    };

    const handleSelectSuggestion = (name: string) => {
        setFormData(prev => ({ ...prev, itemName: name }));
        setMatchingItemsByName([]);
        setNotification({
        show: true,
        message: '物品名を入力しました',
        type: 'success'
        });
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

        <div className="bg-white w-full p-6">
            <h2 className="text-xl font-semibold mb-6">物品登録</h2>

            <div className="mb-6 border p-4 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                バーコード
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
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

                <div className="w-full order-1 sm:order-2 relative">
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.barcode}
                    onChange={handleBarcodeInput}
                    className="w-full border border-gray-300 rounded-md p-2 flex-grow font-mono"
                    placeholder="スキャンするか手動で入力"
                    aria-label="バーコード入力"
                />
                <div className="absolute bottom-1 right-2 text-xs text-gray-500">
                    {formData.barcode.length}
                </div>
                </div>
            </div>

            {matchingItems.length > 0 && (
                <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold mb-2 text-orange-600 flex items-center">
                    <AlertTriangle size={16} className="inline mr-1" />
                    部分一致する登録済み物品:
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 bg-gray-50">
                    {matchingItems.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <div className="h-8 w-8 rounded overflow-hidden flex items-center justify-center bg-white border flex-shrink-0">
                            {item.image && item.image.trim() !== '' ? (
                            <img
                                src={item.image}
                                alt={item.name}
                                className="max-h-full max-w-full object-contain"
                            />
                            ) : (
                            <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                                <Package className="h-5 w-5 text-gray-400" />
                            </div>
                            )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-mono text-gray-700 truncate">{item.item_id}</span>
                            <span className="text-xs text-gray-500 truncate">{item.name}</span>
                        </div>
                        </div>
                    </div>
                    ))}
                </div>
                </div>
            )}

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
                画像
                </label>
                
                <div className="flex items-center gap-4">
                <div className="relative inline-block">
                    <div className="h-20 w-20 rounded-lg overflow-hidden flex items-center justify-center border bg-white">
                    {imagePreview ? (
                        <img 
                        src={imagePreview} 
                        alt="画像プレビュー" 
                        className="max-h-full max-w-full object-contain" 
                        />
                    ) : (
                        <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                        <Package className="h-10 w-10 text-gray-400" />
                        </div>
                    )}
                    </div>
                    {imagePreview && (
                    <button
                        type="button"
                        onClick={() => {
                        setImagePreview(null);
                        setFormData(prev => ({ ...prev, image: null }));
                        const fileInput = document.getElementById('image-upload') as HTMLInputElement;
                        if (fileInput) {
                            fileInput.value = '';
                        }
                        }}
                        className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm hover:bg-gray-100 border"
                        aria-label="プレビューを削除"
                    >
                        <X size={16} className="text-gray-600" />
                    </button>
                    )}
                </div>

                <div className="flex-1">
                    <input
                    id="image-upload"
                    type="file"
                    accept="image/jpeg, image/png, image/gif, image/webp"
                    onChange={handleImageChange}
                    className="w-full border border-gray-300 rounded-md p-2 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                </div>
                </div>
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
                {matchingItemsByName.length > 0 && (
                <div className="mt-2 border rounded-md p-2 bg-gray-50 max-h-40 overflow-y-auto">
                    <h4 className="text-xs font-semibold mb-1 text-gray-600">
                    既存の物品名候補:
                    </h4>
                    <div className="space-y-1">
                    {matchingItemsByName.map((item) => (
                        <div key={item.item_id} className="flex items-center justify-between bg-white p-1 rounded text-sm">
                        <span className="truncate mr-2">{item.name}</span>
                        <button
                            type="button"
                            onClick={() => handleSelectSuggestion(item.name)}
                            className="text-blue-500 hover:text-blue-700 p-1 rounded flex-shrink-0 text-xs font-semibold"
                            title="選択"
                        >
                            選択
                        </button>
                        </div>
                    ))}
                    </div>
                </div>
                )}
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

            <div className="flex flex-col sm:flex-row gap-4 pt-4 items-center">
                {isAuthenticated ? (
                <button
                    type="submit"
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center"
                >
                    <CheckCircle size={20} className="mr-2" />
                    <span>登録</span>
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
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center"
                >
                    <AlertTriangle size={20} className="mr-2" />
                    <span>登録するにはログインが必要です</span>
                </button>
                )}
                
                {isAuthenticated && (
                <>
                    <button
                    type="button"
                    onClick={() => setShowBulkUploadModal(true)}
                    className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center"
                    >
                    <Upload size={20} className="mr-2" />
                    <span>CSVから一括登録</span>
                    </button>
                    <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="w-full sm:w-auto ml-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center"
                    >
                    <Download size={20} className="mr-2" />
                    <span>CSVテンプレート</span>
                    </button>
                </>
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