import { test } from "node:test";
import assert from "node:assert/strict";
import { withReadableDialectName } from "../src/server/db/dialect-name.ts";

/**
 * better-drizzle works out which database it is talking to by reading
 * dialect.constructor.name. This is that read, copied out of the library so
 * a change in its behaviour shows up here rather than in production.
 */
function inferDialect(client) {
    const name = client.dialect?.constructor?.name?.toLowerCase() ?? "";

    if (name.includes("sqlite")) return "sqlite";
    if (name.includes("mysql")) return "mysql";
    if (name.includes("pg") || name.includes("postgres")) return "pg";

    return null;
}

// A class named the way a minifier leaves it: one letter.
class I {
    buildQuery() {
        return "sql";
    }
}

test("a minified dialect name is recognised again", () => {
    const client = { dialect: new I() };

    // Before the fix, the name is a letter and nothing matches.
    assert.equal(inferDialect(client), null);

    withReadableDialectName(client);

    assert.equal(inferDialect(client), "pg");
});

test("the real dialect is still underneath", () => {
    const client = { dialect: new I() };

    withReadableDialectName(client);

    assert.equal(client.dialect.constructor.name, "PgDialect");
    assert.equal(client.dialect.buildQuery(), "sql");
    assert.ok(client.dialect instanceof I);
});

test("a client with no dialect is left alone", () => {
    const client = { dialect: undefined };

    withReadableDialectName(client);

    assert.equal(client.dialect, undefined);
});
