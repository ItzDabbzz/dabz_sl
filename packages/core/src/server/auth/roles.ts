/**
 * Staff is a platform-level thing: the people who run the site.
 *
 * The answer lives in a shared module so the dashboard shell and the API
 * guards can never disagree about who is staff - if they drift, a page
 * can hide what the API still allows.
 */
export {
    STAFF_ROLES,
    isConfiguredAdminId,
    isStaffRole,
    isStaffUser,
} from "@/features/auth/permissions/staff";

import { isStaffRole } from "@/features/auth/permissions/staff";

/**
 * Kept for the places that still ask the old question.
 *
 * @deprecated Use `isStaffUser` from "@/features/auth/permissions/staff" -
 * it takes the whole user record and says the same thing.
 */
export function isPrivilegedMarketplaceRole(
    role: string | undefined | null,
) {
    return isStaffRole(role);
}
