import { StaffOnly } from "@/features/dashboard/components/staff-only";
import ItemCreator from "@/features/marketplace/item_creator/page";

export const dynamic = "force-dynamic";

/**
 * Adding to the marketplace catalogue is staff work, so the page is
 * gated on the server rather than only in the browser.
 */
export default async function NewMarketplaceItemPage() {
    return (
        <StaffOnly
            deniedDescription="Adding items to the marketplace catalogue is for staff."
        >
            <ItemCreator />
        </StaffOnly>
    );
}
