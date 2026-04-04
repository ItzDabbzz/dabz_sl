export const dynamic = "force-dynamic";

import { z } from "zod";
import { createDocument } from "zod-openapi";
import "zod-openapi";
import { WebhookPayloadSchema } from "@/schemas/webhook";
import { auth } from "@/lib/auth";
import { SlRegisterBody, SlRegisterResponse, SlConfigResponse, SlConfigUpdateBody, SlConfigUpdateResponse, SlEntitlementBody, SlEntitlementResponse, SlInstanceDetailsResponse, SlTokenRotateResponse, InstanceAuthHeaders, SlUuid, ETag } from "@/schemas/sl.zod";

// Helper to merge paths from multiple OpenAPI schemas
function mergePaths(...schemas: any[]) {
  return schemas.reduce((acc, schema) => ({ ...acc, ...schema.paths }), {});
}

async function getOpenApiDoc() {
  const authSchema = await auth.api.generateOpenAPISchema();

  const securitySchemes = {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "API Key",
    },
  } as const;

  const slPaths = {
    "/api/sl/register": {
      post: {
        summary: "Register an instance",
        requestBody: {
          content: {
            "application/json": { schema: SlRegisterBody },
          },
        },
        responses: {
          200: {
            description: "Registration success",
            content: { "application/json": { schema: SlRegisterResponse } },
          },
        },
      },
    },
    "/api/sl/instances/{id}": {
      get: {
        summary: "Get instance details",
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: SlInstanceDetailsResponse } },
            headers: z.object({ ETag }),
          },
          404: { description: "Not found" },
        },
      },
    },
    "/api/sl/instances/{id}/config": {
      get: {
        summary: "Fetch config",
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: SlConfigResponse } },
            headers: z.object({ ETag }),
          },
          304: { description: "Not Modified" },
        },
      },
      post: {
        summary: "Update config",
        requestParams: { path: z.object({ id: SlUuid }), header: InstanceAuthHeaders },
        requestBody: { content: { "application/json": { schema: SlConfigUpdateBody } } },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: SlConfigUpdateResponse } } },
          401: { description: "Unauthorized" },
          429: { description: "Rate limited" },
        },
      },
    },
    "/api/sl/instances/{id}/token/rotate": {
      post: {
        summary: "Rotate instance token",
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: SlTokenRotateResponse } } },
          404: { description: "Not found" },
        },
      },
    },
    "/api/sl/instances/{id}/snapshots/{snapshotId}/restore": {
      post: {
        summary: "Restore a config snapshot",
        requestParams: { path: z.object({ id: SlUuid, snapshotId: SlUuid }), header: InstanceAuthHeaders },
        responses: {
          200: { description: "OK" },
          401: { description: "Unauthorized" },
          404: { description: "Not found" },
        },
      },
    },
    "/api/sl/entitlements": {
      post: {
        summary: "Upsert entitlement",
        requestBody: { content: { "application/json": { schema: SlEntitlementBody } } },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: SlEntitlementResponse } } },
        },
      },
    },

    // Creator/Admin
    "/api/creator/master-objects": {
      get: {
        summary: "List master objects",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "OK" } },
      },
      post: {
        summary: "Create master object",
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: "Created" } },
      },
    },
    "/api/creator/master-objects/{id}": {
      get: {
        summary: "Get master object",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
      put: {
        summary: "Update master object",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
      delete: {
        summary: "Delete master object",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
    },
    "/api/creator/master-objects/{id}/versions": {
      get: {
        summary: "List versions",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: { 200: { description: "OK" } },
      },
      post: {
        summary: "Create version",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: { 201: { description: "Created" } },
      },
    },
    "/api/creator/instances": {
      get: {
        summary: "Search instances",
        description: "Returns instances scoped to the API key org/team/user.",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/creator/instances/{id}/token/rotate": {
      post: {
        summary: "Rotate instance token (admin)",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: SlTokenRotateResponse } } },
          404: { description: "Not found" },
        },
      },
    },
    "/api/creator/instances/{id}/token/revoke": {
      post: {
        summary: "Revoke instance token (admin)",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
    },

    "/api/creator/webhooks": {
      get: {
        summary: "List webhooks",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "OK" } },
      },
      post: {
        summary: "Create webhook",
        security: [{ BearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: z.object({
          targetUrl: z.string().url(),
          events: z.array(z.string()),
          secret: z.string().min(8),
          scopeType: z.enum(["org","team","user"]).optional(),
          scopeId: SlUuid.optional(),
        }) } } },
        responses: { 201: { description: "Created" } },
      },
    },
    "/api/creator/webhooks/{id}": {
      put: {
        summary: "Update webhook",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        requestBody: { content: { "application/json": { schema: z.object({
          targetUrl: z.string().url().optional(),
          events: z.array(z.string()).optional(),
          secret: z.string().min(8).optional(),
          active: z.boolean().optional(),
        }) } } },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
      delete: {
        summary: "Delete webhook",
        security: [{ BearerAuth: [] }],
        requestParams: { path: z.object({ id: SlUuid }) },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
    },
    "/api/creator/webhooks/test": {
      post: {
        summary: "Test webhook delivery",
        security: [{ BearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: z.object({
          url: z.string().url(),
          event: z.string().optional(),
          payload: z.unknown().optional(),
        }) } } },
        responses: { 200: { description: "OK" }, 400: { description: "Bad Request" } },
      },
    },

    "/api/creator/apikeys": {
      get: {
        summary: "List API keys",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "OK" } },
      },
      post: {
        summary: "Create API key",
        security: [{ BearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: z.object({
          name: z.string().min(1),
          scopes: z.array(z.string()).optional(),
          metadata: z.record(z.string(), z.any()).optional(),
        }) } } },
        responses: { 201: { description: "Created" } },
      },
      delete: {
        summary: "Delete API key",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "OK" } },
      },
    },
  } as const;

  const allPaths = mergePaths(authSchema, { paths: slPaths });

  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "SL Tools API",
      version: "1.0.0",
      description: "OpenAPI documentation for SL public and creator APIs.",
    },
    components: { securitySchemes },
    security: [],
    paths: allPaths,
  });
}

import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const openApiDoc = await getOpenApiDoc();
  return new Response(JSON.stringify(openApiDoc), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });


}
