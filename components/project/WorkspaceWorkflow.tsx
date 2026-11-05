"use client";
import { BaselineValidationPanel } from "./BaselineValidationPanel";
import { ExecutionActions } from "./WorkspaceExecutionActions";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  workspaceRequest,
  WorkspaceCapabilities,
  commandValidationRequired,
  commandValidationPassed,
  commandValidationFailed,
  WorkspaceView,
  WorkspaceRevision,
  WorkspaceRun,
  MainDocument,
  ArchitectureDocument,
  Question,
  Named,
  Unit,
  GenerationOperation,
  isImplementation,
  isImplementationRun,
  architecturePurpose,
  ValidationArchitectureDocument,
  isDocumentChange,
} from "@/lib/workspace-api";

const lines = (value: string) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
const sectionLabels: Record<string, string> = {
  features: "Features",
  journeys: "User journeys",
  constraints: "Constraints",
  exclusions: "Exclusions",
  decisions: "Decisions",
  components: "Components",
  dataMigrations: "Data and migrations",
  interfaces: "Interfaces",
  security: "Security",
  operations: "Operations",
};
function TextField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Questions({
  value,
  onChange,
}: {
  value: Question[];
  onChange: (v: Question[]) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium">Open questions</h4>
      {value.map((q, i) => (
        <div key={q.id} className="flex gap-2 items-center">
          <Input
            aria-label={"Question " + q.id}
            value={q.question}
            onChange={(e) =>
              onChange(
                value.map((v, j) =>
                  j === i ? { ...v, question: e.target.value } : v,
                ),
              )
            }
          />
          <label className="text-xs whitespace-nowrap">
            <input
              type="checkbox"
              checked={q.blocking}
              onChange={(e) =>
                onChange(
                  value.map((v, j) =>
                    j === i ? { ...v, blocking: e.target.checked } : v,
                  ),
                )
              }
            />{" "}
            Blocks approval
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            Resolve
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([
            ...value,
            {
              id: "Q-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
              question: "Describe the open question",
              blocking: true,
            },
          ])
        }
      >
        Add question
      </Button>
    </div>
  );
}
function Sections<T extends MainDocument | ArchitectureDocument>({
  doc,
  keys,
  onChange,
}: {
  doc: T;
  keys: string[];
  onChange: (v: T) => void;
}) {
  const named = new Set(["features", "journeys", "decisions", "components"]);
  const namedValues = (key: string) =>
    (doc as unknown as Record<string, Named[]>)[key] || [];
  const textValues = (key: string) =>
    (doc as unknown as Record<string, string[]>)[key] || [];
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {keys.map((key) =>
        named.has(key) ? (
          <div key={key} className="space-y-2">
            <h4 className="text-sm font-medium">{sectionLabels[key]}</h4>
            {namedValues(key).map((item, index: number) => (
              <div key={item.id} className="space-y-1">
                <TextField
                  label={item.id}
                  value={item.description}
                  onChange={(description) =>
                    onChange({
                      ...doc,
                      [key]: namedValues(key).map((value, i: number) =>
                        i === index ? { ...value, description } : value,
                      ),
                    })
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...doc,
                      [key]: namedValues(key).filter(
                        (_, i: number) => i !== index,
                      ),
                    })
                  }
                >
                  Remove item
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...doc,
                  [key]: [
                    ...namedValues(key),
                    {
                      id:
                        key.toUpperCase() +
                        "-" +
                        crypto.randomUUID().slice(0, 8).toUpperCase(),
                      description: "Describe this item",
                    },
                  ],
                })
              }
            >
              Add {sectionLabels[key].toLowerCase()} item
            </Button>
          </div>
        ) : (
          <TextField
            key={key}
            label={sectionLabels[key] + " (one per line)"}
            value={textValues(key).join("\n")}
            onChange={(text) =>
              onChange({
                ...doc,
                [key]: lines(text),
              })
            }
          />
        ),
      )}
    </div>
  );
}
export function WorkspaceWorkflow({ projectId }: { projectId: string }) {
  const [observed, setObserved] = useState<
    {
      repositoryId: string;
      head: string | null;
      clean: boolean;
      error: string | null;
    }[]
  >([]);
  const [capabilities, setCapabilities] = useState<WorkspaceCapabilities>({
    aiGeneration: false,
  });
  const [view, setView] = useState<WorkspaceView | null>(null),
    [brief, setBrief] = useState(""),
    [main, setMain] = useState<MainDocument | null>(null),
    [architecture, setArchitecture] = useState<ArchitectureDocument | null>(
      null,
    );
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [activeRun, setActiveRun] = useState<string | null>(null),
    [changes, setChanges] = useState("");
  const fetchSnapshot = useCallback(
    () =>
      Promise.all([
        workspaceRequest<WorkspaceView>(projectId),
        workspaceRequest<WorkspaceCapabilities>(projectId, "/capabilities"),
      ]),
    [projectId],
  );
  const applySnapshot = useCallback(
    (next: WorkspaceView, capabilities: WorkspaceCapabilities) => {
      setCapabilities(capabilities);
      setView(next);
      const approved = next.approvals.find(
        (a) => a.id === next.head.approvalId,
      );
      setSelected((ids) =>
        ids.filter(
          (id) =>
            approved?.snapshot.architecture.units.some((u) => u.id === id) &&
            !next.readiness.invalidatedUnitIds.includes(id),
        ),
      );
      const m = next.documents.find((d) => d.id === next.head.mainId),
        a = next.documents.find((d) => d.id === next.head.architectureId);
      setMain(m?.kind === "MAIN" ? (m.content as MainDocument) : null);
      setArchitecture(
        a?.kind === "ARCHITECTURE" ? (a.content as ArchitectureDocument) : null,
      );
      setBrief(m?.kind === "MAIN" ? (m.content as MainDocument).brief : "");
    },
    [],
  );
  const load = useCallback(async () => {
    const [next, capabilities] = await fetchSnapshot();
    applySnapshot(next, capabilities);
  }, [fetchSnapshot, applySnapshot]);
  useEffect(() => {
    let cancelled = false;
    fetchSnapshot()
      .then(([next, capabilities]) => {
        if (!cancelled) applySnapshot(next, capabilities);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load project documents.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSnapshot, applySnapshot]);
  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  };
  if (!view)
    return <div className="p-5">{error || "Loading project documents…"}</div>;
  const mainRevision = view.documents.find((d) => d.id === view.head.mainId),
    archRevision = view.documents.find(
      (d) => d.id === view.head.architectureId,
    );
  const approval = view.approvals.find((a) => a.id === view.head.approvalId);
  const exactApproved =
    !!approval &&
    approval.architectureId === archRevision?.id &&
    approval.mainId === mainRevision?.id;
  const currentQuestions = [
    ...(main?.questions || []),
    ...(architecture?.questions || []),
  ].filter((q) => q.blocking);
  if(architecture && architecturePurpose(architecture)===null)return <div role="alert">Unsupported or mixed-purpose Architecture. Refresh the documents.</div>;
  const baselineMode = architecture?.schemaVersion === 2 || (archRevision?.content as {schemaVersion?:number}|undefined)?.schemaVersion === 2;
  const save = (
    kind: "MAIN" | "ARCHITECTURE",
    content: MainDocument | ArchitectureDocument,
  ) =>
    act(async () => {
      await workspaceRequest(projectId, "/documents", {
        kind,
        content,
        reason,
        expectedVersion: view.head.stateVersion,
      });
      setReason("");
    });
  const inspectRepositories = async () => {
    setBusy(true);
    setError("");
    try {
      setObserved(
        await workspaceRequest(projectId, "/repositories/observed-baselines"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repository inspection failed");
    } finally {
      setBusy(false);
    }
  };
  const materializeRepository = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await workspaceRequest<{ baseline: string }>(
        projectId,
        "/repositories/" + id + "/materialize",
        {},
      );
      setObserved((values) => [
        ...values.filter((v) => v.repositoryId !== id),
        { repositoryId: id, head: result.baseline, clean: true, error: null },
      ]);
      setView((current) =>
        current
          ? {
              ...current,
              repositories: current.repositories.map((r) =>
                r.id === id
                  ? {
                      ...r,
                      materialized: true,
                      currentIndexedCommit: result.baseline,
                    }
                  : r,
              ),
            }
          : current,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Repository materialization failed",
      );
    } finally {
      setBusy(false);
    }
  };
  const generate = (kind: "MAIN" | "ARCHITECTURE" | "CODE_PROPOSAL") =>
    act(async () => {
      const body = {
        kind,
        brief,
        expectedVersion: view.head.stateVersion,
        idempotencyKey: crypto.randomUUID(),
        instruction:
          reason.trim() ||
          (kind === "MAIN"
            ? "Generate the Main Document from the brief"
            : kind === "ARCHITECTURE"
              ? "Reconcile Architecture to the exact current Main Document"
              : "Implement only the selected approved Architecture units"),
      };
      const operation = await workspaceRequest<GenerationOperation>(
        projectId,
        kind === "CODE_PROPOSAL"
          ? "/runs/" + activeRun + "/propose"
          : "/generate",
        body,
      );
      if (operation.status !== "COMPLETED")
        throw new Error(
          operation.errorCode ||
            "Generation is in progress. Reload to inspect its status.",
        );
      if (kind === "CODE_PROPOSAL") {
        if (!operation.result) throw new Error("The proposal has no result.");
        if (operation.result.output.scopeChangeRequired)
          throw new Error(
            "Return to the documents: " + operation.result.output.reason,
          );
        setChanges(JSON.stringify(operation.result.output.changes, null, 2));
      }
      setReason("");
    });
  const draftArchitecture = () => {
    if (!mainRevision || !main) return;
    if (architecture?.schemaVersion === 2) {
      // Reconcile the immutable Main link without changing purpose, profiles or units.
      setArchitecture({...architecture,sourceMain:{id:mainRevision.id,hash:mainRevision.contentHash}});
      return;
    }
    const repo = view.repositories[0];
    setArchitecture({
      schemaVersion: 1,
      sourceMain: { id: mainRevision.id, hash: mainRevision.contentHash },
      overview: main.purpose,
      components: [
        {
          id: "COMP-001",
          description: "Describe the component and its boundaries",
        },
      ],
      dataMigrations: [],
      interfaces: [],
      security: ["Describe access and isolation requirements"],
      operations: ["Describe deployment, recovery, and ongoing operation"],
      repositories: repo
        ? [
            {
              id: repo.id,
              baseline: repo.currentIndexedCommit || "0".repeat(40),
            },
          ]
        : [],
      units: [],
      questions: [
        {
          id: "Q-ARCHITECTURE",
          question:
            "Review components, repository baselines, implementation scope and checks.",
          blocking: true,
        },
      ],
    });
  };
  const addUnit = () => {
    if (!architecture || !main) return;
    const r = main.requirements[0];
    setArchitecture({
      ...architecture,
      units: [
        ...architecture.units,
        {
          id: "UNIT-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
          title: "Describe the implementation unit",
          requirementIds: [r.id],
          dependsOn: [],
          repositoryId: architecture.repositories[0]?.id || "",
          files: [{ path: "README.md", action: "modify" }],
          checks: r.acceptanceCriteria.map((c) => ({
            id: "CHECK-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
            criterionId: c.id,
            type: "contains",
            path: "README.md",
            expected: "Describe the expected text",
          })),
        },
      ],
    });
  };
  const updateUnit = (index: number, patch: Partial<Unit>) => {
    if (!architecture) return;
    setArchitecture({
      ...architecture,
      units: architecture.units.map((u, i: number) =>
        i === index ? { ...u, ...patch } : u,
      ),
    });
  };
  const run = view.runs.filter(isImplementationRun).find((r) => r.id === activeRun);
  const activeRunRunnable =
    !!run &&
    run.approvalId === view.head.approvalId &&
    !run.authority.unitIds.some((id: string) =>
      view.readiness.invalidatedUnitIds.includes(id),
    ) &&
    !run.events.some((e) =>
      [
        "IMPLEMENTED",
        "REVIEW_VERIFIED",
        "RUN_FAILED",
        "SCOPE_CHANGE_REQUIRED",
      ].includes(e.kind),
    );
  const dirtyMain =
      mainRevision &&
      JSON.stringify(main) !== JSON.stringify(mainRevision.content),
    dirtyArch =
      archRevision &&
      JSON.stringify(architecture) !== JSON.stringify(archRevision.content);
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold">
          {baselineMode ? "Project documents and baseline validation" : "Project documents and implementation"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {baselineMode ? "Edit and save Main and Architecture revisions, then preview the exact baseline validation scope." : "Brief → Main Document → Architecture → implementation → review. Approve the exact Architecture version to authorize work."}
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded border border-destructive p-3 text-destructive"
        >
          {error}
        </p>
      )}
      {capabilities.aiGeneration && !baselineMode && (
        <p className="text-sm text-muted-foreground">
          AI drafts and code proposals require review. Generation never approves
          documents or applies code.
        </p>
      )}
      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="font-semibold">Brief</h3>
        <TextField
          label="What should this project achieve?"
          value={brief}
          onChange={setBrief}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !brief.trim()}
            onClick={() =>
              act(async () => {
                await workspaceRequest(projectId, "/documents", {
                  kind: "MAIN",
                  brief,
                  content: null,
                  reason: "Create a reviewable draft from the brief",
                  expectedVersion: view.head.stateVersion,
                });
              })
            }
          >
            Create Main draft from brief
          </Button>
          {capabilities.aiGeneration && !baselineMode && (
            <Button
              disabled={busy || !brief.trim() || !!dirtyMain || !!dirtyArch}
              onClick={() => generate("MAIN")}
            >
              Generate Main with AI
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await workspaceRequest(projectId, "/import-legacy", {
                  expectedVersion: view.head.stateVersion,
                });
              })
            }
          >
            Import legacy planning as draft
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Draft scaffolds need review. Chat suggestions and legacy approvals do
          not authorize implementation.
        </p>
      </section>
      {main && (
        <section className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">
            Main Document {mainRevision && "v" + mainRevision.version}
          </h3>
          <TextField
            label="Purpose"
            value={main.purpose}
            onChange={(purpose) => setMain({ ...main, purpose })}
          />
          <h4 className="font-medium">Requirements and acceptance</h4>
          {main.requirements.map((r, i: number) => (
            <div key={r.id} className="border rounded p-3 space-y-2">
              <TextField
                label={r.id}
                value={r.description}
                onChange={(description) =>
                  setMain({
                    ...main,
                    requirements: main.requirements.map((v, j: number) =>
                      j === i ? { ...v, description } : v,
                    ),
                  })
                }
              />
              {r.acceptanceCriteria.map((c, j: number) => (
                <TextField
                  key={c.id}
                  label={c.id + " · observable acceptance outcome"}
                  value={c.description}
                  onChange={(description) =>
                    setMain({
                      ...main,
                      requirements: main.requirements.map((v, k: number) =>
                        k === i
                          ? {
                              ...v,
                              acceptanceCriteria: v.acceptanceCriteria.map(
                                (a, l: number) =>
                                  j === l ? { ...a, description } : a,
                              ),
                            }
                          : v,
                      ),
                    })
                  }
                  rows={2}
                />
              ))}
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setMain({
                ...main,
                requirements: [
                  ...main.requirements,
                  {
                    id: "REQ-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
                    description: "New requirement",
                    acceptanceCriteria: [
                      {
                        id:
                          "AC-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
                        description: "Observable acceptance outcome",
                      },
                    ],
                  },
                ],
              })
            }
          >
            Add requirement
          </Button>
          <Sections
            doc={main}
            keys={[
              "features",
              "journeys",
              "constraints",
              "exclusions",
              "decisions",
            ]}
            onChange={setMain}
          />
          <Questions
            value={main.questions}
            onChange={(questions) => setMain({ ...main, questions })}
          />
          <Input
            aria-label="Reason for document change"
            placeholder="Reason for this document version"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            disabled={busy || !reason.trim()}
            onClick={() => save("MAIN", main)}
          >
            Save Main version
          </Button>
        </section>
      )}
      {mainRevision && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">
              Architecture {archRevision && "v" + archRevision.version}
            </h3>
            <Button
              variant="outline"
              disabled={busy || !!dirtyMain}
              onClick={draftArchitecture}
            >
              {baselineMode ? "Reconcile Architecture with current Main" : "Create reconciled Architecture draft"}
            </Button>
            {capabilities.aiGeneration && !baselineMode && (
              <Button
                disabled={busy || !!dirtyMain || !!dirtyArch}
                onClick={() => generate("ARCHITECTURE")}
              >
                Generate Architecture with AI
              </Button>
            )}
          </div>
          {architecture && (
            <>
              <p className="text-xs text-muted-foreground">
                Linked Main: {architecture.sourceMain.id}. Save a reconciled
                version after Main changes.
              </p>
              <TextField
                label="Architecture overview"
                value={architecture.overview}
                onChange={(overview) =>
                  setArchitecture({ ...architecture, overview })
                }
              />
              <Sections
                doc={architecture}
                keys={[
                  "components",
                  "dataMigrations",
                  "interfaces",
                  "security",
                  "operations",
                ]}
                onChange={setArchitecture}
              />
              <h4 className="font-medium">Repositories and exact baselines</h4>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={inspectRepositories}
              >
                Inspect repository baselines
              </Button>
              {view.repositories.map((repo) => (
                <div key={repo.id} className="block text-sm">
                  {repo.name}
                  {!baselineMode && !repo.materialized && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => materializeRepository(repo.id)}
                    >
                      Materialize managed clone
                    </Button>
                  )}
                  {observed
                    .filter((o) => o.repositoryId === repo.id)
                    .map((o) => (
                      <div key={o.repositoryId} className="space-y-1">
                        <p className="text-xs">
                          {o.error ||
                            "Observed HEAD: " +
                              o.head +
                              (o.clean ? " · clean" : " · external changes")}
                        </p>
                        {o.head && o.clean && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setArchitecture({
                                ...architecture,
                                repositories: [
                                  ...architecture.repositories.filter(
                                    (r) => r.id !== repo.id,
                                  ),
                                  { id: repo.id, baseline: o.head || "" },
                                ],
                              })
                            }
                          >
                            Use observed baseline in draft
                          </Button>
                        )}
                      </div>
                    ))}
                  <Input
                    aria-label={repo.name + " baseline commit"}
                    value={
                      architecture.repositories.find((r) => r.id === repo.id)
                        ?.baseline || ""
                    }
                    placeholder="Exact baseline commit SHA"
                    onChange={(e) =>
                      setArchitecture({
                        ...architecture,
                        repositories: [
                          ...architecture.repositories.filter(
                            (r) => r.id !== repo.id,
                          ),
                          { id: repo.id, baseline: e.target.value },
                        ],
                      })
                    }
                  />
                </div>
              ))}
              {!baselineMode && <>
              <h4 className="font-medium">Implementation units</h4>
              {architecture.units.map((u, i: number) => (
                <div key={u.id} className="space-y-2 border rounded p-3">
                  <strong className="text-sm">{u.id}</strong>
                  <Input
                    aria-label="Unit title"
                    value={u.title}
                    onChange={(e) => updateUnit(i, { title: e.target.value })}
                  />
                  <label className="text-sm block">
                    Repository
                    <select
                      className="block w-full border rounded p-2 bg-background"
                      value={u.repositoryId}
                      onChange={(e) =>
                        updateUnit(i, { repositoryId: e.target.value })
                      }
                    >
                      {view.repositories.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    aria-label="Requirement IDs"
                    value={u.requirementIds.join(", ")}
                    onChange={(e) =>
                      updateUnit(i, {
                        requirementIds: e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <Input
                    aria-label="Dependency unit IDs"
                    placeholder="Dependency unit IDs, separated by commas"
                    value={u.dependsOn.join(", ")}
                    onChange={(e) =>
                      updateUnit(i, {
                        dependsOn: e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <TextField
                    label="Allowed files (create, modify, or delete followed by a path; one per line)"
                    value={u.files
                      .map((f) => f.action + " " + f.path)
                      .join("\n")}
                    onChange={(text) =>
                      updateUnit(i, {
                        files: lines(text).map((line) => {
                          const [action, ...parts] = line.split(" ");
                          return {
                            action: action as Unit["files"][number]["action"],
                            path: parts.join(" "),
                          };
                        }),
                      })
                    }
                  />
                  <div className="space-y-2 border rounded p-2">
                    <h5 className="text-sm font-medium">
                      Isolated verification commands
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Approve each executable and argument below. Commands run
                      only in a configured isolated runtime, with no network or
                      host credentials.
                    </p>
                    {(u.commands || []).map((command, commandIndex) => {
                      const update = (
                        patch: Partial<NonNullable<Unit["commands"]>[number]>,
                      ) =>
                        updateUnit(i, {
                          commands: (u.commands || []).map((v, k) =>
                            k === commandIndex ? { ...v, ...patch } : v,
                          ),
                        });
                      return (
                        <div
                          key={command.id}
                          className="space-y-2 border rounded p-2"
                        >
                          <p className="text-xs">{command.id}</p>
                          <Input
                            aria-label="Command acceptance criterion"
                            value={command.criterionId}
                            onChange={(e) =>
                              update({ criterionId: e.target.value })
                            }
                          />
                          <TextField
                            label="Executable and arguments (one per line; no shell)"
                            value={command.argv.join("\n")}
                            onChange={(v) => update({ argv: v.split("\n") })}
                          />
                          <Input
                            aria-label="Command working directory"
                            value={command.cwd}
                            onChange={(e) => update({ cwd: e.target.value })}
                          />
                          <Input
                            aria-label="Command timeout in milliseconds"
                            type="number"
                            min={1000}
                            max={30000}
                            value={command.timeoutMs}
                            onChange={(e) =>
                              update({ timeoutMs: Number(e.target.value) })
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateUnit(i, {
                                commands: (u.commands || []).filter(
                                  (_, k) => k !== commandIndex,
                                ),
                              })
                            }
                          >
                            Remove command
                          </Button>
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(u.commands?.length || 0) >= 4}
                      onClick={() =>
                        updateUnit(i, {
                          commands: [
                            ...(u.commands || []),
                            {
                              id:
                                "CMD-" +
                                crypto.randomUUID().slice(0, 8).toUpperCase(),
                              criterionId: u.checks[0]?.criterionId || "AC-001",
                              argv: ["npm", "test", "--", "--runInBand"],
                              cwd: ".",
                              timeoutMs: 30000,
                            },
                          ],
                        })
                      }
                    >
                      Add command for review
                    </Button>
                  </div>
                  {u.checks.map((c, j: number) => (
                    <div key={c.id} className="grid sm:grid-cols-2 gap-2">
                      <Input
                        aria-label="Acceptance criterion ID"
                        value={c.criterionId}
                        onChange={(e) =>
                          updateUnit(i, {
                            checks: u.checks.map((v, k: number) =>
                              j === k
                                ? { ...v, criterionId: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                      <Input
                        aria-label="Check path"
                        value={c.path}
                        onChange={(e) =>
                          updateUnit(i, {
                            checks: u.checks.map((v, k: number) =>
                              j === k ? { ...v, path: e.target.value } : v,
                            ),
                          })
                        }
                      />
                      <select
                        aria-label="Check type"
                        className="border rounded p-2 bg-background"
                        value={c.type}
                        onChange={(e) =>
                          updateUnit(i, {
                            checks: u.checks.map((v, k: number) =>
                              j === k
                                ? {
                                    ...v,
                                    type: e.target
                                      .value as Unit["checks"][number]["type"],
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        <option value="contains">Contains text</option>
                        <option value="not_contains">
                          Does not contain text
                        </option>
                        <option value="json">Valid JSON</option>
                        <option value="absent">File is absent</option>
                      </select>
                      <Input
                        aria-label="Expected text"
                        disabled={c.type === "json" || c.type === "absent"}
                        value={c.expected}
                        onChange={(e) =>
                          updateUnit(i, {
                            checks: u.checks.map((v, k: number) =>
                              j === k ? { ...v, expected: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addUnit}>
                Add implementation unit
              </Button>
              </>}
              <Questions
                value={architecture.questions}
                onChange={(questions) =>
                  setArchitecture({ ...architecture, questions })
                }
              />
              <Input
                aria-label="Architecture change reason"
                value={reason}
                placeholder="Reason for this Architecture version"
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                disabled={busy || !reason.trim()}
                onClick={() => save("ARCHITECTURE", architecture)}
              >
                Save Architecture version
              </Button>
            </>
          )}
        </section>
      )}
      <section className="space-y-3 border rounded-lg p-4">
        <h3 className="font-semibold">{baselineMode ? "Document history and impact" : "Differences, impact and approval"}</h3>
        {[mainRevision, archRevision].filter(Boolean).map((doc) => {
          const d = doc as WorkspaceRevision;
          const previous = view.documents.find((p) => p.id === d.previousId);
          return (
            <details key={d.id}>
              <summary className="cursor-pointer text-sm">
                {d.kind} v{d.version} · {d.contentHash.slice(0, 12)}
              </summary>
              <div className="grid md:grid-cols-2 gap-2">
                <pre className="text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                  {previous
                    ? JSON.stringify(previous.content, null, 2)
                    : "First version"}
                </pre>
                <pre className="text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                  {JSON.stringify(d.content, null, 2)}
                </pre>
              </div>
            </details>
          );
        })}
        {view.events
          .filter(isDocumentChange)
          .slice(-3)
          .map((e) => (
            <p key={e.id} className="text-xs">
              {e.payload.reason} · affected units:{" "}
              {e.payload.invalidatedUnitIds?.join(", ") || "none recorded"}
            </p>
          ))}
        {currentQuestions.length > 0 && (
          <p className="text-sm">
            Resolve {currentQuestions.length} blocking question(s) before
            approval.
          </p>
        )}
        {!baselineMode && (
        <Button
          disabled={
            busy ||
            !mainRevision ||
            !archRevision ||
            exactApproved ||
            currentQuestions.length > 0 ||
            !!dirtyMain ||
            !!dirtyArch
          }
          onClick={() =>
            act(async () => {
              await workspaceRequest(projectId, "/approve", {
                architectureId: archRevision!.id,
                architectureHash: archRevision!.contentHash,
                mainId: mainRevision!.id,
                mainHash: mainRevision!.contentHash,
                expectedVersion: view.head.stateVersion,
              });
            })
          }
        >
          {exactApproved
            ? "Architecture approved"
            : "Approve exact Architecture and linked Main"}
        </Button>
        )}
      </section>
      {baselineMode && mainRevision && mainRevision.kind === 'MAIN' && archRevision && (archRevision.content as {schemaVersion?:number}).schemaVersion === 2 && (
        <BaselineValidationPanel key={projectId+':'+mainRevision.contentHash+':'+archRevision.contentHash+':'+(dirtyMain||dirtyArch?'dirty':'saved')} projectId={projectId} mainRevision={mainRevision} architectureRevision={archRevision as WorkspaceRevision<ValidationArchitectureDocument>} documentsDirty={!!dirtyMain||!!dirtyArch} externalBusy={busy} onRefresh={load}/>
      )}
      {(dirtyMain || dirtyArch) && <Button variant="outline" disabled={busy} onClick={()=>{applySnapshot(view,capabilities);setReason('');}}>Discard unsaved document edits</Button>}
      {!baselineMode && <>
      {approval && (
        <section className="space-y-3 border rounded-lg p-4">
          <h3 className="font-semibold">Authorized implementation</h3>
          {approval.snapshot.architecture.units.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                disabled={view.readiness.invalidatedUnitIds.includes(u.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, u.id]
                      : selected.filter((id) => id !== u.id),
                  )
                }
              />
              {u.id} · {u.title}
              {view.readiness.invalidatedUnitIds.includes(u.id)
                ? " · Needs Architecture reconciliation"
                : ""}
            </label>
          ))}
          <Button
            disabled={busy || !selected.length || !!dirtyMain || !!dirtyArch}
            onClick={() =>
              act(async () => {
                const next = await workspaceRequest<WorkspaceRun>(
                  projectId,
                  "/runs",
                  {
                    approvalId: approval.id,
                    unitIds: selected,
                    expectedVersion: view.head.stateVersion,
                    idempotencyKey: crypto.randomUUID(),
                  },
                );
                setActiveRun(next.id);
                setChanges(
                  JSON.stringify(
                    await workspaceRequest(
                      projectId,
                      "/runs/" + next.id + "/preview",
                    ),
                    null,
                    2,
                  ),
                );
              })
            }
          >
            Prepare selected units
          </Button>
          <p className="text-xs text-muted-foreground">
            File changes stay within approved units. Architecture commands require an available isolated runtime. Publication requires review and a separate approval of the exact candidate heads.
          </p>
          {activeRun && activeRunRunnable && (
            <>
              {capabilities.aiGeneration && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => generate("CODE_PROPOSAL")}
                >
                  Generate scoped change proposal
                </Button>
              )}
              <TextField
                label="Review proposed file changes"
                value={changes}
                onChange={setChanges}
                rows={10}
              />
              <Button
                disabled={busy || !changes.trim()}
                onClick={() =>
                  act(async () => {
                    await workspaceRequest(
                      projectId,
                      "/runs/" + activeRun + "/execute",
                      { changes: JSON.parse(changes) },
                    );
                  })
                }
              >
                Apply changes in isolated workspace
              </Button>
            </>
          )}
        </section>
      )}
      {view.operations?.length > 0 && (
        <section className="space-y-2 border rounded-lg p-4">
          <h3 className="font-semibold">Generation history</h3>
          {view.operations.map((op) => (
            <p key={op.id} className="text-sm">
              {op.kind} · {op.status}
              {op.errorCode ? " · " + op.errorCode : ""}
            </p>
          ))}
        </section>
      )}
      <section className="space-y-3 border rounded-lg p-4">
        <h3 className="font-semibold">Review and delivery evidence</h3>
        {view.runs.filter(isImplementationRun).map((r) => (
          <div key={r.id} className="border rounded p-3 space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveRun(r.id)}
            >
              {r.id.slice(0, 12)}
            </Button>
            <p className="text-xs">{r.events.map((e) => e.kind).join(" → ")}</p>
            {!r.events.some(
              (e) =>
                e.kind === "SCOPE_CHANGE_REQUIRED" ||
                e.kind === "REVIEW_VERIFIED",
            ) &&
              r.events.some(
                (e) =>
                  e.kind === "RUN_FAILED" ||
                  commandValidationFailed(r) ||
                  (e.kind === "IMPLEMENTED" &&
                    e.payload.verification === "CHECKS_FAILED"),
              ) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !!dirtyMain || !!dirtyArch}
                  onClick={() =>
                    act(async () => {
                      const retry = await workspaceRequest<WorkspaceRun>(
                        projectId,
                        "/runs/" + r.id + "/retry",
                        {
                          expectedVersion: view.head.stateVersion,
                          idempotencyKey: crypto.randomUUID(),
                        },
                      );
                      setActiveRun(retry.id);
                      setChanges(
                        JSON.stringify(
                          await workspaceRequest(
                            projectId,
                            "/runs/" + retry.id + "/preview",
                          ),
                          null,
                          2,
                        ),
                      );
                    })
                  }
                >
                  Prepare repair within the same approved scope
                </Button>
              )}
            <ExecutionActions
              projectId={projectId}
              run={r}
              view={view}
              capabilities={capabilities}
              busy={busy || !!dirtyMain || !!dirtyArch}
              act={act}
            />
            {r.events.filter(isImplementation).map((e) => (
              <div key={e.id}>
                <p className="text-sm">
                  {e.payload.verification} ·{" "}
                  {e.payload.checks.filter((c) => c.passed).length}/
                  {e.payload.checks.length} declared checks passed
                </p>
                {e.payload.diffs.map((d) => (
                  <pre
                    key={d.repositoryId}
                    className="max-h-60 overflow-auto text-xs whitespace-pre-wrap"
                  >
                    {d.diff}
                  </pre>
                ))}
                <Button
                  size="sm"
                  disabled={
                    busy ||
                    e.payload.checks.some((c) => !c.passed) ||
                    !!dirtyMain ||
                    !!dirtyArch ||
                    (commandValidationRequired(r) &&
                      !commandValidationPassed(r)) ||
                    r.events.some((v) => v.kind === "REVIEW_VERIFIED")
                  }
                  onClick={() =>
                    act(async () => {
                      await workspaceRequest(
                        projectId,
                        "/runs/" + r.id + "/review",
                        { expectedChangeHash: e.payload.changeHash },
                      );
                    })
                  }
                >
                  Review exact diff and verify declared checks
                </Button>
              </div>
            ))}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Implemented and verified checks are stored separately. Deployment and
          real signed-in acceptance require separate release evidence.
        </p>
      </section>
      </>}
    </div>
  );
}
