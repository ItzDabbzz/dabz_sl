import { auth } from "@/server/auth/core";
import { NextRequest } from 'next/server';

// Helper to require API key authentication for API routes
export async function requireApiKey(req: NextRequest) {
  // Accept API key in header: 'x-api-key' or 'authorization: Bearer ...'
  const apiKey = req.headers.get('x-api-key') || (req.headers.get('authorization')?.replace(/^Bearer /i, ''));
  if (!apiKey) return null;
  // Validate API key using better-auth
  const user = await auth.api.verifyApiKey({
    body: {
      key: apiKey
      // Optionally add permissions here if needed, e.g.:
      // permissions: { api: ["read"] }
    }
  });
  return user || null;
}
