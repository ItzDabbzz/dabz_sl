# Permission System Reference

All permissions are defined in [`src/features/auth/permissions/admin-access.ts`](../src/features/auth/permissions/admin-access.ts) via Better Auth's `createAccessControl`.

Permission keys follow dot-notation: `resource.action` (e.g. `marketplace.edit`, `blog.settings.update`).

---

## Resources & Actions

| Resource      | Actions                                          | Notes |
|---------------|--------------------------------------------------|-------|
| `user`        | `create`, `list`, `set-role`, `ban`, `impersonate` | Better Auth built-in |
| `session`     | `list`, `delete`, `revoke`                       | Better Auth built-in |
| `marketplace` | `view`, `edit`, `moderate`, `admin`, `requests`  | |
| `blog`        | `view`, `write`, `settings.update`               | Action can contain a dot |
| `sldb`        | `view`, `edit`, `admin`                          | Second Life DB records |
| `wardrobe`    | `view`, `edit`                                   | Wardrobe/outfit management |
| `dashboard`   | `view`                                           | |
| `settings`    | `view`                                           | |
| `apikey`      | `manage`                                         | |
| `rbac`        | `manage`                                         | Role/org administration |
| `org`         | `view`, `delete`                                 | Organization management |

---

## Roles & Their Grants

### `owner` / `developer`
Full access to everything.

| Resource | Actions |
|---|---|
| `user` | `create`, `list`, `set-role`, `ban`, `impersonate` |
| `session` | `list`, `delete`, `revoke` |
| `marketplace` | `view`, `edit`, `moderate`, `admin`, `requests` |
| `blog` | `view`, `write`, `settings.update` |
| `sldb` | `view`, `edit`, `admin` |
| `wardrobe` | `view`, `edit` |
| `dashboard`, `settings` | `view` |
| `apikey` | `manage` |
| `rbac` | `manage` |
| `org` | `view`, `delete` |

---

### `admin`
Same as `owner`/`developer` — full access to everything.

---

### `mod`
Full app access. Cannot delete the org or manage RBAC.

| Resource | Actions |
|---|---|
| `user` | `create`, `list`, `set-role`, `ban`, `impersonate` |
| `session` | `list`, `delete`, `revoke` |
| `marketplace` | `view`, `edit`, `moderate`, `admin`, `requests` |
| `blog` | `view`, `write`, `settings.update` |
| `sldb` | `view`, `edit`, `admin` |
| `wardrobe` | `view`, `edit` |
| `dashboard`, `settings` | `view` |
| `apikey` | `manage` |
| `org` | `view` |
| ~~`rbac.manage`~~ | ✗ denied |
| ~~`org.delete`~~ | ✗ denied |

---

### `trusted`
Marketplace contributor access only.

| Resource | Actions |
|---|---|
| `marketplace` | `view`, `edit`, `requests` |

---

### `creator`
SL database editor.

| Resource | Actions |
|---|---|
| `sldb` | `view`, `edit` |

---

### `blogger`
Blog read/write only.

| Resource | Actions |
|---|---|
| `blog` | `view`, `write` |

---

### `wardrobe`
Wardrobe management only.

| Resource | Actions |
|---|---|
| `wardrobe` | `view`, `edit` |

---

### `user` (default)
Standard authenticated user.

| Resource | Actions |
|---|---|
| `marketplace` | `view` |
| `blog` | `view` |
| `wardrobe` | `view` |
| `dashboard`, `settings` | `view` |
| `apikey` | `manage` |

---

## How Checks Work (`guards.ts`)

`requirePermission(key, headers)` runs three checks in order:

1. **Superadmin bypass** — if the user's ID is in `ADMIN_IDS` env var, always granted.
2. **Better Auth in-memory role check** — calls `auth.api.userHasPermission({ body: { role, permissions: { [resource]: [action] } } })`. Resolves entirely from the statically registered role definitions; no DB query.
3. **Org-level RBAC** — falls through to `PermissionService.hasPermission(userId, orgId, key)` for DB-stored per-org overrides. Requires an `orgId`.

---

## Seed Data (`seed-org` endpoint)

`ROLE_GRANTS` in [`src/server/auth/role-permissions.ts`](../src/server/auth/role-permissions.ts) is a flat `Record<string, string[]>` used **only** by the `/api/admin/rbac/seed-org` route to write role/permission rows into the database for org-level RBAC. It mirrors the same grants listed above.
