"use client";

import { useEffect, useMemo, useRef } from "react";

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: HTMLElement | null) => void;
      };
    };
  }
}

interface ArticleContentProps {
  html: string;
  className?: string;
}

const TWEET_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/\d+(?:\?[^\s<"']*)?/i;

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeTweetUrl(url: string): string {
  return url.replace("twitter.com", "x.com");
}

function buildTweetEmbed(url: string): string {
  const normalizedUrl = normalizeTweetUrl(url.trim());
  return [
    '<div class="x-embed">',
    '<blockquote class="twitter-tweet" data-theme="dark" data-dnt="true">',
    `<a href="${escapeHtmlAttr(normalizedUrl)}">${escapeHtmlAttr(normalizedUrl)}</a>`,
    "</blockquote>",
    "</div>",
  ].join("");
}

function enhanceArticleHtml(html: string): string {
  let enhanced = html.replace(
    /<script[^>]*src=["'][^"']*platform\.twitter\.com\/widgets\.js[^"']*["'][^>]*><\/script>/gi,
    "",
  );

  enhanced = enhanced.replace(
    /<p>\s*(https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/\d+(?:\?[^\s<]*)?)\s*<\/p>/gi,
    (_, url: string) => buildTweetEmbed(url),
  );

  enhanced = enhanced.replace(
    /<p>\s*<a[^>]+href=["'](https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/\d+(?:\?[^"']*)?)["'][^>]*>[\s\S]*?<\/a>\s*<\/p>/gi,
    (_, url: string) => buildTweetEmbed(url),
  );

  return enhanced;
}

export function ArticleContent({ html, className }: ArticleContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const enhancedHtml = useMemo(() => enhanceArticleHtml(html), [html]);

  useEffect(() => {
    if (!enhancedHtml || (!TWEET_URL_PATTERN.test(enhancedHtml) && !enhancedHtml.includes("twitter-tweet"))) {
      return;
    }

    const container = containerRef.current;
    if (!container || typeof window === "undefined") {
      return;
    }

    const loadEmbeds = () => {
      window.twttr?.widgets?.load(container);
    };

    if (window.twttr?.widgets?.load) {
      loadEmbeds();
      return;
    }

    let script = document.querySelector<HTMLScriptElement>('script[data-x-widget-loader="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.setAttribute("data-x-widget-loader", "true");
      document.body.appendChild(script);
    }

    script.addEventListener("load", loadEmbeds);
    return () => {
      script?.removeEventListener("load", loadEmbeds);
    };
  }, [enhancedHtml]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: enhancedHtml }}
    />
  );
}

