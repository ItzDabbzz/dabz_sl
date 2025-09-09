"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmbedField { name: string; value: string; inline?: boolean }

const DEFAULT_VARS = JSON.stringify(
  {
    event: "test.ping",
    id: "evt_123",
    timestamp: new Date().toISOString(),
    data: {
      name: "Sample Object",
      status: "active",
      url: "https://example.com/object/123",
    },
  },
  null,
  2,
);

function isDiscordWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "discord.com" || u.hostname === "discordapp.com") &&
      u.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

function get(vars: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), vars);
}

function replaceVars(input: string, vars: any): string {
  if (!input) return input;
  return input.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, p1) => {
    const v = get(vars, p1.trim());
    return v === undefined || v === null ? "" : String(v);
  });
}

function hexToInt(hex?: string): number | undefined {
  if (!hex) return undefined;
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^([0-9a-fA-F]{6})$/.test(h)) return undefined;
  return parseInt(h, 16);
}

export function DiscordEmbedDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [channels, setChannels] = useState<Array<{ id: string; name: string; webhookUrl: string }>>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelUrl, setNewChannelUrl] = useState("");
  const [username, setUsername] = useState("SL Webhooks");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [content, setContent] = useState("{{event}} – ID: {{id}}");

  const [title, setTitle] = useState("{{data.name}}");
  const [titleUrl, setTitleUrl] = useState("{{data.url}}");
  const [description, setDescription] = useState("Status: **{{data.status}}**\nTimestamp: {{timestamp}}");
  const [colorHex, setColorHex] = useState("#3b82f6");
  const [useTimestamp, setUseTimestamp] = useState(true);

  const [authorName, setAuthorName] = useState("Arousal");
  const [authorUrl, setAuthorUrl] = useState("");
  const [authorIcon, setAuthorIcon] = useState("");

  const [footerText, setFooterText] = useState("Powered by SL");
  const [footerIcon, setFooterIcon] = useState("");

  const [thumbUrl, setThumbUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [fields, setFields] = useState<EmbedField[]>([
    { name: "Event", value: "{{event}}", inline: true },
    { name: "Status", value: "{{data.status}}", inline: true },
  ]);

  const [varsText, setVarsText] = useState(DEFAULT_VARS);
  const [presets, setPresets] = useState<Array<{ id: string; name: string; payloadJson: any }>>([]);
  const [presetName, setPresetName] = useState("");
  // scope
  const [scopeType, setScopeType] = useState<"org" | "team" | "user">("org");
  const [scopeId, setScopeId] = useState<string>("");

  const vars = useMemo(() => {
    try {
      return JSON.parse(varsText);
    } catch {
      return {} as any;
    }
  }, [varsText]);

  const payload = useMemo(() => {
    const col = hexToInt(colorHex);
    const embed: any = {
      title: replaceVars(title, vars),
      url: replaceVars(titleUrl, vars) || undefined,
      description: replaceVars(description, vars),
      color: typeof col === "number" ? col : undefined,
      timestamp: useTimestamp ? new Date().toISOString() : undefined,
      author:
        authorName || authorUrl || authorIcon
          ? {
              name: replaceVars(authorName, vars) || undefined,
              url: replaceVars(authorUrl, vars) || undefined,
              icon_url: replaceVars(authorIcon, vars) || undefined,
            }
          : undefined,
      footer:
        footerText || footerIcon
          ? {
              text: replaceVars(footerText, vars) || undefined,
              icon_url: replaceVars(footerIcon, vars) || undefined,
            }
          : undefined,
      thumbnail: thumbUrl ? { url: replaceVars(thumbUrl, vars) } : undefined,
      image: imageUrl ? { url: replaceVars(imageUrl, vars) } : undefined,
      fields: fields
        .filter((f) => f.name && f.value)
        .map((f) => ({ name: replaceVars(f.name, vars), value: replaceVars(f.value, vars), inline: !!f.inline })),
    };

    const base: any = {
      content: replaceVars(content, vars) || undefined,
      username: username || undefined,
      avatar_url: avatarUrl || undefined,
      embeds: [embed],
    };
    return base;
  }, [title, titleUrl, description, colorHex, useTimestamp, authorName, authorUrl, authorIcon, footerText, footerIcon, thumbUrl, imageUrl, fields, content, username, avatarUrl, vars]);

  // Load presets/channels when opened
  useEffect(() => {
    if (!open) return;
    reloadLists();
  }, [open, scopeType, scopeId]);

  async function reloadLists() {
    const qs = new URLSearchParams();
    if (scopeType) qs.set("scopeType", scopeType);
    if (scopeId) qs.set("scopeId", scopeId);
    try {
      const [p, c] = await Promise.all([
        fetch(`/api/creator/integrations/discord/presets?${qs.toString()}`).then((r) => r.json()).catch(() => ({ items: [] })),
        fetch(`/api/creator/integrations/discord/channels?${qs.toString()}`).then((r) => r.json()).catch(() => ({ items: [] })),
      ]);
      setPresets(p.items || []);
      setChannels(c.items || []);
    } catch {
      // ignore
    }
  }

  async function sendTest() {
    if (!isDiscordWebhookUrl(url)) {
      toast.error("Enter a valid Discord webhook URL");
      return;
    }
    try {
      const res = await fetch("/api/creator/integrations/discord/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, payload }),
      });
      if (!res.ok) throw new Error("non-200");
      toast.success("Sent to Discord");
    } catch {
      toast.error("Failed to send");
    }
  }

  async function sendToSelected() {
    const urls = channels.filter((c) => selectedChannelIds.includes(c.id)).map((c) => c.webhookUrl);
    if (urls.length === 0) {
      toast.error("Select at least one channel");
      return;
    }
    try {
      const res = await fetch("/api/creator/integrations/discord/send-multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("non-200");
      const okCount = Array.isArray(data?.results) ? data.results.filter((r: any) => r.ok).length : 0;
      toast.success(`Sent to ${okCount}/${urls.length}`);
    } catch {
      toast.error("Failed to send");
    }
  }

  async function savePreset() {
    if (!presetName.trim()) return toast.error("Preset needs a name");
    try {
      const body: any = { name: presetName.trim(), payload, scopeType };
      if (scopeId) body.scopeId = scopeId;
      const res = await fetch("/api/creator/integrations/discord/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("non-200");
      setPresetName("");
  await reloadLists();
      toast.success("Preset saved");
    } catch {
      toast.error("Failed to save preset");
    }
  }

  function applyPreset(p: { payloadJson: any }) {
    const pl = p?.payloadJson || {};
    setContent(pl.content || "");
    setUsername(pl.username || "");
    setAvatarUrl(pl.avatar_url || "");
    const e = Array.isArray(pl.embeds) ? pl.embeds[0] || {} : {};
    setTitle(e.title || "");
    setTitleUrl(e.url || "");
    setDescription(e.description || "");
    setColorHex(typeof e.color === "number" ? `#${e.color.toString(16).padStart(6, "0")}` : "#3b82f6");
    setUseTimestamp(Boolean(e.timestamp));
    setAuthorName(e.author?.name || "");
    setAuthorUrl(e.author?.url || "");
    setAuthorIcon(e.author?.icon_url || "");
    setFooterText(e.footer?.text || "");
    setFooterIcon(e.footer?.icon_url || "");
    setThumbUrl(e.thumbnail?.url || "");
    setImageUrl(e.image?.url || "");
    setFields(Array.isArray(e.fields) ? e.fields.map((f: any) => ({ name: f.name, value: f.value, inline: !!f.inline })) : []);
  }

  function addField() {
    setFields((prev) => [...prev, { name: "", value: "", inline: false }]);
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Discord embeds</Button>
      </DialogTrigger>
  <DialogContent className="max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>Discord webhook embeds</DialogTitle>
          <DialogDescription>Create professional, clean embeds and send to a Discord webhook URL.</DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">Scope</label>
          <select
            className="h-8 rounded border bg-background px-2 text-sm"
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as any)}
          >
            <option value="org">Org</option>
            <option value="team">Team</option>
            <option value="user">User</option>
          </select>
          <Input
            placeholder="Scope ID (optional: defaults to your current org/user)"
            className="h-8 w-80"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          />
          <Button size="sm" variant="outline" type="button" onClick={reloadLists}>Reload</Button>
        </div>

  <ScrollArea className="h-[70vh]" viewportClassName="pr-2">
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {/* Presets */}
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Presets</div>
                <div className="flex items-center gap-2">
                  <Input placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} className="h-8 w-40" />
                  <Button size="sm" variant="outline" type="button" onClick={savePreset}>Save</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <div key={p.id} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
                    <button type="button" onClick={() => applyPreset(p)} className="hover:underline">
                      {p.name}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        const name = prompt("Rename preset", p.name);
                        if (!name) return;
                        await fetch(`/api/creator/integrations/discord/presets/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
                        const qs = new URLSearchParams();
                        if (scopeType) qs.set("scopeType", scopeType);
                        if (scopeId) qs.set("scopeId", scopeId);
                        await reloadLists();
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="text-rose-600"
                      onClick={async () => {
                        if (!confirm("Delete preset?")) return;
                        await fetch(`/api/creator/integrations/discord/presets/${p.id}`, { method: "DELETE" });
                        await reloadLists();
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {presets.length === 0 && (
                  <div className="text-xs text-muted-foreground">No presets yet.</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disc-url">Discord webhook URL</Label>
              <Input id="disc-url" placeholder="https://discord.com/api/webhooks/..." value={url} onChange={(e) => setUrl(e.target.value)} />
              {!url ? (
                <p className="text-xs text-muted-foreground">From your Discord channel ➜ Edit Channel ➜ Integrations ➜ Webhooks ➜ Copy URL.</p>
              ) : (
                <p className={cn("text-xs", isDiscordWebhookUrl(url) ? "text-emerald-600" : "text-amber-600")}>{isDiscordWebhookUrl(url) ? "Valid Discord webhook" : "Invalid Discord webhook"}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Avatar URL</Label>
                <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <Input value={content} onChange={(e) => setContent(e.target.value)} />
              <p className="text-xs text-muted-foreground">Supports variables like {'{{event}}'}, {'{{id}}'}, {'{{data.name}}'}.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Title URL</Label>
                <Input value={titleUrl} onChange={(e) => setTitleUrl(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Color (hex)</Label>
                <Input value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#3b82f6" />
              </div>
              <div className="space-y-2">
                <Label>Timestamp</Label>
                <div className="flex items-center gap-2">
                  <input id="ts" type="checkbox" checked={useTimestamp} onChange={(e) => setUseTimestamp(e.target.checked)} />
                  <Label htmlFor="ts">Add now()</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Author name</Label>
                <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Author URL</Label>
                <Input value={authorUrl} onChange={(e) => setAuthorUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Author icon</Label>
                <Input value={authorIcon} onChange={(e) => setAuthorIcon(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Footer text</Label>
                <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Footer icon</Label>
                <Input value={footerIcon} onChange={(e) => setFooterIcon(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Thumbnail URL</Label>
                <Input value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fields</Label>
                <Button type="button" size="sm" variant="outline" onClick={addField}>Add field</Button>
              </div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-3" placeholder="Name" value={f.name} onChange={(e) => setFields((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} />
                    <Input className="col-span-7" placeholder="Value" value={f.value} onChange={(e) => setFields((prev) => prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} />
                    <div className="col-span-2 flex items-center gap-2">
                      <input id={`in-${i}`} type="checkbox" checked={!!f.inline} onChange={(e) => setFields((prev) => prev.map((x, idx) => (idx === i ? { ...x, inline: e.target.checked } : x)))} />
                      <Label htmlFor={`in-${i}`}>Inline</Label>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeField(i)}>✕</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Variables JSON</Label>
              <Textarea value={varsText} onChange={(e) => setVarsText(e.target.value)} rows={6} />
            </div>
          </div>

          <div className="space-y-4">
            {/* Channels */}
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Saved channels</div>
                <div className="flex items-center gap-2">
                  <Input placeholder="Name" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} className="h-8 w-32" />
                  <Input placeholder="Webhook URL" value={newChannelUrl} onChange={(e) => setNewChannelUrl(e.target.value)} className="h-8 w-64" />
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={async () => {
                      if (!newChannelName.trim() || !isDiscordWebhookUrl(newChannelUrl)) return toast.error("Enter a name and valid webhook");
                      try {
                        const r = await fetch("/api/creator/integrations/discord/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newChannelName.trim(), webhookUrl: newChannelUrl, scopeType, scopeId }) });
                        if (!r.ok) throw new Error("non-200");
                        setNewChannelName("");
                        setNewChannelUrl("");
                        await reloadLists();
                      } catch {
                        toast.error("Failed to add channel");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              {channels.length ? (
                <div className="flex flex-wrap gap-2">
                  {channels.map((c) => {
                    const sel = selectedChannelIds.includes(c.id);
                    return (
                      <div key={c.id} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedChannelIds((prev) =>
                              sel ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                            )
                          }
                          className={cn("hover:underline", sel && "font-medium")}
                        >
                          {c.name}
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={async () => {
                            const name = prompt("Rename channel", c.name) || c.name;
                            const webhookUrl = prompt("Update webhook URL", c.webhookUrl) || c.webhookUrl;
                            if (!isDiscordWebhookUrl(webhookUrl)) return toast.error("Invalid webhook URL");
                            await fetch(`/api/creator/integrations/discord/channels/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, webhookUrl }) });
                            const qs = new URLSearchParams();
                            if (scopeType) qs.set("scopeType", scopeType);
                            if (scopeId) qs.set("scopeId", scopeId);
                            const list = await fetch(`/api/creator/integrations/discord/channels?${qs.toString()}`).then((x) => x.json()).catch(() => ({ items: [] }));
                            setChannels(list.items || []);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="text-rose-600"
                          onClick={async () => {
                            if (!confirm("Delete channel?")) return;
                            await fetch(`/api/creator/integrations/discord/channels/${c.id}`, { method: "DELETE" });
                            setChannels((prev) => prev.filter((x) => x.id !== c.id));
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No saved channels.</div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" type="button" variant="secondary" onClick={sendToSelected} disabled={selectedChannelIds.length === 0}>
                  Send to selected ({selectedChannelIds.length})
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs text-muted-foreground">Preview</div>
              <DiscordPreview payload={payload} />
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">JSON payload</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => toast.success("Copied JSON"))}
                  >
                    Copy JSON
                  </Button>
                  <Button size="sm" type="button" onClick={sendTest} disabled={!isDiscordWebhookUrl(url)}>Send test</Button>
                </div>
              </div>
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(payload, null, 2)}</pre>
            </div>
          </div>
  </div>
  </ScrollArea>

        <DialogFooter>
          <div className="text-xs text-muted-foreground">Tip: Use variables like {'{{data.name}}'} in fields. Only Discord hosts are allowed when sending.</div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscordPreview({ payload }: { payload: any }) {
  const embed = payload?.embeds?.[0] ?? {};
  const color = typeof embed.color === "number" ? `#${embed.color.toString(16).padStart(6, "0")}` : "#2b2d31";
  return (
    <div className="rounded-md bg-[#2b2d31] p-3 text-white">
      <div className="mb-2 flex items-center gap-2">
        {payload?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={payload.avatar_url} alt="avatar" className="size-6 rounded-full" />
        ) : (
          <div className="size-6 rounded-full bg-[#5865f2]" />
        )}
        <div className="text-sm font-semibold">{payload?.username || "Bot"}</div>
        <div className="text-xs text-[#b5bac1]">Today at {new Date().toLocaleTimeString()}</div>
      </div>
      {payload?.content && <div className="mb-2 whitespace-pre-wrap text-sm">{payload.content}</div>}
      <div className="flex gap-2">
        <div className="w-1 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1 rounded-md bg-[#313338] p-3">
          {embed.author?.name && (
            <div className="mb-1 text-xs text-[#b5bac1]">{embed.author.name}</div>
          )}
          {embed.title && (
            <div className="text-sm font-semibold text-[#e3e5e8]">{embed.title}</div>
          )}
          {embed.description && (
            <div className="mt-1 whitespace-pre-wrap text-sm text-[#dbdee1]">{embed.description}</div>
          )}
          {Array.isArray(embed.fields) && embed.fields.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {embed.fields.map((f: any, i: number) => (
                <div key={i} className="rounded bg-[#2b2d31] p-2 text-sm">
                  <div className="text-xs font-semibold text-[#e3e5e8]">{f.name}</div>
                  <div className="text-[#dbdee1]">{f.value}</div>
                </div>
              ))}
            </div>
          )}
          {embed.image?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={embed.image.url} alt="image" className="mt-2 max-h-64 w-full rounded object-cover" />
          )}
          <div className="mt-2 text-xs text-[#b5bac1]">{embed.footer?.text}</div>
        </div>
        {embed.thumbnail?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={embed.thumbnail.url} alt="thumb" className="size-16 rounded object-cover" />
        )}
      </div>
    </div>
  );
}
