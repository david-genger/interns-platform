/**
 * Manual sync runner: `npm run sync:hourly` / `npm run sync:daily`.
 * In production the Vercel Cron hits the /api/sync/* routes instead.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { runSync, type SyncMode } from "../src/lib/sync";

const mode = (process.argv[2] as SyncMode) || "hourly";
if (mode !== "hourly" && mode !== "daily") {
  console.error('Usage: tsx scripts/sync.ts <hourly|daily>');
  process.exit(1);
}

runSync(mode)
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    if (r.errors.length) process.exitCode = 1;
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
