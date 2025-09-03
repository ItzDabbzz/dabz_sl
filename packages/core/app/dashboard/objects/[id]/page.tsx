import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
import { JsonEditor } from "@/components/json-editor";
import { VisualConfigEditor } from "@/components/visual-config-editor";

// Save basic details (name, description, visibility)
async function saveDetails(formData: FormData) {
    "use server";
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "");
    const description = String(formData.get("description") || "");
    const visibility = String(formData.get("visibility") || "private");
    const outHeaders = new Headers({ "Content-Type": "application/json" });
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);
    await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: outHeaders,
            body: JSON.stringify({ name, description, visibility }),
        },
    );
    revalidatePath(`/dashboard/objects/${id}`);
}

// Save config schema JSON
async function saveSchema(formData: FormData) {
    "use server";
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const id = String(formData.get("id") || "");
    const schemaText = String(formData.get("configSchemaJson") || "");
    let configSchemaJson: any | undefined;
    try {
        configSchemaJson = schemaText ? JSON.parse(schemaText) : null;
    } catch {
        // Ignore invalid JSON to avoid 500; user can fix and resubmit
        return;
    }
    const outHeaders = new Headers({ "Content-Type": "application/json" });
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);
    await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: outHeaders,
            body: JSON.stringify({ configSchemaJson }),
        },
    );
    revalidatePath(`/dashboard/objects/${id}`);
}

// Save default config JSON
async function saveDefaultConfig(formData: FormData) {
    "use server";
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const id = String(formData.get("id") || "");
    const cfgText = String(formData.get("defaultConfigJson") || "");
    let defaultConfigJson: any | undefined;
    try {
        defaultConfigJson = cfgText ? JSON.parse(cfgText) : null;
    } catch {
        return;
    }
    const outHeaders = new Headers({ "Content-Type": "application/json" });
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);
    await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: outHeaders,
            body: JSON.stringify({ defaultConfigJson }),
        },
    );
    revalidatePath(`/dashboard/objects/${id}`);
}

// Create a new version entry
async function createVersion(formData: FormData) {
    "use server";
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const id = String(formData.get("id") || "");
    const version = Number(formData.get("version") || 0);
    const changelog = String(formData.get("changelog") || "");
    const migrationRef = String(formData.get("migrationRef") || "");
    const outHeaders = new Headers({ "Content-Type": "application/json" });
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);
    await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}/versions`,
        {
            method: "POST",
            headers: outHeaders,
            body: JSON.stringify({ version, changelog, migrationRef }),
        },
    );
    revalidatePath(`/dashboard/objects/${id}`);
}

// Delete object
async function deleteObject(formData: FormData) {
    "use server";
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const id = String(formData.get("id") || "");
    const outHeaders = new Headers();
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);
    await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}`,
        { method: "DELETE", headers: outHeaders },
    );
    redirect("/dashboard/objects");
}

// Promote/demote current version
async function setCurrentVersion(formData: FormData) {
    "use server";
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const id = String(formData.get("id") || "");
    const currentVersion = Number(formData.get("currentVersion") || 0);
    const outHeaders = new Headers({ "Content-Type": "application/json" });
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);
    await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: outHeaders,
            body: JSON.stringify({ currentVersion }),
        },
    );
    revalidatePath(`/dashboard/objects/${id}`);
}

// Save visual config (fields -> JSON Schema + Default Config)
async function saveVisualConfig(formData: FormData) {
    "use server";
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const id = String(formData.get("id") || "");
    const payload = String(formData.get("payload") || "");

    let parsed: any;
    try {
        parsed = payload ? JSON.parse(payload) : null;
    } catch {
        return;
    }
    const fields: Array<{
        name: string;
        type: string;
        required?: boolean;
        enumOptions?: string[];
        defaultValue?: any;
    }> = Array.isArray(parsed?.fields) ? parsed.fields : [];

    const schema: any = {
        type: "object",
        properties: {},
        required: [] as string[],
    };
    const defaults: any = {};

    for (const f of fields) {
        if (!f?.name) continue;
        const name = String(f.name);
        const t = String(f.type || "string");
        if (t === "enum") {
            const opts = Array.isArray(f.enumOptions)
                ? f.enumOptions.filter(Boolean)
                : [];
            schema.properties[name] = {
                type: "string",
                enum: opts.length ? opts : undefined,
            };
        } else if (t === "boolean") {
            schema.properties[name] = { type: "boolean" };
        } else if (t === "number") {
            schema.properties[name] = { type: "number" };
        } else {
            schema.properties[name] = { type: "string" };
        }
        if (f.required) schema.required.push(name);
        if (f.defaultValue !== undefined && f.defaultValue !== null) {
            defaults[name] = f.defaultValue;
        }
    }
    if (!schema.required.length) delete schema.required;

    const outHeaders = new Headers({ "Content-Type": "application/json" });
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);
    await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: outHeaders,
            body: JSON.stringify({
                configSchemaJson: schema,
                defaultConfigJson: defaults,
            }),
        },
    );
    revalidatePath(`/dashboard/objects/${id}`);
}

export default async function EditObjectPage(props: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth.api
        .getSession({ headers: await headers() })
        .catch(() => null);
    if (!session) return redirect("/sign-in");

    const { id } = await props.params;
    const hdrs = await headers();
    const base = process.env.NEXT_PUBLIC_APP_URL || hdrs.get("x-url") || "";
    const outHeaders = new Headers();
    const cookie = hdrs.get("cookie");
    if (cookie) outHeaders.set("cookie", cookie);

    const res = await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}`,
        { headers: outHeaders },
    );
    const obj = await res.json().catch(() => null);
    if (!obj || obj.error) return redirect("/dashboard/objects");

    const resV = await fetch(
        `${base}/api/creator/master-objects/${encodeURIComponent(id)}/versions`,
        { headers: outHeaders },
    );
    const versionsJson = await resV.json().catch(() => ({ items: [] }));
    const versions = Array.isArray(versionsJson?.items)
        ? versionsJson.items
        : [];

    // Build initial fields from schema/defaults (flat object only)
    function schemaToFields(schema: any, defaults: any) {
        const fields: any[] = [];
        const props =
            schema?.properties && typeof schema.properties === "object"
                ? schema.properties
                : {};
        const req: string[] = Array.isArray(schema?.required)
            ? schema.required
            : [];
        for (const key of Object.keys(props)) {
            const p = props[key] || {};
            const type = Array.isArray(p.type) ? p.type[0] : p.type || "string";
            const isEnum = Array.isArray(p.enum) && p.enum.length;
            fields.push({
                name: key,
                type: isEnum ? "enum" : type,
                enumOptions: isEnum ? p.enum : undefined,
                required: req.includes(key),
                defaultValue: defaults?.[key],
            });
        }
        return fields;
    }
    const initialFields = schemaToFields(
        obj.configSchemaJson,
        obj.defaultConfigJson,
    );

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-xl font-semibold">Edit Master Object</h1>

            {/* Visual Config Builder */}
            <Card>
                <CardHeader>
                    <CardTitle>Visual Config Builder</CardTitle>
                </CardHeader>
                <CardContent>
                    <VisualConfigEditor
                        objectId={id}
                        initialFields={initialFields}
                        action={saveVisualConfig}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={saveDetails} className="grid gap-4">
                        <input type="hidden" name="id" value={id} />
                        <div className="grid gap-2">
                            <label className="text-sm">Name</label>
                            <Input
                                name="name"
                                defaultValue={obj.name}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm">Description</label>
                            <Textarea
                                name="description"
                                rows={5}
                                defaultValue={obj.description || ""}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm">Visibility</label>
                            <select
                                name="visibility"
                                defaultValue={obj.visibility || "private"}
                                className="border rounded px-3 py-2 text-sm bg-background"
                            >
                                <option value="private">private</option>
                                <option value="org">org</option>
                                <option value="public">public</option>
                            </select>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">
                                <div>ID: {obj.id}</div>
                                {obj.currentVersion != null && (
                                    <div>
                                        Current Version: {obj.currentVersion}
                                    </div>
                                )}
                                {obj.createdAt && (
                                    <div>
                                        Created:{" "}
                                        {new Date(
                                            obj.createdAt,
                                        ).toLocaleString()}
                                    </div>
                                )}
                                {obj.updatedAt && (
                                    <div>
                                        Updated:{" "}
                                        {new Date(
                                            obj.updatedAt,
                                        ).toLocaleString()}
                                    </div>
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <div className="font-medium text-foreground">
                                    Ownership
                                </div>
                                {obj.orgId && <div>Org: {obj.orgId}</div>}
                                {obj.teamId && <div>Team: {obj.teamId}</div>}
                                {obj.ownerUserId && (
                                    <div>User: {obj.ownerUserId}</div>
                                )}
                                {!obj.orgId &&
                                    !obj.teamId &&
                                    !obj.ownerUserId && <div>Unscoped</div>}
                            </div>
                        </div>
                        <Button type="submit">Save Details</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Config Schema (JSON)</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={saveSchema} className="grid gap-4">
                        <input type="hidden" name="id" value={id} />
                        {/* JSON editor with client-side parsing/formatting */}
                        <JsonEditor
                            name="configSchemaJson"
                            initialValue={obj.configSchemaJson ?? {}}
                            required
                            minRows={14}
                            requireObject
                            invalidMessage="Schema must be a JSON object"
                        />
                        <Button type="submit">Save Schema</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Default Config (JSON)</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={saveDefaultConfig} className="grid gap-4">
                        <input type="hidden" name="id" value={id} />
                        <JsonEditor
                            name="defaultConfigJson"
                            initialValue={obj.defaultConfigJson ?? {}}
                            required
                            minRows={14}
                            requireObject
                            invalidMessage="Default config must be a JSON object"
                        />
                        <Button type="submit">Save Default Config</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Versions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <form
                            action={createVersion}
                            className="grid md:grid-cols-2 gap-4 items-end"
                        >
                            <input type="hidden" name="id" value={id} />
                            <div className="grid gap-2">
                                <label className="text-sm">Version</label>
                                <Input
                                    name="version"
                                    type="number"
                                    defaultValue={(obj.currentVersion || 0) + 1}
                                    min={1}
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <label className="text-sm">Changelog</label>
                                <Textarea name="changelog" rows={3} />
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <label className="text-sm">Migration Ref</label>
                                <Input
                                    name="migrationRef"
                                    placeholder="optional reference"
                                />
                            </div>
                            <div>
                                <Button type="submit">Create Version</Button>
                            </div>
                        </form>

                        <div className="border rounded">
                            <div className="grid grid-cols-6 gap-2 p-3 text-xs font-medium text-muted-foreground border-b">
                                <div>ID</div>
                                <div className="col-span-1">Version</div>
                                <div className="col-span-2">Changelog</div>
                                <div className="col-span-1">Migration</div>
                                <div className="col-span-1">Created</div>
                            </div>
                            {versions?.length ? (
                                versions.map((v: any) => (
                                    <div
                                        key={v.id}
                                        className="grid grid-cols-6 gap-2 p-3 text-sm border-t"
                                    >
                                        <div className="truncate" title={v.id}>
                                            {v.id}
                                        </div>
                                        <div>{v.version}</div>
                                        <div
                                            className="col-span-2 truncate"
                                            title={v.changelog || ""}
                                        >
                                            {v.changelog || ""}
                                        </div>
                                        <div
                                            className="truncate"
                                            title={v.migrationRef || ""}
                                        >
                                            {v.migrationRef || ""}
                                        </div>
                                        <div>
                                            {v.createdAt
                                                ? new Date(
                                                      v.createdAt,
                                                  ).toLocaleString()
                                                : ""}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-3 text-sm text-muted-foreground">
                                    No versions yet.
                                </div>
                            )}
                        </div>

                        <form
                            action={setCurrentVersion}
                            className="grid md:grid-cols-3 gap-4 items-end"
                        >
                            <input type="hidden" name="id" value={id} />
                            <div className="grid gap-2">
                                <label className="text-sm">
                                    Set Current Version
                                </label>
                                <Input
                                    name="currentVersion"
                                    type="number"
                                    defaultValue={obj.currentVersion || ""}
                                    min={1}
                                />
                            </div>
                            <div>
                                <Button type="submit">
                                    Update Current Version
                                </Button>
                            </div>
                        </form>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        action={deleteObject}
                        className="flex items-center justify-between gap-4"
                    >
                        <input type="hidden" name="id" value={id} />
                        <p className="text-sm text-muted-foreground">
                            Deleting this object is irreversible.
                        </p>
                        <Button type="submit" variant="destructive">
                            Delete Object
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
