"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, FileText, History, Loader2, MessageSquare, RefreshCw, Send, ShieldCheck, Upload, X } from "lucide-react";
import { ApiError, projectApi } from "@/lib/project-api";
import type { LiveBriefClaim, LiveBriefWorkspace, Project, ProjectFile, WorkflowRun } from "@/lib/types";
import { ProjectFileItem } from "./project-file-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function currentUserId(): string | null {
  try { return JSON.parse(localStorage.getItem("user") || "null")?.id ?? null; }
  catch { return null; }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return "The brief changed in another session. Latest state has been restored.";
  if (error instanceof ApiError && error.status === 401) return "Your session expired. Sign in again to continue.";
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export function ProjectBrief({ project, files, onUpload }: { project: Project; files: ProjectFile[]; onUpload: () => void }) {
  const [workspace, setWorkspace] = useState<LiveBriefWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [requirementsRun, setRequirementsRun] = useState<WorkflowRun | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (keepError = false) => {
    if (!keepError) setError(null);
    try {
      let data = await projectApi.getLiveBrief(project.id);
      if (!data.state) data = await projectApi.initializeLiveBrief(project.id);
      setWorkspace(data);
      setTitle(data.state?.currentBriefRevision?.title ?? `${project.name} Live Brief`);
      setMarkdown(data.state?.currentBriefRevision?.markdownContent ?? "");
      try {
        const runs = await projectApi.getWorkflowRuns(project.id);
        const reqRuns = runs.filter((r) => r.currentPhase === "requirements");
        if (reqRuns.length > 0) {
          reqRuns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
          setRequirementsRun(reqRuns[0]);
        }
      } catch {
        // Runs fetch failure should not block brief display
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [project.id, project.name]);

  useEffect(() => { setUserId(currentUserId()); void load(); }, [load]);

  useEffect(() => {
    if (!requirementsRun || !["running"].includes(requirementsRun.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await projectApi.getWorkflowRun(project.id, requirementsRun.id);
        setRequirementsRun(next);
      } catch { /* Keep last confirmed server state and allow manual retry. */ }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [project.id, requirementsRun]);

  const revision = workspace?.state?.currentBriefRevision;
  const isOwner = Boolean(userId && project.ownerId && userId === project.ownerId);
  const isCurrentRevisionConfirmed = Boolean(
    workspace?.state?.currentConfirmation &&
    revision &&
    workspace.state.currentConfirmation.briefRevisionId === revision.id
  );
  const readySources = useMemo(() => workspace?.sources.filter((source) => source.extractionStatus === "READY") ?? [], [workspace]);
  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);

  const perform = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await action(); await load(); }
    catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await load(true);
    }
    finally { setBusy(null); }
  };

  const send = () => perform("chat", async () => {
    const content = message.trim();
    if (!content) return;
    await projectApi.sendIntakeMessage(project.id, content, Array.from(selectedSources));
    setMessage("");
  });

  const save = () => revision && perform("save", () => projectApi.updateLiveBrief(project.id, {
    expectedRevisionNumber: revision.revisionNumber, title, markdownContent: markdown, changeSummary: "Edited in Project Brief",
  }));

  const decide = (claim: LiveBriefClaim, action: "ACCEPT" | "REJECT") => revision && perform(`claim:${claim.id}`, () =>
    projectApi.decideLiveBriefClaim(project.id, claim.id, { action, expectedRevisionNumber: revision.revisionNumber }));

  const generateRequirements = () => {
    const confirmation = workspace?.state?.currentConfirmation;
    if (!confirmation) return;
    void perform("requirements", async () => {
      const result = await projectApi.generateRequirements(project.id, confirmation.id);
      setRequirementsRun(result.run);
    });
  };

  if (loading) return <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading Project Brief…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="space-y-4 min-w-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="font-semibold">Source evidence</h2><p className="text-xs text-muted-foreground">Only READY sources can be selected for intake.</p></div>
                <Button size="sm" variant="outline" onClick={onUpload}><Upload className="h-3.5 w-3.5 mr-1" />Upload</Button>
              </div>
              {workspace?.sources.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {workspace.sources.map((source) => {
                    const file = fileById.get(source.projectFileId);
                    const checked = selectedSources.has(source.id);
                    return <div key={source.id} className="rounded-lg border p-2 space-y-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={checked} disabled={source.extractionStatus !== "READY"} onChange={() => setSelectedSources((prior) => {
                          const next = new Set(prior); checked ? next.delete(source.id) : next.add(source.id); return next;
                        })} />
                        <span className="truncate flex-1">{source.originalFilename}</span>
                        <Badge variant={source.extractionStatus === "READY" ? "default" : "secondary"}>{source.extractionStatus}</Badge>
                      </label>
                      {file && <ProjectFileItem file={file} projectId={project.id} onDeleteClick={() => undefined} />}
                    </div>;
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground">No extracted source documents yet. Idea-only intake is supported.</p>}
              {readySources.length > 0 && <p className="text-xs text-muted-foreground">{selectedSources.size} of {readySources.length} READY sources selected.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div><h2 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" />Intake conversation</h2><p className="text-xs text-muted-foreground">AI output is saved as a proposal and never self-approves.</p></div>
              <div className="max-h-80 overflow-y-auto space-y-2 rounded-lg bg-muted/30 p-3">
                {workspace?.messages.length ? workspace.messages.map((item) => (
                  <div key={item.id} className={`rounded-lg px-3 py-2 text-sm ${item.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 border bg-card"}`}>
                    <p className="text-[10px] uppercase opacity-70 mb-1">{item.role}</p>{item.content}
                  </div>
                )) : <p className="py-8 text-center text-sm text-muted-foreground">Describe the project idea or ask the assistant to discuss selected evidence.</p>}
              </div>
              <div className="flex gap-2"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe your goal, users, workflows, or source conflicts…" rows={3} /><Button aria-label="Send intake message" onClick={send} disabled={busy === "chat" || !message.trim()}>{busy === "chat" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold">Clarifications & proposed claims</h2>
              {workspace?.questions.filter((item) => item.status === "OPEN").map((question) => (
                <div key={question.id} className="rounded-lg border p-3 space-y-2"><p className="text-sm font-medium">{question.question}</p><div className="flex gap-2"><Input value={answers[question.id] ?? ""} onChange={(event) => setAnswers((prior) => ({ ...prior, [question.id]: event.target.value }))} placeholder="Your authoritative answer" /><Button size="sm" disabled={!revision || !answers[question.id]?.trim()} onClick={() => revision && perform(`question:${question.id}`, () => projectApi.answerLiveBriefQuestion(project.id, question.id, answers[question.id], revision.revisionNumber))}>Answer</Button></div></div>
              ))}
              {workspace?.claims.filter((claim) => claim.status === "PROPOSED").map((claim) => (
                <div key={claim.id} className="rounded-lg border p-3 space-y-2"><div className="flex items-start justify-between gap-2"><div><Badge variant="outline">{claim.category.replace(/_/g, " ")}</Badge><p className="font-medium text-sm mt-2">{claim.title}</p></div><Badge variant="secondary">Proposal</Badge></div><p className="text-sm text-muted-foreground">{claim.content}</p>{claim.sourceSpanIds.length > 0 && <p className="text-xs text-muted-foreground">Citations: {claim.sourceSpanIds.length} verified span(s)</p>}<div className="flex gap-2"><Button size="sm" onClick={() => decide(claim, "ACCEPT")} disabled={!revision || busy === `claim:${claim.id}`}><Check className="h-3.5 w-3.5 mr-1" />Accept</Button><Button size="sm" variant="outline" onClick={() => decide(claim, "REJECT")} disabled={!revision || busy === `claim:${claim.id}`}><X className="h-3.5 w-3.5 mr-1" />Reject</Button></div></div>
              ))}
              {!workspace?.questions.some((item) => item.status === "OPEN") && !workspace?.claims.some((item) => item.status === "PROPOSED") && <p className="text-sm text-muted-foreground">No open proposals or clarification questions.</p>}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4 min-w-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Editable Live Brief</h2><p className="text-xs text-muted-foreground">Revision {revision?.revisionNumber ?? "—"} · {revision?.contentHash.slice(0, 12) ?? "no hash"}</p></div><Button size="sm" onClick={save} disabled={!revision || busy === "save" || !title.trim() || !markdown.trim()}>{busy === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Save revision</Button></div>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Brief title" />
              <Textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} rows={18} className="font-mono text-sm" aria-label="Live Brief markdown" />
              <div className="grid gap-2 sm:grid-cols-2">
                {(["GOAL", "USER_PERSONA", "WORKFLOW", "SCOPE_IN", "SCOPE_OUT", "CONSTRAINT", "ACCEPTANCE_CRITERION"] as const).map((category) => {
                  const accepted = workspace?.claims.filter((claim) => claim.category === category && claim.status === "ACCEPTED") ?? [];
                  return <div key={category} className="rounded-lg border p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">{category.replace(/_/g, " ")}</p>{accepted.length ? accepted.map((claim) => <p key={claim.id} className="text-sm mt-1">{claim.content}</p>) : <p className="text-xs mt-1 text-muted-foreground">Not accepted yet</p>}</div>;
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Readiness</h2><Badge variant={workspace?.readiness.ready ? "default" : "destructive"}>{workspace?.readiness.ready ? "Ready" : "Blocked"}</Badge></div>
              {workspace?.readiness.blockers.map((item) => <div key={item.code} className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{item.message}</div>)}
              {workspace?.readiness.warnings.map((item) => <div key={item.code} className="flex gap-2 text-sm text-amber-600"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{item.message}</div>)}
              {workspace?.readiness.ready && <div className="flex gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />All deterministic confirmation gates are satisfied.</div>}
            </CardContent>
          </Card>

          {(workspace?.contradictions.length ?? 0) > 0 && <Card><CardContent className="p-4 space-y-3"><h2 className="font-semibold">Contradictions</h2>{workspace?.contradictions.map((item) => <div key={item.id} className="rounded-lg border p-3 space-y-2"><div className="flex justify-between"><p className="text-sm">{item.description}</p><Badge variant={item.status === "ACTIVE" ? "destructive" : "secondary"}>{item.status}</Badge></div>{item.status === "ACTIVE" && <div className="flex gap-2"><Input value={resolutions[item.id] ?? ""} onChange={(event) => setResolutions((prior) => ({ ...prior, [item.id]: event.target.value }))} placeholder="Resolution decision" /><Button size="sm" disabled={!revision || !resolutions[item.id]?.trim()} onClick={() => revision && perform(`contradiction:${item.id}`, () => projectApi.resolveLiveBriefContradiction(project.id, item.id, resolutions[item.id], revision.revisionNumber))}>Resolve</Button></div>}</div>)}</CardContent></Card>}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Authority handoff</h2>
              {isCurrentRevisionConfirmed ? (
                <p className="text-sm text-emerald-600">Revision {workspace?.state?.currentConfirmation?.briefRevisionNumber} is owner-confirmed with exact hash.</p>
              ) : workspace?.state?.currentConfirmation ? (
                <p className="text-sm text-amber-600">Revision {workspace.state.currentConfirmation.briefRevisionNumber} is confirmed, but Revision {revision?.revisionNumber} requires owner confirmation.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Only the project owner can confirm the exact current revision.</p>
              )}
              {!isCurrentRevisionConfirmed && (
                <Button disabled={!isOwner || !workspace?.readiness.ready || !revision || busy === "confirm"} onClick={() => revision && perform("confirm", () => projectApi.confirmLiveBrief(project.id, revision.id, revision.contentHash))}>
                  {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                  Confirm exact revision
                </Button>
              )}
              {!isOwner && <p className="text-xs text-muted-foreground">Confirmation is restricted to the project owner.</p>}
              <Button className="w-full" disabled={!workspace?.state?.currentConfirmation || busy === "requirements" || requirementsRun?.status === "running"} onClick={generateRequirements}>{busy === "requirements" || requirementsRun?.status === "running" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}Generate Requirements from confirmed brief</Button>
              {requirementsRun && <div className="flex items-center gap-2 rounded-lg border p-3 text-sm"><Clock3 className="h-4 w-4" /><span>Workflow run {requirementsRun.id.slice(0, 8)}</span><Badge variant={requirementsRun.status === "completed" ? "default" : requirementsRun.status === "failed" ? "destructive" : "secondary"}>{requirementsRun.status}</Badge></div>}
            </CardContent>
          </Card>

          <Card><CardContent className="p-4 space-y-2"><h2 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" />Revision history</h2>{workspace?.revisions.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 border-b py-2 last:border-0"><div><p className="text-sm font-medium">Revision {item.revisionNumber}</p><p className="text-xs text-muted-foreground">{item.changeSummary}</p></div><code className="text-[10px] text-muted-foreground">{item.contentHash.slice(0, 10)}</code></div>)}</CardContent></Card>
        </section>
      </div>
    </div>
  );
}
