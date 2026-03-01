"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Shield, Eye, Trash2, Check, X, Clock, ExternalLink,
    LogIn, RefreshCw, Pencil, Save, ArrowLeft, Plus, Send, Bot, User, CreditCard
} from "lucide-react";
import type { Article } from "@/lib/supabase";

export default function AdminPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateMessage, setGenerateMessage] = useState("");
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
    const [selectedAttribute, setSelectedAttribute] = useState<"game_news" | "game_intro">("game_news");
    const [generateKeyword, setGenerateKeyword] = useState("");

    // UI State
    const [viewMode, setViewMode] = useState<"list" | "editor">("list");
    const [activeTab, setActiveTab] = useState<"draft" | "published">("draft");
    const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Editor State
    const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        title: "",
        excerpt: "",
        content: "",
        tags: "",
        image_url: "",
    });
    const [saving, setSaving] = useState(false);
    const [sortBy, setSortBy] = useState<"date" | "views">("date");

    // AI Edit Assistant State
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [isAssistantTyping, setIsAssistantTyping] = useState(false);
    const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
    const [costData, setCostData] = useState<{ totalUsd: number; totalJpy: number } | null>(null);

    const fetchArticles = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/articles");
            if (!res.ok) {
                throw new Error("Failed to fetch");
            }
            const data = await res.json();
            setArticles(data);
        } catch {
            setError("記事の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCost = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/stats/cost');
            const data = await res.json();
            if (data.success) {
                setCostData({ totalUsd: data.totalUsd, totalJpy: data.totalJpy });
            }
        } catch (e) {
            console.error('Failed to fetch cost stats:', e);
        }
    }, []);

    useEffect(() => {
        if (viewMode === "list") {
            fetchArticles();
            fetchCost();
        }
    }, [fetchArticles, fetchCost, viewMode]);

    // Progress Polling
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isGenerating) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch("/api/admin/generate/progress");
                    if (res.ok) {
                        const data = await res.json();
                        setProgress(data.progress || 0);
                        if (data.message) {
                            setGenerateMessage(data.message);
                        }
                        setProgressStatus(data.status || 'running');

                        if (data.status === 'completed' || data.status === 'error') {
                            setIsGenerating(false);
                            if (data.status === 'completed') {
                                // Auto refresh after successful generation
                                fetchArticles();
                                fetchCost();
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch progress", e);
                }
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGenerating, fetchArticles]);

    const handleStatusChange = async (id: string, status: "draft" | "published") => {
        try {
            const res = await fetch("/api/admin/articles", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
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
                },
                body: JSON.stringify({ id }),
            });
            if (res.ok) fetchArticles();
        } catch {
            setError("削除に失敗しました");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`${selectedIds.length}件の記事を削除しますか？この操作は取り消せません。`)) return;
        try {
            const res = await fetch("/api/admin/articles", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ids: selectedIds }),
            });
            if (res.ok) {
                setSelectedIds([]);
                fetchArticles();
            } else {
                setError("一括削除に失敗しました");
            }
        } catch {
            setError("一括削除に失敗しました");
        }
    };

    const handleGenerate = async () => {
        if (!confirm("AIによる自動生成プロセスを開始しますか？\n（完了まで数分かかる場合があります）")) return;

        setProgress(0);
        setProgressStatus("running");
        setIsGenerating(true);
        setError("");
        setGenerateMessage("初期化中...");
        try {
            const res = await fetch("/api/admin/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ attribute: selectedAttribute, keyword: generateKeyword }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "生成の開始に失敗しました");
                setIsGenerating(false);
                setProgressStatus("error");
            }
            // If successful, the polling useEffect will handle completion
        } catch {
            setError("予期せぬエラーが発生しました");
            setIsGenerating(false);
            setProgressStatus("error");
        }
    };

    // --- AI Edit Assistant ---
    const handleAssistantSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim() || isAssistantTyping) return;

        const userInstruction = chatInput.trim();
        setChatInput("");
        setChatMessages(prev => [...prev, { role: 'user', content: userInstruction }]);
        setIsAssistantTyping(true);

        try {
            const res = await fetch("/api/admin/edit-assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentHtml: editForm.content,
                    prompt: userInstruction,
                    model: selectedModel
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setChatMessages(prev => [...prev, { role: 'ai', content: `❌ エラー: ${data.error || '修正に失敗しました'}` }]);
            } else {
                setEditForm(prev => ({ ...prev, content: data.html }));
                setChatMessages(prev => [...prev, { role: 'ai', content: '✅ 修正が完了しました！左側のエディタに反映されています。' }]);

                // プレビュー表示に切り替えて変更を見やすくする
                setEditorTab("preview");
                fetchCost(); // 使用量が変わったのでコストを再取得
            }
        } catch (error) {
            setChatMessages(prev => [...prev, { role: 'ai', content: '❌ ネットワークエラーが発生しました。' }]);
        } finally {
            setIsAssistantTyping(false);
        }
    };

    // --- Editor Actions ---
    const openEditorForNew = () => {
        setEditingArticleId(null);
        setEditForm({
            title: "",
            excerpt: "",
            content: "",
            tags: "",
            image_url: "",
        });
        setEditorTab("edit");
        setViewMode("editor");
    };

    const openEditorForEdit = (article: Article) => {
        setEditingArticleId(article.id);
        setEditForm({
            title: article.title,
            excerpt: article.excerpt,
            content: article.content,
            tags: article.tags.join(", "),
            image_url: article.image_url,
        });
        setEditorTab("edit");
        setViewMode("editor");
    };

    const handleSave = async (status: "draft" | "published" = "draft") => {
        if (!editForm.title.trim()) {
            setError("タイトルを入力してください");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const isEditing = !!editingArticleId;
            const url = "/api/admin/articles";
            const method = isEditing ? "PUT" : "POST";

            const payload: any = {
                title: editForm.title,
                excerpt: editForm.excerpt,
                content: editForm.content,
                tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
                image_url: editForm.image_url,
            };

            if (isEditing) {
                payload.id = editingArticleId;
            } else {
                payload.status = status;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setViewMode("list");
            } else {
                setError("保存に失敗しました");
            }
        } catch {
            setError("ネットワークエラーが発生しました");
        } finally {
            setSaving(false);
        }
    };

    const drafts = articles.filter((a) => a.status === "draft");
    const published = articles.filter((a) => a.status === "published");

    // Sort display articles
    let displayArticles = activeTab === "draft" ? drafts : published;
    displayArticles = [...displayArticles].sort((a, b) => {
        if (sortBy === "views") {
            return b.views - a.views;
        }
        // date sort (default)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // ---- 2. Editor Screen (Note-like clean UI + AI Assistant) ----
    if (viewMode === "editor") {
        return (
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 min-h-screen bg-white dark:bg-zinc-950">
                {/* Editor Header (Sticky) */}
                <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 py-4 backdrop-blur-md dark:bg-zinc-950/80 mb-6 border-b border-zinc-100 dark:border-zinc-800/50">
                    <button
                        onClick={() => setViewMode("list")}
                        className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-orange-600 dark:text-zinc-400"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        戻る
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleSave("draft")}
                            disabled={saving}
                            className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
                        >
                            {saving ? "保存中..." : editingArticleId ? "上書き保存" : "下書き保存"}
                        </button>
                        {!editingArticleId && (
                            <button
                                onClick={() => handleSave("published")}
                                disabled={saving}
                                className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 shadow-sm disabled:opacity-50"
                            >
                                公開する
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Main Editor Area with Sidebar */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 pb-20">

                    {/* Left Column: Editor */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Cover Image Upload & Input */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                                    <Plus className="h-4 w-4" />
                                    画像をアップロード
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            try {
                                                // Set loading state (reusing saving state for visual cue)
                                                setSaving(true);
                                                setError("");

                                                // We need to fetch the supabase anon key from environment for client side,
                                                // but since this is a client component, we should ideally use a client supabase instance.
                                                // To keep it simple, let's use the browser's fetch API directly to Supabase REST.
                                                // We'll need the project URL and ANON KEY from env.
                                                const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
                                                const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                                                if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                                                    throw new Error("Supabase config not found");
                                                }

                                                // Create a unique filename
                                                const fileExt = file.name.split('.').pop();
                                                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                                                const filePath = `${fileName}`;

                                                // Upload directly using REST API
                                                const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/images/${filePath}`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                                                        'apikey': SUPABASE_ANON_KEY,
                                                        'Content-Type': file.type,
                                                    },
                                                    body: file
                                                });

                                                if (!uploadRes.ok) {
                                                    console.error(await uploadRes.text());
                                                    throw new Error(`Upload failed: ${uploadRes.status}`);
                                                }

                                                // Get public URL
                                                const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${filePath}`;

                                                // Update form state
                                                setEditForm({ ...editForm, image_url: publicUrl });
                                            } catch (err) {
                                                console.error("Image upload error:", err);
                                                setError("画像のアップロードに失敗しました");
                                            } finally {
                                                setSaving(false);
                                                // clear the input so the same file could be selected again if needed
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                </label>
                                <span className="text-sm text-zinc-400">またはURLを直接入力</span>
                            </div>

                            <input
                                type="text"
                                placeholder="カバー画像URL (https://...)"
                                value={editForm.image_url}
                                onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                                className="w-full bg-transparent text-sm text-zinc-500 placeholder-zinc-400 outline-none border-b border-zinc-200 dark:border-zinc-800 py-2 focus:border-orange-500 transition-colors dark:text-zinc-400"
                            />

                            {editForm.image_url && (
                                <div className="w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 aspect-video">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={editForm.image_url}
                                        alt="カバー画像"
                                        className="h-full w-full object-cover"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Title Input */}
                        <textarea
                            value={editForm.title}
                            onChange={(e) => {
                                setEditForm({ ...editForm, title: e.target.value });
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            placeholder="記事タイトル"
                            rows={1}
                            className="w-full resize-none overflow-hidden bg-transparent text-3xl font-bold leading-tight text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-white dark:placeholder:text-zinc-700 sm:text-4xl"
                        />

                        {/* Tags & Excerpt Input */}
                        <div className="space-y-4 rounded-xl bg-zinc-50 p-5 dark:bg-zinc-900/50">
                            <input
                                type="text"
                                placeholder="タグ（カンマ区切り: ゲーム, Switch, レビュー）"
                                value={editForm.tags}
                                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                                className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-300"
                            />
                            <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />
                            <textarea
                                value={editForm.excerpt}
                                onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                                placeholder="記事の要約・リード文（SNSなどで表示されます）"
                                rows={2}
                                className="w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-600 outline-none placeholder:text-zinc-400 dark:text-zinc-400"
                            />
                        </div>

                        {/* Content Body Input (HTML allowed) */}
                        <div className="relative group mt-8">
                            {/* Tab switcher */}
                            <div className="flex gap-1 mb-4 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800 w-fit">
                                <button
                                    onClick={() => setEditorTab("edit")}
                                    className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${editorTab === "edit"
                                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                        }`}
                                >
                                    ✏️ 編集
                                </button>
                                <button
                                    onClick={() => setEditorTab("preview")}
                                    className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${editorTab === "preview"
                                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                        }`}
                                >
                                    👁️ プレビュー
                                </button>
                            </div>

                            {editorTab === "edit" ? (
                                <textarea
                                    value={editForm.content}
                                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                    placeholder="記事の本文を入力してください... (HTML使用可能)"
                                    className="min-h-[50vh] w-full resize-y bg-transparent text-base leading-loose text-zinc-800 outline-none placeholder:text-zinc-300 dark:text-zinc-200 dark:placeholder:text-zinc-700"
                                />
                            ) : (
                                <div className="min-h-[50vh] rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900 relative">
                                    <div className="absolute top-2 right-4 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
                                        <Pencil className="w-3 h-3" />
                                        直接編集モード
                                    </div>
                                    {editForm.content ? (
                                        <div
                                            contentEditable={true}
                                            suppressContentEditableWarning={true}
                                            onBlur={(e) => {
                                                const newContent = e.currentTarget.innerHTML;
                                                setEditForm(prev => ({ ...prev, content: newContent }));
                                            }}
                                            className="article-content text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-orange-500/10 rounded-lg p-2 transition-all min-h-[40vh]"
                                            dangerouslySetInnerHTML={{ __html: editForm.content }}
                                        />
                                    ) : (
                                        <p className="text-zinc-400 dark:text-zinc-600">本文がありません。編集タブで記事を書いてください。</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: AI Assistant Chat */}
                    <div className="lg:col-span-2 border-l border-zinc-200 dark:border-zinc-800 pl-8 hidden lg:flex flex-col h-[calc(100vh-140px)] sticky top-24">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <div className="bg-orange-100 text-orange-600 p-2 rounded-lg dark:bg-orange-500/20 dark:text-orange-400">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-zinc-800 dark:text-zinc-200">AI アシスタント</h3>
                            </div>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={isAssistantTyping}
                                className="text-xs font-medium bg-zinc-100 border-none rounded-lg px-2 py-1.5 text-zinc-600 outline-none cursor-pointer dark:bg-zinc-800 dark:text-zinc-400 focus:ring-2 focus:ring-orange-500/20"
                            >
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                <option value="gemini-3-pro-3.1">Gemini 3 Pro 3.1</option>
                            </select>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                            {chatMessages.length === 0 ? (
                                <div className="text-center text-sm text-zinc-400 dark:text-zinc-500 mt-10">
                                    <p>「箇条書きにして」</p>
                                    <p>「もっとワクワクする表現にして」</p>
                                    <p>など、HTMLの修正を会話で指示できます。</p>
                                </div>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-zinc-200 dark:bg-zinc-800' : 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'}`}>
                                            {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /> : <Bot className="w-4 h-4" />}
                                        </div>
                                        <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 rounded-tr-sm' : 'bg-orange-50 text-orange-900 dark:bg-orange-500/10 dark:text-orange-100 rounded-tl-sm border border-orange-100 dark:border-orange-500/20'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isAssistantTyping && (
                                <div className="flex gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center dark:bg-orange-500/20 dark:text-orange-400">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl bg-orange-50 text-orange-900 rounded-tl-sm border border-orange-100 dark:bg-orange-500/10 dark:text-orange-100 dark:border-orange-500/20">
                                        <span className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chat Input */}
                        <form onSubmit={handleAssistantSubmit} className="relative mt-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
                            <textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAssistantSubmit();
                                    }
                                }}
                                placeholder="修正内容を指示... (Shift+Enterで改行)"
                                rows={3}
                                className="w-full resize-none bg-zinc-100 rounded-xl pl-4 pr-12 py-3 text-sm outline-none transition-colors border-2 border-transparent focus:border-orange-500 dark:bg-zinc-900/50 dark:text-white dark:border-zinc-800 dark:focus:border-orange-500"
                                disabled={isAssistantTyping}
                            />
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleAssistantSubmit(); }}
                                disabled={!chatInput.trim() || isAssistantTyping}
                                className="absolute right-3 bottom-6 p-2 bg-orange-500 text-white rounded-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // ---- 3. Admin Dashboard List Screen ----
    return (
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-sm">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">
                            記事管理
                        </h1>
                        <p className="text-sm text-zinc-500 font-medium">
                            {drafts.length} 下書き · {published.length} 公開済み
                        </p>
                    </div>
                </div>

                {/* Cost Monitor Badge */}
                {costData && (
                    <div className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-2 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                            <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">今月の推定AIコスト</p>
                            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                                ${costData.totalUsd.toFixed(2)} <span className="ml-1 text-xs font-medium text-zinc-400">({costData.totalJpy.toLocaleString()}円)</span>
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchArticles}
                        disabled={loading}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        aria-label="更新"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <select
                        value={selectedAttribute}
                        onChange={(e) => setSelectedAttribute(e.target.value as "game_news" | "game_intro")}
                        disabled={isGenerating}
                        className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                    >
                        <option value="game_news">ゲームニュース</option>
                        <option value="game_intro">ゲーム紹介</option>
                    </select>
                    <input
                        type="text"
                        placeholder="キーワード (任意)"
                        value={generateKeyword}
                        onChange={(e) => setGenerateKeyword(e.target.value)}
                        disabled={isGenerating}
                        className="w-40 sm:w-48 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-50 dark:bg-indigo-500"
                    >
                        🤖 自動生成を実行
                    </button>
                    <button
                        onClick={openEditorForNew}
                        className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 dark:bg-white dark:text-zinc-900"
                    >
                        <Plus className="h-4 w-4" />
                        記事を書く
                    </button>
                </div>
            </div>

            {/* Progress Bar UI */}
            {(isGenerating || progressStatus === 'completed' || progressStatus === 'error') && (
                <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">
                            {progressStatus === 'completed' ? '✅ 生成完了' : progressStatus === 'error' ? '❌ エラー発生' : '🤖 AI記事生成中'}
                        </span>
                        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                            {progress}%
                        </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                            className={`h-full transition-all duration-500 ease-out ${progressStatus === 'completed' ? 'bg-emerald-500' : progressStatus === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-orange-500 to-red-500'
                                }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    {generateMessage && (
                        <p className={`mt-2 text-xs font-medium ${progressStatus === 'error' ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'
                            }`}>
                            {generateMessage}
                        </p>
                    )}
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}
            {generateMessage && (
                <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 flex items-start gap-2 border border-blue-100 dark:border-blue-900/30">
                    <div className="mt-0.5 animate-pulse">🤖</div>
                    <div>{generateMessage}</div>
                </div>
            )}

            {/* Tabs & Sort */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto">
                    <div className="flex w-full gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900/50 sm:w-auto">
                        <button
                            onClick={() => { setActiveTab("draft"); setSelectedIds([]); }}
                            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all sm:flex-none ${activeTab === "draft"
                                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                }`}
                        >
                            📝 下書き ({drafts.length})
                        </button>
                        <button
                            onClick={() => { setActiveTab("published"); setSelectedIds([]); }}
                            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all sm:flex-none ${activeTab === "published"
                                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                }`}
                        >
                            ✅ 公開済み ({published.length})
                        </button>
                    </div>

                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                        >
                            <Trash2 className="h-4 w-4" />
                            {selectedIds.length}件を削除
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 self-end sm:self-auto">
                    <label htmlFor="sort-select" className="font-medium">並び替え:</label>
                    <select
                        id="sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "date" | "views")}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 focus:ring-2 focus:ring-orange-500/20"
                    >
                        <option value="date">新しい順</option>
                        <option value="views">閲覧数が多い順</option>
                    </select>
                </div>
            </div>

            {/* Article List */}
            <div className="space-y-4">
                {displayArticles.map((article) => (
                    <div
                        key={article.id}
                        className={`group rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 sm:p-6 ${selectedIds.includes(article.id)
                            ? "border-orange-500 ring-1 ring-orange-500 dark:border-orange-500"
                            : "border-zinc-200 dark:border-zinc-800"
                            }`}
                    >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                            {/* Checkbox */}
                            <div className="pt-1">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(article.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedIds(prev => [...prev, article.id]);
                                        } else {
                                            setSelectedIds(prev => prev.filter(id => id !== article.id));
                                        }
                                    }}
                                    className="h-5 w-5 rounded border-zinc-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>

                            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openEditorForEdit(article)}>
                                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 transition-colors group-hover:text-orange-500">
                                    {article.title}
                                </h3>
                                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                    {article.excerpt || "本文なし"}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-400">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>{new Date(article.created_at).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Eye className="h-3.5 w-3.5" />
                                        <span>{article.views} views</span>
                                    </div>
                                    {article.source_url && (
                                        <a
                                            href={article.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-orange-500 hover:text-orange-600"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            引用元
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <button
                                    onClick={() => openEditorForEdit(article)}
                                    className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    編集
                                </button>
                                {article.status === "draft" ? (
                                    <button
                                        onClick={() => handleStatusChange(article.id, "published")}
                                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        公開する
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleStatusChange(article.id, "draft")}
                                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        非公開にする
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(article.id)}
                                    className="flex items-center justify-center rounded-lg bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40"
                                    aria-label="削除"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {displayArticles.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 p-16 text-center dark:border-zinc-800 dark:bg-zinc-900/20 flex flex-col items-center justify-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                            📝
                        </div>
                        <h3 className="mb-1 font-bold text-zinc-900 dark:text-white">
                            {activeTab === "draft" ? "下書きがありません" : "公開済みの記事がありません"}
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            「記事を書く」ボタンから新しい記事を作成しましょう
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
