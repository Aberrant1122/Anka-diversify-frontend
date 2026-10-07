import type { Project, Task, ProjectFile, Activity, Comment, ProjectChatMessage, ProjectMember, Sprint, ChecklistItem, GitCommitItem, GitBranchItem, GitPullItem, ProjectPhaseState, PhaseArtifact, PhaseApproval, WorkflowPhase, WorkflowRun, ProjectRepository, CreateProjectRepositoryInput, PhaseReadiness, KanbanBoard, ImplementationExecution, ImplementationTask } from "./types";

export interface AppNotification {
  id: string;
  type: "mention" | "comment" | "assignment" | "alert" | "system";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  entityId?: string;
  entityType?: string;
  createdAt: string;
}

function mapNotification(n: any): AppNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    entityId: n.entityId,
    entityType: n.entityType,
    createdAt: n.createdAt,
  };
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function getHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return { "Content-Type": "application/json", "X-User-ID": "demo-user-id" };
  }
  const token = localStorage.getItem("authToken");
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  return {
    "Content-Type": "application/json",
    "X-User-ID": user?.id || "demo-user-id",
    "X-User-Name": user?.name || "Demo User",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function checkStatus(res: Response): Response {
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:unauthorized"));
  }
  return res;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = checkStatus(await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...init?.headers },
  }));
  const payload = await res.json().catch(() => null) as { data?: T; message?: string; error?: string; details?: unknown } | null;
  if (!res.ok) {
    throw new ApiError(
      payload?.message || payload?.error || `Request failed with status ${res.status}`,
      res.status,
      payload?.error,
      payload?.details,
    );
  }
  if (!payload || !("data" in payload)) throw new ApiError("Backend returned an invalid response.", res.status);
  return payload.data as T;
}

function idempotencyHeaders(): Record<string, string> {
  return { "Idempotency-Key": crypto.randomUUID() };
}

// in-progress ↔ in_progress conversion
function toFrontendStatus(s: string): Task["status"] {
  if (s === "in_progress") return "in-progress";
  return s as Task["status"];
}
function toBackendStatus(s: string): string {
  if (s === "in-progress") return "in_progress";
  return s;
}

function mapTask(t: any, projectId: string): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description || "",
    status: toFrontendStatus(t.status),
    priority: t.priority as Task["priority"],
    projectId: t.projectId || projectId,
    phase: (t.phase || "development") as Task["phase"],
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : "",
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : "",
    tags: [],
    blockingIds: t.blockingIds || [],
    blockedByIds: t.blockedByIds || [],
    commentCount: t.commentCount ?? 0,
  };
}

// Map backend project row → frontend Project shape
function mapProject(p: any): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description || "",
    phase: p.phase || "product-modeling",
    progress: p.progress ?? 0,
    priority: p.priority || "medium",
    status: p.status || "active",
    githubUrl: p.githubUrl || undefined,
    localPath: p.localPath || undefined,
    startDate: p.startDate ? new Date(p.startDate).toISOString() : new Date().toISOString(),
    dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : new Date().toISOString(),
    team: [],
    tasks: (p.tasks || []).map((t: any) => mapTask(t, p.id)),
    members: (p.members || []).map((m: any) => ({
      id: m.user?.id || m.userId,
      name: m.user?.name,
      email: m.user?.email || "",
      role: m.user?.role || "user",
      department: m.user?.department,
      status: m.user?.status || "active",
      joinedAt: m.joinedAt,
    })) as ProjectMember[],
  };
}

function mapSprint(s: any, projectId: string): Sprint {
  return {
    id: s.id,
    name: s.name,
    projectId: s.projectId || projectId,
    startDate: s.startDate ? new Date(s.startDate).toISOString() : "",
    endDate: s.endDate ? new Date(s.endDate).toISOString() : "",
    status: s.status as Sprint["status"],
    velocity: s.velocity ?? 0,
    tasks: (s.tasks || []).map((t: any) => mapTask(t, s.projectId || projectId)),
  };
}

export const projectApi = {
  async getAll(): Promise<Project[]> {
    const res = await fetch(`${BASE_URL}/projects`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET /projects failed: ${res.status}`);
    const { data } = await res.json();
    return (data as any[]).map(mapProject);
  },

  async create(payload: {
    name: string;
    description?: string;
    phase?: string;
    priority?: string;
    githubUrl?: string;
    githubToken?: string;
  }): Promise<Project> {
    const res = await fetch(`${BASE_URL}/projects`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`POST /projects failed: ${res.status}`);
    const { data } = await res.json();
    return mapProject(data);
  },

  async validateGitHubToken(token: string): Promise<{ valid: boolean; username?: string; scopes?: string[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/projects/validate-github-token`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ githubToken: token }),
      });
      checkStatus(res);
      
      const responseData = await res.json();
      
      if (res.ok) {
        return responseData.data;
      } else {
        return { 
          valid: false, 
          error: responseData.error || `Validation failed with status ${res.status}` 
        };
      }
    } catch (error: any) {
      console.error('Validation API error:', error);
      return { 
        valid: false, 
        error: `Network error: ${error.message}. Make sure backend is running.` 
      };
    }
  },

  async updateGitHubToken(projectId: string, token: string): Promise<{ username?: string; scopes?: string[] }> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/github-token`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ githubToken: token }),
    });
    
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || 'Failed to update GitHub token');
    }
    
    const { data } = await res.json();
    return data;
  },

  async getById(id: string): Promise<Project> {
    const res = await fetch(`${BASE_URL}/projects/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET /projects/${id} failed: ${res.status}`);
    const { data } = await res.json();
    return mapProject(data);
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    checkStatus(res);
    if (!res.ok) throw new Error(`DELETE /projects/${id} failed: ${res.status}`);
  },

  async update(
    id: string,
    payload: {
      name?: string;
      description?: string;
      phase?: string;
      priority?: string;
      githubUrl?: string;
      localPath?: string;
      status?: string;
      dueDate?: string;
    },
  ): Promise<Project> {
    const res = await fetch(`${BASE_URL}/projects/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`PUT /projects/${id} failed: ${res.status}`);
    const { data } = await res.json();
    return mapProject(data);
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE /projects/${id} failed: ${res.status}`);
  },

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async getTasks(projectId: string): Promise<Task[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET tasks failed: ${res.status}`);
    const { data } = await res.json();
    return (data as any[]).map((t) => mapTask(t, projectId));
  },

  async createTask(projectId: string, payload: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    phase?: string;
    dueDate?: string;
  }): Promise<Task> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, status: payload.status ? toBackendStatus(payload.status) : undefined }),
    });
    if (!res.ok) throw new Error(`POST task failed: ${res.status}`);
    const { data } = await res.json();
    return mapTask(data, projectId);
  },

  async updateTask(projectId: string, taskId: string, payload: {
    status?: string;
    title?: string;
    description?: string;
    priority?: string;
    phase?: string;
    dueDate?: string;
  }): Promise<Task> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, status: payload.status ? toBackendStatus(payload.status) : undefined }),
    });
    if (!res.ok) throw new Error(`PUT task failed: ${res.status}`);
    const { data } = await res.json();
    return mapTask(data, projectId);
  },

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE task failed: ${res.status}`);
  },

  async syncGithub(projectId: string, githubUrl: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/sync-github`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ githubUrl }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || `Sync failed: ${res.status}`);
    }
  },

  async getRepoFile(projectId: string, filePath: string): Promise<{ path: string; content: string; sha: string } | null> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repo/file?path=${encodeURIComponent(filePath)}`, { headers: getHeaders() });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data;
  },

  async saveRepoFile(projectId: string, filePath: string, content: string, commitMessage?: string): Promise<{ sha: string; url: string }> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repo/file`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ path: filePath, content, commitMessage }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || `Save failed: ${res.status}`);
    }
    const { data } = await res.json();
    return data;
  },

  async applyLocalChanges(projectId: string, changes: { path: string; content: string }[]): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/apply-local`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ changes }),
    });
    if (!res.ok) throw new Error(`Apply local failed: ${res.status}`);
  },

  async getRepoSnapshot(projectId: string): Promise<{ repoName: string; fileTree: string[]; lastSyncedAt: string } | null> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}`, { headers: getHeaders() });
    if (!res.ok) return null;
    const { data } = await res.json();
    const snap = data.repoSnapshot;
    if (!snap) return null;
    return {
      repoName: snap.repoName,
      lastSyncedAt: snap.lastSyncedAt,
      fileTree: typeof snap.fileTree === "string" ? JSON.parse(snap.fileTree) : (snap.fileTree ?? []),
    };
  },

  // ── Files ──────────────────────────────────────────────────────────────────

  async getFiles(projectId: string): Promise<ProjectFile[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/files`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET files failed: ${res.status}`);
    const { data } = await res.json();
    return data as ProjectFile[];
  },

  async uploadFile(projectId: string, file: File, opts: { phase?: string } = {}): Promise<ProjectFile> {
    // Step 1: get presigned S3 URL
    const presignRes = await fetch(`${BASE_URL}/projects/${projectId}/files/presign`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ filename: file.name, mimetype: file.type, phase: opts.phase }),
    });
    if (!presignRes.ok) throw new Error(`Presign failed: ${presignRes.status}`);
    const { data: { uploadUrl, fileUrl, key, type } } = await presignRes.json();

    // Step 2: upload directly to S3 (no auth headers — presigned URL handles it)
    const s3Res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status}`);

    // Step 3: confirm in DB
    const confirmRes = await fetch(`${BASE_URL}/projects/${projectId}/files/confirm`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        name: file.name,
        type,
        phase: opts.phase || "development",
        url: fileUrl,
        s3Key: key,
        size: file.size < 1024 ? `${file.size} B`
          : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      }),
    });
    if (!confirmRes.ok) throw new Error(`Confirm failed: ${confirmRes.status}`);
    const { data } = await confirmRes.json();
    return data as ProjectFile;
  },

  async createFile(projectId: string, payload: {
    name: string;
    type?: string;
    phase?: string;
    url?: string;
    size?: string;
  }): Promise<ProjectFile> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/files`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`POST file failed: ${res.status}`);
    const { data } = await res.json();
    return data as ProjectFile;
  },

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/files/${fileId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE file failed: ${res.status}`);
  },

  async getFileDownloadUrl(projectId: string, fileId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/files/${fileId}/download`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`GET download URL failed: ${res.status}`);
    const { data } = await res.json();
    return data.downloadUrl;
  },

  // ── Members ────────────────────────────────────────────────────────────────

  async getMembers(projectId: string): Promise<ProjectMember[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/members`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET members failed: ${res.status}`);
    const { data } = await res.json();
    return data as ProjectMember[];
  },

  async addMember(projectId: string, userId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/members`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Failed to add member");
    }
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to remove member");
  },

  // ── Chat ───────────────────────────────────────────────────────────────────

  async getChatMessages(projectId: string): Promise<ProjectChatMessage[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/chat`, { headers: getHeaders() });
    if (!res.ok) return [];
    const { data } = await res.json();
    return (data as ProjectChatMessage[]) ?? [];
  },

  async sendChatMessage(projectId: string, content: string): Promise<ProjectChatMessage> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/chat`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`POST chat failed: ${res.status}`);
    const { data } = await res.json();
    return data as ProjectChatMessage;
  },

  // ── Activities ─────────────────────────────────────────────────────────────

  async getActivities(projectId: string): Promise<Activity[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/activities`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET activities failed: ${res.status}`);
    const { data } = await res.json();
    return data as Activity[];
  },

  // ── Comments ───────────────────────────────────────────────────────────────

  async getComments(projectId: string, taskId: string): Promise<Comment[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}/comments`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET comments failed: ${res.status}`);
    const { data } = await res.json();
    return data as Comment[];
  },

  async createComment(projectId: string, taskId: string, content: string): Promise<Comment> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`POST comment failed: ${res.status}`);
    const { data } = await res.json();
    return data as Comment;
  },

  async deleteComment(projectId: string, taskId: string, commentId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE comment failed: ${res.status}`);
  },

  // ── Sprints ────────────────────────────────────────────────────────────────

  async getSprints(projectId: string): Promise<Sprint[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/sprints`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET sprints failed: ${res.status}`);
    const { data } = await res.json();
    return (data as any[]).map((s) => mapSprint(s, projectId));
  },

  async createSprint(projectId: string, data: {
    name: string;
    goal?: string;
    startDate: string;
    endDate: string;
    velocity?: number;
  }): Promise<Sprint> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/sprints`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`POST sprint failed: ${res.status}`);
    const { data: sprint } = await res.json();
    return mapSprint(sprint, projectId);
  },

  async updateSprint(projectId: string, sprintId: string, data: Partial<{
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    status: string;
    velocity: number;
  }>): Promise<Sprint> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/sprints/${sprintId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`PUT sprint failed: ${res.status}`);
    const { data: sprint } = await res.json();
    return mapSprint(sprint, projectId);
  },

  async deleteSprint(projectId: string, sprintId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/sprints/${sprintId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE sprint failed: ${res.status}`);
  },

  async addTaskToSprint(projectId: string, sprintId: string, taskId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/sprints/${sprintId}/tasks`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok) throw new Error(`POST sprint task failed: ${res.status}`);
  },

  async removeTaskFromSprint(projectId: string, sprintId: string, taskId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/sprints/${sprintId}/tasks/${taskId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE sprint task failed: ${res.status}`);
  },

  // ── Task Dependencies ───────────────────────────────────────────────────────

  async addDependency(projectId: string, blockedTaskId: string, blockingTaskId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${blockedTaskId}/dependencies`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ blockingTaskId }),
    });
    if (!res.ok) throw new Error(`Add dependency failed: ${res.status}`);
  },

  async removeDependency(projectId: string, blockedTaskId: string, blockingTaskId: string): Promise<void> {
    const res = await fetch(
      `${BASE_URL}/projects/${projectId}/tasks/${blockedTaskId}/dependencies/${blockingTaskId}`,
      { method: "DELETE", headers: getHeaders() },
    );
    if (!res.ok) throw new Error(`Remove dependency failed: ${res.status}`);
  },

  // ── Notifications ───────────────────────────────────────────────────────────

  async getNotifications(): Promise<AppNotification[]> {
    const res = await fetch(`${BASE_URL}/notifications`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET notifications failed: ${res.status}`);
    const { data } = await res.json();
    return (data as any[]).map(mapNotification);
  },

  async getUnreadCount(): Promise<number> {
    const res = await fetch(`${BASE_URL}/notifications/unread-count`, { headers: getHeaders() });
    checkStatus(res);
    if (!res.ok) return 0;
    const { count } = await res.json();
    return count as number;
  },

  async markNotificationRead(id: string): Promise<void> {
    await fetch(`${BASE_URL}/notifications/${id}/read`, { method: "PUT", headers: getHeaders() });
  },

  async markAllNotificationsRead(): Promise<void> {
    await fetch(`${BASE_URL}/notifications/read-all`, { method: "PUT", headers: getHeaders() });
  },

  async deleteNotification(id: string): Promise<void> {
    await fetch(`${BASE_URL}/notifications/${id}`, { method: "DELETE", headers: getHeaders() });
  },

  // ── Checklist ───────────────────────────────────────────────────────────────
  async getChecklist(projectId: string, taskId: string): Promise<ChecklistItem[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}/checklist`, { headers: getHeaders() });
    const json = await res.json();
    return (json.data as ChecklistItem[]) ?? [];
  },

  async addChecklistItem(projectId: string, taskId: string, text: string): Promise<ChecklistItem> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}/checklist`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify({ text }),
    });
    const json = await res.json();
    return json.data as ChecklistItem;
  },

  async updateChecklistItem(projectId: string, taskId: string, itemId: string, data: { checked?: boolean; text?: string }): Promise<ChecklistItem> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`, {
      method: "PATCH", headers: getHeaders(), body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data as ChecklistItem;
  },

  async deleteChecklistItem(projectId: string, taskId: string, itemId: string): Promise<void> {
    await fetch(`${BASE_URL}/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`, {
      method: "DELETE", headers: getHeaders(),
    });
  },

  // ── Project Documents (AI-generated) ─────────────────────────────────────

  async createDocument(projectId: string, payload: { title: string; content: string; type: string }): Promise<{ id: string; title: string; projectId: string }> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/documents`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`POST document failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  // ── Global Documents ───────────────────────────────────────────────────────

  async getAllDocuments(): Promise<(ProjectFile & { projectName: string })[]> {
    const res = await fetch(`${BASE_URL}/projects/documents/all`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET all documents failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  // ── Git (live GitHub API) ─────────────────────────────────────────────────

  async getGitCommits(projectId: string, branch?: string): Promise<GitCommitItem[]> {
    const params = branch && branch !== "all" ? `?branch=${encodeURIComponent(branch)}` : "";
    const res = await fetch(`${BASE_URL}/projects/${projectId}/git/commits${params}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET git commits failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async getGitBranches(projectId: string): Promise<GitBranchItem[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/git/branches`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET git branches failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async getGitPulls(projectId: string): Promise<GitPullItem[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/git/pulls`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET git pulls failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  // ── Phased workflow ────────────────────────────────────────────────────────

  async getPhaseStates(projectId: string): Promise<ProjectPhaseState[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/phases`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET phase states failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async startPhase(projectId: string, phase: WorkflowPhase): Promise<ProjectPhaseState> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/phases/${phase}/start`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`POST start phase failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async requestPhaseApproval(projectId: string, phase: WorkflowPhase, artifactId: string, expectedHash: string): Promise<ProjectPhaseState> {
    return apiRequest(`/projects/${projectId}/phases/${phase}/request-approval`, {
      method: "POST",
      body: JSON.stringify({ artifactId, expectedHash }),
    });
  },

  async approvePhase(projectId: string, phase: WorkflowPhase, artifactId: string, expectedHash: string, comments?: string): Promise<ProjectPhaseState[]> {
    return apiRequest(`/projects/${projectId}/phases/${phase}/approve`, {
      method: "POST",
      body: JSON.stringify({ artifactId, expectedHash, ...(comments ? { comments } : {}) }),
    });
  },

  async requestPhaseChanges(projectId: string, phase: WorkflowPhase, artifactId: string, expectedHash: string, comments: string): Promise<ProjectPhaseState> {
    return apiRequest(`/projects/${projectId}/phases/${phase}/request-changes`, {
      method: "POST",
      body: JSON.stringify({ artifactId, expectedHash, comments }),
    });
  },

  async getPhaseApprovals(projectId: string, phase?: WorkflowPhase): Promise<PhaseApproval[]> {
    const params = phase ? `?phase=${encodeURIComponent(phase)}` : "";
    const res = await fetch(`${BASE_URL}/projects/${projectId}/phases/approvals${params}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET phase approvals failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async getPhaseArtifacts(projectId: string, phase?: WorkflowPhase): Promise<PhaseArtifact[]> {
    const params = phase ? `?phase=${encodeURIComponent(phase)}` : "";
    const res = await fetch(`${BASE_URL}/projects/${projectId}/phases/artifacts${params}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET phase artifacts failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async createRequirementsArtifact(projectId: string, data: {
    title: string;
    structuredContent: unknown;
    baseArtifactId?: string;
    baseContentHash?: string;
  }): Promise<PhaseArtifact> {
    return apiRequest(`/projects/${projectId}/phases/artifacts`, {
      method: "POST",
      body: JSON.stringify({ phase: "requirements", ...data }),
    });
  },

  async generateRequirements(projectId: string, brief: string, includeMemory = false): Promise<{ artifact: PhaseArtifact | null; run: WorkflowRun; readiness: PhaseReadiness | null }> {
    return apiRequest(`/projects/${projectId}/phases/requirements/artifacts/generate`, {
      method: "POST",
      headers: idempotencyHeaders(),
      body: JSON.stringify({ brief, includeMemory }),
    });
  },

  async generateDocumentation(projectId: string, includeMemory = false): Promise<{ artifact: PhaseArtifact | null; run: WorkflowRun; readiness: PhaseReadiness | null }> {
    return apiRequest(`/projects/${projectId}/phases/documentation/artifacts/generate`, {
      method: "POST",
      headers: idempotencyHeaders(),
      body: JSON.stringify({ includeMemory }),
    });
  },

  async generateArchitecture(projectId: string, includeMemory = false): Promise<{ artifact: PhaseArtifact | null; run: WorkflowRun; readiness: PhaseReadiness | null }> {
    return apiRequest(`/projects/${projectId}/phases/architecture/artifacts/generate`, {
      method: "POST",
      headers: idempotencyHeaders(),
      body: JSON.stringify({ includeMemory }),
    });
  },

  async revisePhaseArtifact(projectId: string, phase: "requirements" | "documentation" | "architecture", artifact: PhaseArtifact, instruction: string): Promise<{ artifact: PhaseArtifact | null; run: WorkflowRun; readiness: PhaseReadiness | null }> {
    const path = `/projects/${projectId}/phases/${phase}/artifacts/${artifact.id}/${phase === "architecture" ? "revisions/ai" : "revisions"}`;
    const body = phase === "architecture"
      ? { operation: "DOCUMENT_REVISION", baseVersion: artifact.version, baseContentHash: artifact.contentHash, instruction, includeMemory: false, rebaseToCurrentAuthorities: false }
      : { operation: "DOCUMENT_REVISION", instruction, includeMemory: false };
    return apiRequest(path, { method: "POST", headers: idempotencyHeaders(), body: JSON.stringify(body) });
  },

  async getPhaseReadiness(projectId: string, phase: "requirements" | "architecture", artifactId: string, expectedHash?: string): Promise<PhaseReadiness> {
    const query = expectedHash ? `?expectedHash=${encodeURIComponent(expectedHash)}` : "";
    return apiRequest(`/projects/${projectId}/phases/${phase}/artifacts/${artifactId}/readiness${query}`);
  },

  async getWorkflowRuns(projectId: string): Promise<WorkflowRun[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/phases/runs`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET workflow runs failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async getKanbanBoard(projectId: string): Promise<KanbanBoard> {
    return apiRequest(`/projects/${projectId}/kanban`);
  },

  async generateKanbanBoard(projectId: string): Promise<KanbanBoard> {
    return apiRequest(`/projects/${projectId}/kanban/generate`, { method: "POST" });
  },

  async updateImplementationTask(projectId: string, taskId: string, payload: Partial<Pick<ImplementationTask, "title" | "description" | "acceptanceCriteria" | "targetFiles" | "repositoryId">> & { expectedStateVersion: number }): Promise<ImplementationTask> {
    return apiRequest(`/projects/${projectId}/kanban/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  async approveImplementationTask(projectId: string, taskId: string, expectedStateVersion: number): Promise<ImplementationTask> {
    return apiRequest(`/projects/${projectId}/kanban/tasks/${taskId}/approve`, { method: "POST", body: JSON.stringify({ expectedStateVersion }) });
  },

  async startImplementationExecution(projectId: string, taskId: string): Promise<ImplementationExecution> {
    return apiRequest(`/projects/${projectId}/kanban/tasks/${taskId}/executions`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
  },

  async getImplementationExecutions(projectId: string, taskId: string): Promise<ImplementationExecution[]> {
    return apiRequest(`/projects/${projectId}/kanban/tasks/${taskId}/executions`);
  },

  async rejectImplementationExecution(projectId: string, taskId: string, executionId: string, comments: string): Promise<ImplementationExecution> {
    return apiRequest(`/projects/${projectId}/kanban/tasks/${taskId}/executions/${executionId}/reject`, {
      method: "POST",
      body: JSON.stringify({ comments }),
    });
  },

  async resolveClarification(projectId: string, clarificationId: string, selectedOption: string, userNotes?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/kanban/clarifications/${clarificationId}/resolve`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ selectedOption, userNotes }),
    });
    if (!res.ok) throw new Error(`POST resolve clarification failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  // ── Multi-Repository Support ──────────────────────────────────────────
  async getRepositories(projectId: string): Promise<ProjectRepository[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET /projects/${projectId}/repositories failed: ${res.status}`);
    const { data } = await res.json();
    return (data as any[]).map((r) => ({
      ...r,
      dependencies: Array.isArray(r.dependencies) ? r.dependencies : [],
      hasToken: Boolean(r.hasToken),
    }));
  },

  async createRepository(projectId: string, payload: CreateProjectRepositoryInput): Promise<ProjectRepository> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `POST /projects/${projectId}/repositories failed: ${res.status}`);
    }
    const { data } = await res.json();
    return {
      ...data,
      dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
      hasToken: Boolean(data.hasToken),
    };
  },

  async updateRepository(projectId: string, repoId: string, payload: Partial<CreateProjectRepositoryInput>): Promise<ProjectRepository> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories/${repoId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `PUT /projects/${projectId}/repositories/${repoId} failed: ${res.status}`);
    }
    const { data } = await res.json();
    return {
      ...data,
      dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
      hasToken: Boolean(data.hasToken),
    };
  },

  async syncRepository(projectId: string, repoId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories/${repoId}/sync`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `POST /projects/${projectId}/repositories/${repoId}/sync failed: ${res.status}`);
    }
    const { data } = await res.json();
    return data;
  },

  async deleteRepository(projectId: string, repoId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories/${repoId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `DELETE /projects/${projectId}/repositories/${repoId} failed: ${res.status}`);
    }
    return res.json();
  },
};

export type { ProjectRepository };

export const projectRepositoryApi = {
  async list(projectId: string): Promise<ProjectRepository[]> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET repositories failed: ${res.status}`);
    const { data } = await res.json();
    return data;
  },

  async create(
    projectId: string,
    payload: { name: string; role: string; githubUrl: string; githubToken?: string; localPath?: string },
  ): Promise<ProjectRepository> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "" }));
      throw new Error(message || `POST repositories failed: ${res.status}`);
    }
    const { data } = await res.json();
    return data;
  },

  async update(
    projectId: string,
    repoId: string,
    payload: Partial<{ name: string; role: string; githubUrl: string; githubToken: string; localPath: string; buildCommand: string; testCommand: string; lintCommand: string; typecheckCommand: string }>,
  ): Promise<ProjectRepository> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories/${repoId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "" }));
      throw new Error(message || `PUT repository failed: ${res.status}`);
    }
    const { data } = await res.json();
    return data;
  },

  async remove(projectId: string, repoId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories/${repoId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "" }));
      throw new Error(message || `DELETE repository failed: ${res.status}`);
    }
  },

  async sync(projectId: string, repoId: string): Promise<{ repoName: string; lastSyncedAt: string }> {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/repositories/${repoId}/sync`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "" }));
      throw new Error(message || `POST repository sync failed: ${res.status}`);
    }
    const { data } = await res.json();
    return data;
  },
};
