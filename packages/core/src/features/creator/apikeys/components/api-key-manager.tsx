"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Copy, Edit, Eye, EyeOff, Settings } from "lucide-react"
import { toast } from "sonner"
import { client } from "@/features/auth/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

interface ApiKey {
  id: string
  name?: string | null
  start?: string | null
  prefix?: string | null
  enabled: boolean
  createdAt: Date
  expiresAt?: Date | null
  permissions?: { [key: string]: string[] } | null
  metadata?: any | null
  remaining?: number | null
  rateLimitEnabled?: boolean
  rateLimitMax?: number | null
  rateLimitTimeWindow?: number | null
  requestCount?: number
  lastRequest?: Date | null
}

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyPrefix, setNewKeyPrefix] = useState("")
  const [newKeyExpiresIn, setNewKeyExpiresIn] = useState("30") // days
  const [newKeyPermissions, setNewKeyPermissions] = useState("")
  const [newKeyMetadata, setNewKeyMetadata] = useState("")
  const [loading, setLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { data: session } = client.useSession()

  // Load existing API keys
  const loadApiKeys = async () => {
    try {
      setLoading(true)
      const response = await client.apiKey.list()
      if (response.data) {
        setApiKeys((response.data as any).apiKeys ?? (response.data as any))
      }
    } catch (error) {
      toast.error("Failed to load API keys")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Create new API key
  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key")
      return
    }

    try {
      setLoading(true)
      
      const createData: any = {
        name: newKeyName,
      }

      // Only add expiresIn if it's not "never expires" 
      if (newKeyExpiresIn !== "0") {
        createData.expiresIn = parseInt(newKeyExpiresIn) * 24 * 60 * 60 // Convert days to seconds
      }

      // Add advanced options if provided
      if (showAdvanced) {
        if (newKeyPrefix.trim()) {
          createData.prefix = newKeyPrefix
        }

        // Parse permissions
        if (newKeyPermissions.trim()) {
          try {
            createData.permissions = JSON.parse(newKeyPermissions)
          } catch (e) {
            toast.error("Invalid permissions JSON format")
            return
          }
        }

        // Parse metadata
        if (newKeyMetadata.trim()) {
          try {
            createData.metadata = JSON.parse(newKeyMetadata)
          } catch (e) {
            toast.error("Invalid metadata JSON format")
            return
          }
        }
      }

      console.log("Creating API key with data:", createData)

      const response = await client.apiKey.create(createData)

      if (response.data) {
        setGeneratedKey(response.data.key)
        setNewKeyName("")
        setNewKeyPrefix("")
        setNewKeyExpiresIn("30")
        setNewKeyPermissions("")
        setNewKeyMetadata("")
        setShowAdvanced(false)
        toast.success("API key created successfully!")
        loadApiKeys() // Refresh the list
      }
    } catch (error: any) {
      console.error("API Key creation error:", error)
      toast.error(error?.error?.message || "Failed to create API key")
    } finally {
      setLoading(false)
    }
  }

  // Update API key
  const updateApiKey = async (keyId: string, updates: any) => {
    try {
      setLoading(true)
      const response = await client.apiKey.update({
        keyId,
        ...updates
      })

      if (response.data) {
        toast.success("API key updated successfully!")
        loadApiKeys() // Refresh the list
        setEditingKey(null)
      }
    } catch (error: any) {
      console.error("API Key update error:", error)
      toast.error(error?.error?.message || "Failed to update API key")
    } finally {
      setLoading(false)
    }
  }

  // Get API key details
  const getApiKey = async (keyId: string) => {
    try {
      const response = await client.apiKey.get({ query: { id: keyId } })
      return response.data
    } catch (error: any) {
      console.error("API Key get error:", error)
      toast.error(error?.error?.message || "Failed to get API key")
      return null
    }
  }

  // Delete API key
  const deleteApiKey = async (keyId: string) => {
    try {
      setLoading(true)
      await client.apiKey.delete({ keyId })
      toast.success("API key deleted successfully!")
      loadApiKeys() // Refresh the list
    } catch (error: any) {
      console.error("API Key delete error:", error)
      toast.error(error?.error?.message || "Failed to delete API key")
    } finally {
      setLoading(false)
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard!")
  }

  // Load keys on component mount
  useEffect(() => {
    if (session?.user) {
      loadApiKeys()
    }
  }, [session])

  if (!session?.user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Please sign in to manage API keys.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create new API key */}
      <Card>
        <CardHeader>
          <CardTitle>Create New API Key</CardTitle>
          <CardDescription>
            Create a new API key to access your account programmatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">API Key Name *</Label>
              <Input
                id="keyName"
                placeholder="Enter a descriptive name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="keyExpires">Expires In (days)</Label>
              <Select value={newKeyExpiresIn} onValueChange={setNewKeyExpiresIn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="0">Never expires</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="advanced"
              checked={showAdvanced}
              onCheckedChange={setShowAdvanced}
            />
            <Label htmlFor="advanced">Show advanced options</Label>
          </div>

          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="keyPrefix">Custom Prefix (optional)</Label>
                <Input
                  id="keyPrefix"
                  placeholder="e.g., myapp_"
                  value={newKeyPrefix}
                  onChange={(e) => setNewKeyPrefix(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keyPermissions">Permissions (JSON)</Label>
                <Textarea
                  id="keyPermissions"
                  placeholder={'{"api": ["read", "write"], "files": ["read"]}'}
                  value={newKeyPermissions}
                  onChange={(e) => setNewKeyPermissions(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keyMetadata">Metadata (JSON)</Label>
                <Textarea
                  id="keyMetadata"
                  placeholder={'{"plan": "premium", "userId": "123"}'}
                  value={newKeyMetadata}
                  onChange={(e) => setNewKeyMetadata(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          <Button onClick={createApiKey} disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create API Key"}
          </Button>

          {/* Show generated key */}
          {generatedKey && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Your new API key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-background rounded text-sm font-mono break-all">
                  {generatedKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(generatedKey)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Save this key now. You won't be able to see it again!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing API keys */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            Manage your existing API keys. You can edit settings, view details, or delete them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && apiKeys.length === 0 ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-muted-foreground">No API keys found. Create your first one above.</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg space-y-2 md:space-y-0"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{key.name || "Unnamed Key"}</span>
                      <Badge variant={key.enabled ? "default" : "destructive"}>
                        {key.enabled ? "Active" : "Disabled"}
                      </Badge>
                      {key.prefix && (
                        <Badge variant="outline">
                          {key.prefix}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      {key.start && (
                        <>
                          <code className="bg-muted px-1 rounded">{key.start}...</code>
                          <span>•</span>
                        </>
                      )}
                      <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.expiresAt && (
                        <>
                          <span>•</span>
                          <span className={
                            new Date(key.expiresAt) < new Date() ? "text-red-500" : ""
                          }>
                            Expires {new Date(key.expiresAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Additional info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {key.remaining !== null && (
                        <span>Remaining: {key.remaining}</span>
                      )}
                      {key.rateLimitEnabled && (
                        <span>Rate Limited</span>
                      )}
                      {key.requestCount !== undefined && (
                        <span>Requests: {key.requestCount}</span>
                      )}
                      {key.lastRequest && (
                        <span>Last used: {new Date(key.lastRequest).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* Permissions preview */}
                    {key.permissions && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Permissions:</span> {JSON.stringify(key.permissions)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>API Key Details</DialogTitle>
                          <DialogDescription>
                            View detailed information about this API key.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Name</Label>
                            <p className="text-sm">{key.name || "Unnamed"}</p>
                          </div>
                          <div>
                            <Label>Status</Label>
                            <p className="text-sm">{key.enabled ? "Active" : "Disabled"}</p>
                          </div>
                          <div>
                            <Label>Created</Label>
                            <p className="text-sm">{new Date(key.createdAt).toLocaleString()}</p>
                          </div>
                          {key.expiresAt && (
                            <div>
                              <Label>Expires</Label>
                              <p className="text-sm">{new Date(key.expiresAt).toLocaleString()}</p>
                            </div>
                          )}
                          {key.permissions && (
                            <div>
                              <Label>Permissions</Label>
                              <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(key.permissions, null, 2)}
                              </pre>
                            </div>
                          )}
                          {key.metadata && (
                            <div>
                              <Label>Metadata</Label>
                              <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(key.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {key.remaining !== null && (
                              <div>
                                <Label>Remaining Uses</Label>
                                <p>{key.remaining}</p>
                              </div>
                            )}
                            {key.requestCount !== undefined && (
                              <div>
                                <Label>Total Requests</Label>
                                <p>{key.requestCount}</p>
                              </div>
                            )}
                            {key.rateLimitEnabled && (
                              <div>
                                <Label>Rate Limit</Label>
                                <p>{key.rateLimitMax} requests per {key.rateLimitTimeWindow}ms</p>
                              </div>
                            )}
                            {key.lastRequest && (
                              <div>
                                <Label>Last Request</Label>
                                <p>{new Date(key.lastRequest).toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit API Key</DialogTitle>
                          <DialogDescription>
                            Update the settings for this API key.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="editName">Name</Label>
                            <Input
                              id="editName"
                              defaultValue={key.name || ""}
                              onChange={(e) => {
                                if (editingKey) {
                                  setEditingKey({ ...editingKey, name: e.target.value })
                                }
                              }}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={editingKey?.enabled ?? key.enabled}
                              onCheckedChange={(checked) => {
                                if (editingKey) {
                                  setEditingKey({ ...editingKey, enabled: checked })
                                } else {
                                  setEditingKey({ ...key, enabled: checked })
                                }
                              }}
                            />
                            <Label>Enabled</Label>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            onClick={() => {
                              if (editingKey) {
                                updateApiKey(key.id, {
                                  name: editingKey.name,
                                  enabled: editingKey.enabled
                                })
                              }
                            }}
                            disabled={loading}
                          >
                            {loading ? "Updating..." : "Update"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteApiKey(key.id)}
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
