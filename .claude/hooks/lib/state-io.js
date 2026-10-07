"use strict";

// Shared file-I/O primitives for .harness/lib/redteam-stall.cjs's review-round
// state store (.claude/learning/). Scoped to exactly what that file needs:
// a containment check for the state directory, and read/write helpers that
// refuse to follow a symlink at the final path component, per
// rules/security.md § Path Containment ("resolve BOTH candidate and boundary
// root through the SAME resolver ... fail closed if the path will not
// resolve" for the boundary check, "fd-based / O_NOFOLLOW enforcement AT the
// sink" for the read/write check).

const fs = require("node:fs");
const path = require("node:path");

const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;

function realOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

// Resolves symlinks up to the nearest existing ancestor (the target directory
// itself may not exist yet on first run), then re-attaches whatever suffix
// doesn't exist yet, so a not-yet-created directory can still be checked.
function resolveAsFarAsPossible(target) {
  let existing = target;
  const missingParts = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return { real: null, missingParts };
    missingParts.unshift(path.basename(existing));
    existing = parent;
  }
  const real = realOrNull(existing);
  if (real === null) return { real: null, missingParts };
  return { real: missingParts.length ? path.join(real, ...missingParts) : real, missingParts };
}

// `dir` is always `<repoDir>/.claude/learning`; its expected boundary is the
// repo root two levels up. Both sides are resolved through the same
// realpath-based resolver before comparing, so a symlinked `.claude` cannot
// walk the state store outside the repo.
function assertStateDirContained(dir) {
  const resolvedDir = path.resolve(dir);
  const boundary = path.dirname(path.dirname(resolvedDir));
  const { real: realDir } = resolveAsFarAsPossible(resolvedDir);
  const realBoundary = realOrNull(boundary);
  if (realDir === null || realBoundary === null) {
    return { ok: false, reason: `cannot resolve ${dir} against its expected boundary ${boundary}` };
  }
  if (realDir !== realBoundary && !realDir.startsWith(`${realBoundary}${path.sep}`)) {
    return { ok: false, reason: `${dir} resolves outside its expected boundary ${boundary}` };
  }
  return { ok: true, path: realDir };
}

function readFileHardened(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | NOFOLLOW);
  } catch (e) {
    return { ok: false, code: e.code, reason: e.message };
  }
  try {
    return { ok: true, value: fs.readFileSync(fd) };
  } catch (e) {
    return { ok: false, code: e.code, reason: e.message };
  } finally {
    fs.closeSync(fd);
  }
}

// Fails if the path already exists (O_EXCL): the caller either writes a
// freshly-named tmp file (collision-proof by construction) or a lock file
// it wants to fail loudly, never silently, if another writer holds it.
function writeFileHardened(filePath, content) {
  let fd;
  try {
    fd = fs.openSync(filePath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
  } catch (e) {
    return { ok: false, code: e.code, reason: e.message };
  }
  try {
    fs.writeFileSync(fd, content);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code, reason: e.message };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { assertStateDirContained, readFileHardened, writeFileHardened };
