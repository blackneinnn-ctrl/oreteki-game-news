"use client";

import Link from "next/link";
import { useState } from "react";
import {
    Search,
    Menu,
    X,
} from "lucide-react";
import Image from "next/image";

const navItems = [
    { label: "ホーム", href: "/" },
    { label: "ランキング", href: "/ranking" },
    { label: "サイトについて", href: "/about" },
];

export function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500" />

            <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
                <div className="flex h-20 items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="relative z-10 flex h-20 w-[400px] items-center overflow-hidden group">
                        <Image
                            src="/logo.png"
                            alt="俺的ゲームニュース"
                            width={1200}
                            height={240}
                            className="h-[500px] w-auto object-contain transition-transform group-hover:scale-105"
                            priority
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden items-center gap-1 md:flex">
                        {navItems.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <button
                            onClick={() => setSearchOpen(!searchOpen)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                            aria-label="検索"
                        >
                            <Search className="h-4 w-4" />
                        </button>

                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 md:hidden"
                            aria-label="メニュー"
                        >
                            {mobileMenuOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Search Bar (expandable) */}
                {searchOpen && (
                    <div className="border-t border-zinc-800 py-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="記事を検索..."
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                                autoFocus
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="border-t border-zinc-800 bg-zinc-950 md:hidden">
                    <nav className="mx-auto max-w-[1400px] space-y-1 px-4 py-3">
                        {navItems.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </header>
    );
}
