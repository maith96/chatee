// Compares chat models on the same persona eval and prints one table.
// Runs `scripts/eval-personas.mts` once per model, then reads each report it writes.
//
//   npm run compare                                        # Juno, Miles, Cole × current default vs Kimi
//   npm run compare -- --models nova-smart,nova-kimi       # pick models
//   npm run compare -- --personas juno --runs 2            # pick personas, repeat each scenario
//
// Needs NVIDIA_API_KEY (and GOOGLE_GENERATIVE_AI_API_KEY for Gemini models) in .env.local.
// The eval paces itself to stay under NVIDIA's shared rate limit, so a full run takes a while.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isModelId } from "../src/lib/models";

const ROOT = join(import.meta.dirname, "..");
const REPORTS = join(ROOT, "evals/reports");
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const models = opt("--models", "nova-fast,nova-smart,nova-kimi,nova-kimi-pro").split(",").filter(Boolean);
const personas = opt("--personas", "juno,miles,cole").split(",").filter(Boolean);
const runs = opt("--runs", "1");
const unknown = models.filter((m) => !isModelId(m));
if (unknown.length) {
  console.error(`Unknown model id(s): ${unknown.join(", ")}. See src/lib/models.ts.`);
  process.exit(1);
}

type Summary = {
  persona: string;
  conversations: number;
  errors: number;
  checkPassRate: number;
  judge: { in_character: number; natural: number; tone_fit: number; behaviour: number };
  medianReplyMs: number;
};

const reportFiles = () => new Set(readdirSync(REPORTS, { withFileTypes: true }).filter((f) => f.name.endsWith(".json")).map((f) => f.name));
const rows: { model: string; s: Summary }[] = [];

for (const model of models) {
  console.log(`\n=== ${model} ===`);
  let before: Set<string>;
  try { before = reportFiles(); } catch { before = new Set(); }
  const res = spawnSync("npx", ["tsx", "scripts/eval-personas.mts", ...personas, "--model", model, "--runs", runs, "--label", `compare ${model}`], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (res.status !== 0) {
    console.error(`Eval for ${model} failed (exit ${res.status}); skipping.`);
    continue;
  }
  const fresh = [...reportFiles()].filter((f) => !before.has(f)).sort().pop();
  if (!fresh) continue;
  const { summary } = JSON.parse(readFileSync(join(REPORTS, fresh), "utf8")) as { summary: Summary[] };
  for (const s of summary) rows.push({ model, s });
}

const header = "| Model | Persona | Median reply | Checks passed | In character | Natural | Tone | Behaviour | Errors |";
const lines = [
  header,
  "|---|---|---|---|---|---|---|---|---|",
  ...rows.map(({ model, s }) =>
    `| ${model} | ${s.persona} | ${(s.medianReplyMs / 1000).toFixed(1)}s | ${(s.checkPassRate * 100).toFixed(0)}% | ${s.judge.in_character.toFixed(1)} | ${s.judge.natural.toFixed(1)} | ${s.judge.tone_fit.toFixed(1)} | ${s.judge.behaviour.toFixed(1)} | ${s.errors}/${s.conversations} |`,
  ),
];
const table = lines.join("\n");
console.log(`\n${table}\n`);
const out = join(REPORTS, "compare-latest.md");
writeFileSync(out, `# Model comparison (${new Date().toISOString().slice(0, 16)}Z)\n\nPersonas: ${personas.join(", ")} · runs: ${runs}\n\n${table}\n\nFull conversations: the per-model HTML reports in this folder.\n`);
console.log(`Saved: evals/reports/compare-latest.md`);
