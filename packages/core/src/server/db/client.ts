import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

type Database = ReturnType<typeof drizzle>;

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
  cachedDb = drizzle(sql);

  return cachedDb;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDbInstance();
    const value = Reflect.get(instance, property, instance);

    return typeof value === "function" ? value.bind(instance) : value;
  },
});
