import { Suspense } from "react";
import ClientExplorer from "./ClientExplorer";

export default function Page() {
    return (
        <Suspense>
            <ClientExplorer />
        </Suspense>
    );
}
