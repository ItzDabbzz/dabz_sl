import { neon } from "@neondatabase/serverless";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY created_at`;
console.log("Applied migrations in DB:");
rows.forEach((r) => console.log(" ", r.id, String(r.hash).slice(0, 20)));
