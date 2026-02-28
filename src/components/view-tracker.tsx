"use client";

import { useEffect, useRef } from "react";

export function ViewTracker({ articleId }: { articleId: string }) {
    const tracked = useRef(false);

    useEffect(() => {
        if (tracked.current) return;
        tracked.current = true;

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
