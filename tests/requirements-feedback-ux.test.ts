import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Requirements feedback & toast UX enhancements in PhaseDetailView", async () => {
  const fileContent = await readFile(new URL("../components/project/phase-detail-view.tsx", import.meta.url), "utf8");

  // Toaster & toast import
  assert.match(fileContent, /import\s*\{\s*toast\s*\}\s*from\s*["']@\/hooks\/use-toast["']/);

  // Readiness renders blockers or errors, never false validation passed
  assert.match(fileContent, /readiness\.blockers/);
  assert.match(fileContent, /Pre-approval validation requirements not met\./);

  // Friendly unresolved questions banner & actions
  assert.match(fileContent, /Unresolved Question/);
  assert.match(fileContent, /Answer Questions with AI/);
  assert.match(fileContent, /Resolve with Sensible Defaults/);

  // Informative toasts on AI revision
  assert.match(fileContent, /Revision Created/);
  assert.match(fileContent, /Submitting Revision\.\.\./);
});

test("Toaster component mounted in Providers", async () => {
  const providersContent = await readFile(new URL("../app/providers.tsx", import.meta.url), "utf8");
  assert.match(providersContent, /<Toaster\s*\/>/);
});
