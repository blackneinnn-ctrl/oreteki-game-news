"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { EditorToolbar } from "./editor-toolbar";

interface PreviewEditorProps {
    articleId: string;
    initialContent: string;
}

export function PreviewEditor({ articleId, initialContent }: PreviewEditorProps) {
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [pages, setPages] = useState<string[]>(initialContent ? initialContent.split('<!-- PAGE_BREAK -->') : [""]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const editorRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Manual save function
    const handleSave = async () => {
        if (!editorRef.current || saveStatus === "saving") return;

        const currentHtml = editorRef.current.innerHTML;
        const newPages = [...pages];
        newPages[currentPageIndex] = currentHtml;
        setPages(newPages);
        setSaveStatus("saving");

        try {
            const res = await fetch("/api/admin/articles", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: articleId,
                    content: newPages.join('<!-- PAGE_BREAK -->'),
                }),
            });

            if (res.ok) {
                setSaveStatus("saved");
                router.refresh(); // Ensure the server-side component gets the latest data
                // Reset back to idle after 3 seconds
                setTimeout(() => setSaveStatus("idle"), 3000);
            } else {
                setSaveStatus("idle");
                console.error("Failed to save draft content");
                alert("保存に失敗しました。");
            }
        } catch (error) {
            console.error("Error saving draft content", error);
            setSaveStatus("idle");
            alert("エラーが発生しました。");
        }
    };

    return (
        <div className="relative group min-h-[50vh] transition-colors rounded-xl p-2 sm:-mx-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
            {/* Floating Save Button */}
            <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3 sm:bottom-12 sm:right-12 pointer-events-none">
                {/* Save Status Toast */}
                <div
                    className={`transition-all duration-300 transform pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-lg ${saveStatus === "saving"
                        ? "bg-zinc-800 text-white translate-y-0 opacity-100 dark:bg-zinc-200 dark:text-zinc-900"
                        : saveStatus === "saved"
                            ? "bg-emerald-500 text-white translate-y-0 opacity-100"
                            : "translate-y-4 opacity-0"
                        }`}
                >
                    {saveStatus === "saving" && (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>保存中...</span>
                        </>
                    )}
                    {saveStatus === "saved" && (
                        <>
                            <Check className="h-4 w-4" />
                            <span>保存完了</span>
                        </>
                    )}
                </div>

                {/* FAB */}
                <button
                    onClick={handleSave}
                    disabled={saveStatus === "saving"}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-white shadow-xl transition-transform hover:scale-105 hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-500/30 disabled:opacity-50 pointer-events-auto"
                    title="変更を保存"
                >
                    {saveStatus === "saving" ? (
                        <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                        <Save className="h-7 w-7" />
                    )}
                </button>
            </div>

            {/* Printable Page Tabs */}
            {pages.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 mb-4 px-2 sm:px-4">
                    {pages.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentPageIndex(index)}
                            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${currentPageIndex === index
                                ? "bg-white text-orange-600 border-t-2 border-orange-500 shadow-[0_-2px_4px_rgba(0,0,0,0.02)] dark:bg-zinc-900 dark:border-orange-500"
                                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                }`}
                        >
                            ページ {index + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* Editable Content */}
            <div className={`relative ${pages.length > 1 ? 'bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-b-xl rounded-tr-xl' : ''}`}>
                <div className="absolute top-2 left-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity uppercase bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md z-10">
                    直接編集可能
                </div>
                <EditorToolbar className="top-24 mt-8 mx-2 sm:mt-4 sm:mx-4 mb-2" />

                <div
                    ref={editorRef}
                    key={currentPageIndex}
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                        const newContent = e.currentTarget.innerHTML;
                        const newPages = [...pages];
                        newPages[currentPageIndex] = newContent;
                        setPages(newPages);
                    }}
                    onKeyDown={(e) => {
                        // Prevent default Enter behavior (which usually creates a new <p> or <div>)
                        // and insert a <br> instead for a single line break
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            document.execCommand('insertLineBreak');
                        }
                    }}
                    className="article-content text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white dark:focus:bg-zinc-950 rounded-xl p-2 sm:p-4 transition-all"
                    dangerouslySetInnerHTML={{ __html: pages[currentPageIndex] || "" }}
                />
            </div>
        </div>
    );
}
