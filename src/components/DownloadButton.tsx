import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap'; // GSAPとElastic easeをインポート
import './DownloadButton.css'; // CSSスタイルをインポート

// 型定義
type ButtonStatus = 'idle' | 'loading' | 'done' | 'error';

// Props の型定義を拡張
interface DownloadButtonProps {
    // ダウンロード用データを非同期で生成し、データとファイル名を返す関数
    onGenerateData?: () => Promise<{ data: Blob | string, filename: string } | null>;
    idleText?: string; // アイドル状態のテキスト
    loadingText?: string; // ローディング状態のテキスト
    doneText?: string; // 完了状態のテキスト
    errorText?: string; // エラー時のテキスト
}

// SVGパスデータを生成する関数
const getPath = (y: number, smoothing: number): string => {
    // ポイント座標の型定義 (タプル)
    type Point = [number, number];

    const points: Point[] = [
        [4, 12],
        [12, y],
        [20, 12]
    ];

    // 制御点計算ヘルパー関数
    const cp = (current: Point, previous: Point | undefined, next: Point | undefined, reverse?: boolean): Point => {
        const p0 = previous || current;
        const n0 = next || current;
        const o = {
            length: Math.sqrt(Math.pow(n0[0] - p0[0], 2) + Math.pow(n0[1] - p0[1], 2)),
            angle: Math.atan2(n0[1] - p0[1], n0[0] - p0[0])
        };
        const angle = o.angle + (reverse ? Math.PI : 0);
        const length = o.length * smoothing;
        return [current[0] + Math.cos(angle) * length, current[1] + Math.sin(angle) * length];
    };

    const M: Point = points[0];
    const C: string[] = points.slice(1).map((point, i) => {
        const p = points[i]; // Previous point (index i in the original points array)
        const n = points[i + 2]; // Next point

        const cps = cp(p, points[i - 1], point, false); // Control point start
        const cpe = cp(point, p, n, true); // Control point end
        return `C ${cps[0]},${cps[1]} ${cpe[0]},${cpe[1]} ${point[0]},${point[1]}`;
    });

    return `M ${M[0]},${M[1]} ${C.join(' ')}`;
};

// チェックマークのパスデータ
const checkmarkPathData = "M 3,14 C 3,14 6,17 8,19 C 12,23 21,6 21,6";
const errorPathData = "M 6,6 L 18,18 M 18,6 L 6,18"; // Simple X for error

// FC (Function Component) 型を使用し、Props を受け取る
const DownloadButton: React.FC<DownloadButtonProps> = ({
    onGenerateData,
    idleText = "CSV ダウンロード", // デフォルト値
    loadingText = "ダウンロード中", // デフォルト値
    doneText = "完了", // デフォルト値
    errorText = "エラー" // エラーテキストのデフォルト
}) => {
    const [status, setStatus] = useState<ButtonStatus>('idle');
    const [svgD, setSvgD] = useState<string>(getPath(20, 0));
    const buttonRef = useRef<HTMLAnchorElement>(null); // <a> 要素への参照
    const svgPathStateRef = useRef<{ y: number; smoothing: number }>({ y: 20, smoothing: 0 });
    const animationRef = useRef<gsap.core.Timeline | null>(null); // GSAPタイムラインの参照
    const duration = 2000; // Shorter duration might be better now
    const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout ref for error state
    const verticalLineRef = useRef<HTMLDivElement | null>(null); // 縦線要素への参照

    // アニメーション完了通知用のPromiseを管理するRef
    const animationCompletePromiseRef = useRef<{
        promise: Promise<void> | null;
        resolve: (() => void) | null;
    }>({
        promise: null,
        resolve: null
    });

    // CSS変数を設定
    useEffect(() => {
        if (buttonRef.current) {
            buttonRef.current.style.setProperty('--duration', `${duration}ms`);
        }
    }, [duration]);

    // ステータス変更時にアニメーションを制御
    useEffect(() => {
        // Clear error timeout when status changes from error
        if (status !== 'error' && errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current);
            errorTimeoutRef.current = null;
        }

        if (status === 'loading') {
            if (animationRef.current) {
                animationRef.current.kill();
            }

            // アニメーション完了通知用の新しいPromiseを作成
            const completePromise = new Promise<void>((resolve) => {
                animationCompletePromiseRef.current.resolve = resolve;
            });
            animationCompletePromiseRef.current.promise = completePromise;

            svgPathStateRef.current = { y: 20, smoothing: 0 };
            setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing));

            animationRef.current = gsap.timeline({
                onComplete: () => {
                    // アニメーション完了時にPromiseをresolve
                    if (animationCompletePromiseRef.current.resolve) {
                        animationCompletePromiseRef.current.resolve();
                    }
                    animationRef.current = null;
                }
            });

            // --- Loading Animation ---
            // 1. Smoothing
            animationRef.current.to(svgPathStateRef.current, {
                smoothing: 0.3,
                duration: duration * 0.065 / 1000, // 参考コードのタイミングを使用
                onUpdate: () => setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing)),
            });
            
            // 2. Y coordinate animation
            animationRef.current.to(svgPathStateRef.current, {
                y: 12,
                duration: duration * 0.265 / 1000, // 参考コードのタイミングを使用
                ease: "elastic.out(1.12, 0.4)",
                onUpdate: () => setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing)),
            }, ">");

            // 3. 背景アニメーション - JavaScript DOM直接操作（参考コードから追加）
            const buttonDiv = buttonRef.current?.querySelector('div') as HTMLDivElement;
            if (buttonDiv) {
                // 疑似要素を操作するためのスタイル設定
                gsap.set(buttonDiv, { position: 'relative', overflow: 'hidden' });

                // 背景要素を直接作成（疑似要素の代わり）
                const bgDiv = document.createElement('div');
                bgDiv.className = 'bg-fill-element';
                bgDiv.style.position = 'absolute';
                bgDiv.style.width = '100%';
                bgDiv.style.height = '100%';
                bgDiv.style.top = '0';
                bgDiv.style.left = '0';
                bgDiv.style.backgroundColor = 'var(--success, #5c81f1)';
                bgDiv.style.transformOrigin = '50% 0';
                bgDiv.style.transform = 'scaleY(0)';
                bgDiv.style.borderRadius = '0 0 30px 30px';
                bgDiv.style.zIndex = '0';

                // 縦線要素を作成
                const lineDiv = document.createElement('div');
                lineDiv.className = 'vertical-line-element';
                lineDiv.style.position = 'absolute';
                lineDiv.style.width = '2px'; // 線の太さ
                lineDiv.style.height = '14px'; // 線の長さ
                lineDiv.style.backgroundColor = 'var(--arrow, white)';
                lineDiv.style.left = '50%';
                lineDiv.style.marginLeft = '-1px'; // 中央揃え
                lineDiv.style.top = '0';
                lineDiv.style.opacity = '0'; // 初期状態は非表示
                lineDiv.style.zIndex = '1'; // 背景より上、SVGより下
                lineDiv.style.transformOrigin = '50% 0'; // 上部を基点に

                // 既存の要素があれば削除
                const existingBg = buttonDiv.querySelector('.bg-fill-element');
                if (existingBg) {
                    buttonDiv.removeChild(existingBg);
                }

                const existingLine = buttonDiv.querySelector('.vertical-line-element');
                if (existingLine) {
                    buttonDiv.removeChild(existingLine);
                }

                buttonDiv.appendChild(bgDiv);
                buttonDiv.appendChild(lineDiv);

                verticalLineRef.current = lineDiv;

                // 元の矢印を非表示にする
                animationRef.current.to(buttonDiv.querySelector('svg path'), {
                    opacity: 0,
                    duration: duration * 0.1 / 1000,
                    ease: "power1.out"
                }, duration * 0.1 / 1000);

                // アニメーションを一つのタイムラインにまとめて同期させる
                const fillAnimation = gsap.timeline();

                // 背景と縦線の初期位置設定
                fillAnimation.set(bgDiv, { scaleY: 0 });
                fillAnimation.set(lineDiv, { opacity: 0, top: '0px' });

                // 1. 最初に背景を少しだけ表示し、縦線も表示
                fillAnimation.to(bgDiv, {
                    scaleY: 0.05,
                    duration: 0.2,
                    ease: "power1.out",
                    onUpdate: function() {
                        // 背景のscaleYを取得して縦線の位置を正確に更新
                        const currentScaleY = gsap.getProperty(bgDiv, "scaleY") as number;
                        const lineTop = (buttonDiv.offsetHeight * currentScaleY) - 7;
                        lineDiv.style.top = `${lineTop}px`;
                    }
                }, 0);

                fillAnimation.to(lineDiv, {
                    opacity: 1,
                    duration: 0.2,
                    ease: "power1.out"
                }, 0); // 同時に開始

                // 2. 背景と縦線を完全に同期させながらアニメーション
                fillAnimation.to(bgDiv, {
                    scaleY: 1,
                    borderRadius: '0px',
                    duration: 1.2, // 少し長めに
                    ease: "power1.out",
                    onUpdate: function() {
                        // 毎フレーム背景のscaleYを取得して縦線の位置を計算
                        const currentScaleY = gsap.getProperty(bgDiv, "scaleY") as number;
                        const progress = (currentScaleY - 0.05) / 0.95; // 0～1の進行度

                        // 現在の丸みを計算
                        const currentBorderRadius = 30 * (1 - progress);
                        bgDiv.style.borderRadius = `0 0 ${currentBorderRadius}px ${currentBorderRadius}px`;

                        // 縦線の位置を計算（背景の下端に正確に配置）
                        const lineTop = (buttonDiv.offsetHeight * currentScaleY) - 7;
                        lineDiv.style.top = `${lineTop}px`;
                    }
                }, 0.2);

                // 3. 完了時に縦線を非表示に
                fillAnimation.to(lineDiv, {
                    opacity: 0,
                    duration: 0.2
                }, 1.3);

                // タイムラインをメインアニメーションに追加
                animationRef.current.add(fillAnimation, duration * 0.15 / 1000);
            }

            // 4. Transition to checkmark
            animationRef.current.add(() => {
                setSvgD(checkmarkPathData);
                // SVGを表示
                if (buttonRef.current) {
                    const svgPath = buttonRef.current.querySelector('svg path');
                    if (svgPath) {
                        gsap.to(svgPath, {
                            opacity: 1,
                            duration: 0.2
                        });
                    }
                }
            }, duration * 0.85 / 1000); // チェックマークは後半で表示

        } else if (status === 'idle') {
            // Reset SVG to initial arrow path when idle
            if (animationRef.current) animationRef.current.kill();
            svgPathStateRef.current = { y: 20, smoothing: 0 };
            setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing));
            
            // 背景と縦線要素を削除（参考コードから追加）
            const buttonDiv = buttonRef.current?.querySelector('div') as HTMLDivElement;
            if (buttonDiv) {
                const existingBg = buttonDiv.querySelector('.bg-fill-element');
                if (existingBg) {
                    buttonDiv.removeChild(existingBg);
                }

                const existingLine = buttonDiv.querySelector('.vertical-line-element');
                if (existingLine) {
                    buttonDiv.removeChild(existingLine);
                }
            }
            
            // Ensure SVG is visible
            if (buttonRef.current) {
                const svgPath = buttonRef.current.querySelector('svg path');
                if (svgPath) gsap.set(svgPath, { opacity: 1 });
            }
        } else if (status === 'error') {
            // Set SVG to error cross
            if (animationRef.current) animationRef.current.kill();
            setSvgD(errorPathData);
            // Ensure SVG is visible
            if (buttonRef.current) {
                const svgPath = buttonRef.current.querySelector('svg path');
                if (svgPath) gsap.set(svgPath, { opacity: 1 });
            }
            // Automatically reset from 'error' after a longer delay
            if (!errorTimeoutRef.current) {
                errorTimeoutRef.current = setTimeout(() => {
                    setStatus('idle');
                    errorTimeoutRef.current = null;
                }, 3000);
            }
        } else if (status === 'done') {
            // Ensure checkmark is visible
            if (buttonRef.current) {
                const svgPath = buttonRef.current.querySelector('svg path');
                if (svgPath) {
                    setSvgD(checkmarkPathData); // Ensure it's the checkmark
                    gsap.set(svgPath, { opacity: 1 });
                }
            }
            // Automatically reset from 'done' after a delay
            setTimeout(() => {
                // タイマー発火時に強制的に idle に戻す
                setStatus('idle');
            }, 1500);
        }

        // Cleanup GSAP animation and error timeout on unmount or status change
        return () => {
            if (animationRef.current) {
                animationRef.current.kill();
            }
            if (errorTimeoutRef.current) {
                clearTimeout(errorTimeoutRef.current);
            }
            // Promiseの解決も処理
            if (animationCompletePromiseRef.current.resolve) {
                animationCompletePromiseRef.current.resolve();
                animationCompletePromiseRef.current.promise = null;
                animationCompletePromiseRef.current.resolve = null;
            }
        };
        // Dependency array needs careful consideration
    }, [status, duration]); // duration も依存配列に追加

    const handleClick = async (_e: React.MouseEvent<HTMLAnchorElement>) => {
        _e.preventDefault();

        if (status === 'loading' || status === 'error') {
            return;
        }

        if (status === 'done') {
            setStatus('idle');
            return;
        }

        if (!onGenerateData) {
            console.error('onGenerateData prop is missing!');
            setStatus('error');
            return;
        }

        // 1. Start loading animation immediately by setting status
        setStatus('loading');

        try {
            // 2. Generate data while animation is playing
            const result = await onGenerateData();

            // 3. データ生成完了後、アニメーションの完了を待機
            // PromiseRef経由でアニメーションの完了を確実に待機
            if (animationCompletePromiseRef.current.promise) {
                await animationCompletePromiseRef.current.promise;
            } else {
                // アニメーションが既に完了している場合は少し待機
                // (チェックマークが表示されるのを確実に見せるため)
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 4. Check result and trigger download AFTER animation is completely done
            if (result) {
                const { data, filename } = result;
                const link = document.createElement('a');
                let objectUrl: string | null = null;

                if (data instanceof Blob) {
                    objectUrl = URL.createObjectURL(data);
                    link.href = objectUrl;
                } else {
                    link.href = data;
                }

                link.download = filename;
                document.body.appendChild(link);
                link.click(); // Download dialog appears here, after animation
                document.body.removeChild(link);

                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }

                // 5. Set status to 'done' AFTER download trigger
                setStatus('done');

            } else {
                // onGenerateData returned null, treat as error
                console.error('Data generation failed or returned null.');
                // Ensure animation is stopped if it was running but didn't complete
                animationRef.current?.kill();
                setStatus('error');
            }
        } catch (error) {
            console.error('Error during data generation or download trigger:', error);
            // Ensure animation is stopped on error
            animationRef.current?.kill();
            // 6. Set status to 'error' on failure
            setStatus('error');
        } finally {
            // クリーンアップ: Promiseの参照をリセット
            animationCompletePromiseRef.current.promise = null;
            animationCompletePromiseRef.current.resolve = null;
        }
    };

    // Determine current text based on status
    let currentText = idleText;
    if (status === 'loading') currentText = loadingText;
    else if (status === 'done') currentText = doneText;
    else if (status === 'error') currentText = errorText;

    const buttonClassName = `button ${status}`;

    return (
        <div className="download-button-container">
            <a
                href="#" // Prevent navigation
                className={buttonClassName}
                onClick={handleClick}
                ref={buttonRef}
                aria-live="polite"
                aria-label={currentText}
            >
                <ul> 
                    <li style={{ opacity: status === 'idle' ? 1 : 0 }}>{idleText}</li>
                    <li style={{ opacity: status === 'loading' ? 1 : 0 }}>{loadingText}</li>
                    <li style={{ opacity: status === 'done' ? 1 : 0 }}>{doneText}</li>
                    <li style={{ opacity: status === 'error' ? 1 : 0 }}>{errorText}</li>
                </ul>
                {/* Simplified div structure for icon */}
                <div>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d={svgD} />
                    </svg>
                </div>
            </a>
        </div>
    );
};

export default DownloadButton;