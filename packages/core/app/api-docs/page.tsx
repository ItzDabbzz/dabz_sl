"use client";


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter/dist/esm';
import jsonLang from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', jsonLang);


export default function ApiDocsPage() {
    const [openApi, setOpenApi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
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
            .catch((err) => {
                setError("Failed to load API docs");
                setLoading(false);
            });
    }, []);

    return (
        <div className="flex justify-center items-start min-h-screen bg-background px-2 md:px-0">
            {/* Table of Contents */}
            <aside className="hidden md:block sticky top-8 h-fit min-w-[260px] mr-8 mt-12">
                <nav className="bg-card border rounded-lg p-4 shadow-sm">
                    <div className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Endpoints</div>
                    <input
                        type="text"
                        placeholder="Search endpoints..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="mb-3 w-full px-2 py-1 rounded border bg-background text-sm"
                    />
                    <ul className="space-y-2 text-sm max-h-[60vh] overflow-y-auto">
                        <li><a href="#overview" className="hover:underline">Overview</a></li>
                        {toc.map((item) => (
                            <li key={item.id}>
                                <a href={`#${item.id}`} className="hover:underline">
                                    {item.label}
                                </a>
                            </li>
                        ))}
                        <li><a href="#download" className="hover:underline">Download</a></li>
                    </ul>
                </nav>
            </aside>
            <main className="flex-1 flex flex-col items-center w-full">
                <div className="w-full max-w-2xl mt-12">
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
                                            <span className="inline-block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded text-xs font-mono font-semibold border border-green-200 dark:border-green-800 uppercase">
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
                                                        customStyle={{
                                                            background: "#181825",
                                                            color: "#cdd6f4",
                                                            padding: "1rem",
                                                            fontSize: "0.75rem",
                                                            overflowX: "auto",
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
                                                                    customStyle={{
                                                                        background: "#181825",
                                                                        color: "#cdd6f4",
                                                                        padding: "1rem",
                                                                        fontSize: "0.75rem",
                                                                        overflowX: "auto",
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
    );
}
