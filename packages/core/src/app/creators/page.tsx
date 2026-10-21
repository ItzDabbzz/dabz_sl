export {
    default,
    metadata,
} from "@/features/public/creators/page";

// The directory reads its search and sort from the address, so it is
// rendered per request rather than cached as one page.
export const dynamic = "force-dynamic";
