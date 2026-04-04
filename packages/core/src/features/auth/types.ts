import type { auth } from "@/server/auth/core";
import { client } from "@/features/auth/client";

export type Session = typeof auth.$Infer.Session;
export type ActiveOrganization = typeof client.$Infer.ActiveOrganization;
export type Invitation = typeof client.$Infer.Invitation;
