"use client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function compileTemplate(html: string, vars: Record<string, string>) {
  return html
    .replace(/\{\{\s*title\s*\}\}/g, vars.title || "")
    .replace(/\{\{\s*excerpt\s*\}\}/g, vars.excerpt || "")
    .replace(/\{\{\s*url\s*\}\}/g, vars.url || "");
}

const BASE_TEMPLATE = `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>{{title}}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0c;color:#e5e7eb;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#0b0b0c;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:100%;max-width:600px;background:#111214;border:1px solid #232428;border-radius:10px;">
            <tr>
              <td style="padding:24px 24px 0 24px;">
                <h1 style="margin:0 0 8px 0;font-size:22px;line-height:28px;color:#fff;">{{title}}</h1>
                <p style="margin:0 0 16px 0;color:#9ca3af;font-size:14px;line-height:20px;">{{excerpt}}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;">
                <a href="{{url}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;font-size:14px;">Read the post</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;">
                <hr style="border:none;border-top:1px solid #232428;margin:0 0 16px 0"/>
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:18px;">You are receiving this because you opted-in to updates. If this was a mistake, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export function EmailTemplateEditor({ initialSubject, initialHtml }: { initialSubject?: string; initialHtml?: string; }) {
  const [subject, setSubject] = useState(initialSubject || "New post: {{title}}");
  const [html, setHtml] = useState(initialHtml || BASE_TEMPLATE);
  const [sample, setSample] = useState({
    title: "Announcing our latest post",
    excerpt: "A short description that teases the content.",
    url: typeof window !== "undefined" ? window.location.origin + "/blog/example" : "https://example.com/blog/example",
  });

  const compiled = useMemo(() => compileTemplate(html, sample), [html, sample]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Email Subject (default)</label>
        <Input name="emailTemplateSubject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label className="text-sm font-medium mt-3 block">Email HTML (default)</label>
        <textarea
          name="emailTemplateHtml"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="w-full min-h-[260px] rounded border bg-background p-3 font-mono text-sm"
          placeholder="HTML template; variables: {{title}}, {{excerpt}}, {{url}}"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setHtml(BASE_TEMPLATE)}>Use base template</Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Preview vars:</span>
            <Input value={sample.title} onChange={(e) => setSample({ ...sample, title: e.target.value })} className="h-8 w-40" />
            <Input value={sample.excerpt} onChange={(e) => setSample({ ...sample, excerpt: e.target.value })} className="h-8 w-56" />
            <Input value={sample.url} onChange={(e) => setSample({ ...sample, url: e.target.value })} className="h-8 w-56" />
          </div>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Preview</div>
        <div className="rounded border bg-background overflow-hidden">
          <div className="h-[420px] w-full overflow-auto" dangerouslySetInnerHTML={{ __html: compiled }} />
        </div>
      </div>
    </div>
  );
}

export default EmailTemplateEditor;
