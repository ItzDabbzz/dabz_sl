"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createCategory, updateCategory, deleteCategory } from "./actions";
import { OrgTeamPicker } from "@/components/pickers/org-team-picker";
import { UserPicker } from "@/components/pickers/user-picker";
import { cn } from "@/lib/utils";

interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: any;
  createdAt: string;
}

interface Props {
  categories: CategoryRecord[];
  count: number;
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function CategoriesClient({ categories, count }: Props) {
  const [query, setQuery] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<Record<string, boolean>>({});

  function onNameChange(v: string) {
    setName(v);
    if (autoSlug) setSlug(slugify(v));
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(c => [c.name, c.slug, c.description || ""].some(f => f.toLowerCase().includes(q)));
  }, [query, categories]);

  const slugExists = slug && categories.some(c => c.slug === slug);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">{count} total · {filtered.length !== categories.length ? `${filtered.length} shown` : "all"}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)} className="h-8 w-56" />
          <Button size="sm" onClick={()=>setShowCreate(s=>!s)} variant={showCreate?"secondary":"default"}>{showCreate?"Close" : "New"}</Button>
        </div>
      </div>

      {showCreate && (
        <Card className="border-primary/40">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Create Category</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCategory} className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Input name="name" value={name} onChange={e=>onNameChange(e.target.value)} placeholder="Name" required />
                  <p className="text-[11px] text-muted-foreground">Primary display name.</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input name="slug" value={slug} onChange={e=>{ setSlug(e.target.value); setAutoSlug(false); }} placeholder="auto" className={cn(slugExists && "border-destructive")}/>
                    <Button type="button" size="sm" variant="outline" className="h-8" onClick={()=>{ setSlug(slugify(name)); setAutoSlug(true); }}>↺</Button>
                  </div>
                  <p className={cn("text-[11px]", slugExists ? "text-destructive" : "text-muted-foreground")}>{slugExists ? "Slug already exists" : "URL slug (auto)"}</p>
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Input name="description" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description (optional)" />
                </div>
              </div>

              <details className="rounded border">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm">Visibility (advanced)</summary>
                <div className="p-3 grid gap-3 lg:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Mode</label>
                    <select name="visibilityMode" className="w-full rounded border bg-background px-3 py-2">
                      <option value="public">Public</option>
                      <option value="login">Logged-in only</option>
                      <option value="restricted">Restricted (match any)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Roles</label>
                    <Input name="roles" placeholder="owner,admin" />
                  </div>
                  <div className="space-y-1">
                    <OrgTeamPicker labelOrg="Organizations" labelTeams="Teams" preferTeamPicker />
                  </div>
                  <div className="space-y-1">
                    <UserPicker label="Whitelist users" name="userIds" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Emails</label>
                    <Input name="emails" placeholder="a@b.com, c@d.com" />
                  </div>
                  <p className="text-xs text-muted-foreground lg:col-span-3">When Restricted, access is granted if any list matches the viewer.</p>
                </div>
              </details>

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={!name.trim() || !slug.trim() || !!slugExists}>Create</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Existing</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y border-t">
            {filtered.map(c => {
              const open = !!openEdit[c.id];
              const v = (c as any).visibility || {}; 
              return (
                <div key={c.id} className={cn("transition-colors", open && "bg-muted/30")}> 
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate max-w-[200px]" title={c.name}>{c.name}</span>
                        <Badge variant="outline" className="text-[10px]" title={c.slug}>{c.slug}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{(v.mode || "public").toUpperCase()}</Badge>
                        {c.description && <span className="text-xs text-muted-foreground truncate max-w-[240px]" title={c.description}>{c.description}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 flex gap-2 flex-wrap">
                        {!!(v.roles||[]).length && <span>roles:{(v.roles||[]).length}</span>}
                        {!!(v.orgIds||[]).length && <span>orgs:{(v.orgIds||[]).length}</span>}
                        {!!(v.teamIds||[]).length && <span>teams:{(v.teamIds||[]).length}</span>}
                        {!!(v.userIds||[]).length && <span>users:{(v.userIds||[]).length}</span>}
                        {!!(v.emails||[]).length && <span>emails:{(v.emails||[]).length}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={()=>setOpenEdit(m=>({...m,[c.id]:!open}))}>{open?"Close":"Edit"}</Button>
                      <form action={deleteCategory} onSubmit={(e)=>{ if(!confirm("Delete category?")) { e.preventDefault(); } }}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button size="sm" variant="destructive">Delete</Button>
                      </form>
                    </div>
                  </div>
                  {open && (
                    <div className="px-4 pb-4">
                      <form action={updateCategory} className="grid gap-3 rounded-md border p-3 bg-background/60">
                        <input type="hidden" name="id" value={c.id} />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input name="name" defaultValue={c.name} placeholder="Name" />
                          <Input name="slug" defaultValue={c.slug} placeholder="Slug" />
                          <Input name="description" defaultValue={c.description || ""} placeholder="Description (optional)" />
                        </div>
                        <details>
                          <summary className="cursor-pointer text-xs mb-2">Visibility</summary>
                          <div className="grid gap-3 lg:grid-cols-3">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Mode</label>
                              <select name="visibilityMode" defaultValue={v.mode || "public"} className="w-full rounded border bg-background px-3 py-2">
                                <option value="public">Public</option>
                                <option value="login">Logged-in only</option>
                                <option value="restricted">Restricted (match any)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Roles</label>
                              <Input name="roles" defaultValue={(v.roles||[]).join(", ")} placeholder="owner,admin" />
                            </div>
                            <div className="space-y-1">
                              <OrgTeamPicker defaultOrgIds={v.orgIds||[]} defaultTeamIds={v.teamIds||[]} preferTeamPicker />
                            </div>
                            <div className="space-y-1">
                              <UserPicker label="Whitelist users" name="userIds" defaultUserIds={v.userIds||[]} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Emails</label>
                              <Input name="emails" defaultValue={(v.emails||[]).join(", ")} placeholder="a@b.com, c@d.com" />
                            </div>
                            <p className="text-xs text-muted-foreground lg:col-span-3">When Restricted, access is granted if any list matches.</p>
                          </div>
                        </details>
                        <div className="flex justify-end gap-2">
                          <Button type="submit" variant="secondary">Save Changes</Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
            {!filtered.length && (
              <div className="px-4 py-8 text-sm text-muted-foreground text-center">No categories</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
