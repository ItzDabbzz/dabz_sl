# API Key Implementation Guide

This project now includes a fully functional API Key management system using Better Auth's API Key plugin.

## Features Implemented

✅ **Server-side Plugin**: Added `apiKey()` plugin to Better Auth configuration  
✅ **Client-side Plugin**: Added `apiKeyClient()` to auth client  
✅ **Database Schema**: Added `api_key` table with all required fields  
✅ **Database Migration**: Successfully applied migration to add the table  
✅ **UI Components**: Created `ApiKeyManager` component for key management  
✅ **API Routes**: Example protected route with API key verification  

## How to Use

### 1. Create API Keys
- Navigate to `/api-keys` page
- Enter a name for your API key
- Click "Create API Key"
- **Important**: Copy the generated key immediately - you won't see it again!

### 2. Using API Keys in Requests
Include the API key in your request headers:

```bash
curl -H "x-api-key: your_api_key_here" http://localhost:3000/api/protected
```

### 3. API Key Features
- **Expiration**: Keys expire after 30 days by default
- **Permissions**: Keys have configurable permissions (e.g., "api": ["read", "write"])
- **Rate Limiting**: Built-in rate limiting (configurable)
- **Metadata**: Store additional data with keys
- **Automatic Cleanup**: Expired keys are automatically removed

### 4. Available API Endpoints

#### Create API Key
```bash
POST /api/auth/api-key/create
Content-Type: application/json

{
  "name": "My API Key",
  "expiresIn": 2592000,
  "permissions": {
    "api": ["read", "write"]
  }
}
```

#### List API Keys
```bash
GET /api/auth/api-key/list
```

#### Verify API Key
```bash
POST /api/auth/api-key/verify
Content-Type: application/json

{
  "key": "your_api_key_here",
  "permissions": {
    "api": ["read"]
  }
}
```

#### Delete API Key
```bash
POST /api/auth/api-key/delete
Content-Type: application/json

{
  "keyId": "api_key_id_here"
}
```

### 5. Server-side Usage
Use the auth instance to verify API keys in your API routes:

```typescript
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key")
  
  const result = await auth.api.verifyApiKey({
    body: { key: apiKey }
  })
  
  if (result.valid) {
    // Key is valid, proceed with request
  } else {
    // Invalid key, return error
  }
}
```

### 6. Automatic Session Creation
When a valid API key is provided in headers, Better Auth automatically creates a mock session for the user associated with that key.

## Database Schema

The `api_key` table includes:
- `id` - Primary key
- `name` - Human-readable name
- `key` - Hashed API key
- `userId` - Associated user ID
- `enabled` - Whether key is active
- `permissions` - JSON permissions object
- `metadata` - Additional JSON metadata
- `expiresAt` - Expiration timestamp
- Rate limiting fields
- Refill mechanism fields

## Security Features

- **Key Hashing**: API keys are hashed before storage
- **Rate Limiting**: Configurable per-key rate limits
- **Permissions**: Granular permission system
- **Expiration**: Automatic key expiration
- **Prefix Support**: Custom prefixes for key identification

## Configuration Options

You can customize the API key plugin in `lib/auth.ts`:

```typescript
apiKey({
  defaultKeyLength: 64,
  defaultPrefix: "sk_",
  enableMetadata: true,
  rateLimit: {
    enabled: true,
    timeWindow: 86400000, // 24 hours
    maxRequests: 1000
  }
})
```

The implementation follows the same structure and style as other Better Auth plugins in the project, maintaining consistency with the existing codebase.
