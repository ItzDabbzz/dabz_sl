# Permissions Reference

There are two independent permission systems in this project.

---

## 1. Better Auth Admin Plugin (`admin-access.ts`)

Controls user/session management actions available in the admin panel.
Defined via `createAccessControl` — Better Auth reads these directly.

| Action | owner | developer | admin | mod | trusted | creator |
|--------|:-----:|:---------:|:-----:|:---:|:-------:|:-------:|
| `user:create` | ✅ | ✅ | ✅ | | | |
| `user:list` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user:set-role` | ✅ | ✅ | ✅ | ✅ | | |
| `user:ban` | ✅ | ✅ | ✅ | ✅ | | |
| `user:impersonate` | ✅ | ✅ | ✅ | ✅ | | |
| `user:delete` | ✅ | ✅ | ✅ | | | |
| `user:set-password` | ✅ | ✅ | ✅ | | | |
| `user:update` | ✅ | ✅ | ✅ | | | |
| `session:list` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `session:revoke` | ✅ | ✅ | ✅ | ✅ | | |
| `session:delete` | ✅ | ✅ | ✅ | ✅ | | |

---

## 2. App Feature Permissions (`role-permissions.ts` + `requirePermission`)

Controls access to app features. Resolved at runtime from the user's `role` field — **no org membership or DB seeding required**. Roles are matched against the static `ROLE_GRANTS` map.

The org-based RBAC DB tables (seeded via `/api/admin/rbac/seed-org`) can layer per-member overrides *on top* of these static grants.

### Permission Keys

| Key | Description | Gate used on |
|-----|-------------|--------------|
| `marketplace.view` | Read marketplace items | `GET /api/tools/marketplace/items` |
| `marketplace.edit` | Create / update marketplace items | `POST /api/tools/marketplace/items`, `PATCH` |
| `marketplace.moderate` | NSFW flags, bulk updates, category assignment | `PATCH /api/tools/marketplace/items`, `PATCH …/categories/batch` |
| `marketplace.admin` | Delete marketplace items | `DELETE /api/tools/marketplace/items` |
| `marketplace.requests` | View & accept/reject item submission requests | `GET /PATCH /api/tools/marketplace/requests` |
| `blog.view` | Read blog posts | `GET /api/creator/blog` |
| `blog.write` | Create / edit / delete blog posts | `POST/PATCH/DELETE /api/creator/blog` |
| `blog.settings.update` | Update blog global settings | blog settings routes |
| `sldb.view` | Read SL creator DB instances/configs | `GET /api/creator/instances`, `GET /api/creator/configs` |
| `sldb.edit` | Mutate SL creator DB instances | `POST/PATCH/DELETE /api/creator/instances` |
| `sldb.admin` | Admin-level SL DB operations | reserved |
| `wardrobe.view` | Read wardrobe data | wardrobe routes |
| `wardrobe.edit` | Mutate wardrobe data | wardrobe routes |
| `dashboard.view` | Access the dashboard | dashboard gate |
| `settings.view` | Access account/org settings | settings gate |
| `apikey.manage` | Create / revoke API keys | API key routes |
| `org.view` | View organization details | org routes |
| `org.delete` | Delete the organization | org routes |
| `rbac.manage` | Manage roles, permissions, member overrides | `GET/POST/DELETE /api/admin/rbac/*` |

### Role Matrix

| Permission | owner | developer / dev | admin | mod / moderator | trusted | creator | blogger | wardrobe | user |
|------------|:-----:|:---------------:|:-----:|:---------------:|:-------:|:-------:|:-------:|:--------:|:----:|
| `marketplace.view` | ✅ | ✅ | ✅ | ✅ | ✅ | | | | ✅ |
| `marketplace.edit` | ✅ | ✅ | ✅ | ✅ | ✅ | | | | |
| `marketplace.moderate` | ✅ | ✅ | ✅ | ✅ | | | | | |
| `marketplace.admin` | ✅ | ✅ | ✅ | ✅ | | | | | |
| `marketplace.requests` | ✅ | ✅ | ✅ | ✅ | ✅ | | | | |
| `blog.view` | ✅ | ✅ | ✅ | ✅ | | | ✅ | | ✅ |
| `blog.write` | ✅ | ✅ | ✅ | ✅ | | | ✅ | | |
| `blog.settings.update` | ✅ | ✅ | ✅ | ✅ | | | | | |
| `sldb.view` | ✅ | ✅ | ✅ | ✅ | | ✅ | | | |
| `sldb.edit` | ✅ | ✅ | ✅ | ✅ | | ✅ | | | |
| `sldb.admin` | ✅ | ✅ | ✅ | ✅ | | | | | |
| `wardrobe.view` | ✅ | ✅ | ✅ | ✅ | | | | ✅ | ✅ |
| `wardrobe.edit` | ✅ | ✅ | ✅ | ✅ | | | | ✅ | |
| `dashboard.view` | ✅ | ✅ | ✅ | ✅ | | | | | ✅ |
| `settings.view` | ✅ | ✅ | ✅ | ✅ | | | | | ✅ |
| `apikey.manage` | ✅ | ✅ | ✅ | ✅ | | | | | ✅ |
| `org.view` | ✅ | ✅ | ✅ | ✅ | | | | | |
| `org.delete` | ✅ | ✅ | ✅ | | | | | | |
| `rbac.manage` | ✅ | ✅ | ✅ | | | | | | |

---

## How permission checks work (resolution order)

```
requirePermission(key, headers)
  1. No session → throw "unauthorized"
  2. User ID is in BETTER_AUTH_ADMIN_IDS env var → allow (superadmin wildcard)
  3. user.role matches a key in ROLE_GRANTS and that key includes the permission → allow (static, no org needed)
  4. User has an active org → check org-level RBAC DB (member roles + overrides) → allow/deny
  5. No org + not matched above → throw "forbidden"
```

The static map (`role-permissions.ts`) means most privileged users never need an org or seeding — it just works based on their role.

---

## Adding a new permission

1. Add the key to the relevant routes with `await requirePermission("area.action", req.headers as any)`.
2. Add it to `ROLE_GRANTS` in [role-permissions.ts](../packages/core/src/server/auth/role-permissions.ts) for the roles that should have it.
3. Add it to the `GRANTS` map in [seed-org/route.ts](../packages/core/src/app/api/admin/rbac/seed-org/route.ts) so the DB stays in sync for org-override users.
4. Document it in this file.
