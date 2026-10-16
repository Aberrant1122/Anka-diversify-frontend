"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Plus,
  RefreshCw,
  ExternalLink,
  Trash2,
  Edit3,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  Eye,
  EyeOff,
  Loader2,
  Layers,
  Terminal,
  Info,
  CheckSquare,
  Square,
  FolderPlus,
  Link as LinkIcon,
  Code2,
  FileCode,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { projectApi } from "@/lib/project-api";
import type {
  Project,
  ProjectRepository,
  ProjectRepositoryRole,
  CreateProjectRepositoryInput,
  BootstrapPlan,
  BootstrapResult,
} from "@/lib/types";

const ROLE_CONFIG: Record<
  ProjectRepositoryRole,
  { label: string; color: string }
> = {
  frontend: { label: "Frontend", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  backend: { label: "Backend", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  mobile: { label: "Mobile", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  infrastructure: { label: "Infrastructure", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  shared_library: { label: "Shared Library", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  documentation: { label: "Docs", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  data: { label: "Data / AI", color: "bg-pink-500/10 text-pink-400 border-pink-500/30" },
  custom: { label: "Custom", color: "bg-muted text-muted-foreground border-border" },
};

const ALL_ROLES: ProjectRepositoryRole[] = [
  "frontend",
  "backend",
  "mobile",
  "infrastructure",
  "shared_library",
  "documentation",
  "data",
  "custom",
];

interface ProjectRepositoriesProps {
  projectId: string;
  project?: Project;
}

export function ProjectRepositories({ projectId, project }: ProjectRepositoriesProps) {
  const [repositories, setRepositories] = useState<ProjectRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User identity & owner check
  const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const currentUserId = userStr ? JSON.parse(userStr)?.id : null;
  const isOwner = Boolean(
    !project?.userId ||
    (project?.userId && currentUserId && project.userId === currentUserId) ||
    currentUserId === "demo-user-id"
  );

  // Syncing state per repo
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null);
  const [syncSuccessRepoId, setSyncSuccessRepoId] = useState<string | null>(null);

  // Modal states: Existing legacy add modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<ProjectRepository | null>(null);
  const [repoToDelete, setRepoToDelete] = useState<ProjectRepository | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields for legacy modal
  const [formData, setFormData] = useState({
    name: "",
    role: "backend" as ProjectRepositoryRole,
    githubUrl: "",
    githubToken: "",
    defaultBranch: "main",
    buildCommand: "",
    testCommand: "",
    dependencies: [] as string[],
  });
  const [showToken, setShowToken] = useState(false);
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValidationMsg, setTokenValidationMsg] = useState<{
    valid: boolean;
    text: string;
  } | null>(null);

  // ── CP4.2 Path A: Connect Existing Repository Modal ───────────────────────
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectForm, setConnectForm] = useState({
    localPath: "",
    name: "",
    role: "backend" as ProjectRepositoryRole,
    defaultBranch: "main",
    githubUrl: "",
    githubToken: "",
  });
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // ── CP4.2 Path B: Initialize New Repository (Bootstrap) Modal ──────────────
  const [isBootstrapOpen, setIsBootstrapOpen] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [bootstrapPlan, setBootstrapPlan] = useState<BootstrapPlan | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapConfirmed, setBootstrapConfirmed] = useState(false);
  const [customRepoRoot, setCustomRepoRoot] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapSuccess, setBootstrapSuccess] = useState<BootstrapResult | null>(null);

  const fetchRepositories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await projectApi.getRepositories(projectId);

      // If backend has no primary repository row yet, but project has githubUrl,
      // synthesize primary repo card so primary repository is visible
      const hasPrimary = list.some((r) => r.isPrimary);
      if (!hasPrimary && project?.githubUrl) {
        const primarySynth: ProjectRepository = {
          id: `primary-${projectId}`,
          projectId,
          name: project.name ? `${project.name} (main)` : "primary",
          role: "backend",
          githubUrl: project.githubUrl,
          defaultBranch: "main",
          buildCommand: null,
          testCommand: null,
          isPrimary: true,
          dependencies: [],
          hasToken: true,
          localPath: project.localPath || null,
        };
        setRepositories([primarySynth, ...list]);
      } else {
        setRepositories(list);
      }
    } catch (err: any) {
      console.error("Failed to load repositories:", err);
      if (project?.githubUrl) {
        setRepositories([
          {
            id: `primary-${projectId}`,
            projectId,
            name: project.name || "primary",
            role: "backend",
            githubUrl: project.githubUrl,
            defaultBranch: "main",
            buildCommand: null,
            testCommand: null,
            isPrimary: true,
            dependencies: [],
            hasToken: true,
            localPath: project.localPath || null,
          },
        ]);
      } else {
        setError(err.message || "Failed to load repositories");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, project]);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  // ── Handlers for Connect Existing Repository (Path A) ──────────────────────
  const handleOpenConnectExisting = () => {
    setConnectForm({
      localPath: "",
      name: project?.name || "",
      role: "backend",
      defaultBranch: "main",
      githubUrl: "",
      githubToken: "",
    });
    setConnectError(null);
    setIsConnectOpen(true);
  };

  const handleConnectExisting = async () => {
    if (!connectForm.localPath.trim()) {
      setConnectError("Local repository filesystem path is required.");
      return;
    }
    setIsConnecting(true);
    setConnectError(null);
    try {
      await projectApi.bindExistingRepository(projectId, {
        localPath: connectForm.localPath.trim(),
        name: connectForm.name.trim() || undefined,
        role: connectForm.role,
        defaultBranch: connectForm.defaultBranch.trim() || "main",
        githubUrl: connectForm.githubUrl.trim() || undefined,
        githubToken: connectForm.githubToken.trim() || undefined,
        isPrimary: true,
      });
      setIsConnectOpen(false);
      await fetchRepositories();
    } catch (err: any) {
      setConnectError(err.message || "Failed to bind existing repository.");
    } finally {
      setIsConnecting(false);
    }
  };

  // ── Handlers for Initialize New Repository (Path B) ────────────────────────
  const handleOpenBootstrap = async () => {
    setIsBootstrapOpen(true);
    setIsLoadingPlan(true);
    setBootstrapError(null);
    setBootstrapConfirmed(false);
    setBootstrapSuccess(null);
    try {
      const plan = await projectApi.getBootstrapPlan(projectId);
      setBootstrapPlan(plan);
      setCustomRepoRoot(plan.repositoryRoot);
    } catch (err: any) {
      setBootstrapError(err.message || "Failed to load repository bootstrap plan from Architecture authority.");
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleExecuteBootstrap = async () => {
    if (!bootstrapPlan) return;
    if (!bootstrapConfirmed) {
      setBootstrapError("Owner confirmation is required before initializing repository.");
      return;
    }
    setIsBootstrapping(true);
    setBootstrapError(null);
    try {
      const res = await projectApi.executeBootstrap(projectId, {
        idempotencyKey: bootstrapPlan.idempotencyKey,
        confirmation: true,
        repositoryRoot: customRepoRoot.trim() || bootstrapPlan.repositoryRoot,
        templateId: bootstrapPlan.templateId,
        name: project?.name || undefined,
      });
      setBootstrapSuccess(res);
      await fetchRepositories();
    } catch (err: any) {
      setBootstrapError(err.message || "Failed to initialize repository baseline.");
    } finally {
      setIsBootstrapping(false);
    }
  };

  // ── Handlers for Legacy Modal ─────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingRepo(null);
    setFormData({
      name: "",
      role: "backend",
      githubUrl: "",
      githubToken: "",
      defaultBranch: "main",
      buildCommand: "",
      testCommand: "",
      dependencies: [],
    });
    setShowToken(false);
    setFormError(null);
    setTokenValidationMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (repo: ProjectRepository) => {
    setEditingRepo(repo);
    setFormData({
      name: repo.name,
      role: repo.role,
      githubUrl: repo.githubUrl,
      githubToken: "",
      defaultBranch: repo.defaultBranch || "main",
      buildCommand: repo.buildCommand || "",
      testCommand: repo.testCommand || "",
      dependencies: repo.dependencies || [],
    });
    setShowToken(false);
    setFormError(null);
    setTokenValidationMsg(null);
    setIsModalOpen(true);
  };

  const handleValidateToken = async () => {
    if (!formData.githubToken || formData.githubToken.length < 10) {
      setTokenValidationMsg({ valid: false, text: "Token is too short to validate." });
      return;
    }
    setValidatingToken(true);
    setTokenValidationMsg(null);
    try {
      const res = await projectApi.validateGitHubToken(formData.githubToken);
      if (res.valid) {
        setTokenValidationMsg({
          valid: true,
          text: `Valid GitHub token (${res.username || "authenticated"})`,
        });
      } else {
        setTokenValidationMsg({
          valid: false,
          text: res.error || "Invalid token.",
        });
      }
    } catch (e: any) {
      setTokenValidationMsg({
        valid: false,
        text: e.message || "Failed to validate token.",
      });
    } finally {
      setValidatingToken(false);
    }
  };

  const handleSaveRepository = async () => {
    if (!formData.name.trim()) {
      setFormError("Repository name is required.");
      return;
    }
    if (!formData.githubUrl.trim()) {
      setFormError("GitHub Repository URL is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingRepo) {
        const updatePayload: Partial<CreateProjectRepositoryInput> = {
          name: formData.name.trim(),
          role: formData.role,
          githubUrl: formData.githubUrl.trim(),
          defaultBranch: formData.defaultBranch.trim() || "main",
          buildCommand: formData.buildCommand.trim() || undefined,
          testCommand: formData.testCommand.trim() || undefined,
          dependencies: formData.dependencies,
        };

        if (formData.githubToken.trim().length > 0) {
          updatePayload.githubToken = formData.githubToken.trim();
        }

        await projectApi.updateRepository(projectId, editingRepo.id, updatePayload);
      } else {
        const createPayload: CreateProjectRepositoryInput = {
          name: formData.name.trim(),
          role: formData.role,
          githubUrl: formData.githubUrl.trim(),
          defaultBranch: formData.defaultBranch.trim() || "main",
          buildCommand: formData.buildCommand.trim() || undefined,
          testCommand: formData.testCommand.trim() || undefined,
          dependencies: formData.dependencies,
        };

        if (formData.githubToken.trim().length > 0) {
          createPayload.githubToken = formData.githubToken.trim();
        }

        await projectApi.createRepository(projectId, createPayload);
      }

      setIsModalOpen(false);
      await fetchRepositories();
    } catch (e: any) {
      setFormError(e.message || "Failed to save repository.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRepository = async () => {
    if (!repoToDelete) return;
    setIsDeleting(true);
    try {
      await projectApi.deleteRepository(projectId, repoToDelete.id);
      setRepoToDelete(null);
      await fetchRepositories();
    } catch (e: any) {
      alert(`Failed to delete repository: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncRepo = async (repo: ProjectRepository) => {
    setSyncingRepoId(repo.id);
    setSyncSuccessRepoId(null);
    try {
      if (repo.isPrimary && repo.id.startsWith("primary-")) {
        await projectApi.syncGithub(projectId, repo.githubUrl);
      } else {
        await projectApi.syncRepository(projectId, repo.id);
      }
      setSyncSuccessRepoId(repo.id);
      setTimeout(() => setSyncSuccessRepoId(null), 3000);
    } catch (e: any) {
      console.error("Sync error:", e);
      alert(`Sync failed: ${e.message}`);
    } finally {
      setSyncingRepoId(null);
    }
  };

  const primaryRepo = repositories.find((r) => r.isPrimary);
  const secondaryRepos = repositories.filter((r) => !r.isPrimary);
  const totalRepos = repositories.length;

  return (
    <div className="space-y-6">
      {/* ── Non-Owner Warning Banner ── */}
      {!isOwner && (
        <div
          data-testid="owner-warning-banner"
          className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-md flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Only the project owner can initialize, bind, or modify repository settings.</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight">Repositories</h2>
            {primaryRepo ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Baseline Bound ({primaryRepo.defaultBranch || "main"})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 px-2.5 py-0.5">
                No Baseline Bound
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Connect an existing Git repository or bootstrap a new baseline from approved Architecture authority.
          </p>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            id="btn-connect-existing"
            variant="outline"
            size="sm"
            onClick={handleOpenConnectExisting}
            disabled={!isOwner}
            className="gap-1.5 text-xs"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Connect Existing
          </Button>

          <Button
            id="btn-init-new-repo"
            size="sm"
            onClick={handleOpenBootstrap}
            disabled={!isOwner || Boolean(primaryRepo?.localPath)}
            title={primaryRepo?.localPath ? "Project already has a bound primary repository" : ""}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Initialize New Repository
          </Button>

          {primaryRepo && (
            <Button
              id="btn-add-secondary-repo"
              variant="secondary"
              size="sm"
              onClick={handleOpenAddModal}
              disabled={!isOwner}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Repo
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRepositories}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm">Loading project repositories...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── No Repositories Empty State ── */}
          {!primaryRepo && repositories.length === 0 && (
            <Card className="border-dashed p-8 text-center bg-card/40">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <FolderGit2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">No Git Repository Bound</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    To enable task execution, isolated worktrees, and bounded code generation, ANKA OS requires a valid Git repository baseline.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Button
                    id="btn-empty-connect-existing"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenConnectExisting}
                    disabled={!isOwner}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Connect Existing Repository
                  </Button>

                  <Button
                    id="btn-empty-init-new"
                    size="sm"
                    onClick={handleOpenBootstrap}
                    disabled={!isOwner}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Initialize New Repository
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Primary Repository Card ── */}
          {primaryRepo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <GitBranch className="h-3.5 w-3.5 text-primary" />
                <span>Primary Bound Repository</span>
              </div>

              <Card className="border-primary/30 bg-primary/5 relative overflow-hidden" data-testid="primary-repo-card">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-bold flex items-center gap-2" data-testid="repo-name">
                          <FolderGit2 className="h-4 w-4 text-primary" />
                          {primaryRepo.name}
                        </CardTitle>
                        <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-[11px]">
                          PRIMARY BASELINE
                        </Badge>
                        <Badge
                          variant="outline"
                          className={ROLE_CONFIG[primaryRepo.role]?.color || ROLE_CONFIG.custom.color}
                        >
                          {ROLE_CONFIG[primaryRepo.role]?.label || primaryRepo.role}
                        </Badge>
                      </div>

                      {primaryRepo.localPath && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono" data-testid="repo-local-path">
                          <Terminal className="h-3 w-3 shrink-0 text-primary/70" />
                          <span className="truncate">{primaryRepo.localPath}</span>
                        </div>
                      )}

                      {primaryRepo.githubUrl && primaryRepo.githubUrl.startsWith("http") && (
                        <a
                          href={primaryRepo.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit"
                        >
                          <span>{primaryRepo.githubUrl}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 text-xs"
                        onClick={() => handleSyncRepo(primaryRepo)}
                        disabled={syncingRepoId === primaryRepo.id}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            syncingRepoId === primaryRepo.id ? "animate-spin text-primary" : ""
                          }`}
                        />
                        {syncingRepoId === primaryRepo.id ? "Syncing..." : syncSuccessRepoId === primaryRepo.id ? "Synced!" : "Sync"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-primary/20">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Base Branch</span>
                      <span className="font-mono font-medium" data-testid="repo-base-branch">
                        {primaryRepo.defaultBranch || "main"}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Baseline Commit</span>
                      {primaryRepo.currentIndexedCommit ? (
                        <span className="font-mono font-semibold text-emerald-400" data-testid="repo-baseline-commit">
                          {primaryRepo.currentIndexedCommit.slice(0, 7)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unindexed</span>
                      )}
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Worktree Readiness</span>
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Isolated Ready
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Role</span>
                      <span className="font-medium capitalize">{primaryRepo.role}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Additional Repositories ── */}
          {secondaryRepos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Additional Repositories ({secondaryRepos.length})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {secondaryRepos.map((repo) => {
                  const roleStyle = ROLE_CONFIG[repo.role] || ROLE_CONFIG.custom;
                  const isSyncing = syncingRepoId === repo.id;
                  const isSyncSuccess = syncSuccessRepoId === repo.id;

                  return (
                    <Card key={repo.id} className="hover:border-foreground/30 transition-colors bg-card/60">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-sm font-semibold truncate flex items-center gap-1.5">
                                <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{repo.name}</span>
                              </CardTitle>
                              <Badge variant="outline" className={roleStyle.color}>
                                {roleStyle.label}
                              </Badge>
                            </div>
                            {repo.localPath && (
                              <p className="text-xs text-muted-foreground font-mono truncate">{repo.localPath}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleSyncRepo(repo)}
                              disabled={isSyncing}
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${isSyncing ? "animate-spin text-primary" : isSyncSuccess ? "text-emerald-400" : ""}`}
                              />
                            </Button>
                            {isOwner && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleOpenEditModal(repo)}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setRepoToDelete(repo)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CP4.2 Path A: Connect Existing Repository Dialog ── */}
      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Connect Existing Repository
            </DialogTitle>
            <DialogDescription>
              Bind an existing local Git repository within authorized workspace boundaries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {connectError && (
              <div className="p-3 text-xs bg-destructive/10 border border-destructive/30 text-destructive rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{connectError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Local Repository Path *</label>
              <Input
                id="input-connect-local-path"
                placeholder="e.g. C:/Users/PCC/Desktop/my-project or /path/to/repo"
                value={connectForm.localPath}
                onChange={(e) => setConnectForm((f) => ({ ...f, localPath: e.target.value }))}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Must be an existing, clean Git repository within approved workspace boundaries.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Repository Name</label>
                <Input
                  id="input-connect-name"
                  placeholder="e.g. my-app"
                  value={connectForm.name}
                  onChange={(e) => setConnectForm((f) => ({ ...f, name: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Base Branch</label>
                <Input
                  id="input-connect-branch"
                  placeholder="main"
                  value={connectForm.defaultBranch}
                  onChange={(e) => setConnectForm((f) => ({ ...f, defaultBranch: e.target.value }))}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Role</label>
              <Select
                value={connectForm.role}
                onValueChange={(val) => setConnectForm((f) => ({ ...f, role: val as ProjectRepositoryRole }))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {ROLE_CONFIG[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Remote GitHub URL (Optional)</label>
              <Input
                id="input-connect-github-url"
                placeholder="https://github.com/org/repo"
                value={connectForm.githubUrl}
                onChange={(e) => setConnectForm((f) => ({ ...f, githubUrl: e.target.value }))}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsConnectOpen(false)} disabled={isConnecting}>
              Cancel
            </Button>
            <Button
              id="btn-submit-connect-existing"
              size="sm"
              onClick={handleConnectExisting}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect & Validate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CP4.2 Path B: Initialize New Repository Dialog ── */}
      <Dialog open={isBootstrapOpen} onOpenChange={setIsBootstrapOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Initialize New Repository
            </DialogTitle>
            <DialogDescription>
              Create and bind a fresh Git baseline derived deterministically from approved Architecture authority.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto space-y-4 py-2 pr-1 flex-1">
            {isLoadingPlan ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-xs">Evaluating approved Architecture authority and preparing bootstrap plan...</p>
              </div>
            ) : bootstrapError ? (
              <div
                id="bootstrap-error-banner"
                className="p-3 text-xs bg-destructive/10 border border-destructive/30 text-destructive rounded-md space-y-2"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Bootstrap Preflight Denied</span>
                </div>
                <p>{bootstrapError}</p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={handleOpenBootstrap} className="text-xs">
                    Retry Planning
                  </Button>
                </div>
              </div>
            ) : bootstrapSuccess ? (
              <div
                id="bootstrap-success-banner"
                className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg space-y-3"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Repository Initialized & Bound!</span>
                </div>
                <div className="space-y-1 text-xs">
                  <p>
                    <strong className="text-foreground">Baseline Commit:</strong>{" "}
                    <code className="font-mono text-emerald-300">{bootstrapSuccess.baselineCommitSha}</code>
                  </p>
                  <p>
                    <strong className="text-foreground">Base Branch:</strong>{" "}
                    <code className="font-mono">{bootstrapSuccess.baseBranch}</code>
                  </p>
                  <p>
                    <strong className="text-foreground">Technology Stack:</strong>{" "}
                    {bootstrapSuccess.selectedStack.language} {bootstrapSuccess.selectedStack.framework ? `(${bootstrapSuccess.selectedStack.framework})` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsBootstrapOpen(false)} className="w-full mt-2">
                  Done
                </Button>
              </div>
            ) : bootstrapPlan ? (
              <div id="bootstrap-plan-view" className="space-y-4">
                {/* Tech Stack Summary Card */}
                <div className="p-3 rounded-lg border bg-card/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                      Resolved Technology Stack
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {bootstrapPlan.templateId}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Language</span>
                      <span>{bootstrapPlan.selectedStack.language}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Framework</span>
                      <span>{bootstrapPlan.selectedStack.framework || "None"}</span>
                    </div>
                  </div>
                </div>

                {/* Target Root */}
                <div className="space-y-1.5 text-xs">
                  <label className="font-medium">Repository Root Directory *</label>
                  <Input
                    id="input-bootstrap-root"
                    value={customRepoRoot}
                    onChange={(e) => setCustomRepoRoot(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must be within approved workspace boundaries and empty or non-existent.
                  </p>
                </div>

                {/* Planned Foundational Files */}
                <div className="space-y-2 text-xs">
                  <label className="font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                    Planned Foundational Files ({bootstrapPlan.plannedFiles.length})
                  </label>
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y bg-muted/20">
                    {bootstrapPlan.plannedFiles.map((file) => (
                      <div key={file.path} className="p-2 flex items-start gap-2">
                        <FileCode className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-medium truncate">{file.path}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{file.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Explicit Owner Confirmation */}
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                  <label
                    htmlFor="checkbox-confirm-bootstrap"
                    className="flex items-start gap-2 cursor-pointer text-xs font-medium"
                  >
                    <input
                      id="checkbox-confirm-bootstrap"
                      type="checkbox"
                      checked={bootstrapConfirmed}
                      onChange={(e) => setBootstrapConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>
                      I explicitly authorize ANKA OS to scaffold foundational files, create the initial local Git commit, and bind this repository baseline to project tasks.
                    </span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBootstrapOpen(false)}
              disabled={isBootstrapping}
            >
              Cancel
            </Button>
            {!bootstrapSuccess && bootstrapPlan && (
              <Button
                id="btn-confirm-bootstrap"
                size="sm"
                onClick={handleExecuteBootstrap}
                disabled={!bootstrapConfirmed || isBootstrapping || !isOwner}
                className="gap-2"
              >
                {isBootstrapping && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Initialize
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Legacy Add/Edit Modal (Preserved for compatibility) ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRepo ? "Edit Repository" : "Add Companion Repository"}</DialogTitle>
            <DialogDescription>
              {editingRepo
                ? "Update repository details or build configuration."
                : "Register a companion repository for multi-repo agent tasks."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="p-3 text-xs bg-destructive/10 border border-destructive/30 text-destructive rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Repository Name *</label>
              <Input
                placeholder="e.g. mobile-app or shared-utils"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Role *</label>
              <Select
                value={formData.role}
                onValueChange={(val) => setFormData((f) => ({ ...f, role: val as ProjectRepositoryRole }))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {ROLE_CONFIG[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">GitHub Repository URL *</label>
              <Input
                placeholder="https://github.com/org/repo"
                value={formData.githubUrl}
                onChange={(e) => setFormData((f) => ({ ...f, githubUrl: e.target.value }))}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">GitHub Token (Optional)</label>
                {formData.githubToken && (
                  <button
                    type="button"
                    onClick={handleValidateToken}
                    disabled={validatingToken}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    {validatingToken ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    Validate
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder={editingRepo ? "(leave blank to keep existing)" : "ghp_..."}
                  value={formData.githubToken}
                  onChange={(e) => setFormData((f) => ({ ...f, githubToken: e.target.value }))}
                  className="text-xs pr-8 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {tokenValidationMsg && (
                <p className={`text-[11px] ${tokenValidationMsg.valid ? "text-emerald-400" : "text-destructive"}`}>
                  {tokenValidationMsg.text}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Default Branch</label>
              <Input
                placeholder="main"
                value={formData.defaultBranch}
                onChange={(e) => setFormData((f) => ({ ...f, defaultBranch: e.target.value }))}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveRepository} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRepo ? "Save Changes" : "Add Repository"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!repoToDelete} onOpenChange={(open) => !open && setRepoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Repository?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{repoToDelete?.name}</strong> from this project? The
              underlying Git repository on disk will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRepository}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removing..." : "Remove Repository"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
