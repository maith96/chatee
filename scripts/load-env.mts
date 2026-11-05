// Loads .env.local into process.env. Import this FIRST in a script: ES module imports run before the
// script's own code, and src/lib/providers.ts reads the API keys as soon as it is imported.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const path = join(import.meta.dirname, "..", ".env.local");
if (existsSync(path)) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
