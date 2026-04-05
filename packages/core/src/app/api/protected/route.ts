import { auth } from "@/server/auth/core";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401 }
      );
    }

    const result = await auth.api.verifyApiKey({
      body: {
        key: apiKey,
        permissions: {
          api: ["read"],
        }
      }
    });

    if (!result.valid || !result.key) {
      return NextResponse.json(
        { error: result.error?.message || "Invalid API key" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: "Hello from protected API!",
      timestamp: new Date().toISOString(),
      keyInfo: {
        id: result.key.id,
        name: result.key.name,
        // userId is present at runtime but omitted from BetterAuth's returned type
        userId: (result.key as any).userId as string | undefined,
        permissions: result.key.permissions
      }
    });
  } catch (error) {
    console.error("API Key verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
