import Link from "next/link";
import { Gamepad2, Twitter, Youtube, Rss } from "lucide-react";

const footerLinks = [
    {
        title: "メニュー",
        links: [
            { label: "ホーム", href: "/" },
            { label: "ランキング", href: "/ranking" },
            { label: "サイトについて", href: "/about" },
        ],
    },
    {
        title: "情報",
        links: [
            { label: "お問い合わせ", href: "/about#contact" },
            { label: "プライバシーポリシー", href: "/about#privacy" },
            { label: "利用規約", href: "/about#terms" },
        ],
    },
];

export function Footer() {
    return (
        <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
                                <Gamepad2 className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-lg font-bold text-zinc-900 dark:text-white">
                                俺的<span className="text-orange-600 dark:text-orange-400">ゲームニュース</span>
                            </span>
                        </Link>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                            ゲームに関する最新ニュースや<br />
                            話題をお届けするゲームブログ。
                        </p>
                        {/* Social */}
                        <div className="mt-4 flex gap-3">
                            <a
                                href="#"
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-200/60 text-zinc-500 transition-colors hover:bg-orange-100 hover:text-orange-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400"
                                aria-label="Twitter"
                            >
                                <Twitter className="h-4 w-4" />
                            </a>
                            <a
                                href="#"
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-200/60 text-zinc-500 transition-colors hover:bg-orange-100 hover:text-orange-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400"
                                aria-label="YouTube"
                            >
                                <Youtube className="h-4 w-4" />
                            </a>
                            <a
                                href="#"
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-200/60 text-zinc-500 transition-colors hover:bg-orange-100 hover:text-orange-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400"
                                aria-label="RSS"
                            >
                                <Rss className="h-4 w-4" />
                            </a>
                        </div>
                    </div>

                    {/* Link groups */}
                    {footerLinks.map((group) => (
                        <div key={group.title}>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
                                {group.title}
                            </h3>
                            <ul className="mt-3 space-y-2">
                                {group.links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-zinc-500 transition-colors hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                        © 2026 俺的ゲームニュース. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
