"use client";

import { useState, use, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectAIAssistant } from "@/components/ai/project-ai-assistant";
import { ProjectIDE } from "@/components/project/project-ide";
import { PhaseStepper } from "@/components/project/phase-stepper";
import { PhaseDetailView } from "@/components/project/phase-detail-view";
import { ProjectRepositories } from "@/components/project/project-repositories";
import { ContextSnapshotAuditPanel } from "@/components/ai/context-snapshot-audit-panel";
import { ArchitectureDriftPanel } from "@/components/ai/architecture-drift-panel";
import { FileReservationsPanel } from "@/components/ai/file-reservations-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { projectApi } from "@/lib/project-api";
import type { Project, Task, ProjectFile, Activity, Comment, ProjectMember, WorkflowPhase, ProjectPhaseState } from "@/lib/types";
import { inviteApi } from "@/lib/invite-api";
import type { TeamUser } from "@/lib/invite-api";
import { ProjectFileItem } from "@/components/project/project-file-item";
import { ProjectBrief } from "@/components/project/project-brief";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  GripVertical,
  Flag,
  User,
  Tag,
  Upload,
  FileText,
  File,
  ChevronRight,
  Settings,
  Trash2,
  Edit3,
  Link2,
  Send,
  X,
  UserPlus,
  GitMerge,
  Unlink,
  GitBranch,
  MessageSquare,
  Zap,
  Loader2,
  Kanban,
  Layers,
  FolderOpen,
  Code,
  Activity as ActivityIcon,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Image } from "lucide-react";

// ─── constants ───────────────────────────────────────────────────────────────

const phaseColors: Record<string, string> = {
  "product-modeling": "bg-chart-4/20 text-chart-4 border-chart-4/30",
  development: "bg-primary/20 text-primary border-primary/30",
  marketing: "bg-warning/20 text-warning border-warning/30",
  completed: "bg-success/20 text-success border-success/30",
};
const phaseLabels: Record<string, string> = {
  "product-modeling": "Product Modeling",
  development: "Development",
  marketing: "Marketing",
  completed: "Completed",
};
const priorityColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-warning text-warning-foreground",
  medium: "bg-primary text-primary-foreground",
  low: "bg-muted text-muted-foreground",
};
const statusColumns = [
  { id: "todo", label: "To Do", icon: Circle, color: "text-muted-foreground" },
  { id: "in-progress", label: "In Progress", icon: Clock, color: "text-primary" },
  { id: "review", label: "Review", icon: AlertCircle, color: "text-warning" },
  { id: "done", label: "Done", icon: CheckCircle2, color: "text-success" },
];

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // Empty shell so the page renders immediately, then hydrate from backend
  const emptyProject: Project = {
    id,
    name: "",
    description: "",
    phase: "product-modeling",
    progress: 0,
    team: [],
    members: [],
    startDate: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    tasks: [],
    priority: "medium",
    status: "active",
  };
  const [project, setProject] = useState<Project>(emptyProject);
  const [projectLoading, setProjectLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [, setTasksLoading] = useState(true);

  // Fetch project metadata from backend
  useEffect(() => {
    setProjectLoading(true);
    projectApi.getById(id)
      .then((p) => setProject(p))
      .catch(() => { /* keep empty shell */ })
      .finally(() => setProjectLoading(false));
  }, [id]);

  // Fetch real tasks from backend (separate from project metadata)
  useEffect(() => {
    setTasksLoading(true);
    projectApi.getTasks(id)
      .then((t) => setTasks(t))
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [id]);

  // ── files state ──
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [newFile, setNewFile] = useState({ name: "", type: "doc", phase: "development", url: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null);

  useEffect(() => {
    projectApi.getFiles(id).then(setFiles).catch(() => { });
  }, [id]);

  const handleAddFile = async () => {
    setFileUploadError(null);
    const name = selectedFile ? selectedFile.name : newFile.name.trim();
    if (!name) return;

    setFileUploading(true);
    const optimistic: ProjectFile = {
      id: `tmp-${Date.now()}`,
      projectId: id,
      name,
      type: newFile.type as ProjectFile["type"],
      phase: newFile.phase,
      url: newFile.url || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFiles((prev) => [optimistic, ...prev]);
    setIsAddFileOpen(false);

    try {
      let saved: ProjectFile;
      if (selectedFile) {
        saved = await projectApi.uploadFile(id, selectedFile, { phase: newFile.phase });
      } else {
        saved = await projectApi.createFile(id, newFile);
      }
      setFiles((prev) => prev.map((f) => f.id === optimistic.id ? saved : f));
    } catch {
      setFileUploadError("Upload could not be confirmed. Check the file status and try again if needed.");
      try {
        setFiles(await projectApi.getFiles(id));
      } catch {
        setFiles((prev) => prev.filter((f) => f.id !== optimistic.id));
      }
    } finally {
      setFileUploading(false);
      setNewFile({ name: "", type: "doc", phase: "development", url: "" });
      setSelectedFile(null);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    const file = fileToDelete;
    setFileToDelete(null);
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    try {
      await projectApi.deleteFile(id, file.id);
    } catch {
      setFiles((prev) => [file, ...prev]);
    }
  };

  // ── members state ──
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [allUsers, setAllUsers] = useState<TeamUser[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    projectApi.getMembers(id).then(setMembers).catch(() => { });
    inviteApi.listUsers().then(setAllUsers).catch(() => { });
  }, [id]);

  const handleAddMember = async (userId: string) => {
    setMemberLoading(true);
    setMemberError(null);
    try {
      await projectApi.addMember(id, userId);
      const updated = await projectApi.getMembers(id);
      setMembers(updated);
    } catch (e: any) {
      setMemberError(e.message);
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await projectApi.removeMember(id, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch { /* silent */ }
  };

  // ── phased workflow state ──
  const [phaseStates, setPhaseStates] = useState<ProjectPhaseState[]>([]);
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>("requirements");
  const refreshPhaseStates = useCallback(() => {
    projectApi.getPhaseStates(id).then(setPhaseStates).catch(() => { });
  }, [id]);

  // ── activities state ──
  const [activities, setActivities] = useState<Activity[]>([]);
  // Project Brief is canonical. The query parameter provides reload-safe deep links.
  const [activeTab, setActiveTab] = useState("project-brief");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    const allowed = new Set(["project-brief", "kanban", "workflow", "files", "repositories", "code", "activity", "ai-assistant"]);
    if (requested && allowed.has(requested)) setActiveTab(requested);
  }, [id]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── agent → IDE bridge ──
  const [pendingAgentChanges, setPendingAgentChanges] = useState<{ path: string; content: string; description: string; repositoryId?: string }[] | null>(null);

  const handleAgentChanges = (changes: { path: string; content: string; description: string; repositoryId?: string }[]) => {
    setPendingAgentChanges(changes);
  };

  // "Run Agent" clicked on a Kanban card — jump to the AI tab and have the
  // agent implement that specific task, full description included.
  const [agentTaskRequest, setAgentTaskRequest] = useState<{ taskId: string; title: string; description?: string } | null>(null);
  const handleRunAgentOnTask = (task: Task) => {
    setAgentTaskRequest({ taskId: task.id, title: task.title, description: task.description });
    setActiveTab("ai-assistant");
  };

  // Marks a task done after the agent's batch run for it has been pushed —
  // unblocks any tasks that were waiting on it.
  const handleTaskCompletedByAgent = (taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t)));
    projectApi.updateTask(id, taskId, { status: "done" }).catch(() => { });
  };

  const refreshActivities = useCallback(() => {
    projectApi.getActivities(id).then(setActivities).catch(() => { });
  }, [id]);

  useEffect(() => { refreshActivities(); }, [refreshActivities]);
  useEffect(() => { refreshPhaseStates(); }, [refreshPhaseStates]);

  // Poll every 8s when activity tab is open
  useEffect(() => {
    if (activeTab === "activity") {
      pollRef.current = setInterval(refreshActivities, 8000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab, refreshActivities]);

  // ── keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeTab !== "kanban") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setIsNewTaskOpen(true); }
      if (e.key === "b" || e.key === "B") { e.preventDefault(); setBulkMode((v) => !v); setSelectedTaskIds(new Set()); }
      if (e.key === "Escape") { setSelectedTask(null); setBulkMode(false); setSelectedTaskIds(new Set()); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab]);

  // ── checklist state ──
  const [checklist, setChecklist] = useState<import("@/lib/types").ChecklistItem[]>([]);
  const [checklistInput, setChecklistInput] = useState("");

  // ── comments state ──
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // ── kanban state ──
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── new task form ──
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "", phase: "development",
    priority: "medium", dueDate: "",
  });

  // ── task detail sidebar ──
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!selectedTask) { setChecklist([]); setComments([]); return; }
    projectApi.getComments(id, selectedTask.id).then(setComments).catch(() => { });
    projectApi.getChecklist(id, selectedTask.id).then((data) => setChecklist(data ?? [])).catch(() => { });
  }, [id, selectedTask?.id]);

  const handleAddComment = async () => {
    if (!commentInput.trim() || !selectedTask || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const comment = await projectApi.createComment(id, selectedTask.id, commentInput.trim());
      setComments((prev) => [...prev, comment]);
      setCommentInput("");
      refreshActivities();
    } catch { /* silent */ } finally {
      setCommentSubmitting(false);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!checklistInput.trim() || !selectedTask) return;
    const text = checklistInput.trim();
    setChecklistInput("");
    const item = await projectApi.addChecklistItem(id, selectedTask.id, text).catch(() => null);
    if (item) setChecklist((prev) => [...prev, item]);
  };

  const handleToggleChecklistItem = async (itemId: string, checked: boolean) => {
    setChecklist((prev) => prev.map((i) => i.id === itemId ? { ...i, checked } : i));
    await projectApi.updateChecklistItem(id, selectedTask!.id, itemId, { checked }).catch(() => {
      setChecklist((prev) => prev.map((i) => i.id === itemId ? { ...i, checked: !checked } : i));
    });
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    setChecklist((prev) => prev.filter((i) => i.id !== itemId));
    await projectApi.deleteChecklistItem(id, selectedTask!.id, itemId).catch(() => { });
  };

  // ── delete task confirmation ──
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // ── edit project dialog ──
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string; description: string; phase: string;
    priority: string; dueDate: string; githubUrl: string; localPath: string;
  }>({
    name: project.name,
    description: project.description,
    phase: project.phase,
    priority: project.priority || "medium",
    dueDate: toDateInputValue(project.dueDate),
    githubUrl: project.githubUrl || "",
    localPath: project.localPath || "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // ── delete project dialog ──
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync edit form when project loads from backend
  useEffect(() => {
    setEditForm({
      name: project.name,
      description: project.description,
      phase: project.phase,
      priority: project.priority || "medium",
      dueDate: toDateInputValue(project.dueDate),
      githubUrl: project.githubUrl || "",
      localPath: project.localPath || "",
    });
  }, [project.id, project.name]);

  // ── derived ──

  const filteredTasks = tasks.filter(
    (t) => phaseFilter === "all" || t.phase === phaseFilter,
  );
  const getTasksByStatus = (status: string) =>
    filteredTasks.filter((t) => t.status === status);
  const progress =
    tasks.length === 0
      ? project.progress ?? 0
      : Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);

  // ── handlers ──
  const handleDragStart = (task: Task) => setDraggedTask(task);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (status: string) => {
    if (!draggedTask) return;
    const newStatus = status as Task["status"];
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => t.id === draggedTask.id ? { ...t, status: newStatus } : t),
    );
    // Persist to backend
    projectApi.updateTask(id, draggedTask.id, { status })
      .then(() => refreshActivities())
      .catch(() => {
        setTasks((prev) =>
          prev.map((t) => t.id === draggedTask.id ? { ...t, status: draggedTask.status } : t),
        );
      });
    setDraggedTask(null);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    const task = taskToDelete;
    setTaskToDelete(null);
    if (selectedTask?.id === task.id) setSelectedTask(null);
    // Optimistic remove
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await projectApi.deleteTask(id, task.id);
      refreshActivities();
    } catch {
      setTasks((prev) => [...prev, task]);
    }
  };

  const toggleBulkSelect = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const handleBulkUpdate = async (update: Partial<Pick<Task, "status" | "priority">>) => {
    if (selectedTaskIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedTaskIds);
    const prev = tasks.map((t) => ({ ...t }));
    setTasks((all) => all.map((t) => ids.includes(t.id) ? { ...t, ...update } : t));
    try {
      await Promise.all(ids.map((taskId) => projectApi.updateTask(id, taskId, update)));
      refreshActivities();
    } catch {
      setTasks(prev);
    } finally {
      setBulkLoading(false);
      setSelectedTaskIds(new Set());
      setBulkMode(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedTaskIds);
    const prev = tasks.map((t) => ({ ...t }));
    setTasks((all) => all.filter((t) => !ids.includes(t.id)));
    try {
      await Promise.all(ids.map((taskId) => projectApi.deleteTask(id, taskId)));
      refreshActivities();
    } catch {
      setTasks(prev);
    } finally {
      setBulkLoading(false);
      setSelectedTaskIds(new Set());
      setBulkMode(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    // Optimistic local task
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      title: newTask.title,
      description: newTask.description,
      status: "todo",
      priority: newTask.priority as Task["priority"],
      projectId: id,
      phase: newTask.phase as Task["phase"],
      dueDate: newTask.dueDate,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    setTasks((prev) => [optimistic, ...prev]);
    setNewTask({ title: "", description: "", phase: "development", priority: "medium", dueDate: "" });
    setIsNewTaskOpen(false);
    try {
      const saved = await projectApi.createTask(id, {
        title: optimistic.title,
        description: optimistic.description,
        status: optimistic.status,
        priority: optimistic.priority,
        phase: optimistic.phase,
        dueDate: optimistic.dueDate || undefined,
      });
      setTasks((prev) => prev.map((t) => t.id === optimistic.id ? saved : t));
      refreshActivities();
    } catch { /* keep optimistic */ }
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const updated = await projectApi.update(id, {
        name: editForm.name,
        description: editForm.description,
        phase: editForm.phase,
        priority: editForm.priority,
        dueDate: editForm.dueDate || undefined,
        githubUrl: editForm.githubUrl || undefined,
        localPath: editForm.localPath || undefined,
      });
      setProject(updated);
    } catch {
      setProject((p) => ({
        ...p,
        name: editForm.name,
        description: editForm.description,
        phase: editForm.phase as Project["phase"],
        priority: editForm.priority as Project["priority"],
        dueDate: editForm.dueDate || p.dueDate,
        githubUrl: editForm.githubUrl || undefined,
        localPath: editForm.localPath || undefined,
      }));
    } finally {
      setEditSaving(false);
      setIsEditOpen(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      await projectApi.remove(id);
    } catch { /* best-effort */ }
    router.push("/development/projects");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full">

        {/* ── Header ── */}
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="p-3 sm:p-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-4">
              <Link href="/development/projects">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold truncate">{projectLoading ? "Loading…" : project.name}</h1>
                  <Badge variant="outline" className={phaseColors[project.phase] + " shrink-0"}>
                    {phaseLabels[project.phase]}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{project.description}</p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 sm:gap-2 px-2 sm:px-3"
                  onClick={() => setIsEditOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit Project
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <Link2 className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setIsDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {members.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-2">
                      {members.slice(0, 4).map((member) => (
                        <Avatar key={member.id} className="h-6 w-6 sm:h-7 sm:w-7 border-2 border-background">
                          <AvatarFallback className="text-[10px] sm:text-xs">{(member.name || member.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{members.length} member{members.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-4 w-px bg-border hidden xs:block" />
                </>
              )}
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Due:</span>
                <span>{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "—"}</span>
              </div>
              <div className="h-4 w-px bg-border hidden xs:block" />
              <div className="flex items-center gap-2 flex-1 min-w-[120px] max-w-full sm:max-w-xs">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Progress:</span>
                <Progress value={progress} className="h-1.5 sm:h-2 flex-1" />
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{progress}%</span>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} className="w-full" onValueChange={(v) => { setActiveTab(v); if (id) { try { router.replace(`/development/projects/${id}?tab=${encodeURIComponent(v)}`, { scroll: false }); } catch {} } if (v === "activity") refreshActivities(); if (v === "workflow") refreshPhaseStates(); }}>
            <div className="px-4 border-t bg-card/30 backdrop-blur-md overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="h-12 bg-transparent gap-1.5 sm:gap-2 w-max sm:w-full justify-start py-1">
                {[
                  { id: "project-brief", label: "Project Brief", icon: FileText },
                  { id: "kanban", label: "Kanban Board", icon: Kanban },
                  { id: "workflow", label: "Workflow", icon: Layers },
                  { id: "files", label: "Files", icon: FolderOpen },
                  { id: "repositories", label: "Repositories", icon: GitBranch },
                  { id: "code", label: "Code", icon: Code },
                  { id: "activity", label: "Activity", icon: ActivityIcon },
                  { id: "ai-assistant", label: "AI Agent", icon: Zap, badge: "Multi-Stage" },
                ].map(({ id: tabId, label, icon: Icon, badge }) => (
                  <TabsTrigger
                    key={tabId}
                    value={tabId}
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 data-[state=active]:shadow-sm rounded-lg border border-transparent px-3 py-1.5 transition-all text-xs font-medium flex items-center gap-1.5 whitespace-nowrap hover:bg-secondary/40"
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", tabId === "ai-assistant" ? "text-violet-400" : "")} />
                    <span>{label}</span>
                    {badge && (
                      <span className="ml-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {badge}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="project-brief" className="mt-0 flex-1">
              <ProjectBrief project={project} files={files} onUpload={() => setIsAddFileOpen(true)} />
            </TabsContent>

            {/* ── Workflow ── forceMount keeps workflow state & artifacts loaded without tab blink */}
            <TabsContent
              value="workflow"
              className="mt-0 flex-1"
              forceMount
              style={activeTab !== "workflow" ? { display: "none" } : undefined}
            >
              <PhaseStepper states={phaseStates} activePhase={workflowPhase} onSelectPhase={setWorkflowPhase} />
              <PhaseDetailView
                projectId={id}
                phase={workflowPhase}
                project={project}
                activeTab={activeTab}
                onStatesChange={setPhaseStates}
                onNavigateTab={(tab) => {
                  setActiveTab(tab);
                  router.replace(`/development/projects/${id}?tab=${encodeURIComponent(tab)}`, { scroll: false });
                }}
              />
            </TabsContent>

            {/* ── Kanban ── */}
            <TabsContent value="kanban" className="mt-0 flex-1">
              <div className="p-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                      <SelectTrigger className="w-40 sm:w-45 h-8 sm:h-10 text-xs sm:text-sm">
                        <SelectValue placeholder="Filter by phase" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Phases</SelectItem>
                        <SelectItem value="product-modeling">Product Modeling</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={bulkMode ? "secondary" : "outline"}
                      size="sm"
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                      onClick={() => { setBulkMode((v) => !v); setSelectedTaskIds(new Set()); }}
                    >
                      {bulkMode ? "Cancel" : "Select"}
                    </Button>
                  </div>

                  {bulkMode && selectedTaskIds.size > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{selectedTaskIds.size} selected</span>
                      <Select onValueChange={(v) => handleBulkUpdate({ status: v as Task["status"] })} disabled={bulkLoading}>
                        <SelectTrigger className="h-8 text-xs w-32 sm:w-36">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">Todo</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select onValueChange={(v) => handleBulkUpdate({ priority: v as Task["priority"] })} disabled={bulkLoading}>
                        <SelectTrigger className="h-8 text-xs w-32 sm:w-36">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleBulkDelete} disabled={bulkLoading}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                      </Button>
                    </div>
                  ) : (
                    <Button className="gap-2 h-8 sm:h-10 text-xs sm:text-sm" onClick={() => setIsNewTaskOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Add Task
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-150">
                  {statusColumns.map((column) => {
                    const columnTasks = getTasksByStatus(column.id);
                    const Icon = column.icon;
                    return (
                      <div
                        key={column.id}
                        className="flex flex-col bg-secondary/30 rounded-lg"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(column.id)}
                      >
                        <div className="p-3 border-b border-border/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${column.color}`} />
                            <span className="font-medium text-sm">{column.label}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {columnTasks.length}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setIsNewTaskOpen(true)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                          {columnTasks.map((task) => (
                            <Card
                              key={task.id}
                              className={`cursor-pointer hover:border-primary/50 transition-all group ${bulkMode && selectedTaskIds.has(task.id) ? "border-primary bg-primary/5" : ""}`}
                              draggable={!bulkMode}
                              onDragStart={() => !bulkMode && handleDragStart(task)}
                              onClick={() => bulkMode ? toggleBulkSelect(task.id) : setSelectedTask(task)}
                            >
                              <CardContent className="p-3 space-y-3">
                                <div className="flex items-start gap-2">
                                  {bulkMode ? (
                                    <input
                                      type="checkbox"
                                      checked={selectedTaskIds.has(task.id)}
                                      onChange={() => toggleBulkSelect(task.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-3.5 w-3.5 mt-0.5 accent-primary shrink-0"
                                    />
                                  ) : (
                                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 cursor-grab shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-1.5">
                                      <p className="font-medium text-sm leading-tight flex-1">{task.title}</p>
                                      {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" && (
                                        <span className="shrink-0 text-[10px] font-semibold bg-destructive/20 text-destructive border border-destructive/30 rounded px-1 py-0.5 leading-none mt-0.5">OVERDUE</span>
                                      )}
                                    </div>
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                  {/* Run Agent on this task */}
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-primary"
                                    title="Run Agent on this task"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRunAgentOnTask(task);
                                    }}
                                  >
                                    <Zap className="h-3.5 w-3.5" />
                                  </button>
                                  {/* Delete task button */}
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTaskToDelete(task);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={`${phaseColors[task.phase]} text-xs px-1.5 py-0`}
                                  >
                                    {phaseLabels[task.phase]}
                                  </Badge>
                                  {task.tags?.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                  <div className="flex items-center gap-2">
                                    {task.assignee && (
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={task.assignee.avatar} />
                                        <AvatarFallback className="text-xs">
                                          {task.assignee.name.slice(0, 2)}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                    <div className={`h-2 w-2 rounded-full ${priorityColors[task.priority]}`} />
                                    {(task.blockedByIds?.length ?? 0) > 0 && (
                                      <span className="flex items-center gap-0.5 text-xs text-red-400" title={`Blocked by ${task.blockedByIds!.length} task(s)`}>
                                        <GitMerge className="h-3 w-3" />
                                        {task.blockedByIds!.length}
                                      </span>
                                    )}
                                    {(task.blockingIds?.length ?? 0) > 0 && (
                                      <span className="flex items-center gap-0.5 text-xs text-yellow-400" title={`Blocking ${task.blockingIds!.length} task(s)`}>
                                        <GitMerge className="h-3 w-3 rotate-180" />
                                        {task.blockingIds!.length}
                                      </span>
                                    )}
                                    {(task.commentCount ?? 0) > 0 && (
                                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground" title={`${task.commentCount} comment(s)`}>
                                        <MessageSquare className="h-3 w-3" />
                                        {task.commentCount}
                                      </span>
                                    )}
                                  </div>
                                  {task.dueDate && (() => {
                                    const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "done";
                                    return (
                                      <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                        <Calendar className="h-3 w-3" />
                                        {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ── Files ── */}
            <TabsContent value="files" className="mt-0">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                  <h2 className="text-base sm:text-lg font-semibold">Files & Deliverables</h2>
                  <Button size="sm" className="gap-2" onClick={() => setIsAddFileOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Add File
                  </Button>
                </div>
                {fileUploadError && <p role="alert" className="text-sm text-rose-700 mb-3">{fileUploadError}</p>}
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <File className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-sm">No files yet. Add your first deliverable.</p>
                  </div>
                ) : (
                  ["product-modeling", "development", "marketing"].map((phase) => {
                    const phaseFiles = files.filter((f) => f.phase === phase);
                    if (phaseFiles.length === 0) return null;
                    return (
                      <div key={phase} className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className={phaseColors[phase]}>{phaseLabels[phase]}</Badge>
                          <span className="text-sm text-muted-foreground">Phase Deliverables</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          {phaseFiles.map((file) => (
                            <ProjectFileItem
                              key={file.id}
                              file={file}
                              projectId={id}
                              onDeleteClick={setFileToDelete}
                            />
                          ))}
                          <Card
                            className="border-dashed hover:border-primary/50 transition-all cursor-pointer"
                            onClick={() => { setNewFile((f) => ({ ...f, phase })); setIsAddFileOpen(true); }}
                          >
                            <CardContent className="p-4 h-full flex flex-col items-center justify-center text-muted-foreground">
                              <Plus className="h-8 w-8 mb-2" />
                              <span className="text-sm">Add File</span>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* ── Repositories ── */}
            <TabsContent value="repositories" className="mt-0 flex-1 p-4 sm:p-6 focus-visible:outline-none">
              <ProjectRepositories projectId={id} project={project} />
            </TabsContent>

            {/* ── Activity ── */}
            <TabsContent value="activity" className="mt-0">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet. Create or move a task to get started.</p>
                ) : (
                  <div className="space-y-1">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{activity.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{activity.userName}</span>
                            <span className="text-muted-foreground"> {activity.action.replace(/_/g, " ")} </span>
                            {activity.entityName && <span className="font-medium">{activity.entityName}</span>}
                            {activity.meta?.to && (
                              <span className="text-muted-foreground"> → {String(activity.meta.to).replace(/_/g, " ")}</span>
                            )}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString("en-US", {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-10 pt-6 border-t">
                  <h2 className="text-lg font-semibold mb-1">AI Context Audit</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    What the AI agent actually saw — repo, files, and task classification — for each run.
                  </p>
                  <ContextSnapshotAuditPanel projectId={id} />
                </div>

                <div className="mt-10 pt-6 border-t">
                  <h2 className="text-lg font-semibold mb-1">Architecture Drift</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Flagged disagreements between the approved architecture doc and observed repository state.
                  </p>
                  <ArchitectureDriftPanel projectId={id} />
                </div>

                <div className="mt-10 pt-6 border-t">
                  <h2 className="text-lg font-semibold mb-1">Active File Reservations</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Files currently locked by an in-progress multi-repo agent run, to prevent collisions.
                  </p>
                  <FileReservationsPanel projectId={id} />
                </div>
              </div>
            </TabsContent>

            {/* ── Code (IDE) ── forceMount keeps terminal alive across tab switches */}
            <TabsContent
              value="code"
              className="mt-0 p-4"
              forceMount
              style={activeTab !== "code" ? { display: "none" } : undefined}
            >
              <ProjectIDE
                project={project}
                pendingChanges={pendingAgentChanges}
                onChangesApplied={() => setPendingAgentChanges(null)}
              />
            </TabsContent>

            {/* ── AI Assistant ── */}
            <TabsContent value="ai-assistant" className="mt-0 flex-1">
              <ProjectAIAssistant
                project={project}
                tasks={tasks}
                onAgentChanges={handleAgentChanges}
                runTaskRequest={agentTaskRequest}
                onRunTaskConsumed={() => setAgentTaskRequest(null)}
                onTaskCompleted={handleTaskCompletedByAgent}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Edit Project Dialog ── */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-125 max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update project details and settings</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto pr-1 flex-1 space-y-4 py-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Phase</label>
                  <Select value={editForm.phase} onValueChange={(v) => setEditForm((f) => ({ ...f, phase: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product-modeling">Product Modeling</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">GitHub Repository URL</label>
                <Input
                  type="url"
                  placeholder="https://github.com/username/repo"
                  value={editForm.githubUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, githubUrl: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Local Project Path</label>
                <Input
                  placeholder="/Users/you/projects/my-app"
                  value={editForm.localPath}
                  onChange={(e) => setEditForm((f) => ({ ...f, localPath: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Where this repo is cloned on your machine. The terminal will start here and the AI agent will write changes directly to these files.</p>
              </div>

              {/* ── Team Members ── */}
              <div className="flex flex-col gap-2 pt-2 border-t">
                <label className="text-sm font-medium">Team Members</label>

                {/* Current members */}
                <div className="space-y-1.5">
                  {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No members yet.</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{(m.name || m.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-medium">{m.name || m.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMember(m.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add member */}
                <div className="flex gap-2">
                  <Select
                    onValueChange={(userId) => handleAddMember(userId)}
                    disabled={memberLoading}
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue placeholder="Add a team member…" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers
                        .filter((u) => !members.some((m) => m.id === u.id))
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <span className="text-xs">{u.name || u.email} <span className="text-muted-foreground capitalize">· {u.role}</span></span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" className="h-8 w-8 shrink-0" variant="outline" disabled>
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {memberError && <p className="text-xs text-destructive">{memberError}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={editSaving} className="gap-2">
                {editSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Project Confirm ── */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-100">
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{project.name}</strong> and all its data. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting} className="gap-2">
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  "Delete Project"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add Task Dialog ── */}
        <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task to the project</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              {/* Templates */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Templates</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Bug Fix", title: "Fix: ", description: "Steps to reproduce:\n1. \n\nExpected behavior:\n\nActual behavior:", priority: "high" },
                    { label: "Feature", title: "Feat: ", description: "User story:\nAs a user, I want to...\n\nAcceptance criteria:\n- [ ] ", priority: "medium" },
                    { label: "Code Review", title: "Review PR: ", description: "PR link:\n\nFocus areas:\n- ", priority: "medium" },
                    { label: "Research", title: "Research: ", description: "Goal:\n\nQuestions to answer:\n1. \n\nDeliverables:", priority: "low" },
                    { label: "Documentation", title: "Docs: ", description: "What needs to be documented:\n\nAudience:", priority: "low" },
                    { label: "Testing", title: "Test: ", description: "Scope:\n\nTest cases:\n- [ ] ", priority: "medium" },
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setNewTask((t) => ({ ...t, title: tpl.title, description: tpl.description, priority: tpl.priority }))}
                      className="text-xs px-2.5 py-1 rounded-full border bg-secondary/50 hover:bg-secondary hover:border-primary/50 transition-colors"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Task Title</label>
                <Input
                  placeholder="Enter task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe the task"
                  rows={3}
                  value={newTask.description}
                  onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Phase</label>
                  <Select value={newTask.phase} onValueChange={(v) => setNewTask((t) => ({ ...t, phase: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product-modeling">Product Modeling</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask((t) => ({ ...t, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewTaskOpen(false)}>Cancel</Button>
              <Button onClick={handleAddTask} disabled={!newTask.title.trim()}>Create Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Task Confirm ── */}
        <Dialog open={!!taskToDelete} onOpenChange={(open) => { if (!open) setTaskToDelete(null); }}>
          <DialogContent className="sm:max-w-100">
            <DialogHeader>
              <DialogTitle>Delete Task</DialogTitle>
              <DialogDescription>
                Delete <strong>{taskToDelete?.title}</strong>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteTask}>Delete Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add File Dialog ── */}
        <Dialog open={isAddFileOpen} onOpenChange={setIsAddFileOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add File</DialogTitle>
              <DialogDescription>Add a deliverable or reference file to this project</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              {/* File upload area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Upload File</label>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  {selectedFile ? (
                    <span className="text-sm font-medium text-primary">{selectedFile.name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Click to choose a file</span>
                  )}
                  <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, images up to 20MB</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.svg,.txt,.md,.csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <span>or add by URL</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {!selectedFile && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">File Name</label>
                  <Input
                    placeholder="e.g. Design Mockups v2"
                    value={newFile.name}
                    onChange={(e) => setNewFile((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Phase</label>
                  <Select value={newFile.phase} onValueChange={(v) => setNewFile((f) => ({ ...f, phase: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product-modeling">Product Modeling</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={newFile.type} onValueChange={(v) => setNewFile((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doc">Document</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="code">Code</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!selectedFile && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={newFile.url}
                    onChange={(e) => setNewFile((f) => ({ ...f, url: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAddFileOpen(false); setSelectedFile(null); }}>Cancel</Button>
              <Button
                onClick={handleAddFile}
                disabled={fileUploading || (!selectedFile && !newFile.name.trim())}
              >
                {fileUploading ? "Uploading…" : "Add File"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete File Confirm ── */}
        <Dialog open={!!fileToDelete} onOpenChange={(open) => { if (!open) setFileToDelete(null); }}>
          <DialogContent className="sm:max-w-100">
            <DialogHeader>
              <DialogTitle>Delete File</DialogTitle>
              <DialogDescription>
                Delete <strong>{fileToDelete?.name}</strong>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFileToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteFile}>Delete File</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Task Detail Sidebar ── */}
        {selectedTask && (
          <div className="fixed inset-x-0 sm:inset-x-auto sm:inset-y-0 sm:right-0 w-full sm:w-100 bg-card sm:border-l shadow-xl z-50 sm:top-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Task Details</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setTaskToDelete(selectedTask)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTask(null)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <h4 className="text-lg font-semibold">{selectedTask.title}</h4>
                  <p className="text-sm text-muted-foreground mt-2">{selectedTask.description}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" /> Assignee
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedTask.assignee ? (
                        <>
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={selectedTask.assignee.avatar} />
                            <AvatarFallback>{selectedTask.assignee.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{selectedTask.assignee.name}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Flag className="h-4 w-4" /> Priority
                    </span>
                    <Badge className={priorityColors[selectedTask.priority]}>{selectedTask.priority}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Due Date
                    </span>
                    <span className="text-sm">
                      {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Phase
                    </span>
                    <Badge variant="outline" className={phaseColors[selectedTask.phase]}>
                      {phaseLabels[selectedTask.phase]}
                    </Badge>
                  </div>
                </div>
                {/* Dependencies */}
                <div className="pt-4 border-t">
                  <h5 className="font-medium mb-3 flex items-center gap-2">
                    <GitMerge className="h-4 w-4" />Dependencies
                  </h5>
                  <div className="space-y-2 mb-3">
                    {(selectedTask.blockedByIds ?? []).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Blocked by</p>
                        {selectedTask.blockedByIds!.map((blockingId) => {
                          const blocker = tasks.find((t) => t.id === blockingId);
                          return (
                            <div key={blockingId} className="flex items-center justify-between text-xs bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 mb-1">
                              <span className="text-red-700 truncate">{blocker?.title || blockingId}</span>
                              <button
                                onClick={async () => {
                                  await projectApi.removeDependency(project.id, selectedTask.id, blockingId);
                                  setTasks((prev) => prev.map((t) => t.id === selectedTask.id ? { ...t, blockedByIds: t.blockedByIds?.filter((id) => id !== blockingId) } : t));
                                }}
                                className="ml-2 text-muted-foreground hover:text-destructive shrink-0"
                              >
                                <Unlink className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(selectedTask.blockingIds ?? []).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Blocking</p>
                        {selectedTask.blockingIds!.map((blockedId) => {
                          const blocked = tasks.find((t) => t.id === blockedId);
                          return (
                            <div key={blockedId} className="flex items-center justify-between text-xs bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1.5 mb-1">
                              <span className="text-yellow-400 truncate">{blocked?.title || blockedId}</span>
                              <button
                                onClick={async () => {
                                  await projectApi.removeDependency(project.id, blockedId, selectedTask.id);
                                  setTasks((prev) => prev.map((t) => t.id === selectedTask.id ? { ...t, blockingIds: t.blockingIds?.filter((id) => id !== blockedId) } : t));
                                }}
                                className="ml-2 text-muted-foreground hover:text-destructive shrink-0"
                              >
                                <Unlink className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Select
                      onValueChange={async (blockingTaskId) => {
                        await projectApi.addDependency(project.id, selectedTask.id, blockingTaskId);
                        setTasks((prev) => prev.map((t) => t.id === selectedTask.id
                          ? { ...t, blockedByIds: [...(t.blockedByIds ?? []), blockingTaskId] }
                          : t.id === blockingTaskId
                            ? { ...t, blockingIds: [...(t.blockingIds ?? []), selectedTask.id] }
                            : t
                        ));
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="+ Add blocker..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tasks
                          .filter((t) => t.id !== selectedTask.id && !(selectedTask.blockedByIds ?? []).includes(t.id))
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Checklist */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium">Checklist</h5>
                    {checklist.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {checklist.filter((i) => i.checked).length}/{checklist.length}
                      </span>
                    )}
                  </div>
                  {checklist.length > 0 && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.round((checklist.filter((i) => i.checked).length / checklist.length) * 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 mb-2">
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)}
                          className="h-3.5 w-3.5 accent-primary shrink-0"
                        />
                        <span className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                          {item.text}
                        </span>
                        <button
                          onClick={() => handleDeleteChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add item..."
                      value={checklistInput}
                      onChange={(e) => setChecklistInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddChecklistItem(); } }}
                      className="h-8 text-xs"
                    />
                    <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleAddChecklistItem} disabled={!checklistInput.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h5 className="font-medium mb-3">Comments</h5>
                  <div className="space-y-3 mb-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-xs">{c.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted/50 rounded-lg p-2">
                          <p className="text-xs font-medium">{c.userName}</p>
                          <p className="text-sm mt-0.5">{c.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      className="flex-1"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    />
                    <Button size="icon" className="h-9 w-9" onClick={handleAddComment} disabled={commentSubmitting || !commentInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
