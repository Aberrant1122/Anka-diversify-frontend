import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectApi } from "../lib/project-api";

test("CP3.3 & CP3.4: projectApi.getArtifactCurrentness formats request correctly", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (url: string | URL | Request) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({
      data: {
        isCurrent: true,
        isStale: false,
        status: "CURRENT",
        staleReason: null,
        upstreamPhase: null,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const res = await projectApi.getArtifactCurrentness("proj-123", "art-456", "requirements");
    assert.match(capturedUrl, /\/projects\/proj-123\/phases\/requirements\/artifacts\/art-456\/currentness$/);
    assert.equal(res.isCurrent, true);
    assert.equal(res.status, "CURRENT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CP3.3 & CP3.4: projectApi.getArtifactDiff formats compare request correctly", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (url: string | URL | Request) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({
      data: {
        phase: "requirements",
        baseArtifact: { id: "art-1", version: 1, title: "v1", contentHash: "hash-1" },
        targetArtifact: { id: "art-2", version: 2, title: "v2", contentHash: "hash-2" },
        diff: {
          changedRootSections: ["functionalRequirements"],
          addedIds: ["FR-002"],
          modifiedIds: [],
          removedIds: [],
          retainedIds: ["FR-001"],
        },
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const res = await projectApi.getArtifactDiff("proj-123", "art-2", "art-1", "requirements");
    assert.match(capturedUrl, /\/projects\/proj-123\/phases\/requirements\/artifacts\/art-2\/diff\?compareArtifactId=art-1$/);
    assert.equal(res.phase, "requirements");
    assert.deepEqual((res.diff as any).addedIds, ["FR-002"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Task A: projectApi.rebaseDocumentation formats revision request with rebaseToCurrentRequirements", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody: any = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    if (init?.body) capturedBody = JSON.parse(String(init.body));
    return new Response(JSON.stringify({
      data: {
        artifact: { id: "doc-2", version: 2 },
        workflowRun: { id: "run-doc-2", status: "COMPLETED" },
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const res = await projectApi.rebaseDocumentation("proj-123", {
      id: "doc-1",
      version: 1,
      contentHash: "hash-doc-1",
    } as any);
    assert.match(capturedUrl, /\/projects\/proj-123\/phases\/documentation\/artifacts\/doc-1\/revisions$/);
    assert.equal(capturedBody.operation, "DOCUMENT_REVISION");
    assert.equal(capturedBody.rebaseToCurrentRequirements, true);
    assert.equal(res.artifact?.version, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Task B: projectApi.rebaseArchitecture formats AI revision request with rebaseToCurrentAuthorities", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody: any = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    if (init?.body) capturedBody = JSON.parse(String(init.body));
    return new Response(JSON.stringify({
      data: {
        artifact: { id: "arch-2", version: 2 },
        workflowRun: { id: "run-arch-2", status: "COMPLETED" },
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const res = await projectApi.rebaseArchitecture("proj-123", {
      id: "arch-1",
      version: 1,
      contentHash: "hash-arch-1",
    } as any);
    assert.match(capturedUrl, /\/projects\/proj-123\/phases\/architecture\/artifacts\/arch-1\/revisions\/ai$/);
    assert.equal(capturedBody.operation, "DOCUMENT_REVISION");
    assert.equal(capturedBody.baseVersion, 1);
    assert.equal(capturedBody.baseContentHash, "hash-arch-1");
    assert.equal(capturedBody.rebaseToCurrentAuthorities, true);
    assert.equal(res.artifact?.version, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CP3.4: Workflow Requirements generation rejects free-text instruction and binds to active brief confirmation", async () => {
  const fileContent = await readFile(new URL("../components/project/phase-detail-view.tsx", import.meta.url), "utf8");

  // Verify that the old free-text instruction generate call is gone
  assert.doesNotMatch(
    fileContent,
    /projectApi\.generateRequirements\(projectId,\s*instruction\.trim\(\)\)/,
    "PhaseDetailView must not pass free-text instruction as briefConfirmationId"
  );

  // Verify that active brief confirmation ID is strictly used
  assert.match(
    fileContent,
    /projectApi\.generateRequirements\(projectId,\s*activeConfirmation\.id\)/,
    "PhaseDetailView must pass activeConfirmation.id to generateRequirements"
  );

  // Verify presence of prompt directing user to Project Brief when no active brief exists
  assert.match(
    fileContent,
    /No active Live Brief confirmation found\. Please confirm the brief in the Project Brief tab/,
    "PhaseDetailView must validate presence of active brief before generating Requirements"
  );
});

test("Task E: Default-deny role-aware approval enforcement in PhaseDetailView", async () => {
  const fileContent = await readFile(new URL("../components/project/phase-detail-view.tsx", import.meta.url), "utf8");

  // Verify that insecure default-allow owner check (!projectOwnerId || !currentUser?.id) is eliminated
  assert.doesNotMatch(
    fileContent,
    /isOwner\s*=\s*!projectOwnerId\s*\|\|\s*!currentUser\?\.id/,
    "Insecure default-allow owner check must not exist"
  );

  // Verify that strict default-deny owner check is implemented
  assert.match(
    fileContent,
    /isOwner\s*=\s*Boolean\(projectOwnerId\s*&&\s*currentUserId\s*&&\s*projectOwnerId\s*===\s*currentUserId\)/,
    "Strict default-deny owner check must be enforced"
  );

  // Verify non-owner disabled button and warning
  assert.match(fileContent, /Only the project owner can approve artifacts/);
  assert.match(fileContent, /Approve \(Owner only\)/);
});

test("Tasks A & B: Stale phase recovery provides direct recovery CTAs and calls rebase methods", async () => {
  const fileContent = await readFile(new URL("../components/project/phase-detail-view.tsx", import.meta.url), "utf8");

  // Requirements stale recovery
  assert.match(fileContent, /Regenerate from Confirmed Brief Rev/);

  // Documentation stale recovery calling rebaseDocumentation
  assert.match(fileContent, /Rebase Documentation to Current Requirements/);
  assert.match(fileContent, /projectApi\.rebaseDocumentation\(projectId,\s*latest\)/);

  // Architecture stale recovery calling rebaseArchitecture
  assert.match(fileContent, /Rebase Architecture to Current Authorities/);
  assert.match(fileContent, /projectApi\.rebaseArchitecture\(projectId,\s*latest\)/);
});

test("CP3.3: Structured item review components are integrated in PhaseDetailView", async () => {
  const fileContent = await readFile(new URL("../components/project/phase-detail-view.tsx", import.meta.url), "utf8");

  assert.match(fileContent, /<RequirementsItemReview content=\{artifact\.structuredContent as any\} \/>/);
  assert.match(fileContent, /<DocumentationItemReview content=\{artifact\.structuredContent as any\} \/>/);
  assert.match(fileContent, /<ArchitectureItemReview content=\{artifact\.structuredContent as any\} \/>/);
});

test("CP3.3: Interactive Version Diff Dialog is integrated in PhaseDetailView", async () => {
  const fileContent = await readFile(new URL("../components/project/phase-detail-view.tsx", import.meta.url), "utf8");

  assert.match(fileContent, /<ArtifactVersionDiffDialog/);
  assert.match(fileContent, /initialBaseId=\{diffBaseId\}/);
  assert.match(fileContent, /initialCompareId=\{diffCompareId\}/);
});

test("Defect A: PhaseDetailView enforces phase-aware question templates without cross-phase leakage", async () => {
  const fileContent = await readFile(new URL("../components/project/phase-detail-view.tsx", import.meta.url), "utf8");

  // Verify handleAnswerAllQuestions is phase-aware
  assert.match(fileContent, /const phaseLabel = isArch \? "Architecture" : isDoc \? "Documentation" : "Requirements"/);
  assert.match(fileContent, /incorporate the answers into the \$\{phaseLabel\}:/);
  assert.match(fileContent, /without altering approved Requirements or Documentation decisions/);
  assert.match(fileContent, /without altering approved Requirements/);

  // Verify handleResolveWithDefaults is phase-aware
  assert.match(fileContent, /Document all decisions clearly in the appropriate component, interface, and data designs without altering approved Requirements or Documentation decisions/);
});

