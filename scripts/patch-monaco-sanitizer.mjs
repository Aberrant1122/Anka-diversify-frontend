// Monaco ships a vendored sanitizer as well as an npm dependency. Patch the
// exact vendored ESM entry from the pinned, patched upstream package before
// bundling. Never use Monaco's prebuilt AMD/CDN bundle, which embeds the old copy.
import fs from "node:fs";
import path from "node:path";
const monacoRoot = path.resolve("node_modules/monaco-editor");
const sanitizerRoot = path.resolve("node_modules/dompurify");
const monaco = JSON.parse(
  fs.readFileSync(path.join(monacoRoot, "package.json"), "utf8"),
);
const sanitizer = JSON.parse(
  fs.readFileSync(path.join(sanitizerRoot, "package.json"), "utf8"),
);
if (monaco.version !== "0.57.0" || sanitizer.version !== "3.4.17")
  throw new Error(
    "Review pinned Monaco/sanitizer versions before changing the patch contract",
  );
const target = path.join(
  monacoRoot,
  "esm/vs/base/browser/dompurify/dompurify.js",
);
const original = fs.readFileSync(target, "utf8");
if (!/DOMPurify 3\.4\.(?:15|17)\b/.test(original))
  throw new Error(
    "Unexpected vendored Monaco sanitizer; refusing a blind patch",
  );
const patched = fs.readFileSync(
  path.join(sanitizerRoot, "dist/purify.es.mjs"),
  "utf8",
);
if (!patched.includes("DOMPurify 3.4.17"))
  throw new Error("Patched sanitizer identity mismatch");
if (original !== patched) fs.writeFileSync(target, patched);
console.log("Verified local Monaco 0.57.0 ESM sanitizer: DOMPurify 3.4.17");
