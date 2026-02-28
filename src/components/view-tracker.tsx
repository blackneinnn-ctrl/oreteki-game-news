"use client";

import { useEffect } from "react";

export function ViewTracker({ articleId }: { articleId: string }) {
    useEffect(() => {
        const key = `viewed_${articleId}`;

        // sessionStorageで同一セッション内の二重カウントを防止
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, "1");
        } catch {
            // private browsing等でsessionStorageが使えない場合はそのまま進む
        }

        fetch("/api/views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: articleId }),
        }).catch(() => {
            // silently fail
        });
    }, [articleId]);

    return null;
}
