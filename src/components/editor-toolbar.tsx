"use client";

import { Bold, Italic, Underline, Type, Palette } from "lucide-react";
import { useEffect, useState, useRef } from "react";

export function EditorToolbar({ className }: { className?: string }) {
    const [savedSelection, setSavedSelection] = useState<Range | null>(null);
    const [openMenu, setOpenMenu] = useState<'size' | 'font' | 'color' | null>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    // Save the selection whenever it changes
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                let node = selection.anchorNode;
                let isInsideEditor = false;
                while (node && node !== document.body) {
                    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).isContentEditable) {
                        isInsideEditor = true;
                        break;
                    }
                    node = node.parentNode;
                }
                if (isInsideEditor) {
                    setSavedSelection(selection.getRangeAt(0).cloneRange());
                }
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (openMenu && toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openMenu]);

    const exec = (command: string, value?: string) => {
        // Restore selection before executing if we have one
        if (savedSelection) {
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(savedSelection);
            }
        }
        document.execCommand(command, false, value);
        setOpenMenu(null);
    };

    const execFontSize = (sizePx: number) => {
        if (savedSelection) {
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(savedSelection);
            }
        }

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            // Because execCommand('fontSize') is limited to 1-7, we use a custom span wrapper for pixel sizes
            const span = document.createElement("span");
            span.style.fontSize = `${sizePx}px`;

            // To handle styling across multiple nodes correctly in contentEditable,
            // we first use execCommand to apply a temporary unique font name, 
            // then find those elements and swap them for our custom span styles.
            const tempFontName = `__TEMP_FONT_${Date.now()}`;
            document.execCommand('fontName', false, tempFontName);

            const rootNode = savedSelection ? savedSelection.commonAncestorContainer : document.body;
            // Searching within the contentEditable div (simplification: search whole body)
            const elements = document.querySelectorAll(`font[face="${tempFontName}"]`);
            elements.forEach(el => {
                const newSpan = document.createElement('span');
                newSpan.style.fontSize = `${sizePx}px`;
                newSpan.innerHTML = el.innerHTML;

                // Keep any existing styles if it was already a styled element (like color)
                if (el.getAttribute('style')) {
                    newSpan.style.cssText += el.getAttribute('style');
                }

                el.replaceWith(newSpan);
            });
        }
        setOpenMenu(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent default so editor doesn't lose focus immediately, keeping text visually highlighted
        e.preventDefault();
        e.stopPropagation();
    };

    const handleMenuToggle = (e: React.MouseEvent, menu: 'size' | 'font' | 'color') => {
        e.preventDefault();
        setOpenMenu(openMenu === menu ? null : menu);
    };

    return (
        <div ref={toolbarRef} className={`sticky z-20 flex flex-wrap items-center gap-2 p-2 bg-zinc-100/95 backdrop-blur-md shadow-sm dark:bg-zinc-800/95 dark:shadow-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 ${className || 'top-0 mb-2'}`}>
            {/* Font Size */}
            <div className="relative flex items-center gap-1 border-r border-zinc-300 dark:border-zinc-600 pr-2">
                <button
                    onMouseDown={(e) => handleMenuToggle(e, 'size')}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded text-xs px-3 py-1.5 outline-none text-zinc-700 dark:text-zinc-300 flex items-center justify-between min-w-[100px]"
                >
                    <span>文字サイズ</span>
                    <span className="text-[10px] ml-2">▼</span>
                </button>
                {openMenu === 'size' && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg overflow-y-auto max-h-64 flex flex-col z-50">
                        {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map((size) => (
                            <button
                                key={size}
                                onMouseDown={(e) => { handleMouseDown(e); execFontSize(size); }}
                                className="px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            >
                                {size}px
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Font Family */}
            <div className="relative flex items-center gap-1 border-r border-zinc-300 dark:border-zinc-600 pr-2">
                <button
                    onMouseDown={(e) => handleMenuToggle(e, 'font')}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded text-xs px-3 py-1.5 outline-none text-zinc-700 dark:text-zinc-300 flex items-center justify-between min-w-[120px]"
                >
                    <span>フォント</span>
                    <span className="text-[10px] ml-2">▼</span>
                </button>
                {openMenu === 'font' && (
                    <div className="absolute top-full left-0 mt-1 w-full min-w-fit whitespace-nowrap bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg overflow-hidden flex flex-col z-50">
                        <button onMouseDown={(e) => { handleMouseDown(e); exec('fontName', "'Noto Sans JP', sans-serif"); }} className="px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-sans">ゴシック体</button>
                        <button onMouseDown={(e) => { handleMouseDown(e); exec('fontName', "'Noto Serif JP', serif"); }} className="px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-serif">明朝体</button>
                        <button onMouseDown={(e) => { handleMouseDown(e); exec('fontName', "monospace"); }} className="px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">等幅 (コード)</button>
                    </div>
                )}
            </div>

            {/* Font Color */}
            <div className="relative flex items-center gap-1 border-r border-zinc-300 dark:border-zinc-600 pr-2">
                <button
                    onMouseDown={(e) => handleMenuToggle(e, 'color')}
                    className="flex items-center justify-center p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                    title="文字色"
                >
                    <Palette className="w-4 h-4" />
                </button>
                {openMenu === 'color' && (
                    <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg flex flex-wrap gap-1 w-[120px] z-50">
                        {['#000000', '#4b5563', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map(color => (
                            <button
                                key={color}
                                onMouseDown={(e) => { handleMouseDown(e); exec('foreColor', color); }}
                                className="w-6 h-6 rounded-full border border-black/10 shadow-sm"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Text Formatting */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onMouseDown={(e) => { handleMouseDown(e); exec('bold'); }}
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                    title="太字"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { handleMouseDown(e); exec('italic'); }}
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                    title="斜体"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { handleMouseDown(e); exec('underline'); }}
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                    title="下線"
                >
                    <Underline className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
