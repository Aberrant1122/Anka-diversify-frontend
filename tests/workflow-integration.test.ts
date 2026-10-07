import assert from "node:assert/strict";
import test from "node:test";
import type * as ProjectApiModule from "../lib/project-api";

const loadProjectApi = () => import(new URL("../lib/project-api.ts", import.meta.url).href) as Promise<typeof ProjectApiModule>;

type CapturedRequest = { url: string; init?: RequestInit };

function capture(data: unknown, status = 200): { requests: CapturedRequest[]; restore: () => void } {
  const requests: CapturedRequest[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { requests, restore: () => { globalThis.fetch = original; } };
}

test("Requirements generation uses the dedicated endpoint and an idempotency key", async () => {
  const { projectApi } = await loadProjectApi();
  const fixture = capture({ data: { artifact: null, run: { id: "run-1" }, readiness: null } });
  try {
    await projectApi.generateRequirements("project-1", "Build a calculator");
    assert.equal(fixture.requests[0].url, "http://localhost:3001/api/projects/project-1/phases/requirements/artifacts/generate");
    assert.equal(fixture.requests[0].init?.method, "POST");
    const headers = fixture.requests[0].init?.headers as Record<string, string>;
    assert.match(headers["Idempotency-Key"], /^[0-9a-f-]{36}$/i);
    assert.deepEqual(JSON.parse(String(fixture.requests[0].init?.body)), { brief: "Build a calculator", includeMemory: false });
  } finally { fixture.restore(); }
});

test("approval sends the exact artifact ID and server hash", async () => {
  const { projectApi } = await loadProjectApi();
  const fixture = capture({ data: [] });
  try {
    await projectApi.approvePhase("project-1", "documentation", "artifact-7", "a".repeat(64), "Approved");
    assert.equal(fixture.requests[0].url, "http://localhost:3001/api/projects/project-1/phases/documentation/approve");
    assert.deepEqual(JSON.parse(String(fixture.requests[0].init?.body)), {
      artifactId: "artifact-7", expectedHash: "a".repeat(64), comments: "Approved",
    });
  } finally { fixture.restore(); }
});

test("Architecture revisions preserve the exact version and content hash", async () => {
  const { projectApi } = await loadProjectApi();
  const fixture = capture({ data: { artifact: null, run: { id: "run-2" }, readiness: null } });
  try {
    await projectApi.revisePhaseArtifact("project-1", "architecture", {
      id: "architecture-2", projectId: "project-1", phase: "architecture", type: "architecture_doc",
      title: "Architecture", content: "", version: 4, createdBy: "user-1", createdAt: new Date().toISOString(),
      approved: false, contentHash: "b".repeat(64),
    }, "Split the API component");
    const body = JSON.parse(String(fixture.requests[0].init?.body));
    assert.equal(body.baseVersion, 4);
    assert.equal(body.baseContentHash, "b".repeat(64));
    assert.equal(body.operation, "DOCUMENT_REVISION");
  } finally { fixture.restore(); }
});

test("backend validation failures remain visible to callers", async () => {
  const { ApiError, projectApi } = await loadProjectApi();
  const fixture = capture({ error: "PLANNING_ARTIFACT_STALE", message: "Artifact hash is stale", details: { currentVersion: 3 } }, 409);
  try {
    await assert.rejects(
      projectApi.requestPhaseApproval("project-1", "requirements", "artifact-1", "c".repeat(64)),
      (error: unknown) => error instanceof ApiError && error.status === 409 && error.code === "PLANNING_ARTIFACT_STALE" && error.message === "Artifact hash is stale",
    );
  } finally { fixture.restore(); }
});

test("Implementation approval includes the server state version", async () => {
  const { projectApi } = await loadProjectApi();
  const fixture = capture({ data: { id: "task-1" } });
  try {
    await projectApi.approveImplementationTask("project-1", "task-1", 8);
    assert.equal(fixture.requests[0].url, "http://localhost:3001/api/projects/project-1/kanban/tasks/task-1/approve");
    assert.deepEqual(JSON.parse(String(fixture.requests[0].init?.body)), { expectedStateVersion: 8 });
  } finally { fixture.restore(); }
});

test("Implementation change requests target the exact execution", async () => {
  const { projectApi } = await loadProjectApi();
  const fixture = capture({ data: { id: "execution-3", state: "rejected" } });
  try {
    await projectApi.rejectImplementationExecution("project-1", "task-1", "execution-3", "Fix the failing validation");
    assert.equal(fixture.requests[0].url, "http://localhost:3001/api/projects/project-1/kanban/tasks/task-1/executions/execution-3/reject");
    assert.deepEqual(JSON.parse(String(fixture.requests[0].init?.body)), { comments: "Fix the failing validation" });
  } finally { fixture.restore(); }
});
