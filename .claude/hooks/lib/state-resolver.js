"use strict";

// Shared by the .harness/bin/*.mjs review-convergence tooling and
// .harness/lib/redteam-stall.cjs (see .harness/README.md § Shared state).
// The harness has no multi-operator coordination layer, so the only job
// here is: given any cwd, find the ONE main checkout directory shared by
// every worktree, so review/state files land in a single place regardless
// of which worktree wrote them.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

// `git rev-parse --git-common-dir` always resolves to the main checkout's
// .git directory, even from inside a linked worktree (rules/worktree-isolation.md
// Rule 7 uses the same primitive for the same reason). Its parent is the main
// checkout root.
function requireMainCheckout(cwd) {
  let commonDir;
  try {
    commonDir = execFileSync(
      "git",
      ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return { ok: false, reason: `${cwd} is not inside a git repository` };
  }
  if (!commonDir) {
    return { ok: false, reason: `${cwd} is not inside a git repository` };
  }
  // A plain repo's or linked worktree's common dir is always named `.git`, so
  // its parent is the main checkout root. `--separate-git-dir` and a
  // submodule's common dir are NOT named `.git` (they resolve to wherever the
  // real .git data lives, or to `<parent>/.git/modules/<name>`), and taking
  // the parent there silently returns the wrong directory instead of failing.
  // Fail closed rather than guess.
  if (path.basename(commonDir) !== ".git") {
    return {
      ok: false,
      reason: `${cwd}'s git-common-dir (${commonDir}) is not named ".git" — ` +
        `unsupported layout (e.g. --separate-git-dir, a submodule, or a bare repo); refusing to guess the checkout root`,
    };
  }
  return { ok: true, repoDir: path.dirname(commonDir) };
}

module.exports = { requireMainCheckout };
