import { ApiKeyManager } from "@/components/api-key-manager";

export default function APICard(_props?: { session?: any }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
                <ApiKeyManager />
            </div>
        </div>
    );
}
