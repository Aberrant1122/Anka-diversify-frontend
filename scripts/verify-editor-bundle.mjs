import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(".next/static/chunks");
const matches = [];
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith(".js")) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("DOMPurify")) {
        const versions = [
          ...content.matchAll(/\.version\s*=\s*["'](3\.4\.\d+)["']/g),
        ].map((m) => m[1]);
        for (const version of versions) {
          if (version !== "3.4.17")
            throw new Error("Unpatched sanitizer in compiled asset " + file);
          matches.push({
            file: path.relative(process.cwd(), file),
            version,
            sha256: crypto.createHash("sha256").update(content).digest("hex"),
          });
        }
      }
    }
  }
}
visit(root);
if (!matches.length)
  throw new Error(
    "Patched editor sanitizer is missing from the production bundle",
  );
fs.mkdirSync(".next/verification", { recursive: true });
fs.writeFileSync(
  ".next/verification/editor-sanitizer.json",
  JSON.stringify(matches, null, 2) + "\n",
);
console.log(
  "Verified " +
    matches.length +
    " compiled local sanitizer instance(s): 3.4.17",
);
