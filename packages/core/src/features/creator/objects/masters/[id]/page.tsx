import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
import { JsonEditor } from "@/components/json-editor";
import { VisualConfigEditor } from "@/components/visual-config-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { VisibilitySelect } from "@/components/visibility-select";
import { ActionToast } from "@/components/action-toast";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getOptionalSession } from "@/server/auth/session";
import {
    fetchInternalApi,
    fetchInternalApiJson,
} from "@/server/services/internal-api";

async function updateMasterObject(id: string, body: Record<string, unknown>) {
    await fetchInternalApi(
        `/api/creator/master-objects/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
    );
}

// Save basic details (name, description, visibility)
async function saveDetails(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "");
    const description = String(formData.get("description") || "");
    const visibility = String(formData.get("visibility") || "private");
    await updateMasterObject(id, { name, description, visibility });
    revalidatePath(`/dashboard/database/objects/${id}`);
    redirect(`/dashboard/database/objects/${id}?ok=details`);
}

// Save config schema JSON
async function saveSchema(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const schemaText = String(formData.get("configSchemaJson") || "");
    let configSchemaJson: any | undefined;
    try {
        configSchemaJson = schemaText ? JSON.parse(schemaText) : null;
    } catch {
        // Ignore invalid JSON to avoid 500; user can fix and resubmit
        return;
    }
    await updateMasterObject(id, { configSchemaJson });
    revalidatePath(`/dashboard/database/objects/${id}`);
    redirect(`/dashboard/database/objects/${id}?ok=schema`);
}

// Save default config JSON
async function saveDefaultConfig(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const cfgText = String(formData.get("defaultConfigJson") || "");
    let defaultConfigJson: any | undefined;
    try {
        defaultConfigJson = cfgText ? JSON.parse(cfgText) : null;
    } catch {
        return;
    }
    await updateMasterObject(id, { defaultConfigJson });
    revalidatePath(`/dashboard/database/objects/${id}`);
    redirect(`/dashboard/database/objects/${id}?ok=defaults`);
}

// Create a new version entry
async function createVersion(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const version = Number(formData.get("version") || 0);
    const changelog = String(formData.get("changelog") || "");
    const migrationRef = String(formData.get("migrationRef") || "");
    await fetchInternalApi(
        `/api/creator/master-objects/${encodeURIComponent(id)}/versions`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version, changelog, migrationRef }),
        },
    );
    revalidatePath(`/dashboard/database/objects/${id}`);
    redirect(`/dashboard/database/objects/${id}?ok=version`);
}

// Delete object
async function deleteObject(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    await fetchInternalApi(
        `/api/creator/master-objects/${encodeURIComponent(id)}`,
        { method: "DELETE" },
    );
    redirect("/dashboard/database/objects");
}

// Promote/demote current version
async function setCurrentVersion(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const currentVersion = Number(formData.get("currentVersion") || 0);
    await updateMasterObject(id, { currentVersion });
    revalidatePath(`/dashboard/database/objects/${id}`);
    redirect(`/dashboard/database/objects/${id}?ok=current`);
}

// Save visual config (fields -> JSON Schema + Default Config)
async function saveVisualConfig(formData: FormData) {
    "use server";
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
        enumLabels?: Record<string, string>;
        defaultValue?: any;
        description?: string;
        // string
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        // number
        minimum?: number;
        maximum?: number;
        step?: number;
        // flags
        readOnly?: boolean;
        hidden?: boolean;
        advanced?: boolean;
    }> = Array.isArray(parsed?.fields) ? parsed.fields : [];

    const allowAdditional: boolean = !!parsed?.additionalProperties;

    const schema: any = {
        type: "object",
        properties: {},
        required: [] as string[],
        additionalProperties: allowAdditional,
    };
    const defaults: any = {};

    for (const f of fields) {
        if (!f?.name) continue;
        const name = String(f.name);
        const t = String(f.type || "string");
        const prop: any = {};
        if (t === "enum") {
            const opts = Array.isArray(f.enumOptions)
                ? f.enumOptions.filter(Boolean)
                : [];
            prop.type = "string";
            if (opts.length) prop.enum = opts;
            if (f.enumLabels && typeof f.enumLabels === "object") {
                prop["x-enumLabels"] = f.enumLabels;
            }
        } else if (t === "boolean") {
            prop.type = "boolean";
        } else if (t === "number") {
            prop.type = "number";
            if (f.minimum != null) prop.minimum = f.minimum;
            if (f.maximum != null) prop.maximum = f.maximum;
            if (f.step != null) prop["x-step"] = f.step;
        } else {
            prop.type = "string";
            if (f.minLength != null) prop.minLength = f.minLength;
            if (f.maxLength != null) prop.maxLength = f.maxLength;
            if (f.pattern) prop.pattern = f.pattern;
        }
        if (f.description) prop.description = f.description;
        if (f.readOnly) prop.readOnly = true;
        if (f.hidden) prop["x-hidden"] = true;
        if (f.advanced) prop["x-advanced"] = true;

        (schema.properties as any)[name] = prop;

        if (f.required) schema.required.push(name);
        if (f.defaultValue !== undefined && f.defaultValue !== null) {
            defaults[name] = f.defaultValue;
        }
    }
    if (!schema.required.length) delete schema.required;
    await updateMasterObject(id, {
        configSchemaJson: schema,
        defaultConfigJson: defaults,
    });
    revalidatePath(`/dashboard/database/objects/${id}`);
}

export default async function EditObjectPage(props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ ok?: string }>;
}) {
    const session = await getOptionalSession();
    if (!session) return redirect("/sign-in");

    const { id } = await props.params;
    const obj = await fetchInternalApiJson<any | null>(
        `/api/creator/master-objects/${encodeURIComponent(id)}`,
        null,
    );
    if (!obj || obj.error) return redirect("/dashboard/database/objects");

    const versionsJson = await fetchInternalApiJson<{ items?: unknown[] }>(
        `/api/creator/master-objects/${encodeURIComponent(id)}/versions`,
        { items: [] },
    );
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
                description: p.description,
                minLength: p.minLength,
                maxLength: p.maxLength,
                pattern: p.pattern,
                minimum: p.minimum,
                maximum: p.maximum,
                step: p["x-step"],
                readOnly: !!p.readOnly,
                hidden: !!p["x-hidden"],
                advanced: !!p["x-advanced"],
                enumLabels: p["x-enumLabels"],
            });
        }
        return fields;
    }
    const initialFields = schemaToFields(
        obj.configSchemaJson,
        obj.defaultConfigJson,
    );

    // read ok query for toast
    const searchParams = await props.searchParams;
    const ok = searchParams?.ok || undefined;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <ActionToast ok={ok} />
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Edit Master Object</h1>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="builder" className="w-full">
                                <TabsList ref={undefined as any} className="grid grid-cols-3 w-full">
                                    <TabsTrigger ref={undefined as any} value="builder">Visual Builder</TabsTrigger>
                                    <TabsTrigger ref={undefined as any} value="schema">Schema (JSON)</TabsTrigger>
                                    <TabsTrigger ref={undefined as any} value="defaults">Defaults (JSON)</TabsTrigger>
                                </TabsList>

                                <TabsContent ref={undefined as any} value="builder" className="pt-4">
                                    <VisualConfigEditor
                                        objectId={id}
                                        initialFields={initialFields}
                                        action={saveVisualConfig}
                                        initialAdditionalProps={obj?.configSchemaJson?.additionalProperties === true}
                                    />
                                </TabsContent>

                                <TabsContent ref={undefined as any} value="schema" className="pt-4">
                                    <form action={saveSchema} className="grid gap-4">
                                        <input type="hidden" name="id" value={id} />
                                        <JsonEditor
                                            name="configSchemaJson"
                                            initialValue={obj.configSchemaJson ?? {}}
                                            required
                                            minRows={16}
                                            requireObject
                                            invalidMessage="Schema must be a JSON object"
                                        />
                                        <div className="flex justify-end">
                                            <Button type="submit">Save Schema</Button>
                                        </div>
                                    </form>
                                </TabsContent>

                                <TabsContent ref={undefined as any} value="defaults" className="pt-4">
                                    <form action={saveDefaultConfig} className="grid gap-4">
                                        <input type="hidden" name="id" value={id} />
                                        <JsonEditor
                                            name="defaultConfigJson"
                                            initialValue={obj.defaultConfigJson ?? {}}
                                            required
                                            minRows={16}
                                            requireObject
                                            invalidMessage="Default config must be a JSON object"
                                        />
                                        <div className="flex justify-end">
                                            <Button type="submit">Save Default Config</Button>
                                        </div>
                                    </form>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form action={saveDetails} className="grid gap-4">
                                <input type="hidden" name="id" value={id} />
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <label className="text-sm">Name</label>
                                        <Input name="name" defaultValue={obj.name} required />
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm">Visibility</label>
                                        <VisibilitySelect name="visibility" defaultValue={obj.visibility || "private"} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm">Description</label>
                                    <Textarea name="description" rows={4} defaultValue={obj.description || ""} />
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit">Save Details</Button>
                                </div>
                            </form>

                            <Separator ref={undefined as any} className="my-4" />
                            <div className="grid gap-3 text-sm text-muted-foreground">
                                <div className="grid grid-cols-2 gap-2">
                                    <span className="text-foreground/80">ID</span>
                                    <span className="truncate" title={obj.id}>{obj.id}</span>
                                </div>
                                {obj.currentVersion != null && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-foreground/80">Current Version</span>
                                        <span>{obj.currentVersion}</span>
                                    </div>
                                )}
                                {obj.createdAt && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-foreground/80">Created</span>
                                        <span>{new Date(obj.createdAt).toLocaleString()}</span>
                                    </div>
                                )}
                                {obj.updatedAt && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-foreground/80">Updated</span>
                                        <span>{new Date(obj.updatedAt).toLocaleString()}</span>
                                    </div>
                                )}

                                <Separator ref={undefined as any} className="my-2" />
                                <div className="text-foreground font-medium">Ownership</div>
                                {obj.orgId && <div>Org: {obj.orgId}</div>}
                                {obj.teamId && <div>Team: {obj.teamId}</div>}
                                {obj.ownerUserId && <div>User: {obj.ownerUserId}</div>}
                                {!obj.orgId && !obj.teamId && !obj.ownerUserId && (
                                    <div>Unscoped</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Versions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <form action={createVersion} className="grid gap-4">
                                    <input type="hidden" name="id" value={id} />
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <label className="text-sm">Version</label>
                                            <Input
                                                name="version"
                                                type="number"
                                                defaultValue={(obj.currentVersion || 0) + 1}
                                                min={1}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <label className="text-sm">Migration Ref</label>
                                            <Input name="migrationRef" placeholder="optional reference" />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm">Changelog</label>
                                        <Textarea name="changelog" rows={3} />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="submit">Create Version</Button>
                                    </div>
                                </form>

                                {versions?.length ? (
                                    <Accordion type="single" collapsible className="w-full space-y-2">
                                        {versions.map((v: any) => (
                                            <AccordionItem ref={undefined as any} key={v.id} value={`v-${v.id}`} className="border rounded">
                                                <AccordionTrigger ref={undefined as any} className="px-3">
                                                    <div className="grid grid-cols-6 gap-2 w-full text-sm">
                                                        <div className="truncate" title={v.id}>{v.id}</div>
                                                        <div>v{v.version}</div>
                                                        <div className="col-span-2 truncate" title={v.changelog || ""}>{v.changelog || ""}</div>
                                                        <div className="truncate" title={v.migrationRef || ""}>{v.migrationRef || ""}</div>
                                                        <div>{v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}</div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent ref={undefined as any} className="px-3 pb-3">
                                                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <div className="text-muted-foreground">ID</div>
                                                            <div className="truncate" title={v.id}>{v.id}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">Version</div>
                                                            <div>{v.version}</div>
                                                        </div>
                                                        <div className="sm:col-span-2">
                                                            <div className="text-muted-foreground">Changelog</div>
                                                            <div className="whitespace-pre-wrap break-words">{v.changelog || "—"}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">Migration Ref</div>
                                                            <div className="break-words">{v.migrationRef || "—"}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">Created</div>
                                                            <div>{v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}</div>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : (
                                    <div className="p-3 text-sm text-muted-foreground">No versions yet.</div>
                                )}

                                <form action={setCurrentVersion} className="grid md:grid-cols-3 gap-4 items-end">
                                    <input type="hidden" name="id" value={id} />
                                    <div className="grid gap-2 md:col-span-2">
                                        <label className="text-sm">Set Current Version</label>
                                        <Input
                                            name="currentVersion"
                                            type="number"
                                            defaultValue={obj.currentVersion || ""}
                                            min={1}
                                        />
                                    </div>
                                    <div className="md:justify-self-end">
                                        <Button type="submit">Update</Button>
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
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Delete</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete object?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the object and its versions.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction asChild>
                                            <form action={deleteObject}>
                                                <input type="hidden" name="id" value={id} />
                                                <Button type="submit" variant="destructive">Confirm delete</Button>
                                            </form>
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
