"use client";
import React, { useEffect, useMemo } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";
import markdown from "react-syntax-highlighter/dist/esm/languages/hljs/markdown";
import lsl from "@/lib/hljs/lsl";

SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("xml", xml);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("lsl", lsl as any);

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function textFromChildren(children: React.ReactNode): string {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.map(textFromChildren).join("");
    if (children && typeof children === "object" && "props" in (children as any)) {
        return textFromChildren((children as any).props?.children);
    }
    return "";
}

// Smoothly scroll to a heading id; retries briefly until the element exists
function scrollToId(targetId: string) {
    const id = decodeURIComponent(targetId.replace(/^#/, ""));
    const start = performance.now();
    const timeoutMs = 1500;
    const tick = () => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
            return;
        }
        if (performance.now() - start < timeoutMs) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

export function Markdown({ value }: { value: string }) {
    const slugCounts = useMemo(() => new Map<string, number>(), []);
    const slugify = (s: string) => {
        const base = (s || "")
            .trim()
            .toLowerCase()
            .replace(/[`_*~]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");
        const n = (slugCounts.get(base) || 0) + 1;
        slugCounts.set(base, n);
        return n > 1 ? `${base}-${n}` : base;
    };

    // On initial mount or when markdown changes, honor current URL hash
    useEffect(() => {
        if (typeof window === "undefined") return;
        const hash = window.location.hash;
        if (hash) {
            scrollToId(hash);
        }
        const onHashChange = () => {
            if (window.location.hash) scrollToId(window.location.hash);
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, [value]);

    return (
        <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h2({ children, ...props }: any) {
                        const id = slugify(textFromChildren(children));
                        return (
                            <h2 id={id} className="scroll-mt-28" {...props}>
                                {children}
                            </h2>
                        );
                    },
                    h3({ children, ...props }: any) {
                        const id = slugify(textFromChildren(children));
                        return (
                            <h3 id={id} className="scroll-mt-28" {...props}>
                                {children}
                            </h3>
                        );
                    },
                    h4({ children, ...props }: any) {
                        const id = slugify(textFromChildren(children));
                        return (
                            <h4 id={id} className="scroll-mt-28" {...props}>
                                {children}
                            </h4>
                        );
                    },
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        const lang = match?.[1];
                        if (!inline && lang) {
                            return (
                                <SyntaxHighlighter
                                    style={atomOneDark}
                                    language={lang as any}
                                    PreTag="div"
                                    {...props}
                                >
                                    {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                            );
                        }
                        // Inline code: strip any literal backticks if present at the edges
                        const raw = String(children ?? "");
                        const sanitized = raw.replace(/^`+|`+$/g, "");
                        return (
                            <code className={className} {...props}>
                                {sanitized}
                            </code>
                        );
                    },
                    table({ children }: any) {
                        return (
                            <div className="w-full overflow-x-auto">
                                <table className="table-auto border-collapse w-full">
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    th({ children }: any) {
                        return (
                            <th className="border px-3 py-2 text-left bg-muted/50">
                                {children}
                            </th>
                        );
                    },
                    td({ children }: any) {
                        return (
                            <td className="border px-3 py-2 align-top">
                                {children}
                            </td>
                        );
                    },
                }}
            >
                {value}
            </ReactMarkdown>
        </div>
    );
}

export default Markdown;
