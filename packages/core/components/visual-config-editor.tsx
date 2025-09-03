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
};

type PresetName =
  | "uuid"
  | "uuid-or-null"
  | "texture-uuid"
  | "hex-color"
  | "hex-color-8"
  | "vector2"
  | "vector3"
  | "rotation"
  | "integer"
  | "float-0-1"
  | "percent-0-100"
  | "slurl"
  | "url"
  | "chat-channel"
  | "face-index";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeInitial(fields: any[]): VisualField[] {
  return (Array.isArray(fields) ? fields : []).map((f) => ({
    id: uid(),
    name: String(f?.name ?? ""),
    type: (f?.type as VisualFieldType) || "string",
    required: !!f?.required,
    enumOptions: Array.isArray(f?.enumOptions) ? f.enumOptions.filter(Boolean) : undefined,
    enumLabels: f?.enumLabels && typeof f.enumLabels === "object" ? f.enumLabels : undefined,
    defaultValue: f?.defaultValue,
    description: f?.description ? String(f.description) : undefined,
    minLength: f?.minLength != null ? Number(f.minLength) : undefined,
    maxLength: f?.maxLength != null ? Number(f.maxLength) : undefined,
    pattern: f?.pattern ? String(f.pattern) : undefined,
    minimum: f?.minimum != null ? Number(f.minimum) : undefined,
    maximum: f?.maximum != null ? Number(f.maximum) : undefined,
    step: f?.step != null ? Number(f.step) : undefined,
    readOnly: !!f?.readOnly,
    hidden: !!f?.hidden,
    advanced: !!f?.advanced,
  }));
}

function sanitizeDefault(type: VisualFieldType, value: any, enumOptions?: string[]) {
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
  const names = fields.map((f) => f.name.trim());
  if (names.some((n) => !n)) return "All fields must have a name";
  const set = new Set<string>();
  for (const n of names) {
    if (set.has(n)) return `Duplicate field name: ${n}`;
    set.add(n);
  }
  for (const f of fields) {
    if (f.type === "enum" && (!f.enumOptions || !f.enumOptions.length)) {
      return `Enum field "${f.name}" needs at least one option`;
    }
    if (f.type === "string") {
      if (f.minLength != null && f.minLength < 0) return `minLength for ${f.name} must be >= 0`;
      if (f.maxLength != null && f.maxLength < 0) return `maxLength for ${f.name} must be >= 0`;
      if (f.minLength != null && f.maxLength != null && f.minLength > f.maxLength)
        return `minLength must be <= maxLength for ${f.name}`;
    }
    if (f.type === "number") {
      if (f.minimum != null && f.maximum != null && f.minimum > f.maximum)
        return `minimum must be <= maximum for ${f.name}`;
    }
  }
  return null;
}

export function VisualConfigEditor({
  objectId,
  initialFields,
  action,
  initialAdditionalProps = false,
}: {
  objectId: string;
  initialFields: any[];
  action: (formData: FormData) => Promise<void>;
  initialAdditionalProps?: boolean;
}) {
  const [fields, setFields] = React.useState<VisualField[]>(() => normalizeInitial(initialFields));
  const [error, setError] = React.useState<string | null>(null);
  const [allowAdditional, setAllowAdditional] = React.useState<boolean>(!!initialAdditionalProps);
  const payloadRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const err = validateFields(fields);
    setError(err);
    const serializable = fields.map((f) => ({
      name: f.name.trim(),
      type: f.type,
      required: !!f.required,
      enumOptions: f.type === "enum" ? (f.enumOptions || []) : undefined,
      enumLabels: f.type === "enum" ? (f.enumLabels || undefined) : undefined,
      defaultValue: sanitizeDefault(f.type, f.defaultValue, f.enumOptions),
      description: f.description || undefined,
      minLength: f.type === "string" ? f.minLength : undefined,
      maxLength: f.type === "string" ? f.maxLength : undefined,
      pattern: f.type === "string" ? f.pattern : undefined,
      minimum: f.type === "number" ? f.minimum : undefined,
      maximum: f.type === "number" ? f.maximum : undefined,
      step: f.type === "number" ? f.step : undefined,
      readOnly: !!f.readOnly,
      hidden: !!f.hidden,
      advanced: !!f.advanced,
    }));
    const json = JSON.stringify({ fields: serializable, additionalProperties: !!allowAdditional });
    if (payloadRef.current) {
      payloadRef.current.value = json;
      payloadRef.current.setCustomValidity(err || "");
    }
  }, [fields, allowAdditional]);

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
        description: "",
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
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function parseEnumPairs(input: string): { values: string[]; labels?: Record<string, string> } {
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    const values: string[] = [];
    const labels: Record<string, string> = {};
    for (const p of parts) {
      const [v, l] = p.split(":").map((s) => s.trim());
      if (!v) continue;
      values.push(v);
      if (l) labels[v] = l;
    }
    return { values, labels: Object.keys(labels).length ? labels : undefined };
  }

  function applyPreset(id: string, preset: PresetName) {
    // Helpers to reset opposite-type constraints
    const clearString = { pattern: undefined as any, minLength: undefined as any, maxLength: undefined as any };
    const clearNumber = { minimum: undefined as any, maximum: undefined as any, step: undefined as any };

    switch (preset) {
      case "uuid":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$",
          description: "Second Life asset UUID",
          defaultValue: "",
        });
      case "uuid-or-null":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern:
            "^(?:[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$",
          description: "UUID or NULL_KEY",
          defaultValue: "00000000-0000-0000-0000-000000000000",
        });
      case "texture-uuid":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$",
          description: "Texture UUID",
          defaultValue: "",
        });
      case "hex-color":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$",
          description: "Hex color (#RGB or #RRGGBB)",
          defaultValue: "#FFFFFF",
        });
      case "hex-color-8":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{4})$",
          description: "Hex color with alpha (#RGBA or #RRGGBBAA)",
          defaultValue: "#FFFFFFFF",
        });
      case "vector2":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^-?\\d+(?:\\.\\d+)?,\\s*-?\\d+(?:\\.\\d+)?$",
          description: "Vector2 as x,y",
          defaultValue: "0,0",
        });
      case "vector3":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^-?\\d+(?:\\.\\d+)?,\\s*-?\\d+(?:\\.\\d+)?,\\s*-?\\d+(?:\\.\\d+)?$",
          description: "Vector3 as x,y,z",
          defaultValue: "0,0,0",
        });
      case "rotation":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^-?\\d+(?:\\.\\d+)?,\\s*-?\\d+(?:\\.\\d+)?,\\s*-?\\d+(?:\\.\\d+)?,\\s*-?\\d+(?:\\.\\d+)?$",
          description: "Rotation (quaternion) as x,y,z,w",
          defaultValue: "0,0,0,1",
        });
      case "integer":
        return updateField(id, {
          type: "number",
          ...clearString,
          minimum: undefined,
          maximum: undefined,
          step: 1,
          description: "Integer",
          defaultValue: 0,
        });
      case "float-0-1":
        return updateField(id, {
          type: "number",
          ...clearString,
          minimum: 0,
          maximum: 1,
          step: 0.01,
          description: "Float between 0 and 1",
          defaultValue: 0,
        });
      case "percent-0-100":
        return updateField(id, {
          type: "number",
          ...clearString,
          minimum: 0,
          maximum: 100,
          step: 1,
          description: "Percent (0–100)",
          defaultValue: 100,
        });
      case "slurl":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern:
            "^(?:secondlife://[^/]+/\\d{1,5}/\\d{1,5}/\\d{1,5}|https?://maps\\.secondlife\\.com/secondlife/[^/]+/\\d{1,5}/\\d{1,5}/\\d{1,5})$",
          description: "SLURL (viewer or maps URL)",
          defaultValue: "",
        });
      case "url":
        return updateField(id, {
          type: "string",
          ...clearNumber,
          pattern: "^https?://.+$",
          description: "HTTP/HTTPS URL",
          defaultValue: "https://",
        });
      case "chat-channel":
        return updateField(id, {
          type: "number",
          ...clearString,
          minimum: -2147483648,
          maximum: 2147483647,
          step: 1,
          description: "Chat channel (32-bit integer)",
          defaultValue: 0,
        });
      case "face-index":
        return updateField(id, {
          type: "number",
          ...clearString,
          minimum: 0,
          maximum: 7,
          step: 1,
          description: "Face index (0–7)",
          defaultValue: 0,
        });
    }
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={objectId} />
      <input ref={payloadRef} type="hidden" name="payload" required />

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Build your config by adding fields below. Choose a type, options, and defaults.
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 text-sm">
            <Checkbox checked={allowAdditional} onCheckedChange={(v) => setAllowAdditional(!!v)} />
            <span>Allow extra keys</span>
          </div>
          <Button type="button" variant="secondary" onClick={addField}>Add field</Button>
          <Button type="submit" disabled={!!error}>Save</Button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}

      <div className="grid gap-3">
        {fields.length === 0 ? (
          <div className="text-sm text-muted-foreground">No fields yet. Click "Add field" to begin.</div>
        ) : (
          fields.map((f) => (
            <div key={f.id} className="grid gap-3 border rounded p-3">
              <div className="grid md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3 grid gap-1">
                  <label className="text-xs">Name</label>
                  <Input value={f.name} onChange={(e) => updateField(f.id, { name: e.target.value })} placeholder="e.g. color" />
                </div>
                <div className="md:col-span-2 grid gap-1">
                  <label className="text-xs">Type</label>
                  <Select value={f.type} onValueChange={(v) => updateField(f.id, { type: v as VisualFieldType })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                      <SelectItem value="enum">enum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 grid gap-1">
                  <label className="text-xs">Required</label>
                  <div className="h-10 px-3 py-2 border rounded flex items-center gap-2">
                    <Checkbox checked={!!f.required} onCheckedChange={(v) => updateField(f.id, { required: !!v })} />
                    <span className="text-sm">Required</span>
                  </div>
                </div>
                <div className="md:col-span-2 grid gap-1">
                  <label className="text-xs">Preset</label>
                  <Select onValueChange={(v) => applyPreset(f.id, v as PresetName)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uuid">UUID</SelectItem>
                      <SelectItem value="uuid-or-null">UUID or NULL_KEY</SelectItem>
                      <SelectItem value="texture-uuid">Texture UUID</SelectItem>
                      <SelectItem value="hex-color">Hex Color</SelectItem>
                      <SelectItem value="hex-color-8">Hex Color (8-digit)</SelectItem>
                      <SelectItem value="vector2">Vector2 (x,y)</SelectItem>
                      <SelectItem value="vector3">Vector3 (x,y,z)</SelectItem>
                      <SelectItem value="rotation">Rotation (x,y,z,w)</SelectItem>
                      <SelectItem value="integer">Integer</SelectItem>
                      <SelectItem value="float-0-1">Float 0–1</SelectItem>
                      <SelectItem value="percent-0-100">Percent 0–100</SelectItem>
                      <SelectItem value="slurl">SLURL</SelectItem>
                      <SelectItem value="url">URL (http/https)</SelectItem>
                      <SelectItem value="chat-channel">Chat channel</SelectItem>
                      <SelectItem value="face-index">Face index 0–7</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 grid gap-1">
                  <label className="text-xs">Description</label>
                  <Input value={f.description ?? ""} onChange={(e) => updateField(f.id, { description: e.target.value })} placeholder="Short help text" />
                </div>
              </div>

              <div className="grid md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4 grid gap-1">
                  <label className="text-xs">Default</label>
                  {f.type === "boolean" ? (
                    <div className="h-10 px-3 py-2 border rounded flex items-center gap-2">
                      <Checkbox
                        checked={!!f.defaultValue}
                        onCheckedChange={(v) => updateField(f.id, { defaultValue: !!v })}
                      />
                      <span className="text-sm">True/False</span>
                    </div>
                  ) : f.type === "number" ? (
                    <Input
                      type="number"
                      value={f.defaultValue ?? ""}
                      onChange={(e) => updateField(f.id, { defaultValue: e.target.value })}
                      placeholder="0"
                    />
                  ) : f.type === "enum" ? (
                    <Select
                      value={f.defaultValue ?? ""}
                      onValueChange={(v) => updateField(f.id, { defaultValue: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick default" />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.enumOptions || []).map((opt) => (
                          <SelectItem key={opt} value={opt}>{f.enumLabels?.[opt] || opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={f.defaultValue ?? ""}
                      onChange={(e) => updateField(f.id, { defaultValue: e.target.value })}
                      placeholder="text"
                    />
                  )}
                </div>

                {f.type === "string" && (
                  <>
                    <div className="md:col-span-2 grid gap-1">
                      <label className="text-xs">minLength</label>
                      <Input type="number" value={f.minLength ?? ""} onChange={(e) => updateField(f.id, { minLength: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-2 grid gap-1">
                      <label className="text-xs">maxLength</label>
                      <Input type="number" value={f.maxLength ?? ""} onChange={(e) => updateField(f.id, { maxLength: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-4 grid gap-1">
                      <label className="text-xs">pattern (regex)</label>
                      <Input value={f.pattern ?? ""} onChange={(e) => updateField(f.id, { pattern: e.target.value || undefined })} placeholder="^#[0-9A-Fa-f]{6}$" />
                    </div>
                  </>
                )}

                {f.type === "number" && (
                  <>
                    <div className="md:col-span-2 grid gap-1">
                      <label className="text-xs">minimum</label>
                      <Input type="number" value={f.minimum ?? ""} onChange={(e) => updateField(f.id, { minimum: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-2 grid gap-1">
                      <label className="text-xs">maximum</label>
                      <Input type="number" value={f.maximum ?? ""} onChange={(e) => updateField(f.id, { maximum: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-2 grid gap-1">
                      <label className="text-xs">step</label>
                      <Input type="number" value={f.step ?? ""} onChange={(e) => updateField(f.id, { step: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </div>
                  </>
                )}

                {f.type === "enum" && (
                  <div className="md:col-span-8 grid gap-1">
                    <label className="text-xs">Enum options (value or value:label, comma-separated)</label>
                    <Input
                      value={(f.enumOptions || []).map((v) => (f.enumLabels?.[v] ? `${v}:${f.enumLabels[v]}` : v)).join(", ")}
                      onChange={(e) => {
                        const { values, labels } = parseEnumPairs(e.target.value);
                        updateField(f.id, { enumOptions: values, enumLabels: labels });
                      }}
                      placeholder="red:Red, green:Green, blue:Blue"
                    />
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-2 flex items-center gap-2">
                  <Checkbox checked={!!f.readOnly} onCheckedChange={(v) => updateField(f.id, { readOnly: !!v })} />
                  <span className="text-sm">Read-only</span>
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Checkbox checked={!!f.hidden} onCheckedChange={(v) => updateField(f.id, { hidden: !!v })} />
                  <span className="text-sm">Hidden</span>
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Checkbox checked={!!f.advanced} onCheckedChange={(v) => updateField(f.id, { advanced: !!v })} />
                  <span className="text-sm">Advanced</span>
                </div>
                <div className="md:col-span-6 flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => moveField(f.id, -1)}>Up</Button>
                  <Button type="button" variant="secondary" onClick={() => moveField(f.id, 1)}>Down</Button>
                  <Button type="button" variant="destructive" onClick={() => removeField(f.id)}>Remove</Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </form>
  );
}
