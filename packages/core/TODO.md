# TODO

## General Repository
- Make sure mobile-first is a priority. currently quite a few things dont render well on mobile.
- Fix the useless extra requests. Ex: on dashboard/userprofile it constantly pings for a organization, and returns null if a user doesnt have one (aka the default...)
- Scan over all other routes and make sure requests are kept to minimal.

## User/Auth
- Finish setting up `packages/core/src/lib/admin-access.ts`, rename the file, expand permissions and start utilizing said permissions across the site instead of purely just role based.
- Verify orgs/teams work, along with permissions delegation to orgs and teams. org owners/staff should be able to manage perms per team, one team could be a blog only team, one could be a marketplace only team. Flexibility is key.
- Api key's need proper scope selector, not a json input. users wont know the typical json entrys. simple toggles in a modal would do. So possibly redesign all of api-key area in userprofile area. make it table based, a create api key button, that opens a modal.

# Marketplace
- Make mobile safe.
-

## Dashboard Area
- [x] `/dashboard/tools/marketplace/requests` Should not show in sidebar if a user doesnt have permission to view it.
- [x] A regular user should NOT see `dashboard/tools/marketplace/categories` ever, only owner, dev, admin, mod.
- marketplace-scrape needs to be feature-flag locked somehow, with a easy way to roll it out to specific users.
- Rework blog area a bit
  - Adjust how blogs are handled, staff can make global blogs at the regular /blog route, but i also want to setup creator specific blogs. each creator has their own blog page with their own blogs to display.
  - We would add a new button to homepage labled `Community Blogs`, that page would go to a general latest posted list, with a clean/minimal sidebar to search for creators thats categoriezed. it needs to be EXTREMLY user friendly ux/ui wise.
- [x] fix no_active_org errors, as by default a user doesnt have a org unless they create or join one, which is optional.
```ts
Error: no_active_org
    at requirePermission (src/server/auth/guards.ts:38:23)
    at async GET (src/app/api/creator/instances/route.ts:12:9)
  36 |     }
  37 |
> 38 |     if (!orgId) throw new Error("no_active_org");
     |                       ^
  39 |
  40 |     const ok = await PermissionService.hasPermission(user.id, orgId, key);
  41 |     if (!ok) throw new Error("forbidden");
```