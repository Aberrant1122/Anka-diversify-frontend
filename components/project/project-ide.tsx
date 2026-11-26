"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { projectApi } from "@/lib/project-api";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Folder,
  RefreshCw,
  X,
  AlertCircle,
  Github,
  Loader2,
  Globe,
} from "lucide-react";
import { BrowserPanel } from "./browser-panel";
import { useTheme } from "@/components/theme-provider";

const Editor = dynamic(async () => {
  const [editor] = await Promise.all([import("@monaco-editor/react"), import("@/lib/secure-monaco")]);
  return editor.default;
}, {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

function EditorSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── File tree ────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const path of paths) {
    const parts = path.split("/");
    let nodes = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      let node = nodes.find((n) => n.name === name);
      if (!node) {
        node = { name, path: parts.slice(0, i + 1).join("/"), type: isLast ? "file" : "dir", children: [] };
        nodes.push(node);
        nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      }
      nodes = node.children;
    }
  }
  return root;
}

function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", html: "html",
    py: "python", go: "go", rs: "rust", sh: "shell",
    yml: "yaml", yaml: "yaml", prisma: "prisma", sql: "sql",
  };
  return map[ext] || "plaintext";
}

function fileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "text-blue-400", tsx: "text-blue-400", js: "text-yellow-400", jsx: "text-yellow-400",
    json: "text-yellow-300", md: "text-gray-400", css: "text-pink-400", html: "text-orange-400",
    py: "text-green-400", go: "text-cyan-400", rs: "text-orange-500", prisma: "text-indigo-400",
  };
  return map[ext] || "text-muted-foreground";
}

function TreeItem({ node, depth, selectedPath, openDirs, onToggleDir, onSelectFile, modifiedPaths }: {
  node: TreeNode; depth: number; selectedPath: string | null;
  openDirs: Set<string>; onToggleDir: (p: string) => void;
  onSelectFile: (p: string) => void; modifiedPaths: Set<string>;
}) {
  const isOpen = openDirs.has(node.path);
  const isSelected = node.path === selectedPath;

  if (node.type === "dir") {
    return (
      <div>
        <button onClick={() => onToggleDir(node.path)} style={{ paddingLeft: `${8 + depth * 12}px` }}
          className="flex items-center w-full gap-1 py-0.5 pr-2 hover:bg-accent/50 text-xs rounded">
          {isOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {isOpen ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-400" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-yellow-400" />}
          <span className="truncate text-foreground/80">{node.name}</span>
        </button>
        {isOpen && node.children.map((c) => (
          <TreeItem key={c.path} node={c} depth={depth + 1} selectedPath={selectedPath}
            openDirs={openDirs} onToggleDir={onToggleDir} onSelectFile={onSelectFile} modifiedPaths={modifiedPaths} />
        ))}
      </div>
    );
  }

  return (
    <button onClick={() => onSelectFile(node.path)} style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: "8px" }}
      className={cn("flex items-center w-full gap-1.5 py-0.5 hover:bg-accent/50 text-xs rounded", isSelected && "bg-primary/15 text-primary")}>
      <FileText className={cn("h-3.5 w-3.5 shrink-0", fileColor(node.name))} />
      <span className="truncate flex-1">{node.name}</span>
      {modifiedPaths.has(node.path) && <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />}
    </button>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpenFile {
  path: string;
  content: string;
  savedContent: string;
  loading: boolean;
  error: string | null;
}

export interface AgentFileChange {
  path: string;
  content: string;
  description: string;
}

interface ProjectIDEProps {
  project: Project;
  pendingChanges?: AgentFileChange[] | null;
  onChangesApplied?: () => void;
}


// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectIDE({ project }: ProjectIDEProps) {
  const { resolvedTheme } = useTheme();
  const [snapshot, setSnapshot] = useState<{ repoName: string; fileTree: string[]; lastSyncedAt: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [githubUrl, setGithubUrl] = useState(project.githubUrl || "");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const [showBrowser, setShowBrowser] = useState(false);


  // Load snapshot
  useEffect(() => {
    projectApi.getRepoSnapshot(project.id).then((snap) => {
      if (snap) { setSnapshot(snap); setTreeNodes(buildTree(snap.fileTree)); }
    });
  }, [project.id]);

  const handleSync = async () => {
    if (!githubUrl.trim()) return;
    setIsSyncing(true); setSyncError(null);
    try {
      await projectApi.syncGithub(project.id, githubUrl.trim());
      if (githubUrl.trim() !== project.githubUrl) await projectApi.update(project.id, { githubUrl: githubUrl.trim() });
      const snap = await projectApi.getRepoSnapshot(project.id);
      if (snap) { setSnapshot(snap); setTreeNodes(buildTree(snap.fileTree)); }
    } catch (err) { setSyncError(err instanceof Error ? err.message : "Sync failed"); }
    finally { setIsSyncing(false); }
  };

  const handleToggleDir = (path: string) => {
    setOpenDirs((prev) => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  };

  const handleSelectFile = async (path: string) => {
    if (openFiles.find((f) => f.path === path)) { setActiveTab(path); return; }
    setOpenFiles((prev) => [...prev, { path, content: "", savedContent: "", loading: true, error: null }]);
    setActiveTab(path);
    const file = await projectApi.getRepoFile(project.id, path);
    setOpenFiles((prev) => prev.map((f) => f.path === path
      ? file ? { path, content: file.content, savedContent: file.content, loading: false, error: null }
             : { ...f, loading: false, error: "Failed to load file" }
      : f));
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      if (activeTab === path) setActiveTab(next.length > 0 ? next[next.length - 1].path : null);
      return next;
    });
  };

  const activeFile = openFiles.find((f) => f.path === activeTab) ?? null;
  const modifiedPaths = new Set(openFiles.filter((f) => f.content !== f.savedContent).map((f) => f.path));

  // No repo connected
  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-320px)] gap-4 text-center p-8">
        <Github className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">No repository connected</p>
          <p className="text-sm text-muted-foreground mt-1">Connect a GitHub repo to browse files</p>
        </div>
        <div className="flex gap-2 w-full max-w-sm">
          <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/owner/repo" className="h-8 text-sm" />
          <Button size="sm" onClick={handleSync} disabled={isSyncing || !githubUrl.trim()}>
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Connect"}
          </Button>
        </div>
        {syncError && <p className="text-xs text-destructive">{syncError}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-280px)] overflow-hidden rounded-lg border bg-background">
      {/* File tree */}
      <div className="w-52 shrink-0 border-r border-border flex flex-col bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {snapshot.repoName.split("/")[1]}
          </span>
          <button onClick={handleSync} disabled={isSyncing} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {treeNodes.map((node) => (
            <TreeItem key={node.path} node={node} depth={0} selectedPath={activeTab}
              openDirs={openDirs} onToggleDir={handleToggleDir}
              onSelectFile={handleSelectFile} modifiedPaths={modifiedPaths} />
          ))}
        </div>
      </div>

      {/* Read-only repository viewer */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {/* File tabs */}
        {openFiles.length > 0 && (
          <div className="flex items-center border-b border-border overflow-x-auto shrink-0 bg-muted">
            {openFiles.map((file) => {
              const isActive = file.path === activeTab;
              const modified = file.content !== file.savedContent;
              return (
                <button key={file.path} onClick={() => setActiveTab(file.path)}
                  className={cn("flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-r border-border hover:bg-accent/50 max-w-48 shrink-0 group",
                    isActive ? "bg-background text-foreground border-t border-t-primary" : "text-muted-foreground")}>
                  <FileText className={cn("h-3 w-3 shrink-0", fileColor(file.path.split("/").pop() || ""))} />
                  <span className="truncate">{file.path.split("/").pop()}</span>
                  {modified && <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />}
                  <X className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 hover:opacity-100"
                    onClick={(e) => handleCloseTab(file.path, e)} />
                </button>
              );
            })}
          </div>
        )}

        {activeFile && <div className="px-3 py-2 border-b text-xs text-muted-foreground">{activeFile.path} · Read-only repository view. Propose changes in Workflow.</div>}

        {/* Monaco editor */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeFile ? (
            activeFile.loading ? <EditorSkeleton /> :
            activeFile.error ? (
              <div className="flex-1 flex items-center justify-center text-sm text-destructive gap-2 h-full">
                <AlertCircle className="h-4 w-4" />{activeFile.error}
              </div>
            ) : (
              <Editor
                height="100%"
                language={langFromPath(activeFile.path)}
                value={activeFile.content}
                theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                options={{
                  readOnly:true,
                  fontSize: 13, lineHeight: 20,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: "on", tabSize: 2,
                  renderLineHighlight: "line",
                  smoothScrolling: true,
                  cursorSmoothCaretAnimation: "on",
                  padding: { top: 8 },
                }}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-20" />
              <p className="text-sm">Select a file to inspect</p>
              <p className="text-xs opacity-50">Propose implementation changes in Workflow</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground"><span>Implementation and validation evidence is available in Workflow.</span><Button size="sm" variant="ghost" onClick={()=>setShowBrowser(v=>!v)}><Globe className="h-3 w-3 mr-1"/>Browser</Button></div>
      </div>

      {/* Browser panel — separate right panel */}
      {showBrowser && (
        <div className="w-120 shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 h-8 border-b border-border bg-muted shrink-0">
            <span className="flex items-center gap-1.5 text-xs text-foreground">
              <Globe className="h-3.5 w-3.5" />Browser
            </span>
            <button onClick={() => setShowBrowser(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <BrowserPanel />
          </div>
        </div>
      )}
    </div>
  );
}
