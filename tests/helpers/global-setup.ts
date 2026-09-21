import { execSync } from "node:child_process";
import { prepareTestsSchema, testDatabaseUrl } from "./test-db";

/**
 * Prepare an isolated test database (Supabase `tests` schema) before the
 * suite runs: sync the Prisma schema into it. Production/dev data (the
 * `public` schema in the same Supabase project) is never touched.
 */
export default async function setup() {
  const url = testDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — configure Supabase credentials in .env before running tests.",
    );
  }

  const { cwd, schemaPath, prismaCli } = prepareTestsSchema();
  execSync(
    `node "${prismaCli}" db push --skip-generate --accept-data-loss --schema "${schemaPath}"`,
    {
      cwd,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    },
  );

  return async () => {};
}