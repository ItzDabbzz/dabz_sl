import { Suspense } from "react";
import ClientExplorer from "./ClientExplorer";

export default function Page() {
    return (
        <div className="h-[100svh] w-full overflow-hidden pb-2.5">
            <Suspense>
                <ClientExplorer />
            </Suspense>
        </div>
    );
}
