"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertCircle, CheckCircle2, GitBranch, History, Loader2, Play, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { projectApi } from "@/lib/project-api";
import type { ImplementationExecution, KanbanBoard, PhaseApproval, PhaseArtifact, PhaseReadiness, ProjectPhaseState, ProjectRepository, WorkflowPhase, WorkflowRun } from "@/lib/types";

const LABELS: Record<WorkflowPhase, string> = {
  requirements: "Requirements", documentation: "Documentation", architecture: "Architecture",
  implementation: "Implementation", testing: "Testing", review: "Review",
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Please try again.";
}

function readinessMessages(items: PhaseReadiness["errors"]): string[] {
  return (items ?? []).map((item) => typeof item === "string" ? item : item.message || item.code || item.path || "Validation failed");
}

interface Props { projectId: string; phase: WorkflowPhase; onStatesChange?: (states: ProjectPhaseState[]) => void }

export function PhaseDetailView({ projectId, phase, onStatesChange }: Props) {
  if (phase === "implementation") return <ImplementationView projectId={projectId} onStatesChange={onStatesChange} />;
  if (phase === "testing" || phase === "review") return <LockedPhase phase={phase} />;
  return <PlanningPhaseView projectId={projectId} phase={phase} onStatesChange={onStatesChange} />;
}

function PlanningPhaseView({ projectId, phase, onStatesChange }: Props) {
  const [phaseState, setPhaseState] = useState<ProjectPhaseState | null>(null);
  const [artifacts, setArtifacts] = useState<PhaseArtifact[]>([]);
  const [approvals, setApprovals] = useState<PhaseApproval[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [readiness, setReadiness] = useState<PhaseReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"generate" | "revise" | null>(null);
  const [instruction, setInstruction] = useState("");
  const [comment, setComment] = useState("");
  const callbackRef = useRef(onStatesChange);
  useEffect(() => { callbackRef.current = onStatesChange; }, [onStatesChange]);

  const refresh = useCallback(async () => {
    const [states, nextArtifacts, nextApprovals, nextRuns] = await Promise.all([
      projectApi.getPhaseStates(projectId), projectApi.getPhaseArtifacts(projectId, phase),
      projectApi.getPhaseApprovals(projectId, phase), projectApi.getWorkflowRuns(projectId),
    ]);
    const latest = nextArtifacts[0];
    let nextReadiness: PhaseReadiness | null = null;
    if (latest?.contentHash && (phase === "requirements" || phase === "architecture")) {
      nextReadiness = await projectApi.getPhaseReadiness(projectId, phase, latest.id, latest.contentHash);
    }
    setPhaseState(states.find((state) => state.phase === phase) ?? null);
    setArtifacts(nextArtifacts); setApprovals(nextApprovals);
    setRuns(nextRuns.filter((run) => run.currentPhase === phase)); setReadiness(nextReadiness);
    callbackRef.current?.(states);
  }, [phase, projectId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true); setError(null);
    refresh().catch((cause) => mounted && setError(messageOf(cause))).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [refresh]);

  const mutate = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await operation(); await refresh(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };

  const latest = artifacts[0];
  const status = phaseState?.status ?? "not_started";
  const approved = status === "approved" || status === "completed";
  const exactHash = latest?.contentHash;
  const canSubmit = Boolean(latest && exactHash && (phase === "documentation" || readiness?.ready));

  const generate = () => mutate(async () => {
    if (phase === "requirements") {
      if (!instruction.trim()) throw new Error("Describe the product before generating Requirements.");
      await projectApi.generateRequirements(projectId, instruction.trim());
    } else if (phase === "documentation") await projectApi.generateDocumentation(projectId);
    else await projectApi.generateArchitecture(projectId);
    setInstruction(""); setDialog(null);
  });

  const revise = () => mutate(async () => {
    if (!latest || !instruction.trim()) throw new Error("Enter a revision instruction.");
    await projectApi.revisePhaseArtifact(projectId, phase as "requirements" | "documentation" | "architecture", latest, instruction.trim());
    setInstruction(""); setDialog(null);
  });

  if (loading) return <div className="p-4 grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2"/><Skeleton className="h-48"/></div>;

  return <div className="p-4 grid gap-4 lg:grid-cols-3">
    <div className="lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{LABELS[phase]}</h2><p className="text-sm text-muted-foreground">Authoritative backend artifact workflow</p></div><StatusBadge status={status}/></div>
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>Action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{latest?.title ?? `${LABELS[phase]} artifact`}</CardTitle><CardDescription>{latest ? `Version ${latest.version} · ${latest.lifecycleStatus ?? "DRAFT"}` : "No artifact has been generated."}</CardDescription></div><Button onClick={() => { setInstruction(""); setDialog("generate"); }} disabled={busy || approved}><Sparkles className="h-4 w-4"/>Generate</Button></div></CardHeader>
        <CardContent>{latest ? <ArtifactContent artifact={latest}/> : <p className="py-12 text-center text-sm text-muted-foreground">Generate the first {LABELS[phase].toLowerCase()} artifact to continue.</p>}</CardContent></Card>
      {latest && !approved && <Card><CardHeader><CardTitle className="text-base">Review and approval</CardTitle><CardDescription>All decisions are bound to artifact {latest.id} and its server content hash.</CardDescription></CardHeader><CardContent className="space-y-3">
        {readiness && <Readiness readiness={readiness}/>}
        {phase === "documentation" && <p className="text-sm text-muted-foreground">Documentation eligibility is validated by the dedicated approval endpoint.</p>}
        <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Required when requesting changes; optional for approval" rows={3}/>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setInstruction(""); setDialog("revise"); }} disabled={busy}>Revise with AI</Button>
          {status === "awaiting_approval" ? <><Button disabled={busy || !exactHash} onClick={() => mutate(() => projectApi.approvePhase(projectId, phase, latest.id, exactHash!, comment.trim() || undefined))}><CheckCircle2 className="h-4 w-4"/>Approve</Button><Button variant="destructive" disabled={busy || !exactHash || !comment.trim()} onClick={() => mutate(() => projectApi.requestPhaseChanges(projectId, phase, latest.id, exactHash!, comment.trim()))}>Request changes</Button></> : <Button disabled={busy || !canSubmit} onClick={() => mutate(() => projectApi.requestPhaseApproval(projectId, phase, latest.id, exactHash!))}>Submit for approval</Button>}
        </div></CardContent></Card>}
    </div>
    <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4"/>Version history</CardTitle></CardHeader><CardContent className="space-y-2">{artifacts.length ? artifacts.map((artifact) => <div key={artifact.id} className="flex justify-between text-sm"><span className="truncate">{artifact.title}</span><Badge variant="outline">v{artifact.version}</Badge></div>) : <p className="text-sm text-muted-foreground">No versions yet.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Decision log</CardTitle></CardHeader><CardContent className="space-y-2">{approvals.length ? approvals.map((approval) => <div key={approval.id} className="text-sm"><Badge variant="outline">{approval.decision.replaceAll("_", " ")}</Badge>{approval.comments && <p className="mt-1 text-muted-foreground">{approval.comments}</p>}</div>) : <p className="text-sm text-muted-foreground">No decisions yet.</p>}</CardContent></Card>
      {runs.length > 0 && <Card><CardHeader><CardTitle className="text-base">Generation runs</CardTitle></CardHeader><CardContent>{runs.slice(0, 5).map((run) => <div key={run.id} className="flex justify-between text-sm py-1"><span>{run.triggerType}</span><Badge variant="outline">{run.status}</Badge></div>)}</CardContent></Card>}
    </div>
    <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>{dialog === "revise" ? `Revise ${LABELS[phase]}` : `Generate ${LABELS[phase]}`}</DialogTitle><DialogDescription>{dialog === "revise" ? "Describe the exact changes required. A new server version will be created." : phase === "requirements" ? "Describe the product goal, users, constraints, and scope." : "The backend will generate from the approved upstream artifact."}</DialogDescription></DialogHeader>{(dialog === "revise" || phase === "requirements") && <Textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={6}/>}<DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={dialog === "revise" ? revise : generate} disabled={busy || ((dialog === "revise" || phase === "requirements") && !instruction.trim())}>{busy && <Loader2 className="h-4 w-4 animate-spin"/>}Continue</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ArtifactContent({ artifact }: { artifact: PhaseArtifact }) {
  if (artifact.structuredContent !== undefined && artifact.structuredContent !== null) return <pre className="max-h-144 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">{JSON.stringify(artifact.structuredContent, null, 2)}</pre>;
  return <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{artifact.content}</ReactMarkdown></div>;
}

function Readiness({ readiness }: { readiness: PhaseReadiness }) {
  const errors = readinessMessages(readiness.errors);
  return <Alert variant={readiness.ready ? "default" : "destructive"}>{readiness.ready ? <CheckCircle2 className="h-4 w-4"/> : <AlertCircle className="h-4 w-4"/>}<AlertTitle>{readiness.ready ? "Ready for approval" : "Not ready for approval"}</AlertTitle><AlertDescription>{errors.length ? <ul className="list-disc pl-4">{errors.map((item) => <li key={item}>{item}</li>)}</ul> : "Server validation passed."}</AlertDescription></Alert>;
}

function ImplementationView({ projectId, onStatesChange }: Pick<Props, "projectId" | "onStatesChange">) {
  const [board, setBoard] = useState<KanbanBoard | null>(null); const [repos, setRepos] = useState<ProjectRepository[]>([]);
  const [executions, setExecutions] = useState<Record<string, ImplementationExecution[]>>({}); const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(onStatesChange); useEffect(() => { callbackRef.current = onStatesChange; }, [onStatesChange]);
  const refresh = useCallback(async () => { const [nextBoard, nextRepos, states] = await Promise.all([projectApi.getKanbanBoard(projectId), projectApi.getRepositories(projectId), projectApi.getPhaseStates(projectId)]); setBoard(nextBoard); setRepos(nextRepos); callbackRef.current?.(states); }, [projectId]);
  useEffect(() => { refresh().catch((cause) => setError(messageOf(cause))).finally(() => setLoading(false)); }, [refresh]);
  const act = async (id: string, operation: () => Promise<unknown>) => { setBusyId(id); setError(null); try { await operation(); await refresh(); } catch (cause) { setError(messageOf(cause)); } finally { setBusyId(null); } };
  const tasks = board?.stages.flatMap((stage) => stage.tasks) ?? [];
  if (loading) return <div className="p-4"><Skeleton className="h-72"/></div>;
  return <div className="p-4 space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Implementation planning</h2><p className="text-sm text-muted-foreground">Architecture-derived tasks controlled by backend state and versions</p></div><Button disabled={busyId !== null} onClick={() => act("generate", () => projectApi.generateKanbanBoard(projectId))}><GitBranch className="h-4 w-4"/>Generate tasks</Button></div>
    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>Action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {tasks.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Approve Architecture, then generate implementation tasks.</CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{tasks.map((task) => <Card key={task.id}><CardHeader><div className="flex justify-between gap-2"><div><CardTitle className="text-base">{task.title}</CardTitle><CardDescription>{task.description}</CardDescription></div><Badge variant="outline">{task.implementationState ?? task.status}</Badge></div></CardHeader><CardContent className="space-y-3">
      <div><p className="text-xs font-medium">Acceptance criteria</p><ul className="list-disc pl-5 text-sm text-muted-foreground">{task.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <Select value={task.repositoryId ?? undefined} disabled={!['draft','changes_requested','failed'].includes(task.implementationState ?? '') || busyId === task.id} onValueChange={(repositoryId) => act(task.id, () => projectApi.updateImplementationTask(projectId, task.id, { expectedStateVersion: task.stateVersion, repositoryId }))}><SelectTrigger><SelectValue placeholder="Select repository before approval"/></SelectTrigger><SelectContent>{repos.map((repo) => <SelectItem key={repo.id} value={repo.id}>{repo.name} · {repo.role}</SelectItem>)}</SelectContent></Select>
      <div className="flex flex-wrap gap-2">{task.implementationState === "draft" && <Button disabled={busyId === task.id || !task.repositoryId} onClick={() => act(task.id, () => projectApi.approveImplementationTask(projectId, task.id, task.stateVersion))}>Approve task v{task.stateVersion}</Button>}{task.implementationState === "approved" && <Button disabled={busyId === task.id} onClick={() => act(task.id, () => projectApi.startImplementationExecution(projectId, task.id))}><Play className="h-4 w-4"/>Start execution</Button>}<Button variant="outline" disabled={busyId === task.id} onClick={() => act(task.id, async () => { const next = await projectApi.getImplementationExecutions(projectId, task.id); setExecutions((current) => ({ ...current, [task.id]: next })); })}>Refresh executions</Button></div>
      {(executions[task.id] ?? []).map((execution) => <div key={execution.id} className="rounded-md border p-3 text-sm"><div className="flex justify-between"><span>Execution {execution.id.slice(0, 8)}</span><Badge variant="outline">{execution.state}</Badge></div>{execution.diffSummary && <p className="mt-2 text-muted-foreground">{execution.diffSummary}</p>}{execution.changedFiles && <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{execution.changedFiles.map((file) => <li key={file}>{file}</li>)}</ul>}{execution.validationEvidence && <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(execution.validationEvidence, null, 2)}</pre>}{execution.state === "awaiting_review" && <div className="mt-3 space-y-2"><Textarea value={reviewComments[execution.id] ?? ""} onChange={(event) => setReviewComments((current) => ({ ...current, [execution.id]: event.target.value }))} placeholder="Required change-request comments" rows={3}/><Button variant="destructive" disabled={busyId === execution.id || !(reviewComments[execution.id] ?? "").trim()} onClick={() => act(execution.id, async () => { await projectApi.rejectImplementationExecution(projectId, task.id, execution.id, reviewComments[execution.id].trim()); const next = await projectApi.getImplementationExecutions(projectId, task.id); setExecutions((current) => ({ ...current, [task.id]: next })); })}>Request execution changes</Button><p className="text-xs text-muted-foreground">Owner acceptance is unavailable until the backend exposes the exact generated file contents required by its acceptance contract.</p></div>}</div>)}
    </CardContent></Card>)}</div>}
  </div>;
}

function LockedPhase({ phase }: { phase: WorkflowPhase }) { return <div className="p-4"><Card><CardHeader><CardTitle>{LABELS[phase]}</CardTitle><CardDescription>This phase is not exposed by the verified backend workflow yet.</CardDescription></CardHeader></Card></div>; }

function StatusBadge({ status }: { status: string }) { return <Badge variant="outline">{status.replaceAll("_", " ")}</Badge>; }
