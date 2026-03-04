'use client';

import { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

declare global {
    interface Window {
        adsbygoogle: Record<string, unknown>[];
    }
}

const AD_COOLDOWN_KEY = 'interstitial_ad_last_shown';
const AD_COOLDOWN_MS = 30 * 60 * 1000; // 30分に1回

export function InterstitialAd() {
    const [isVisible, setIsVisible] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const [canClose, setCanClose] = useState(false);

    useEffect(() => {
        // クールダウンチェック（30分以内に見せていたらスキップ）
        const lastShown = localStorage.getItem(AD_COOLDOWN_KEY);
        if (lastShown && Date.now() - parseInt(lastShown, 10) < AD_COOLDOWN_MS) {
            return;
        }

        // 0.5秒後に表示（ページロード直後の急すぎる表示を避ける）
        const showTimer = setTimeout(() => {
            setIsVisible(true);
            localStorage.setItem(AD_COOLDOWN_KEY, String(Date.now()));
        }, 500);

        return () => clearTimeout(showTimer);
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        if (countdown <= 0) {
            setCanClose(true);
            return;
        }

        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [isVisible, countdown]);

    const handleClose = () => {
        if (!canClose) return;
        setIsVisible(false);
    };

    const adPushed = useRef(false);
    useEffect(() => {
        if (!isVisible || adPushed.current) return;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            adPushed.current = true;
        } catch (e) {
            // AdSense not loaded yet
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
        >
            {/* 広告コンテナ */}
            <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl">

                {/* 閉じるボタン */}
                <button
                    id="interstitial-close-btn"
                    onClick={handleClose}
                    aria-label="広告を閉じる"
                    className={[
                        'absolute top-2 right-2 z-10 flex items-center justify-center',
                        'w-7 h-7 rounded-full text-xs font-bold transition-all duration-200',
                        canClose
                            ? 'bg-white/90 text-black hover:bg-white cursor-pointer shadow-md'
                            : 'bg-zinc-600/80 text-zinc-400 cursor-not-allowed',
                    ].join(' ')}
                >
                    {canClose ? (
                        <X size={14} strokeWidth={3} />
                    ) : (
                        <span>{countdown}</span>
                    )}
                </button>

                {/* 広告エリア ── ここにGoogle AdSenseコードなどを貼る */}
                <div
                    id="interstitial-ad-content"
                    className="bg-white dark:bg-zinc-900 w-full flex flex-col items-center justify-center"
                    style={{ minHeight: '300px' }}
                >
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
                        <div className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-2">
                            広告
                        </div>
                        <ins className="adsbygoogle"
                            style={{ display: 'block', minHeight: '250px', width: '100%' }}
                            data-ad-client="ca-pub-1875347370848956"
                            data-ad-slot=""
                            data-ad-format="auto"
                            data-full-width-responsive="true" />
                    </div>
                </div>

                {/* 下部バー */}
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-400">スポンサー広告</span>
                    {canClose ? (
                        <button
                            onClick={handleClose}
                            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                        >
                            広告を閉じる
                        </button>
                    ) : (
                        <span className="text-xs text-zinc-400">{countdown}秒後に閉じられます</span>
                    )}
                </div>
            </div>
        </div>
    );
}
