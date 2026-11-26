# Dependency remediation and reachable editor code

Baseline e5efa3022b6bf6605372b33015ee9c51d588c4c1 had 11 npm audit findings:
2 critical, 7 high and 2 moderate. The reviewed targeted changes use Next and
its matching lint config 16.4.3, PostCSS 8.5.31, compatible transitive updates,
and remove unused frontend Zod, @hookform/resolvers and OpenAI declarations.
The remaining tooling peer accepts Zod v4 and now resolves a patched release.
No npm audit fix --force was used. The resulting local audit reports zero
findings; this is a registry result, not proof that every application path is safe.

## Reachability and disposition

| Package/family | Source path / condition | Disposition |
| --- | --- | --- |
| Next | App Router runs on this Windows host. The Windows-filesystem RCE advisory explicitly affects 16.2.0; authentication alone is not a workaround. Other Next findings vary by deployment/features. | Upgrade to 16.4.3, beyond the audit's affected ranges. |
| DOMPurify / Monaco | ProjectIDE renders repository content through the editor. The React loader defaults to CDN Monaco 0.55.1; Monaco also vendors sanitizer source, so changing the npm dependency alone does not fix all reachable code. No application setConfig/uponSanitizeAttribute hooks were found; individual hook-specific advisories are conditional, but untrusted hover/Markdown rendering remains a sanitizer boundary. | Use local Monaco 0.57.0 ESM, bypass CDN/AMD loading, pin DOMPurify 3.4.17, replace the exact vendored ESM entry before bundling, and verify the actual compiled sanitizer version. |
| Zod | No application imports or resolver use in app/components/lib/hooks/tests. A remaining tooling peer declares compatibility with v3 or v4. Oversized collection validation is the advisory trigger. | Remove unused direct packages; resolve tooling peer to patched v4 within its declared range. |
| PostCSS / source-map-js | CSS build-time inputs. Repository CSS is developer-controlled here; no public endpoint accepting arbitrary CSS/source maps was found. | Compatible patched updates, including Next's fixed PostCSS tree. |
| lodash | Recharts dependency; no application template/imports code-generation use found. That narrows the observed path but does not establish universal non-reachability. | Compatible transitive patch. |
| nanoid | CSS/tooling dependency. No application non-secure/custom negative/zero-size generator calls found. | Compatible transitive patch. |
| browserslist / baseline-browser-mapping | Build/tooling query and stats input. No route accepts arbitrary stats/query files. | Compatible transitive patches. |
| sharp | Next image dependency. Application config sets images.unoptimized=true, reducing observed image-optimizer reachability. Deployment assumptions still matter. | Next's patched dependency tree; no reliance on the config as the sole fix. |

Advisory sources:
- https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
- https://github.com/advisories/GHSA-cmwh-pvxp-8882
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- The full baseline and final registry reports are retained in task outputs.

## Deterministic vendored sanitizer treatment

Monaco 0.57.0 pins and embeds DOMPurify 3.4.15. The scoped npm override alone
is insufficient because that embedded file is separate. predev/prebuild/pretest
run scripts/patch-monaco-sanitizer.mjs. The script checks exact reviewed Monaco
and upstream sanitizer versions, refuses an unexpected vendored entry, and
copies the published 3.4.17 ESM implementation with its license header intact.
It does not patch the AMD distribution. lib/secure-monaco.ts provides the local
ESM instance to the React loader, which bypasses the default CDN path. Editor
workers are bundled locally. No repository-controlled scripts or remote editor
loader are used by this patch.

postbuild runs scripts/verify-editor-bundle.mjs, which inspects production
chunks, rejects an older discovered sanitizer, requires the patched compiled
instance, and records its asset hash in .next/verification/editor-sanitizer.json.
A future Monaco/sanitizer upgrade requires reviewing these version guards;
there is no blind patch of an arbitrary dependency file.

The legacy Code panel is a read-only repository viewer. Direct save/push and
host terminal controls are removed from that view; proposed code and explicit
publication authority belong to the document workflow.

Verification includes TypeScript/production build, compiled asset inspection,
existing frontend tests, focused lint and final dependency audit. After explicit
local synthetic sign-in authorization, browser verification rendered README in
Monaco, confirmed attempted editing left it unchanged, and exercised command
plan approval, scoped injected proposal/file mutation, unavailable-runtime
review gating and local exact-head candidate preparation. Publication approval
and dispatch remained disabled. Screenshots and exact provenance are retained
in the canonical task outputs. This is synthetic/local verification, not real
provider, hardened-runtime, GitHub transport or deployed acceptance.
