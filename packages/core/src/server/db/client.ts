import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { better } from "better-drizzle";
import * as slSchema from "@/schemas/sl-schema";
import * as authSchema from "@/schemas/auth-schema";

/**
 * Every table in one object.
 *
 * Drizzle needs the schema for its relational query builder, and
 * better-drizzle reads the same thing to build a delegate per table. Keeping
 * one combined object means a table only has to be declared once.
 */
const schema = { ...slSchema, ...authSchema };

type RawDatabase = ReturnType<typeof drizzle<typeof schema>>;
type BetterClient = ReturnType<typeof better<typeof schema>>;

/**
 * The client.
 *
 * It is both things at once: the better-drizzle client, which gives every
 * table a typed delegate (`db.mpCategories.findMany(...)`), and the raw
 * Drizzle client, which keeps the query builder available for the queries a
 * delegate does not cover (`db.select().from(...)`). The two are merged into
 * one object so a caller never has to know which is which.
 */
export type Database = BetterClient & RawDatabase;

let cachedDb: Database | undefined;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  return databaseUrl;
}

function getDbInstance(): Database {
  if (cachedDb) {
    return cachedDb;
  }

  const sql = neon(getDatabaseUrl());
  const raw = drizzle(sql, { schema });
  const client = better(raw, { schema });

  // The delegate wins where the two overlap, and raw Drizzle answers for
  // everything else. A plain merge would not do: Drizzle's query builder
  // methods live on the prototype, so they are not own properties and an
  // object merge silently drops them.
  cachedDb = new Proxy(client, {
    get(target, property) {
      if (property in target) {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }

      const value = Reflect.get(raw, property, raw);
      return typeof value === "function" ? value.bind(raw) : value;
    },
  }) as unknown as Database;

  return cachedDb;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDbInstance() as unknown as Record<
      string | symbol,
      unknown
    >;
    return instance[property];
  },
});
