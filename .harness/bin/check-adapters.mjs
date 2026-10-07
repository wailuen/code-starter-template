#!/usr/bin/env node
// Adapter content is mechanical; policy lives in shared phases, guides and roles.
//
//   node .harness/bin/check-adapters.mjs           # report drift (exit 1 on any)
//   node .harness/bin/check-adapters.mjs --write   # regenerate every enabled adapter file
//   node .harness/bin/check-adapters.mjs --write --codex   # also enable + generate Codex adapters
//   node .harness/bin/check-adapters.mjs --write --codex-only # never write Claude files
//
// Claude Code adapters (`.claude/commands/<phase>.md`) are always checked. Codex adapters
// (`.agents/skills/`, `.codex/agents/`) are checked only once the project has enabled Codex,
// i.e. once either directory exists, or when explicitly requested with --codex/--codex-only.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
export const root = fileURLToPath(new URL("../../", import.meta.url));
export function codexEnabled(base = root) {
  return existsSync(resolve(base, ".agents")) || existsSync(resolve(base, ".codex"));
}
export function renderAdapters({ codex = true } = {}) {
  const manifest = JSON.parse(readFileSync(resolve(root, ".harness/manifest.json"), "utf8"));
  const files = {};
  for (const [phase, description] of Object.entries(manifest.phases)) {
    if (codex) files[`.agents/skills/${phase}/SKILL.md`] = `---\nname: ${phase}\ndescription: ${JSON.stringify(description)}\n---\n\nRead and follow the repository's \`.harness/adapters/codex.md\`, then\n\`.harness/phases/${phase}.md\` in full. Resolve paths from the Git repository root.\nTreat \`$ARGUMENTS\` in the shared procedure as the user's phase arguments.\nDo not copy policy here; edit the shared files so both runtimes benefit.\n`;
    files[`.claude/commands/${phase}.md`] = `---\nname: ${phase}\ndescription: ${JSON.stringify(description)}\n---\n\nRead and follow \`.harness/adapters/claude.md\`, then \`.harness/phases/${phase}.md\` in full.\nTreat \`$ARGUMENTS\` as the user's phase arguments. Do not copy policy here.\n`;
  }
  if (codex) {
    const settings = manifest.codex;
    if (!settings?.agents || !settings?.helpers) throw new Error("Missing manifest.codex agents/helpers");
    const validName = (name) => /^[a-z][a-z0-9-]*$/.test(name);
    for (const [name, description] of Object.entries(settings.helpers)) {
      if (!validName(name) || Object.hasOwn(manifest.phases, name) || typeof description !== "string")
        throw new Error(`Invalid Codex helper: ${name}`);
      files[`.agents/skills/${name}/SKILL.md`] = `---\nname: ${name}\ndescription: ${JSON.stringify(description + ` Use for $${name} or /${name}.`)}\n---\n\nRead and follow the repository's \`.harness/adapters/codex.md\`, then\n\`.claude/commands/${name}.md\` in full as a read-only instruction source.\nResolve paths from the repository root. Treat \`$ARGUMENTS\` as the user's arguments.\nMap Claude tool and agent names through the Codex adapter; never execute a slash command in a shell.\nDo not edit this generated wrapper.\n`;
    }
    for (const [role, agent] of Object.entries(settings.agents)) {
      if (!validName(role) || !agent ||
          ![agent.description, agent.instructions, agent.model].every(v => typeof v === "string" && v.trim()) ||
          !["low", "medium", "high", "xhigh", "max", "ultra"].includes(agent.model_reasoning_effort))
        throw new Error(`Invalid Codex agent settings: ${role}`);
      const instructions = `Read .harness/adapters/codex.md and .harness/guides/task-delivery.md in full, then ${agent.instructions}.\nThe Codex adapter owns runtime mapping. Ignore Claude frontmatter model, effort and tools; follow the instruction body.\nBefore any checkout-dependent action, enter the assigned absolute checkout and verify its resolved root and expected revision. Stop on mismatch.\nUse absolute paths or an explicit workdir on every tool call; a previous shell cd does not persist.\nStay within the assigned scope. Reviewers report without editing the author's checkout. Return evidence, actual checks and unresolved items; never an unsupported CLEAR.\n`;
      files[`.codex/agents/harness-${role}.toml`] = `name = "harness-${role}"\ndescription = ${JSON.stringify(agent.description)}\nmodel = ${JSON.stringify(agent.model)}\nmodel_reasoning_effort = ${JSON.stringify(agent.model_reasoning_effort)}\ndeveloper_instructions = ${JSON.stringify(instructions)}\n`;
    }
  }
  return files;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => !["--write", "--codex", "--codex-only"].includes(a));
  if (unknown.length) {
    console.error(`Unknown argument(s): ${unknown.join(" ")}\nUsage: check-adapters.mjs [--write] [--codex | --codex-only]`);
    process.exit(2);
  }
  const write = args.includes("--write");
  const codexOnly = args.includes("--codex-only");
  const codex = codexOnly || args.includes("--codex") || codexEnabled();
  const adapters = Object.fromEntries(Object.entries(renderAdapters({ codex }))
    .filter(([path]) => !codexOnly || !path.startsWith(".claude/")));
  let failures = 0;
  for (const [path, expected] of Object.entries(adapters)) {
    let actual; try { actual = readFileSync(resolve(root, path), "utf8"); } catch { actual = null; }
    if (actual === expected) continue;
    if (write) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      writeFileSync(resolve(root, path), expected);
      console.log(`Wrote ${path}`);
    } else { console.error(`Adapter drift: ${path}`); failures++; }
  }
  if (failures) console.error(`Regenerate with \`node .harness/bin/check-adapters.mjs --write${codexOnly ? " --codex-only" : codex ? " --codex" : ""}\`; do not duplicate shared policy.`);
  else console.log(`Shared harness adapters match the manifest (${codexOnly ? "Codex only; Claude Code untouched" : codex ? "Claude Code + Codex" : "Claude Code only; Codex not enabled"}).`);
  process.exitCode = failures ? 1 : 0;
}
