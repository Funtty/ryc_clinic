import "dotenv/config";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Isolated Postgres schema for the vitest suite. Points at the same Supabase
 * project as dev/prod but inside the `tests` schema, so the test suite never
 * touches `public` dev/production data.
 */

export function withSchema(url: string, schema: string): string {
  if (!url) return "";
  const parsed = new URL(url);
  parsed.searchParams.set("schema", schema);
  return parsed.toString();
}

export function testDatabaseUrl(): string {
  return withSchema((process.env.DATABASE_URL ?? "").trim(), "tests");
}

/**
 * Prisma's CLI re-injects the project `.env` over DATABASE_URL (it walks up
 * parent directories looking for `.env`), so the test-schema URL can't be
 * forced via the child env alone. We instead stage a schema + `.env` in a
 * scratch dir OUTSIDE the project (os.tmpdir), so the tests URL is the only
 * `.env` Prisma can load, and invoke the project's Prisma binary directly.
 */
const ARTIFACT_ROOT = join(tmpdir(), "ryc-tests-schema");

export function prepareTestsSchema(): {
  cwd: string;
  schemaPath: string;
  prismaCli: string;
} {
  mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const dir = mkdtempSync(join(ARTIFACT_ROOT, "tests-"));
  const schemaPath = join(dir, "schema.prisma");
  writeFileSync(
    schemaPath,
    readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8"),
  );
  const url = testDatabaseUrl();
  // `db push` needs the DIRECT connection (port 5432): the transaction pooler
  // (6543) rejects DDL. Schema both so the push targets the `tests` schema.
  const directUrl =
    withSchema((process.env.DIRECT_URL ?? "").trim(), "tests") || url;
  writeFileSync(
    join(dir, ".env"),
    `DATABASE_URL="${url}"\nDIRECT_URL="${directUrl}"\n`,
  );
  return {
    cwd: dir,
    schemaPath,
    prismaCli: join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
  };
}