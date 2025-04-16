import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap'; // GSAPとElastic easeをインポート
import './DownloadButton.css'; // CSSスタイルをインポート

// 型定義
type ButtonStatus = 'idle' | 'loading' | 'done';

// Props の型定義を拡張
interface DownloadButtonProps {
    onAnimationComplete?: () => Promise<void>; // Promiseを返すように変更
    onDownloadComplete?: () => void; // ダウンロード完了時に呼び出すコールバック
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

// FC (Function Component) 型を使用し、Props を受け取る
const DownloadButton: React.FC<DownloadButtonProps> = ({ onAnimationComplete, onDownloadComplete }) => {
    const [status, setStatus] = useState<ButtonStatus>('idle');
    const [svgD, setSvgD] = useState<string>(getPath(20, 0));
    const buttonRef = useRef<HTMLAnchorElement>(null); // <a> 要素への参照
    const verticalLineRef = useRef<HTMLDivElement | null>(null); // 縦線要素への参照
    const svgPathStateRef = useRef<{ y: number; smoothing: number }>({ y: 20, smoothing: 0 });
    const animationRef = useRef<gsap.core.Timeline | null>(null); // GSAPタイムラインの参照
    const duration = 3000; // アニメーション時間 (ミリ秒)

    // CSS変数を設定
    useEffect(() => {
        if (buttonRef.current) {
            buttonRef.current.style.setProperty('--duration', `${duration}ms`);
        }
    }, [duration]);

    // ステータス変更時にアニメーションを制御
    useEffect(() => {
        if (status === 'loading') {
            if (animationRef.current) {
                animationRef.current.kill(); // 既存のアニメーションをキャンセル
            }

            svgPathStateRef.current = { y: 20, smoothing: 0 };
            setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing)); // 即時反映

            animationRef.current = gsap.timeline({
                onComplete: () => {
                    setStatus('done');
                    animationRef.current = null;

                    // 別の非同期関数を定義して呼び出す
                    const handleAnimationComplete = async () => {
                        // アニメーション完了時にコールバックを呼び出す
                        if (onAnimationComplete) {
                            try {
                                await onAnimationComplete(); // ダウンロード処理を待つ

                                // ダウンロード完了後のコールバックがあれば呼び出す
                                if (onDownloadComplete) {
                                    onDownloadComplete();
                                }

                                // ファイル保存ダイアログ操作終了を見越して自動リセット
                                // ダウンロード処理完了から一定時間後に初期状態に戻す
                                setTimeout(() => {
                                    setStatus('idle');
                                }, 1500); // 1.5秒後に自動リセット
                            } catch (error) {
                                console.error('ダウンロード中にエラーが発生しました:', error);
                                // エラーが発生した場合も自動リセット
                                setTimeout(() => {
                                    setStatus('idle');
                                }, 3000);
                            }
                        } else {
                            // onAnimationCompleteがない場合も自動リセット
                            setTimeout(() => {
                                setStatus('idle');
                            }, 3000);
                        }
                    };

                    // 非同期関数を呼び出す（結果を待たない）
                    handleAnimationComplete();
                }
            });

            // 1. Smoothing アニメーション
            animationRef.current.to(svgPathStateRef.current, {
                smoothing: 0.3,
                duration: duration * 0.065 / 1000,
                onUpdate: () => {
                    setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing));
                },
            });

            // 2. Y座標 アニメーション (Elastic Ease)
            animationRef.current.to(svgPathStateRef.current, {
                y: 12,
                duration: duration * 0.265 / 1000,
                ease: "elastic.out(1.12, 0.4)",
                onUpdate: () => {
                    setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing));
                },
            }, ">");

            // 3. 背景アニメーション - JavaScript DOM直接操作
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
                // 単一のアニメーションにして、onUpdateでリアルタイムに縦線の位置を計算
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

                // チェックマークへの変化タイミング調整
                const checkmarkTime = duration * 0.85 / 1000;

                // 4. チェックマークへの変化
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
                }, checkmarkTime);
            }

        } else if (status === 'idle') {
            if (animationRef.current) {
                animationRef.current.kill();
                animationRef.current = null;
            }

            // SVGを初期状態に戻す
            svgPathStateRef.current = { y: 20, smoothing: 0 };
            setSvgD(getPath(svgPathStateRef.current.y, svgPathStateRef.current.smoothing));

            // 背景と縦線要素を削除
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

                // SVGのopacityをリセット
                const svgPath = buttonDiv.querySelector('svg path');
                if (svgPath) {
                    (svgPath as HTMLElement).style.opacity = '1';
                }
            }
        }

        return () => {
            if (animationRef.current) {
                animationRef.current.kill();
            }
        };
    }, [status, duration, onAnimationComplete, onDownloadComplete]);

    const handleClick = (_e: React.MouseEvent<HTMLAnchorElement>) => {
        if (status === 'loading') {
            return;
        }

        // done状態でクリックした場合はidle状態に戻す
        if (status === 'done') {
            setStatus('idle');
            return;
        }

        if (status === 'idle') {
            setStatus('loading');
        }
    };

    const buttonClassName = `button ${status === 'loading' ? 'loading' : ''} ${status === 'done' ? 'done' : ''}`;

    return (
        <div className="download-button-container">
            <a
                href="#download"
                className={buttonClassName}
                onClick={handleClick}
                ref={buttonRef}
                aria-live="polite"
                aria-label={
                    status === 'idle' ? 'Download' :
                    status === 'loading' ? 'Downloading' : 'Open File'
                }
            >
                <ul>
                    <li>CSV ダウンロード</li>
                    <li>ダウンロード中</li>
                    <li>完了</li>
                </ul>
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