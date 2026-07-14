import fs from "fs";
import path from "path";
import { Client } from "pg";

function loadEnv(): void {
  const fp = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const sql = fs.readFileSync(path.join(process.cwd(), "database/schema/132_music_commercial_score.sql"), "utf8");
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? "postgresql://ai_cut:ai_cut_dev@localhost:5433/ai_cut_v1",
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("132_music_commercial_score applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
