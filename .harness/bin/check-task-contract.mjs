#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const nonempty = (s) => typeof s === "string" && s.trim().length > 0;
const strings = (xs, allowEmpty = false) => Array.isArray(xs) &&
  (allowEmpty || xs.length > 0) && xs.every(nonempty);

export function validateTaskContract(text) {
  const section = text.match(/^## Delivery contract\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  const json = section?.[1].match(/```json\s*\n([\s\S]*?)\n```/);
  if (!json) return ["Missing ## Delivery contract with a fenced JSON object"];
  let c;
  try { c = JSON.parse(json[1]); } catch { return ["Delivery contract is invalid JSON"]; }
  if (!c || typeof c !== "object" || Array.isArray(c)) return ["Contract must be an object"];
  const errors = [];
  for (const field of ["approved_by", "integration"]) {
    if (!nonempty(c[field])) errors.push(`${field} must be explicit`);
  }
  for (const field of ["owned_paths", "interfaces"]) {
    if (!strings(c[field])) errors.push(`${field} must name at least one item`);
  }
  if (!strings(c.dependencies, true)) errors.push("dependencies must be an array (empty when independent)");
  if (!Array.isArray(c.acceptance) || c.acceptance.length < 1 || c.acceptance.length > 10 ||
      !c.acceptance.every((a) => a && [a.id, a.scenario, a.verify].every(nonempty))) {
    errors.push("acceptance needs 1–10 criteria, each with id, scenario and verify");
  } else if (new Set(c.acceptance.map((a) => a.id)).size !== c.acceptance.length) {
    errors.push("acceptance IDs must be unique");
  }
  for (const field of ["trusted", "untrusted", "excluded"]) {
    if (!strings(c.boundaries?.[field])) errors.push(`boundaries.${field} must be explicit (state none with a reason if appropriate)`);
  }
  if (!["none", "isolated-cluster", "exclusive-cluster"].includes(c.test_environment?.isolation)) {
    errors.push("test_environment.isolation must be none, isolated-cluster or exclusive-cluster");
  }
  if (!nonempty(c.test_environment?.command) || !strings(c.test_environment?.ordinary_failures)) {
    errors.push("test_environment needs command and ordinary_failures");
  }
  if (!Array.isArray(c.open_questions) || c.open_questions.length !== 0) {
    errors.push("Resolve open_questions before implementation, or create a design/spike task");
  }
  return errors;
}

export function main() {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: check-task-contract.mjs <todo.md>");
    const errors = validateTaskContract(readFileSync(process.argv[2], "utf8"));
    console.log(JSON.stringify({ ready: errors.length === 0, errors }));
    process.exitCode = errors.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
