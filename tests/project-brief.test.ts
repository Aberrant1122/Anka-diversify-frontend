import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectApi } from "../lib/project-api";

test("Requirements handoff sends only confirmed brief authority", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ data: { artifact: null, run: { id: "run-1", status: "running" }, readiness: null } }), {
      status: 202, headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await projectApi.generateRequirements("project-1", "confirmation-1");
    assert.ok(request);
    const captured = request as { url: string; init?: RequestInit };
    assert.match(captured.url, /requirements\/artifacts\/generate$/);
    assert.deepEqual(JSON.parse(String(captured.init?.body)), { briefConfirmationId: "confirmation-1", includeMemory: false });
    assert.ok(new Headers(captured.init?.headers).get("Idempotency-Key"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("project workspace defaults to URL-addressable Project Brief and removes Chat tab", async () => {
  const page = await readFile(new URL("../app/development/projects/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /useState\("project-brief"\)/);
  assert.match(page, /\?tab=\$\{encodeURIComponent\(v\)\}/);
  const order = ["project-brief", "kanban", "workflow", "files", "repositories", "code", "activity", "ai-assistant"];
  let last = -1;
  for (const tab of order) {
    const position = page.indexOf(`{ id: "${tab}"`);
    assert.ok(position > last, `${tab} should appear in the required order`);
    last = position;
  }
  assert.doesNotMatch(page, /{ id: "chat", label: "Chat"/);
});

test("projectApi.confirmLiveBrief sends correct endpoint, method, and exact revision payload", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({
      data: {
        id: "conf-123",
        briefRevisionId: "rev-1",
        briefRevisionNumber: 1,
        briefContentHash: "hash-rev-1",
        status: "ACTIVE",
        confirmedAt: new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await projectApi.confirmLiveBrief("proj-abc", "rev-1", "hash-rev-1");
    assert.ok(request);
    const captured = request as { url: string; init?: RequestInit };
    assert.match(captured.url, /\/projects\/proj-abc\/brief\/confirm$/);
    assert.equal(captured.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(captured.init?.body)), {
      revisionId: "rev-1",
      expectedContentHash: "hash-rev-1",
    });
    assert.equal(result.id, "conf-123");
    assert.equal(result.briefRevisionId, "rev-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ProjectBrief confirmation rules: initial, confirmed, successor, unready, non-owner, and duplicate submissions", async () => {
  const briefSource = await readFile(new URL("../components/project/project-brief.tsx", import.meta.url), "utf8");

  // Rule 1: Distinguishes current revision from prior confirmation using isCurrentRevisionConfirmed
  assert.match(
    briefSource,
    /isCurrentRevisionConfirmed\s*=\s*Boolean\(\s*workspace\?\.state\?\.currentConfirmation\s*&&\s*revision\s*&&\s*workspace\.state\.currentConfirmation\.briefRevisionId\s*===\s*revision\.id\s*\)/,
    "Must compute isCurrentRevisionConfirmed by matching currentConfirmation.briefRevisionId to revision.id"
  );

  // Rule 2: Renders confirmation button only when current revision is NOT confirmed
  assert.match(
    briefSource,
    /\{!isCurrentRevisionConfirmed\s*&&\s*\(?\s*<Button/,
    "Must render confirmation button when current revision is unconfirmed"
  );

  // Rule 3: Successor revision messaging when earlier confirmation exists
  assert.match(
    briefSource,
    /Revision \{workspace\.state\.currentConfirmation\.briefRevisionNumber\} is confirmed, but Revision \{revision\?\.revisionNumber\} requires owner confirmation\./,
    "Must show amber notice that prior revision is confirmed but successor requires owner confirmation"
  );

  // Rule 4: Confirmed revision messaging when current revision matches confirmation
  assert.match(
    briefSource,
    /Revision \{workspace\?\.state\?\.currentConfirmation\?\.briefRevisionNumber\} is owner-confirmed with exact hash\./,
    "Must display green confirmed message when current revision is owner-confirmed"
  );

  // Rule 5: Deterministic gates and owner-only disable conditions
  assert.match(
    briefSource,
    /disabled=\{!isOwner\s*\|\|\s*!workspace\?\.readiness\.ready\s*\|\|\s*!revision\s*\|\|\s*busy\s*===\s*"confirm"\}/,
    "Button must be disabled if not owner, not ready, no revision, or busy confirming"
  );

  // Rule 6: Default-deny owner check
  assert.match(
    briefSource,
    /isOwner\s*=\s*Boolean\(userId\s*&&\s*project\.ownerId\s*&&\s*userId\s*===\s*project\.ownerId\)/,
    "Must enforce default-deny owner permission check"
  );

  // Rule 7: Non-owner notice
  assert.match(
    briefSource,
    /\{!isOwner\s*&&\s*<p className="text-xs text-muted-foreground">Confirmation is restricted to the project owner\./,
    "Must inform user that confirmation is restricted to the project owner"
  );

  // Logic evaluation test for all 6 states
  function evaluateConfirmationState({
    currentConfirmation,
    currentRevision,
    ready,
    userId,
    ownerId,
    busy,
  }: {
    currentConfirmation: { briefRevisionId: string; briefRevisionNumber: number } | null;
    currentRevision: { id: string; revisionNumber: number; contentHash: string } | null;
    ready: boolean;
    userId: string | null;
    ownerId: string | null;
    busy: string | null;
  }) {
    const isOwner = Boolean(userId && ownerId && userId === ownerId);
    const isCurrentRevisionConfirmed = Boolean(
      currentConfirmation &&
      currentRevision &&
      currentConfirmation.briefRevisionId === currentRevision.id
    );
    const showButton = !isCurrentRevisionConfirmed;
    const buttonDisabled = !isOwner || !ready || !currentRevision || busy === "confirm";
    let messageType: "confirmed" | "successor_needs_confirmation" | "initial_unconfirmed";
    if (isCurrentRevisionConfirmed) {
      messageType = "confirmed";
    } else if (currentConfirmation) {
      messageType = "successor_needs_confirmation";
    } else {
      messageType = "initial_unconfirmed";
    }
    return { isOwner, isCurrentRevisionConfirmed, showButton, buttonDisabled, messageType };
  }

  // State 1: Initial unconfirmed revision, ready, owner
  const state1 = evaluateConfirmationState({
    currentConfirmation: null,
    currentRevision: { id: "rev-1", revisionNumber: 1, contentHash: "hash-1" },
    ready: true,
    userId: "user-owner",
    ownerId: "user-owner",
    busy: null,
  });
  assert.equal(state1.showButton, true, "Initial revision must show confirmation button");
  assert.equal(state1.buttonDisabled, false, "Ready owner button must be enabled");
  assert.equal(state1.messageType, "initial_unconfirmed");

  // State 2: Already confirmed revision
  const state2 = evaluateConfirmationState({
    currentConfirmation: { briefRevisionId: "rev-1", briefRevisionNumber: 1 },
    currentRevision: { id: "rev-1", revisionNumber: 1, contentHash: "hash-1" },
    ready: true,
    userId: "user-owner",
    ownerId: "user-owner",
    busy: null,
  });
  assert.equal(state2.isCurrentRevisionConfirmed, true);
  assert.equal(state2.showButton, false, "Already confirmed revision must NOT show confirmation button");
  assert.equal(state2.messageType, "confirmed");

  // State 3: Ready successor revision (Rev 2 created, Rev 1 was confirmed)
  const state3 = evaluateConfirmationState({
    currentConfirmation: { briefRevisionId: "rev-1", briefRevisionNumber: 1 },
    currentRevision: { id: "rev-2", revisionNumber: 2, contentHash: "hash-2" },
    ready: true,
    userId: "user-owner",
    ownerId: "user-owner",
    busy: null,
  });
  assert.equal(state3.isCurrentRevisionConfirmed, false);
  assert.equal(state3.showButton, true, "Successor revision MUST show confirmation button");
  assert.equal(state3.buttonDisabled, false, "Successor revision button must be enabled when ready");
  assert.equal(state3.messageType, "successor_needs_confirmation");

  // State 4: Unready successor revision (e.g. blockers exist)
  const state4 = evaluateConfirmationState({
    currentConfirmation: { briefRevisionId: "rev-1", briefRevisionNumber: 1 },
    currentRevision: { id: "rev-2", revisionNumber: 2, contentHash: "hash-2" },
    ready: false,
    userId: "user-owner",
    ownerId: "user-owner",
    busy: null,
  });
  assert.equal(state4.showButton, true);
  assert.equal(state4.buttonDisabled, true, "Unready revision must disable confirmation button");

  // State 5: Non-owner access
  const state5 = evaluateConfirmationState({
    currentConfirmation: { briefRevisionId: "rev-1", briefRevisionNumber: 1 },
    currentRevision: { id: "rev-2", revisionNumber: 2, contentHash: "hash-2" },
    ready: true,
    userId: "user-viewer",
    ownerId: "user-owner",
    busy: null,
  });
  assert.equal(state5.isOwner, false);
  assert.equal(state5.buttonDisabled, true, "Non-owner must have confirmation button disabled");

  // State 6: Duplicate submission / busy state
  const state6 = evaluateConfirmationState({
    currentConfirmation: null,
    currentRevision: { id: "rev-1", revisionNumber: 1, contentHash: "hash-1" },
    ready: true,
    userId: "user-owner",
    ownerId: "user-owner",
    busy: "confirm",
  });
  assert.equal(state6.buttonDisabled, true, "Busy submission must disable button to prevent duplicates");
});
