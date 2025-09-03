"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, Copy, Download, Link as LinkIcon, Settings } from "lucide-react";

function normalizeUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Scraper() {
  const [urlsText, setUrlsText] = useState("");
  const [savedAuth, setSavedAuth] = useState<any | null>(null);
  const [xlsx, setXlsx] = useState(false);
  const [concurrency, setConcurrency] = useState(3);
  const [headless, setHeadless] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Load any locally saved auth.json contents
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mp:auth");
      if (raw) setSavedAuth(JSON.parse(raw));
    } catch {}
  }, []);

  const urls = useMemo(() => normalizeUrls(urlsText), [urlsText]);

  const handleAuthFile = async (f: File) => {
    try {
      const txt = await f.text();
      const json = JSON.parse(txt);
      localStorage.setItem("mp:auth", JSON.stringify(json));
      setSavedAuth(json);
      setMessage(`Saved auth from ${f.name} locally (browser only)`);
    } catch {
      setMessage("Invalid auth.json file");
    }
  };

  const buildCommand = () => {
    const parts: string[] = [
      "pnpm",
      "--filter",
      "@dabz/scraper-cli",
      "dev",
    ];
    if (headless === false) parts.push("--headless", "false");
    if (concurrency && concurrency !== 3) parts.push("--concurrency", String(concurrency));
    if (xlsx) parts.push("--xlsx");
    if (urls.length) {
      // include as repeated --url flags for simplicity
      urls.forEach((u) => parts.push("--url", u));
    }
    return parts.join(" ");
  };

  const downloadUrls = () => {
    const blob = new Blob([urls.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "urls.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(buildCommand());
      setMessage("Copied command to clipboard");
    } catch {
      setMessage("Failed to copy");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scrape</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">1) Upload your auth.json (from running the CLI login). This is kept only in your browser.</div>
          <div className="flex items-center gap-2">
            <Input type="file" accept="application/json" onChange={(e) => e.target.files && e.target.files[0] && handleAuthFile(e.target.files[0])} />
            <Button variant="outline" size="icon" title="Upload"><Upload className="h-4 w-4" /></Button>
            {savedAuth && <Badge variant="secondary">Auth saved</Badge>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">2) Enter product URLs (one per line) or paste from a file.</div>
          <Textarea rows={6} placeholder="https://marketplace.secondlife.com/p/...\nhttps://marketplace.secondlife.com/p/..." value={urlsText} onChange={(e) => setUrlsText(e.target.value)} />
          <div className="flex items-center gap-2">
            <Button onClick={downloadUrls} variant="outline" className="inline-flex items-center gap-1"><Download className="h-4 w-4" /> Download urls.txt</Button>
            <div className="ml-auto text-xs text-muted-foreground">{urls.length} URL(s)</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm">Concurrency</label>
            <Input type="number" className="w-20" min={1} max={10} value={concurrency} onChange={(e) => setConcurrency(parseInt(e.target.value || "3", 10))} />
          </div>
          <div className="inline-flex items-center gap-2">
            <input id="xlsx" type="checkbox" checked={xlsx} onChange={(e) => setXlsx(e.target.checked)} />
            <label htmlFor="xlsx" className="text-sm">Write Excel</label>
          </div>
          <div className="inline-flex items-center gap-2">
            <input id="headless" type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} />
            <label htmlFor="headless" className="text-sm">Headless</label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">3) Run this command locally (from the repo root):</div>
          <pre className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">{buildCommand()}</pre>
          <div className="flex items-center gap-2">
            <Button onClick={copyCmd} className="inline-flex items-center gap-1"><Copy className="h-4 w-4" /> Copy</Button>
            <span className="text-xs text-muted-foreground">Auth file path used by CLI: <code>out/auth.json</code>. Ensure your auth.json exists at that path (CLI login creates it).</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          After it finishes, upload the produced JSON with the Import JSON section above, then assign categories and import.
        </div>

        {message && <div className="text-sm text-muted-foreground">{message}</div>}
      </CardContent>
    </Card>
  );
}
