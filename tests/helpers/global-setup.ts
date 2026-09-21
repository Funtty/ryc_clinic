import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB_REL = path.join("prisma", "test.db");

/**
 * Prepare an isolated test database (prisma/test.db) before the suite runs:
 * drop any leftovers, then sync the Prisma schema into it. Production/dev data
 * (dev.db) is never touched by the test suite.
 */
export default async function setup() {
  const root = process.cwd();
  for (const file of [DB_REL, `${DB_REL}-journal`]) {
    fs.rmSync(path.join(root, file), { force: true });
  }

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });

  return async () => {
    for (const file of [DB_REL, `${DB_REL}-journal`]) {
      fs.rmSync(path.join(root, file), { force: true });
    }
  };
}