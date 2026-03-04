"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollAnimateProps {
    children: ReactNode;
    delay?: number;
    className?: string;
}

export function ScrollAnimate({ children, delay = 0, className = "" }: ScrollAnimateProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // Apply delay then add visible class
                    setTimeout(() => {
                        el.classList.add("is-visible");
                    }, delay);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [delay]);

    return (
        <div ref={ref} className={`scroll-fade-in ${className}`}>
            {children}
        </div>
    );
}
