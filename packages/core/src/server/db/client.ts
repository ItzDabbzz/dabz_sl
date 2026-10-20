import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { better } from "better-drizzle";
import * as slSchema from "@/schemas/sl-schema";
import * as authSchema from "@/schemas/auth-schema";
import { withReadableDialectName } from "./dialect-name";

/**
 * Every table in one object.
 *
 * Drizzle needs the schema for its relational query builder, and
 * better-drizzle reads the same thing to build a delegate per table. Keeping
 * one combined object means a table only has to be declared once.
 */
const schema = { ...slSchema, ...authSchema };

/**
 * The table names, which are the delegate names.
 *
 * This has to be worked out up front. Asking better-drizzle for a delegate
 * under a name it does not recognise makes it try to build one, and that
 * fails — so the delegate client is only ever asked for a name on this
 * list. The schema also holds relation objects, which are not tables.
 */
const tableNames = new Set(
    Object.entries(schema)
        .filter(
            ([, value]) =>
                value &&
                typeof value === "object" &&
                Symbol.for("drizzle:Name") in value,
        )
        .map(([name]) => name),
);

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
  const raw = withReadableDialectName(drizzle(sql, { schema }));
  const client = better(raw, { schema });

  // A delegate answers for the tables; raw Drizzle answers for everything
  // else. The raw client is the target, so an unknown property is answered
  // by Drizzle rather than by the delegate client, which would treat the
  // name as a table it cannot build a delegate for.
  cachedDb = new Proxy(raw, {
    get(target, property) {
      if (typeof property === "string" && tableNames.has(property)) {
        const value = Reflect.get(client, property, client);
        return typeof value === "function" ? value.bind(client) : value;
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
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
