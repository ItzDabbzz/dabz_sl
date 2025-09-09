export interface ScopeOption {
  key: string;
  label?: string;
  group?: string;
  description?: string;
}

// Central list of suggested scopes derived from API usage
export const defaultScopeOptions: ScopeOption[] = [
  { key: "*", label: "All permissions", group: "Global", description: "Grant full access to all current and future scopes. Use with care." },
  { key: "sl.apikeys:read", label: "API Keys: Read", group: "API Keys", description: "List and view API keys and metadata" },
  { key: "sl.apikeys:write", label: "API Keys: Write", group: "API Keys", description: "Create and revoke API keys" },
  { key: "sl.objects:read", label: "Objects: Read", group: "Objects", description: "Read creator objects and versions" },
  { key: "sl.objects:write", label: "Objects: Write", group: "Objects", description: "Create/update/delete creator objects and versions" },
  { key: "sl.instances:write", label: "Instances: Write", group: "Instances", description: "Manage instance tokens, rotate/revoke" },
  { key: "sl.entitlements:read", label: "Entitlements: Read", group: "Entitlements", description: "Read user entitlements/licenses" },
  { key: "sl.webhooks:read", label: "Webhooks: Read", group: "Webhooks", description: "List webhooks and deliveries" },
  { key: "sl.webhooks:write", label: "Webhooks: Write", group: "Webhooks", description: "Create, update, and delete webhooks" },
];
