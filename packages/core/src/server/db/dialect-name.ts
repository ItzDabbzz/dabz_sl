/**
 * Giving the dialect a name that survives minification.
 *
 * better-drizzle works out which database it is talking to by reading
 * `dialect.constructor.name` and matching it against `pg`, `mysql` and
 * `sqlite`. A production build renames the class, so the name arrives as a
 * single letter and the inference throws instead of recognising Postgres.
 *
 * Drizzle itself never reads that property, so the dialect is handed over a
 * stand-in with a readable name. It is the real dialect underneath, so every
 * method still behaves exactly as before.
 */

/** The names better-drizzle looks for, and the one this project uses. */
const DIALECT_NAME = "PgDialect";

/**
 * Replace a dialect with a stand-in whose constructor name is readable.
 *
 * The stand-in is the real dialect underneath, so nothing that calls into it
 * changes behaviour.
 */
export function withReadableDialectName<T extends object>(client: T): T {
    const target = client as { dialect?: object };
    const dialect = target.dialect;

    if (!dialect) return client;

    class NamedDialect {}
    Object.defineProperty(NamedDialect, "name", { value: DIALECT_NAME });

    const shim = Object.create(dialect) as object;
    Object.defineProperty(shim, "constructor", { value: NamedDialect });

    target.dialect = shim;

    return client;
}
