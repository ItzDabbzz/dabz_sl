"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter/dist/esm';
import jsonLang from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

SyntaxHighlighter.registerLanguage('json', jsonLang);


export default function ApiDocsPage() {
    const [openApi, setOpenApi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [baseChoice, setBaseChoice] = useState<"origin" | "local">("origin");
    const [baseUrl, setBaseUrl] = useState("");
    const toc = openApi ? Object.entries(openApi.paths).map(([path, methods]: any) => {
        const method = Object.keys(methods)[0];
        return { id: `${method}-${path.replace(/[^a-zA-Z0-9]/g, "-")}`, label: `${method.toUpperCase()} ${path}` };
    }) : [];

    const filteredPaths = openApi ? Object.entries(openApi.paths).filter(([path, methods]: any) => {
        const method = Object.keys(methods)[0];
        const searchTerm = search.toLowerCase();
        return path.toLowerCase().includes(searchTerm) || method.toLowerCase().includes(searchTerm);
    }) : [];

    useEffect(() => {
        fetch("/api/docs")
            .then((res) => res.json())
            .then((data) => {
                setOpenApi(data);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load API docs");
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setBaseUrl(baseChoice === "origin" ? origin : "http://localhost:3000");
    }, [baseChoice]);

    const copyToClipboard = async (text: string) => {
        try { await navigator.clipboard.writeText(text); } catch {}
    };

    const methodBadgeClasses = (m: string) => {
        const method = m.toUpperCase();
        const common = "inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase border";
        switch (method) {
            case "GET":
                return `${common} bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800`;
            case "POST":
                return `${common} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800`;
            case "PUT":
                return `${common} bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800`;
            case "PATCH":
                return `${common} bg-cyan-100 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100 border-cyan-200 dark:border-cyan-800`;
            case "DELETE":
                return `${common} bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100 border-rose-200 dark:border-rose-800`;
            default:
                return `${common} bg-muted text-foreground border-muted`;
        }
    };

    const buildUrl = (path: string) => `${baseUrl || ""}${path}`;

    const makeCurlSample = (method: string, path: string) => {
        const url = buildUrl(path);
        const upper = method.toUpperCase();
        const needsBody = upper !== "GET" && upper !== "DELETE";
        const lines: string[] = [
            `curl -X ${upper} \\`,
            `  '${url}' \\`,
            `  -H 'Accept: application/json' \\`,
            `  -H 'Content-Type: application/json' \\`,
            needsBody
                ? `  -H 'Authorization: Bearer <token>' \\\n`
                : `  -H 'Authorization: Bearer <token>'`
        ];
        if (needsBody) {
            lines.push(
                `  -d '{`,
                `    "key": "value"`,
                `  }'`
            );
        }
        // Convert double backslashes in JS literal to single in output
        return lines.join("\n").replace(/\\\\/g, "\\");
    };

    const makeFetchSample = (method: string, path: string) => {
        const url = buildUrl(path);
        const upper = method.toUpperCase();
        const needsBody = upper !== "GET" && upper !== "DELETE";
        return `fetch('${url}', {\n  method: '${upper}',\n  headers: {\n    'Accept': 'application/json',\n    'Content-Type': 'application/json',\n    'Authorization': 'Bearer <token>'\n  },${needsBody ? "\n  body: JSON.stringify({ key: 'value' })," : ""}\n}).then(r => r.json());`;
    };

    return (
        <div className="mx-auto w-full max-w-7xl h-screen overflow-hidden bg-background px-4 md:px-6 lg:px-8">
            <ScrollArea className="w-full overflow-x-hidden h-[calc(100vh-6rem)] md:h-[calc(100vh-7rem)]">
                <div className="grid grid-cols-1 md:[grid-template-columns:minmax(0,260px)_minmax(0,1fr)] lg:[grid-template-columns:minmax(0,300px)_minmax(0,1fr)] gap-8 xl:gap-10 pt-10 pb-10">
                    {/* Table of Contents */}
                    <aside className="hidden md:block sticky top-8 self-start min-w-0">
                        <ScrollArea
                            className="h-[calc(100vh-2rem)] w-full max-w-full overflow-x-hidden rounded-lg border bg-card shadow-sm"
                            viewportClassName="px-4 [scrollbar-gutter:stable] md:[scrollbar-gutter:stable_both-edges]"
                        >
                            <div className="pt-4 pb-10 px-0 space-y-3 w-full min-w-0 overflow-x-clip">
                                <div className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Endpoints</div>
                                <input
                                    type="text"
                                    placeholder="Search endpoints..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="mb-1 block w-full max-w-full min-w-0 px-2 py-1 rounded-md border bg-background text-sm box-border focus-visible:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <ul className="space-y-2 text-sm">
                                    <li><a href="#overview" className="hover:underline block break-words">Overview</a></li>
                                    {toc.map((item) => (
                                        <li key={item.id}>
                                            <a href={`#${item.id}`} className="hover:underline block break-words">
                                                {item.label}
                                            </a>
                                        </li>
                                    ))}
                                    <li><a href="#download" className="hover:underline block break-words">Download</a></li>
                                </ul>
                            </div>
                        </ScrollArea>
                    </aside>
                    <main className="w-full min-w-0">
                        <div className="w-full max-w-none pb-10">
                            {/* Top toolbar */}
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    {/* Removed inline Home button; using floating button instead */}
                                    <span className="text-xs text-muted-foreground">OpenAPI 3.1</span>
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Select value={baseChoice} onValueChange={(v: any) => setBaseChoice(v)}>
                                        <SelectTrigger className="h-8 w-[200px] text-xs">
                                            <SelectValue placeholder="Base URL" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="origin">This site</SelectItem>
                                            <SelectItem value="local">http://localhost:3000</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div className="hidden sm:block text-xs text-muted-foreground truncate max-w-[220px]" title={baseUrl}>{baseUrl}</div>
                                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(baseUrl)}>
                                        Copy Base URL
                                    </Button>
                                </div>
                            </div>

                            <Card className="mb-8">
                                <CardHeader>
                                    <CardTitle>API Documentation</CardTitle>
                                    <CardDescription>
                                        OpenAPI 3.1.0 documentation for your API endpoints.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading && <div>Loading...</div>}
                                    {error && <div className="text-red-500">{error}</div>}
                                    {openApi && (
                                        <div className="prose prose-neutral dark:prose-invert max-w-none">
                                            <section id="overview">
                                                <h2 className="mt-0">{openApi.info.title}</h2>
                                                <p>{openApi.info.description}</p>
                                            </section>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            {openApi && filteredPaths.length === 0 && (
                                <div className="text-muted-foreground mt-8">No endpoints found.</div>
                            )}
                            {openApi && filteredPaths.map(([path, methods]: any) =>
                                Object.entries(methods).map(([method, details]: any) => {
                                    const sectionId = `${method}-${path.replace(/[^a-zA-Z0-9]/g, "-")}`;
                                    return (
                                        <Card key={sectionId} id={sectionId} className="mb-8">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <span className={methodBadgeClasses(method)}>
                                                        {method}
                                                    </span>
                                                    <span>{path}</span>
                                                </CardTitle>
                                                <CardDescription>
                                                    {details.summary || details.operationId || ""}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {details.description && <p className="mb-2 text-sm text-muted-foreground">{details.description}</p>}
                                                {details.requestBody && details.requestBody.content && (
                                                    <div className="mb-4">
                                                        <div className="mb-1 text-xs text-muted-foreground">Request Body ({Object.keys(details.requestBody.content).join(", ")})</div>
                                                        {Object.entries(details.requestBody.content).map(([type, content]: any) => (
                                                            <SyntaxHighlighter
                                                                key={type}
                                                                language="json"
                                                                style={atomOneDark}
                                                                wrapLongLines
                                                                customStyle={{
                                                                    background: "#181825",
                                                                    color: "#cdd6f4",
                                                                    padding: "1rem",
                                                                    fontSize: "0.75rem",
                                                                    whiteSpace: "pre-wrap",
                                                                    wordBreak: "break-word",
                                                                    overflowX: "hidden",
                                                                    borderRadius: "0.5rem",
                                                                    marginBottom: "0.5rem",
                                                                }}
                                                            >
                                                                {JSON.stringify(content.schema, null, 2)}
                                                            </SyntaxHighlighter>
                                                        ))}
                                                    </div>
                                                )}
                                                {details.responses && (
                                                    <div className="mb-4">
                                                        <div className="mb-1 text-xs text-muted-foreground">Responses</div>
                                                        <div className="space-y-4">
                                                            {Object.entries(details.responses).map(([code, resp]: any) => (
                                                                <div key={code} className="border rounded p-3 bg-muted/50">
                                                                    <div className="font-semibold flex items-center gap-2 mb-1">
                                                                        <span className="inline-block bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono font-semibold border border-primary/20">{code}</span>
                                                                        <span>{resp.description}</span>
                                                                    </div>
                                                                    {resp.content && Object.entries(resp.content).map(([type, content]: any) => (
                                                                        <SyntaxHighlighter
                                                                            key={type}
                                                                            language="json"
                                                                            style={atomOneDark}
                                                                            wrapLongLines
                                                                            customStyle={{
                                                                                background: "#181825",
                                                                                color: "#cdd6f4",
                                                                                padding: "1rem",
                                                                                fontSize: "0.75rem",
                                                                                whiteSpace: "pre-wrap",
                                                                                wordBreak: "break-word",
                                                                                overflowX: "hidden",
                                                                                borderRadius: "0.5rem",
                                                                            }}
                                                                        >
                                                                            {JSON.stringify(content.schema, null, 2)}
                                                                        </SyntaxHighlighter>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Code samples */}
                                                <div className="mt-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-xs text-muted-foreground">Code samples</div>
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(makeCurlSample(method, path))}>Copy cURL</Button>
                                                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(makeFetchSample(method, path))}>Copy fetch</Button>
                                                        </div>
                                                    </div>
                                                    <SyntaxHighlighter
                                                        language="bash"
                                                        style={atomOneDark}
                                                        wrapLongLines
                                                        customStyle={{ background: "#181825", color: "#cdd6f4", padding: "1rem", fontSize: "0.75rem", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "hidden", borderRadius: "0.5rem" }}
                                                    >
                                                        {makeCurlSample(method, path)}
                                                    </SyntaxHighlighter>
                                                    <SyntaxHighlighter
                                                        language="javascript"
                                                        style={atomOneDark}
                                                        wrapLongLines
                                                        customStyle={{ background: "#181825", color: "#cdd6f4", padding: "1rem", fontSize: "0.75rem", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "hidden", borderRadius: "0.5rem" }}
                                                    >
                                                        {makeFetchSample(method, path)}
                                                    </SyntaxHighlighter>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                            <Card className="mb-8" id="download">
                                <CardHeader>
                                    <CardTitle>Download</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Button asChild className="mt-2">
                                        <a href="/api/docs" download="openapi.json">Download OpenAPI JSON</a>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </main>
                </div>
            </ScrollArea>
            {/* Floating Home button */}
            <Button
                asChild
                className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full shadow-lg ring-1 ring-border bg-primary text-primary-foreground hover:opacity-90"
                aria-label="Go home"
            >
                <Link href="/">
                    <Home className="h-5 w-5" />
                </Link>
            </Button>
        </div>
    );
}
