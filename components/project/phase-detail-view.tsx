"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  HelpCircle,
  History,
  Loader2,
  Play,
  Sparkles,
  GitCompare,
  RefreshCw,
  Lock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { projectApi } from "@/lib/project-api";
import type {
  ImplementationExecution,
  KanbanBoard,
  PhaseApproval,
  PhaseArtifact,
  PhaseReadiness,
  Project,
  ProjectPhaseState,
  ProjectRepository,
  WorkflowPhase,
  WorkflowRun,
  LiveBriefWorkspace,
} from "@/lib/types";
import { RequirementsItemReview } from "./planning/requirements-item-review";
import { DocumentationItemReview } from "./planning/documentation-item-review";
import { ArchitectureItemReview } from "./planning/architecture-item-review";
import { ArtifactVersionDiffDialog } from "./planning/artifact-version-diff-dialog";

const LABELS: Record<WorkflowPhase, string> = {
  requirements: "Requirements",
  documentation: "Documentation",
  architecture: "Architecture",
  implementation: "Implementation",
  testing: "Testing",
  review: "Review",
};

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const details = (error as any).details;
    if (details && typeof details === "object") {
      try {
        const str = JSON.stringify(details);
        if (str !== "{}") {
          return `${error.message} (${str})`;
        }
      } catch {}
    }
    return error.message;
  }
  return "The request failed. Please try again.";
}

function readinessMessages(items: unknown[]): string[] {
  return (items ?? []).map((item: any) =>
    typeof item === "string" ? item : item?.message || item?.code || item?.path || "Validation failed"
  );
}

interface Props {
  projectId: string;
  phase: WorkflowPhase;
  project?: Project;
  activeTab?: string;
  onStatesChange?: (states: ProjectPhaseState[]) => void;
  onNavigateTab?: (tab: string) => void;
}

export function PhaseDetailView({ projectId, phase, project, activeTab, onStatesChange, onNavigateTab }: Props) {
  if (phase === "implementation") return <ImplementationView projectId={projectId} onStatesChange={onStatesChange} />;
  if (phase === "testing" || phase === "review") return <LockedPhase phase={phase} />;
  return (
    <PlanningPhaseView
      projectId={projectId}
      phase={phase}
      project={project}
      activeTab={activeTab}
      onStatesChange={onStatesChange}
      onNavigateTab={onNavigateTab}
    />
  );
}

function PlanningPhaseView({ projectId, phase, project, activeTab, onStatesChange, onNavigateTab }: Props) {
  const [phaseState, setPhaseState] = useState<ProjectPhaseState | null>(null);
  const [artifacts, setArtifacts] = useState<PhaseArtifact[]>([]);
  const [approvals, setApprovals] = useState<PhaseApproval[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [readiness, setReadiness] = useState<PhaseReadiness | null>(null);
  const [briefWorkspace, setBriefWorkspace] = useState<LiveBriefWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"generate" | "revise" | null>(null);
  const [instruction, setInstruction] = useState("");
  const [comment, setComment] = useState("");

  // Diff dialog state
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffBaseId, setDiffBaseId] = useState<string | undefined>(undefined);
  const [diffCompareId, setDiffCompareId] = useState<string | undefined>(undefined);

  const callbackRef = useRef(onStatesChange);
  useEffect(() => {
    callbackRef.current = onStatesChange;
  }, [onStatesChange]);

  const refresh = useCallback(async () => {
    const [states, nextArtifacts, nextApprovals, nextRuns, nextBrief] = await Promise.all([
      projectApi.getPhaseStates(projectId),
      projectApi.getPhaseArtifacts(projectId, phase),
      projectApi.getPhaseApprovals(projectId, phase),
      projectApi.getWorkflowRuns(projectId),
      projectApi.getLiveBrief(projectId).catch(() => null),
    ]);
    const latest = nextArtifacts[0];
    let nextReadiness: PhaseReadiness | null = null;
    if (latest?.contentHash && (phase === "requirements" || phase === "architecture")) {
      nextReadiness = await projectApi.getPhaseReadiness(projectId, phase, latest.id, latest.contentHash).catch(() => null);
    }
    setPhaseState(states.find((state) => state.phase === phase) ?? null);
    setArtifacts(nextArtifacts);
    setApprovals(nextApprovals);
    setRuns(nextRuns.filter((run) => run.currentPhase === phase));
    setReadiness(nextReadiness);
    setBriefWorkspace(nextBrief);
    callbackRef.current?.(states);
    return { latest, readiness: nextReadiness };
  }, [phase, projectId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    refresh()
      .catch((cause) => mounted && setError(messageOf(cause)))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (activeTab === "workflow") {
      refresh().catch(() => {});
    }
  }, [activeTab, refresh]);

  // Track runs and notify when an in-flight run completes or fails
  const prevRunsRef = useRef<WorkflowRun[]>([]);
  useEffect(() => {
    const prev = prevRunsRef.current;
    if (prev.length > 0) {
      runs.forEach((run) => {
        const prevRun = prev.find((p) => p.id === run.id);
        if (prevRun && prevRun.status === "running" && run.status === "failed") {
          const err = getRunErrorDetails(run);
          console.error(`[Generation Run Failed] Run ID: ${run.id}, Error:`, err);
          toast({
            title: "Generation Run Failed",
            description: err?.message || "Generation run failed.",
            variant: "destructive",
          });
        }
      });
    }
    prevRunsRef.current = runs;
  }, [runs]);

  // Poll while any workflow run is in flight (persisted run updates)
  useEffect(() => {
    const hasRunningRun = runs.some((r) => r.status === "running");
    if (!hasRunningRun) return;

    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, 2500);

    return () => clearInterval(interval);
  }, [runs, refresh]);

  const latest = artifacts[0];
  const status = phaseState?.status ?? "not_started";
  const approved = status === "approved" || status === "completed";
  const isStale = Boolean(phaseState?.isStale);
  const staleReason = phaseState?.staleReason;
  const exactHash = latest?.contentHash;
  const canSubmit = Boolean(latest && exactHash && (phase === "documentation" || readiness?.ready) && !isStale);

  const structured = latest?.structuredContent as any;
  const unresolvedQuestions: Array<{ id: string; question: string }> =
    Array.isArray(structured?.unresolvedQuestions) ? structured.unresolvedQuestions : [];

  const handleAnswerAllQuestions = () => {
    if (unresolvedQuestions.length === 0) return;
    const isArch = phase === "architecture";
    const isDoc = phase === "documentation";
    const phaseLabel = isArch ? "Architecture" : isDoc ? "Documentation" : "Requirements";
    const updatesLabel = isArch
      ? "Please update all related component, interface, and architecture designs without altering approved Requirements or Documentation decisions, and remove these resolved questions from unresolvedQuestions so the artifact can be approved."
      : isDoc
      ? "Please update all related documentation sections and specifications without altering approved Requirements, and remove these resolved questions from unresolvedQuestions so the artifact can be approved."
      : "Please update all related requirements and acceptance criteria, and remove these resolved questions from unresolvedQuestions so the artifact can be approved.";

    const formatted = [
      `Please resolve the following unresolved questions and incorporate the answers into the ${phaseLabel}:`,
      "",
      ...unresolvedQuestions.map((q, idx) => `${idx + 1}. [${q.id}]: ${q.question}\nAnswer: `),
      "",
      updatesLabel,
    ].join("\n");
    setInstruction(formatted);
    setDialog("revise");
    toast({
      title: "Questions Template Loaded",
      description: "Fill in your answers or instructions for the questions below, then submit revision.",
    });
  };

  const handleResolveWithDefaults = () => {
    const isArch = phase === "architecture";
    const isDoc = phase === "documentation";
    const phaseLabel = isArch ? "Architecture" : isDoc ? "Documentation" : "Requirements";
    const decisionsLabel = isArch
      ? "Document all decisions clearly in the appropriate component, interface, and data designs without altering approved Requirements or Documentation decisions."
      : isDoc
      ? "Document all decisions clearly in the appropriate functional and technical specifications without altering approved Requirements."
      : "Document all decisions clearly in the appropriate functional requirements, non-functional requirements, and assumptions.";

    const formatted = [
      "Please resolve all remaining unresolved questions by applying sensible, industry-standard defaults for our application.",
      decisionsLabel,
      `Remove all resolved items from unresolvedQuestions so that the ${phaseLabel} artifact satisfies all readiness criteria for approval.`,
    ].join("\n");
    setInstruction(formatted);
    setDialog("revise");
    toast({
      title: "Default Resolution Template Loaded",
      description: "Review the instruction and click 'Submit Revision' to let AI resolve all open questions.",
    });
  };

  const mutate = async (
    operation: () => Promise<unknown>,
    meta?: {
      successTitle?: string;
      successDescription?: string;
      isRevision?: boolean;
    }
  ) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      const updated = await refresh();
      if (meta?.successTitle) {
        const nextArtifact = updated?.latest;
        const nextReadiness = updated?.readiness;
        const nextQuestions = Array.isArray((nextArtifact?.structuredContent as any)?.unresolvedQuestions)
          ? ((nextArtifact?.structuredContent as any)?.unresolvedQuestions as any[])
          : [];

        if (nextReadiness?.ready) {
          toast({
            title: meta.isRevision ? "Revision Created & Ready!" : "Artifact Ready!",
            description: `Artifact v${nextArtifact?.version ?? 1} is validated and ready for approval.`,
          });
        } else if (nextQuestions.length > 0) {
          toast({
            title: meta.isRevision ? "Revision Created (Open Questions)" : "Artifact Generated (Open Questions)",
            description: `Artifact v${nextArtifact?.version ?? 1} created, but ${nextQuestions.length} unresolved question(s) remain to be answered before approval.`,
          });
        } else {
          toast({
            title: meta.successTitle,
            description: meta.successDescription ?? "Operation completed successfully.",
          });
        }
      }
    } catch (cause) {
      console.error(`[PhaseDetailView] Action failed for phase ${phase}:`, cause);
      if (cause && typeof cause === "object" && "details" in cause) {
        console.error(`[PhaseDetailView] Error details for phase ${phase}:`, (cause as any).details);
      }
      const msg = messageOf(cause);
      setError(msg);
      toast({
        title: "Action Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // Active brief inspection
  const activeConfirmation = briefWorkspace?.state?.currentConfirmation;
  const activeBriefRevision = briefWorkspace?.state?.currentBriefRevision;
  const hasActiveBrief = Boolean(activeConfirmation && activeConfirmation.status === "ACTIVE");

  // Role-awareness inspection
  const currentUser = typeof window !== "undefined"
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem("user") || "null");
        } catch {
          return null;
        }
      })()
    : null;
  const projectOwnerId = project?.userId || project?.ownerId;
  const currentUserId = currentUser?.id;
  const isOwner = Boolean(projectOwnerId && currentUserId && projectOwnerId === currentUserId);

  const generate = () =>
    mutate(async () => {
      toast({
        title: "Generating Artifact...",
        description: `Starting AI generation for ${LABELS[phase]} phase.`,
      });
      if (phase === "requirements") {
        if (!activeConfirmation?.id) {
          throw new Error("No active Live Brief confirmation found. Please confirm the brief in the Project Brief tab.");
        }
        await projectApi.generateRequirements(projectId, activeConfirmation.id);
      } else if (phase === "documentation") {
        await projectApi.generateDocumentation(projectId);
      } else {
        await projectApi.generateArchitecture(projectId);
      }
      setInstruction("");
      setDialog(null);
    }, {
      successTitle: "Artifact Generated",
      successDescription: `${LABELS[phase]} artifact generated successfully.`,
    });

  const revise = () =>
    mutate(async () => {
      if (!latest || !instruction.trim()) throw new Error("Enter a revision instruction.");
      toast({
        title: "Submitting Revision...",
        description: "AI is processing your revision instructions...",
      });
      await projectApi.revisePhaseArtifact(
        projectId,
        phase as "requirements" | "documentation" | "architecture",
        latest,
        instruction.trim()
      );
      setInstruction("");
      setDialog(null);
    }, {
      successTitle: "Revision Created",
      isRevision: true,
    });

  const recoverStale = () =>
    mutate(async () => {
      if (phase === "requirements") {
        if (!activeConfirmation?.id) {
          throw new Error("Cannot recover Requirements: No active Live Brief confirmation found. Please confirm the brief in the Project Brief tab.");
        }
        await projectApi.generateRequirements(projectId, activeConfirmation.id);
      } else if (phase === "documentation") {
        if (!latest) {
          throw new Error("Cannot recover Documentation: No existing artifact found to rebase.");
        }
        await projectApi.rebaseDocumentation(projectId, latest);
      } else if (phase === "architecture") {
        if (!latest) {
          throw new Error("Cannot recover Architecture: No existing artifact found to rebase.");
        }
        await projectApi.rebaseArchitecture(projectId, latest);
      }
    }, {
      successTitle: "Phase Rebased",
      successDescription: `${LABELS[phase]} rebased successfully.`,
    });

  if (loading) {
    return (
      <div className="p-4 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-4 grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {/* Phase Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{LABELS[phase]}</h2>
            <p className="text-sm text-muted-foreground">Authoritative backend planning workflow</p>
          </div>
          <div className="flex items-center gap-2">
            {isStale && <Badge variant="destructive">Stale Authority</Badge>}
            <StatusBadge status={status} isStale={isStale} />
          </div>
        </div>

        {/* Stale Authority Warning and Interactive Recovery */}
        {isStale && (
          <Alert variant="destructive" className="border-rose-500/30 bg-rose-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold">Stale Authority Warning</AlertTitle>
            <AlertDescription className="space-y-2 mt-1">
              <p className="text-sm leading-relaxed">
                {staleReason ?? "Upstream authority has been superseded by newer confirmed requirements or brief."}
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {phase === "requirements" ? (
                  hasActiveBrief ? (
                    <Button
                      size="sm"
                      onClick={recoverStale}
                      disabled={busy}
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Regenerate from Confirmed Brief Rev #{activeBriefRevision?.revisionNumber ?? 1}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigateTab?.("project-brief")}
                      className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                      Open Project Brief to Confirm Scope
                    </Button>
                  )
                ) : phase === "documentation" ? (
                  <Button
                    size="sm"
                    onClick={recoverStale}
                    disabled={busy}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Rebase Documentation to Current Requirements
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={recoverStale}
                    disabled={busy}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Rebase Architecture to Current Authorities
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Artifact Review Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{latest?.title ?? `${LABELS[phase]} artifact`}</CardTitle>
                <CardDescription>
                  {latest
                    ? `Version ${latest.version} · ${latest.lifecycleStatus ?? "DRAFT"} ${
                        latest.contentHash ? `· Hash ${latest.contentHash.slice(0, 10)}...` : ""
                      }`
                    : "No artifact has been generated."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {latest && approved && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInstruction("");
                      setDialog("revise");
                    }}
                    disabled={busy}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Revise with AI
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setInstruction("");
                    setDialog("generate");
                  }}
                  disabled={busy || (approved && !isStale) || (isStale && phase !== "requirements")}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Generate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {latest ? (
              <ArtifactContent artifact={latest} />
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                <p>Generate the first {LABELS[phase].toLowerCase()} artifact to begin review.</p>
                {phase === "requirements" && !hasActiveBrief && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onNavigateTab?.("project-brief")}
                    className="text-primary text-xs"
                  >
                    Confirm Live Brief in Project Brief tab first →
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unresolved Questions Attention Banner */}
        {latest && !approved && unresolvedQuestions.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-500">
                  <HelpCircle className="h-4 w-4" />
                  {unresolvedQuestions.length} Unresolved Question{unresolvedQuestions.length > 1 ? "s" : ""}
                </CardTitle>
                <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-xs">
                  Approval Blocker
                </Badge>
              </div>
              <CardDescription className="text-xs">
                The AI identified questions that need to be answered or clarified before {LABELS[phase].toLowerCase()} can be approved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs"
                  onClick={handleAnswerAllQuestions}
                  disabled={busy}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Answer Questions with AI
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  onClick={handleResolveWithDefaults}
                  disabled={busy}
                >
                  Resolve with Sensible Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review & Approval Card */}
        {latest && !approved && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review and approval</CardTitle>
              <CardDescription>
                All decisions are bound to artifact v{latest.version} ({latest.id}) and verified server content hash.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {readiness && <Readiness readiness={readiness} />}
              {phase === "documentation" && (
                <p className="text-xs text-muted-foreground">
                  Documentation completeness is validated before approval is granted.
                </p>
              )}
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Required when requesting changes; optional for approval"
                rows={3}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setInstruction("");
                    setDialog("revise");
                  }}
                  disabled={busy}
                >
                  Revise with AI
                </Button>
                {status === "awaiting_approval" ? (
                  <>
                    {isOwner ? (
                      <Button
                        disabled={busy || !exactHash}
                        onClick={() =>
                          mutate(
                            () =>
                              projectApi.approvePhase(projectId, phase, latest.id, exactHash!, comment.trim() || undefined),
                            {
                              successTitle: "Artifact Approved!",
                              successDescription: `${LABELS[phase]} v${latest.version} has been approved.`,
                            }
                          )
                        }
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Approve
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button disabled variant="outline" title="Only project owner can approve artifacts">
                          <Lock className="h-3.5 w-3.5 mr-1" />
                          Approve (Owner only)
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Only the project owner can approve artifacts.
                        </span>
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      disabled={busy || !exactHash || !comment.trim()}
                      onClick={() =>
                        mutate(
                          () =>
                            projectApi.requestPhaseChanges(projectId, phase, latest.id, exactHash!, comment.trim()),
                          {
                            successTitle: "Changes Requested",
                            successDescription: "Feedback submitted for revisions.",
                          }
                        )
                      }
                    >
                      Request changes
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={busy || !canSubmit}
                    onClick={() =>
                      mutate(
                        () => projectApi.requestPhaseApproval(projectId, phase, latest.id, exactHash!),
                        {
                          successTitle: "Submitted for Approval",
                          successDescription: `Artifact v${latest.version} is now awaiting review.`,
                        }
                      )
                    }
                  >
                    Submit for approval
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar: Version History, Decisions, Runs */}
      <div className="space-y-4">
        {/* Version History with Comparison */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Version history
            </CardTitle>
            {artifacts.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setDiffBaseId(artifacts[1]?.id);
                  setDiffCompareId(artifacts[0]?.id);
                  setDiffOpen(true);
                }}
              >
                <GitCompare className="h-3.5 w-3.5 mr-1" /> Compare
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {artifacts.length ? (
              artifacts.map((artifact, idx) => (
                <div key={artifact.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0">
                  <div className="truncate mr-2">
                    <span className="font-medium text-xs truncate block">{artifact.title}</span>
                    <span className="text-[11px] text-muted-foreground block">
                      {new Date(artifact.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-xs">v{artifact.version}</Badge>
                    {idx < artifacts.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setDiffBaseId(artifacts[idx + 1].id);
                          setDiffCompareId(artifact.id);
                          setDiffOpen(true);
                        }}
                        title="Compare with predecessor"
                      >
                        <GitCompare className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No versions yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Decision Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvals.length ? (
              approvals.map((approval) => (
                <div key={approval.id} className="text-sm p-2 rounded border bg-card/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant={approval.decision === "approved" ? "default" : "secondary"}>
                      {approval.decision.replaceAll("_", " ")}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(approval.approvedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {approval.comments && <p className="text-xs text-muted-foreground">{approval.comments}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No decisions yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Generation Runs */}
        {runs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generation runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.slice(0, 5).map((run) => {
                const err = getRunErrorDetails(run);
                return (
                  <div key={run.id} className="text-xs py-2 border-b last:border-b-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="truncate mr-2">
                        <span className="font-mono text-[11px] block">{run.operation || run.triggerType}</span>
                        <span className="text-[10px] text-muted-foreground">{run.id.slice(0, 16)}...</span>
                      </div>
                      <Badge
                        variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {run.status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />}
                        {run.status}
                      </Badge>
                    </div>
                    {err && (
                      <div className="bg-destructive/10 text-destructive text-[11px] rounded px-2 py-1 mt-1 space-y-0.5">
                        <div className="font-medium">{err.message}</div>
                        {err.details && (
                          <div className="text-[10px] opacity-80 font-mono break-all whitespace-pre-wrap max-h-32 overflow-y-auto" title={err.details}>
                            {err.details}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Generation & Revision Dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-3xl w-full max-h-[85vh] flex flex-col p-6 overflow-hidden gap-0">
          <DialogHeader className="shrink-0 pb-3 border-b">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {dialog === "revise" ? `Revise ${LABELS[phase]} Artifact` : `Generate ${LABELS[phase]} Artifact`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {dialog === "revise"
                ? "Provide your answers or guidance. AI will produce a revised version and resolve open questions."
                : phase === "requirements"
                ? "Requirements authority is strictly derived from the confirmed Live Brief."
                : "The backend will generate the draft from the currently approved upstream artifact."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-3 space-y-3 pr-1">
            {dialog === "generate" && phase === "requirements" ? (
              <div className="space-y-4 py-1">
                {!hasActiveBrief ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Confirmed Brief Required</AlertTitle>
                    <AlertDescription className="space-y-2 mt-1">
                      <p className="text-xs">
                        No active confirmed Live Brief exists for this project. Requirements authority requires an intake confirmation.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDialog(null);
                          onNavigateTab?.("project-brief");
                        }}
                        className="mt-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Go to Project Brief
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3 p-3.5 rounded-lg border bg-card/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Confirmed Live Brief Rev #{activeBriefRevision?.revisionNumber ?? 1}
                      </span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                        ACTIVE AUTHORITY
                      </Badge>
                    </div>
                    {activeBriefRevision?.title && (
                      <p className="text-muted-foreground">{activeBriefRevision.title}</p>
                    )}
                    <div className="pt-1 font-mono text-[10px] text-muted-foreground space-y-0.5 border-t">
                      <p>Confirmation: {activeConfirmation?.id}</p>
                      {activeConfirmation?.briefContentHash && (
                        <p>Content Hash: {activeConfirmation.briefContentHash.slice(0, 20)}...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : dialog === "revise" ? (
              <div className="space-y-3">
                {unresolvedQuestions.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5" />
                        {unresolvedQuestions.length} Open Question{unresolvedQuestions.length > 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10 px-2"
                          onClick={handleAnswerAllQuestions}
                        >
                          Paste Questions
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-6 text-[11px] px-2"
                          onClick={handleResolveWithDefaults}
                        >
                          Use Sensible Defaults
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Tip: Answer the open questions below or instruct the AI to resolve them so the artifact is ready for approval.
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Revision Instructions & Answers:
                  </label>
                  <Textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder="Enter revision instructions or answers to open questions..."
                    className="min-h-[240px] max-h-[400px] text-xs font-mono leading-relaxed resize-y"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t mt-2 flex items-center justify-between sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={dialog === "revise" ? revise : generate}
              disabled={
                busy ||
                (dialog === "revise" && !instruction.trim()) ||
                (dialog === "generate" && phase === "requirements" && !hasActiveBrief)
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {dialog === "revise" ? "Submit Revision" : "Generate Artifact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Diff Dialog */}
      <ArtifactVersionDiffDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        projectId={projectId}
        phase={phase}
        artifacts={artifacts}
        initialBaseId={diffBaseId}
        initialCompareId={diffCompareId}
      />
    </div>
  );
}

function ArtifactContent({ artifact }: { artifact: PhaseArtifact }) {
  if (artifact.structuredContent !== undefined && artifact.structuredContent !== null) {
    if (artifact.phase === "requirements") {
      return <RequirementsItemReview content={artifact.structuredContent as any} />;
    }
    if (artifact.phase === "documentation") {
      return <DocumentationItemReview content={artifact.structuredContent as any} />;
    }
    if (artifact.phase === "architecture") {
      return <ArchitectureItemReview content={artifact.structuredContent as any} />;
    }
    return (
      <pre className="max-h-144 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs font-mono">
        {JSON.stringify(artifact.structuredContent, null, 2)}
      </pre>
    );
  }
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{artifact.content}</ReactMarkdown>
    </div>
  );
}

function Readiness({ readiness }: { readiness: PhaseReadiness }) {
  const items = (readiness.blockers && (readiness.blockers as any[]).length > 0)
    ? (readiness.blockers as any[])
    : (readiness.errors && readiness.errors.length > 0)
      ? readiness.errors
      : [];
  const errors = readinessMessages(items);
  return (
    <Alert variant={readiness.ready ? "default" : "destructive"}>
      {readiness.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <AlertTitle>{readiness.ready ? "Ready for approval" : "Not ready for approval"}</AlertTitle>
      <AlertDescription>
        {errors.length ? (
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : readiness.ready ? (
          "Server validation passed."
        ) : (
          "Pre-approval validation requirements not met."
        )}
      </AlertDescription>
    </Alert>
  );
}

function ImplementationView({ projectId, onStatesChange }: Pick<Props, "projectId" | "onStatesChange">) {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [repos, setRepos] = useState<ProjectRepository[]>([]);
  const [executions, setExecutions] = useState<Record<string, ImplementationExecution[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(onStatesChange);
  useEffect(() => {
    callbackRef.current = onStatesChange;
  }, [onStatesChange]);

  const refresh = useCallback(async () => {
    const [nextBoard, nextRepos, states] = await Promise.all([
      projectApi.getKanbanBoard(projectId),
      projectApi.getRepositories(projectId),
      projectApi.getPhaseStates(projectId),
    ]);
    setBoard(nextBoard);
    setRepos(nextRepos);
    callbackRef.current?.(states);
  }, [projectId]);

  useEffect(() => {
    refresh()
      .catch((cause) => setError(messageOf(cause)))
      .finally(() => setLoading(false));
  }, [refresh]);

  const act = async (id: string, operation: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await operation();
      await refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusyId(null);
    }
  };

  const tasks = board?.stages.flatMap((stage) => stage.tasks) ?? [];

  if (loading) {
    return (
      <div className="p-4">
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Implementation planning</h2>
          <p className="text-sm text-muted-foreground">Architecture-derived tasks controlled by backend state and versions</p>
        </div>
        <Button disabled={busyId !== null} onClick={() => act("generate", () => projectApi.generateKanbanBoard(projectId))}>
          <GitBranch className="h-4 w-4 mr-1.5" />
          Generate tasks
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Approve Architecture, then generate implementation tasks.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    <CardDescription>{task.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{task.implementationState ?? task.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium">Acceptance criteria</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {task.acceptanceCriteria.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <Select
                  value={task.repositoryId ?? undefined}
                  disabled={!["draft", "changes_requested", "failed"].includes(task.implementationState ?? "") || busyId === task.id}
                  onValueChange={(repositoryId) =>
                    act(task.id, () =>
                      projectApi.updateImplementationTask(projectId, task.id, {
                        expectedStateVersion: task.stateVersion,
                        repositoryId,
                      })
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select repository before approval" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id}>
                        {repo.name} · {repo.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                  {task.implementationState === "draft" && (
                    <Button
                      disabled={busyId === task.id || !task.repositoryId}
                      onClick={() =>
                        act(task.id, () =>
                          projectApi.approveImplementationTask(projectId, task.id, task.stateVersion)
                        )
                      }
                    >
                      Approve task v{task.stateVersion}
                    </Button>
                  )}
                  {task.implementationState === "approved" && (
                    <Button
                      disabled={busyId === task.id}
                      onClick={() => act(task.id, () => projectApi.startImplementationExecution(projectId, task.id))}
                    >
                      <Play className="h-4 w-4 mr-1.5" />
                      Start execution
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={busyId === task.id}
                    onClick={() =>
                      act(task.id, async () => {
                        const next = await projectApi.getImplementationExecutions(projectId, task.id);
                        setExecutions((current) => ({ ...current, [task.id]: next }));
                      })
                    }
                  >
                    Refresh executions
                  </Button>
                </div>
                {(executions[task.id] ?? []).map((execution) => (
                  <div key={execution.id} className="rounded-md border p-3 text-sm">
                    <div className="flex justify-between">
                      <span>Execution {execution.id.slice(0, 8)}</span>
                      <Badge variant="outline">{execution.state}</Badge>
                    </div>
                    {execution.diffSummary && (
                      <p className="mt-2 text-muted-foreground">{execution.diffSummary}</p>
                    )}
                    {execution.changedFiles && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                        {execution.changedFiles.map((file) => (
                          <li key={file}>{file}</li>
                        ))}
                      </ul>
                    )}
                    {execution.validationEvidence && (
                      <pre className="mt-2 overflow-auto text-xs font-mono">
                        {JSON.stringify(execution.validationEvidence, null, 2)}
                      </pre>
                    )}
                    {execution.state === "awaiting_review" && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          value={reviewComments[execution.id] ?? ""}
                          onChange={(event) =>
                            setReviewComments((current) => ({ ...current, [execution.id]: event.target.value }))
                          }
                          placeholder="Required change-request comments"
                          rows={3}
                        />
                        <Button
                          variant="destructive"
                          disabled={busyId === execution.id || !(reviewComments[execution.id] ?? "").trim()}
                          onClick={() =>
                            act(execution.id, async () => {
                              await projectApi.rejectImplementationExecution(
                                projectId,
                                task.id,
                                execution.id,
                                reviewComments[execution.id].trim()
                              );
                              const next = await projectApi.getImplementationExecutions(projectId, task.id);
                              setExecutions((current) => ({ ...current, [task.id]: next }));
                            })
                          }
                        >
                          Request execution changes
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LockedPhase({ phase }: { phase: WorkflowPhase }) {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>{LABELS[phase]}</CardTitle>
          <CardDescription>This phase is not exposed by the verified backend workflow yet.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function StatusBadge({ status, isStale }: { status: string; isStale?: boolean }) {
  if (isStale && (status === "approved" || status === "completed")) {
    return <Badge variant="secondary" className="border-amber-500/40 text-amber-300">HISTORICAL (STALE UPSTREAM)</Badge>;
  }
  return <Badge variant="outline">{status.replaceAll("_", " ")}</Badge>;
}

function getRunErrorDetails(run: WorkflowRun): { message: string; details?: string } | null {
  if (run.status !== "failed") return null;
  if (!run.errorMessage && !run.errorCode) return { message: "Generation failed" };
  if (run.errorMessage) {
    try {
      const parsed = JSON.parse(run.errorMessage);
      const msg = parsed.message || run.errorMessage;
      const details = parsed.details ? (typeof parsed.details === "object" ? JSON.stringify(parsed.details) : String(parsed.details)) : undefined;
      return { message: msg, details };
    } catch {
      return { message: run.errorMessage, details: run.errorCode || undefined };
    }
  }
  return { message: run.errorCode || "Generation failed" };
}
