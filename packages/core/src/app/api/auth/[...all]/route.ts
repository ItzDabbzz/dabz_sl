export const dynamic = "force-dynamic";

import { auth } from "@/server/auth/core";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);


