import { ApiKeyManager } from "@/features/creator/apikeys/components/api-key-manager"

export default function ApiKeysPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">API Keys</h1>
        <p className="text-muted-foreground mt-2">
          Manage your API keys to access your account programmatically.
        </p>
      </div>
      
      <ApiKeyManager />
    </div>
  )
}
