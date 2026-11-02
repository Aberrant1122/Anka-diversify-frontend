"use client";
import {useEffect,useState} from "react";
import { Button } from "@/components/ui/button";
import {
  WorkspaceRun,
  WorkspaceView,
  WorkspaceCapabilities,
  workspaceRequest,
  isImplementation,
  IsolatedValidationEvidence,
  PublicationBundle,
  commandValidationRequired,
} from "@/lib/workspace-api";
export function ExecutionActions({
  projectId,
  run,
  view,
  capabilities,
  busy,
  act,
}: {
  projectId: string;
  run: WorkspaceRun;
  view: WorkspaceView;
  capabilities: WorkspaceCapabilities;
  busy: boolean;
  act: (work: () => Promise<void>) => Promise<void>;
}) {
  const [now,setNow]=useState(0);
  useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[]);
  const implemented = run.events.find(isImplementation),
    reviewed = run.events.some((e) => e.kind === "REVIEW_VERIFIED");
  const prepared = run.events
      .filter((e) => e.kind === "PUBLICATION_PREPARED")
      .slice(-1)[0],
    bundle = (prepared?.payload as unknown as { result?: PublicationBundle })
      ?.result;
  const permission = run.events
    .filter(
      (e) =>
        e.kind === "PUBLICATION_APPROVED" &&
        e.payload.preparedEventId === prepared?.id &&
        e.payload.headVersion === view.head.stateVersion &&
        Date.parse(String(e.payload.expiresAt)) > now,
    )
    .slice(-1)[0];
  const attempted = run.events.some((e) => e.kind === "PUBLICATION_STARTED"),
    validationAttempted = run.events.some(
      (e) => e.kind === "VALIDATION_STARTED",
    );
  const input = {
    expectedVersion: view.head.stateVersion,
    expectedChangeHash: implemented?.payload.changeHash,
  };
  const post = (path: string, body: Record<string, unknown>) =>
    act(async () => {
      await workspaceRequest(projectId, "/runs/" + run.id + path, body);
    });
  return (
    <div className="space-y-2">
      {commandValidationRequired(run) && (
        <div className="border rounded p-2 space-y-2">
          <p className="text-sm">Approved isolated command checks</p>
          {run.authority.units?.flatMap((u) =>
            (u.commands || []).map((c) => (
              <pre key={u.id + c.id} className="text-xs whitespace-pre-wrap">
                {u.id} · {c.criterionId} · {JSON.stringify(c.argv)} · {c.cwd} ·{" "}
                {c.timeoutMs} ms
              </pre>
            )),
          )}
          {!capabilities.isolatedValidation && (
            <p className="text-xs">
              Isolated runtime unavailable. Command checks and review remain
              gated.
            </p>
          )}
          <Button
            size="sm"
            disabled={
              busy ||
              !implemented ||
              !capabilities.isolatedValidation ||
              validationAttempted
            }
            onClick={() =>
              post("/validate", {
                ...input,
                idempotencyKey: crypto.randomUUID(),
              })
            }
          >
            Run approved isolated checks
          </Button>
        </div>
      )}
      {run.events
        .filter((e) => e.kind === "SANDBOX_VALIDATED")
        .map((e) => {
          const result = (e.payload as unknown as IsolatedValidationEvidence)
            .result;
          return (
            <div key={e.id} className="text-xs">
              <p>
                {result.passed ? "Checks passed" : "Checks failed"} ·{" "}
                {result.evidenceClass}
              </p>
              {result.results.map((r) => (
                <details key={r.id}>
                  <summary>
                    {r.id} · exit {r.exitCode ?? "none"}
                    {r.timedOut ? " · timed out" : ""}
                  </summary>
                  <pre className="whitespace-pre-wrap max-h-40 overflow-auto">
                    {r.stdout}
                    {r.stderr}
                  </pre>
                </details>
              ))}
            </div>
          );
        })}
      {reviewed && (
        <div className="border rounded p-2 space-y-2">
          <p className="text-sm">Separate publication authority</p>
          <p className="text-xs">
            Prepare a local candidate, inspect its exact heads and branches,
            then approve publication. Approval expires after 15 minutes.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || attempted || !!bundle}
            onClick={() =>
              post("/publication/prepare", {
                ...input,
                idempotencyKey: crypto.randomUUID(),
              })
            }
          >
            Prepare local publication candidate
          </Button>
          {bundle && (
            <>
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(bundle, null, 2)}
              </pre>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  busy || attempted || !!permission || !capabilities.publication
                }
                onClick={() =>
                  post("/publication/approve", {
                    expectedVersion: view.head.stateVersion,
                    preparedEventId: prepared.id,
                    expectedBundleHash: bundle.bundleHash,
                  })
                }
              >
                Approve these exact heads for publication
              </Button>
              <Button
                size="sm"
                disabled={
                  busy || attempted || !permission || !capabilities.publication
                }
                onClick={() =>
                  post("/publication/publish", {
                    ...input,
                    idempotencyKey: crypto.randomUUID(),
                    publicationApprovalId: permission.id,
                  })
                }
              >
                Publish approved branches
              </Button>
              {attempted && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !capabilities.publication}
                  onClick={() =>
                    post("/publication/reconcile", {
                      preparedEventId: prepared.id,
                    })
                  }
                >
                  Reconcile remote branch evidence
                </Button>
              )}
            </>
          )}
          {!capabilities.publication && (
            <p className="text-xs">
              Publication is disabled in this environment.
            </p>
          )}
        </div>
      )}
      {run.events
        .filter((e) =>
          /^(PUBLICATION_|PUBLISHED|VALIDATION_CONFLICTED)/.test(e.kind),
        )
        .map((e) => (
          <details key={e.id} className="text-xs">
            <summary>{e.kind}</summary>
            <pre className="whitespace-pre-wrap max-h-40 overflow-auto">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          </details>
        ))}
      {view.operations
        .filter(
          (o) =>
            o.status === "RUNNING" &&
            run.events.some((e) => e.payload.operationId === o.id) &&
            ["VALIDATION", "PUBLICATION_PREPARE", "PUBLICATION"].includes(
              o.kind,
            ),
        )
        .map((o) => (
          <Button
            key={o.id}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => post("/operations/" + o.id + "/recover", {})}
          >
            Recover interrupted {o.kind.toLowerCase()} after five minutes
          </Button>
        ))}
    </div>
  );
}
