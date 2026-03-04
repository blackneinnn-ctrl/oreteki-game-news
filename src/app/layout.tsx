import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { InterstitialAd } from "@/components/interstitial-ad";
import { BackToTop } from "@/components/back-to-top";

export const metadata: Metadata = {
  title: {
    default: "俺的ゲームニュース",
    template: "%s | 俺的ゲームニュース",
  },
  description: "ゲームに関する最新ニュースや話題をまとめてお届けするゲームブログ。",
  icons: {
    icon: "/site-logo.png",
    shortcut: "/site-logo.png",
    apple: "/site-logo.png",
  },
  openGraph: {
    title: "俺的ゲームニュース",
    description: "ゲームに関する最新ニュースや話題をまとめてお届けするゲームブログ。",
    url: "https://oreteki-game-news.com", // 適切な本番のURLに変更可能
    siteName: "俺的ゲームニュース",
    images: [
      {
        url: "/site-logo.png",
        width: 1200,
        height: 630,
        alt: "俺的ゲームニュース ロゴ",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "俺的ゲームニュース",
    description: "ゲームに関する最新ニュースや話題をまとめてお届けするゲームブログ。",
    images: ["/site-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1875347370848956"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <InterstitialAd />
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <BackToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}
