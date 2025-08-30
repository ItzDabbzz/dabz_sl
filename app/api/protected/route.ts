import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Get the API key from headers
    const apiKey = request.headers.get("x-api-key")
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401 }
      )
    }

    // Verify the API key
    const result = await auth.api.verifyApiKey({
      body: {
        key: apiKey,
        permissions: {
          api: ["read"] // Check if the key has read permissions for 'api' resource
        }
      }
    })

    if (!result.valid || !result.key) {
      return NextResponse.json(
        { error: result.error?.message || "Invalid API key" },
        { status: 401 }
      )
    }

    // API key is valid, return some protected data
    return NextResponse.json({
      message: "Hello from protected API!",
      timestamp: new Date().toISOString(),
      keyInfo: {
        id: result.key.id,
        name: result.key.name,
        userId: result.key.userId,
        permissions: result.key.permissions
      }
    })

  } catch (error) {
    console.error("API Key verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
