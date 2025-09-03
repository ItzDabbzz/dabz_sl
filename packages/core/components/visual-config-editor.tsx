"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export type VisualFieldType = "string" | "number" | "boolean" | "enum";
export type VisualField = {
    id: string;
    name: string;
    type: VisualFieldType;
    required: boolean;
    enumOptions?: string[];
    defaultValue?: any;
};

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function normalizeInitial(fields: any[]): VisualField[] {
    return (Array.isArray(fields) ? fields : []).map((f) => ({
        id: uid(),
        name: String(f?.name ?? ""),
        type: (f?.type as VisualFieldType) || "string",
        required: !!f?.required,
        enumOptions: Array.isArray(f?.enumOptions)
            ? f.enumOptions.filter(Boolean)
            : undefined,
        defaultValue: f?.defaultValue,
    }));
}

function sanitizeDefault(
    type: VisualFieldType,
    value: any,
    enumOptions?: string[],
) {
    if (value === undefined || value === null || value === "") return undefined;
    switch (type) {
        case "number": {
            const n = Number(value);
            return Number.isFinite(n) ? n : undefined;
        }
        case "boolean": {
            if (typeof value === "boolean") return value;
            if (value === "true" || value === true) return true;
            if (value === "false" || value === false) return false;
            return undefined;
        }
        case "enum": {
            const v = String(value);
            if (Array.isArray(enumOptions) && enumOptions.includes(v)) return v;
            return undefined;
        }
        default:
            return String(value);
    }
}

function validateFields(fields: VisualField[]): string | null {
    // basic: non-empty unique names
    const names = fields.map((f) => f.name.trim());
    if (names.some((n) => !n)) return "All fields must have a name";
    const set = new Set<string>();
    for (const n of names) {
        if (set.has(n)) return `Duplicate field name: ${n}`;
        set.add(n);
    }
    // enum needs options
    for (const f of fields) {
        if (f.type === "enum" && (!f.enumOptions || !f.enumOptions.length)) {
            return `Enum field "${f.name}" needs at least one option`;
        }
    }
    return null;
}

export function VisualConfigEditor({
    objectId,
    initialFields,
    action,
}: {
    objectId: string;
    initialFields: any[];
    action: (formData: FormData) => Promise<void>;
}) {
    const [fields, setFields] = React.useState<VisualField[]>(() =>
        normalizeInitial(initialFields),
    );
    const [error, setError] = React.useState<string | null>(null);
    const payloadRef = React.useRef<HTMLInputElement>(null);

    // keep payload in sync
    React.useEffect(() => {
        const err = validateFields(fields);
        setError(err);
        const serializable = fields.map((f) => ({
            name: f.name.trim(),
            type: f.type,
            required: !!f.required,
            enumOptions: f.type === "enum" ? f.enumOptions || [] : undefined,
            defaultValue: sanitizeDefault(
                f.type,
                f.defaultValue,
                f.enumOptions,
            ),
        }));
        const json = JSON.stringify({ fields: serializable });
        if (payloadRef.current) {
            payloadRef.current.value = json;
            payloadRef.current.setCustomValidity(err || "");
        }
    }, [fields]);

    function addField() {
        setFields((prev) => [
            ...prev,
            {
                id: uid(),
                name: "",
                type: "string",
                required: false,
                enumOptions: [],
                defaultValue: "",
            },
        ]);
    }

    function removeField(id: string) {
        setFields((prev) => prev.filter((f) => f.id !== id));
    }

    function moveField(id: string, dir: -1 | 1) {
        setFields((prev) => {
            const idx = prev.findIndex((f) => f.id === id);
            if (idx < 0) return prev;
            const ni = idx + dir;
            if (ni < 0 || ni >= prev.length) return prev;
            const next = [...prev];
            const [item] = next.splice(idx, 1);
            next.splice(ni, 0, item);
            return next;
        });
    }

    function updateField(id: string, patch: Partial<VisualField>) {
        setFields((prev) =>
            prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        );
    }

    return (
        <form action={action} className="grid gap-4">
            <input type="hidden" name="id" value={objectId} />
            <input ref={payloadRef} type="hidden" name="payload" required />

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Build your config by adding fields below. Choose a type,
                    options, and default values.
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={addField}
                    >
                        Add field
                    </Button>
                    <Button type="submit" disabled={!!error}>
                        Save
                    </Button>
                </div>
            </div>

            {error && <div className="text-xs text-destructive">{error}</div>}

            <div className="grid gap-3">
                {fields.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        No fields yet. Click "Add field" to begin.
                    </div>
                ) : (
                    fields.map((f) => (
                        <div
                            key={f.id}
                            className="grid gap-2 border rounded p-3"
                        >
                            <div className="grid md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-3 grid gap-1">
                                    <label className="text-xs">Name</label>
                                    <Input
                                        value={f.name}
                                        onChange={(e) =>
                                            updateField(f.id, {
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder="e.g. color"
                                    />
                                </div>
                                <div className="md:col-span-2 grid gap-1">
                                    <label className="text-xs">Type</label>
                                    <Select
                                        value={f.type}
                                        onValueChange={(v) =>
                                            updateField(f.id, {
                                                type: v as VisualFieldType,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="string">
                                                string
                                            </SelectItem>
                                            <SelectItem value="number">
                                                number
                                            </SelectItem>
                                            <SelectItem value="boolean">
                                                boolean
                                            </SelectItem>
                                            <SelectItem value="enum">
                                                enum
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2 grid gap-1">
                                    <label className="text-xs">Required</label>
                                    <div className="h-10 px-3 py-2 border rounded flex items-center gap-2">
                                        <Checkbox
                                            checked={!!f.required}
                                            onCheckedChange={(v) =>
                                                updateField(f.id, {
                                                    required: !!v,
                                                })
                                            }
                                        />
                                        <span className="text-sm">
                                            Required
                                        </span>
                                    </div>
                                </div>
                                <div className="md:col-span-4 grid gap-1">
                                    <label className="text-xs">Default</label>
                                    {f.type === "boolean" ? (
                                        <div className="h-10 px-3 py-2 border rounded flex items-center gap-2">
                                            <Checkbox
                                                checked={!!f.defaultValue}
                                                onCheckedChange={(v) =>
                                                    updateField(f.id, {
                                                        defaultValue: !!v,
                                                    })
                                                }
                                            />
                                            <span className="text-sm">
                                                True/False
                                            </span>
                                        </div>
                                    ) : f.type === "number" ? (
                                        <Input
                                            type="number"
                                            value={f.defaultValue ?? ""}
                                            onChange={(e) =>
                                                updateField(f.id, {
                                                    defaultValue:
                                                        e.target.value,
                                                })
                                            }
                                            placeholder="0"
                                        />
                                    ) : f.type === "enum" ? (
                                        <Select
                                            value={f.defaultValue ?? ""}
                                            onValueChange={(v) =>
                                                updateField(f.id, {
                                                    defaultValue: v,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pick default" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(f.enumOptions || []).map(
                                                    (opt) => (
                                                        <SelectItem
                                                            key={opt}
                                                            value={opt}
                                                        >
                                                            {opt}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            value={f.defaultValue ?? ""}
                                            onChange={(e) =>
                                                updateField(f.id, {
                                                    defaultValue:
                                                        e.target.value,
                                                })
                                            }
                                            placeholder="text"
                                        />
                                    )}
                                </div>
                            </div>

                            {f.type === "enum" && (
                                <div className="grid md:grid-cols-12 gap-3 items-end">
                                    <div className="md:col-span-8 grid gap-1">
                                        <label className="text-xs">
                                            Enum options (comma-separated)
                                        </label>
                                        <Input
                                            value={(f.enumOptions || []).join(
                                                ", ",
                                            )}
                                            onChange={(e) =>
                                                updateField(f.id, {
                                                    enumOptions: e.target.value
                                                        .split(",")
                                                        .map((s) => s.trim())
                                                        .filter(Boolean),
                                                })
                                            }
                                            placeholder="red, green, blue"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 justify-end">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => moveField(f.id, -1)}
                                >
                                    Up
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => moveField(f.id, 1)}
                                >
                                    Down
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => removeField(f.id)}
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </form>
    );
}
