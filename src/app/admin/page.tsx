"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Shield, Eye, Trash2, Check, X, Clock, ExternalLink,
    LogIn, RefreshCw, Pencil, Save, ArrowLeft
} from "lucide-react";
import type { Article } from "@/lib/supabase";

export default function AdminPage() {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"draft" | "published">("draft");
    const [editingArticle, setEditingArticle] = useState<Article | null>(null);
    const [editForm, setEditForm] = useState({
        title: "",
        excerpt: "",
        content: "",
        tags: "",
        image_url: "",
    });
    const [saving, setSaving] = useState(false);

    const fetchArticles = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/articles", {
                headers: { Authorization: `Bearer ${password}` },
            });
            if (!res.ok) {
                if (res.status === 401) {
                    setIsAuthenticated(false);
                    setError("認証に失敗しました");
                    return;
                }
                throw new Error("Failed to fetch");
            }
            const data = await res.json();
            setArticles(data);
        } catch {
            setError("記事の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }, [password]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchArticles();
        }
    }, [isAuthenticated, fetchArticles]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/articles", {
                headers: { Authorization: `Bearer ${password}` },
            });
            if (res.ok) {
                setIsAuthenticated(true);
            } else {
                setError("パスワードが正しくありません");
            }
        } catch {
            setError("接続に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id: string, status: "draft" | "published") => {
        try {
            const res = await fetch("/api/admin/articles", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${password}`,
                },
                body: JSON.stringify({ id, status }),
            });
            if (res.ok) fetchArticles();
        } catch {
            setError("ステータスの更新に失敗しました");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("この記事を削除しますか？この操作は取り消せません。")) return;
        try {
            const res = await fetch("/api/admin/articles", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${password}`,
                },
                body: JSON.stringify({ id }),
            });
            if (res.ok) fetchArticles();
        } catch {
            setError("削除に失敗しました");
        }
    };

    const startEditing = (article: Article) => {
        setEditingArticle(article);
        setEditForm({
            title: article.title,
            excerpt: article.excerpt,
            content: article.content,
            tags: article.tags.join(", "),
            image_url: article.image_url,
        });
    };

    const handleSaveEdit = async () => {
        if (!editingArticle) return;
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/admin/articles", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${password}`,
                },
                body: JSON.stringify({
                    id: editingArticle.id,
                    title: editForm.title,
                    excerpt: editForm.excerpt,
                    content: editForm.content,
                    tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
                    image_url: editForm.image_url,
                }),
            });
            if (res.ok) {
                setEditingArticle(null);
                fetchArticles();
            } else {
                setError("保存に失敗しました");
            }
        } catch {
            setError("保存に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    const drafts = articles.filter((a) => a.status === "draft");
    const published = articles.filter((a) => a.status === "published");
    const displayArticles = activeTab === "draft" ? drafts : published;

    // ---- Login Screen ----
    if (!isAuthenticated) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center px-4">
                <form
                    onSubmit={handleLogin}
                    className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                            <Shield className="h-5 w-5 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">管理画面</h1>
                    </div>
                    {error && (
                        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="管理パスワード"
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        <LogIn className="h-4 w-4" />
                        ログイン
                    </button>
                </form>
            </div>
        );
    }

    // ---- Edit Screen ----
    if (editingArticle) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
                <button
                    onClick={() => setEditingArticle(null)}
                    className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-orange-600 dark:text-zinc-400"
                >
                    <ArrowLeft className="h-4 w-4" />
                    一覧に戻る
                </button>

                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                        <Pencil className="h-5 w-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-white">記事を編集</h1>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                    {/* Title */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            タイトル
                        </label>
                        <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </div>

                    {/* Excerpt */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            要約
                        </label>
                        <textarea
                            value={editForm.excerpt}
                            onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            本文（HTML）
                        </label>
                        <textarea
                            value={editForm.content}
                            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                            rows={15}
                            className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            タグ（カンマ区切り）
                        </label>
                        <input
                            type="text"
                            value={editForm.tags}
                            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                            placeholder="Nintendo, Switch, ゲーム"
                            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </div>

                    {/* Image URL */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            サムネイル画像URL
                        </label>
                        <input
                            type="text"
                            value={editForm.image_url}
                            onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                        {editForm.image_url && (
                            <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={editForm.image_url}
                                    alt="プレビュー"
                                    className="h-40 w-full object-cover"
                                />
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-700">
                        <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? "保存中..." : "保存する"}
                        </button>
                        <button
                            onClick={() => setEditingArticle(null)}
                            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ---- Admin Dashboard ----
    return (
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
                            記事管理
                        </h1>
                        <p className="text-sm text-zinc-500">
                            下書き: {drafts.length}件 / 公開済み: {published.length}件
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchArticles}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    更新
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="mb-6 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                <button
                    onClick={() => setActiveTab("draft")}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "draft"
                            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                        }`}
                >
                    📝 下書き ({drafts.length})
                </button>
                <button
                    onClick={() => setActiveTab("published")}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "published"
                            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                        }`}
                >
                    ✅ 公開済み ({published.length})
                </button>
            </div>

            {/* Article List */}
            <div className="space-y-3">
                {displayArticles.map((article) => (
                    <div
                        key={article.id}
                        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 sm:text-base">
                                    {article.title}
                                </h3>
                                <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    {article.excerpt}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{new Date(article.created_at).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Eye className="h-3 w-3" />
                                        <span>{article.views} views</span>
                                    </div>
                                    {article.source_url && (
                                        <a
                                            href={article.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-orange-500 hover:text-orange-600"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            {article.source_name ?? "引用元"}
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <button
                                    onClick={() => startEditing(article)}
                                    className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    編集
                                </button>
                                {article.status === "draft" ? (
                                    <button
                                        onClick={() => handleStatusChange(article.id, "published")}
                                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        公開する
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleStatusChange(article.id, "draft")}
                                        className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        非公開
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(article.id)}
                                    className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    削除
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {displayArticles.length === 0 && (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-zinc-500 dark:text-zinc-400">
                            {activeTab === "draft" ? "下書き記事はありません" : "公開済み記事はありません"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
