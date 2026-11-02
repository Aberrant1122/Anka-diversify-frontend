"use client";

import { useState } from "react";
import { Search, Plus, Filter, Grid3X3, List, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectApi } from "@/lib/project-api";

interface ProjectsHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  phaseFilter: string;
  setPhaseFilter: (filter: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  filteredProjectsCount: number;
  phaseLabels: Record<string, string>;
  onAddProject: (project: {
    name: string;
    description: string;
    phase: string;
    githubUrl: string;
    githubToken: string;
    priority: string;
    teamLead?: string;
  }) => void;
}

export function ProjectsHeader({
  searchQuery,
  setSearchQuery,
  phaseFilter,
  setPhaseFilter,
  viewMode,
  setViewMode,
  filteredProjectsCount,
  phaseLabels,
  onAddProject,
}: ProjectsHeaderProps) {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [startingPhase, setStartingPhase] = useState("development");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    message?: string;
    username?: string;
  }>({ status: 'idle' });
  const [priority, setPriority] = useState("medium");
  const [teamLead, setTeamLead] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateToken = async (token: string) => {
    if (!token || token.length < 20) {
      setTokenValidation({ status: 'idle' });
      return;
    }

    setTokenValidation({ status: 'validating', message: 'Validating token...' });

    try {
      const result = await projectApi.validateGitHubToken(token);

      console.log('Validation result:', result); // Debug log

      if (result.valid) {
        setTokenValidation({
          status: 'valid',
          message: `Valid token for ${result.username}`,
          username: result.username,
        });
      } else {
        setTokenValidation({
          status: 'invalid',
          message: result.error || 'Invalid token',
        });
      }
    } catch (error: unknown) {
      console.error('Token validation error:', error);
      setTokenValidation({
        status: 'invalid',
        message: error instanceof Error ? error.message : 'Failed to validate token. Check backend console for details.',
      });
    }
  };

  const handleTokenChange = (value: string) => {
    setGithubToken(value);
    // Debounce validation
    if (value.length >= 20) {
      const timeoutId = setTimeout(() => validateToken(value), 500);
      return () => clearTimeout(timeoutId);
    } else {
      setTokenValidation({ status: 'idle' });
    }
  };

  const handleAddProject = async () => {
    if (!projectName || (githubUrl && !githubToken)) {
      console.error("Project name, GitHub URL, and GitHub token are required");
      return;
    }

    if (githubToken && tokenValidation.status !== 'valid') {
      console.error("Please provide a valid GitHub token");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddProject({
        name: projectName,
        description: projectDescription,
        phase: startingPhase,
        githubUrl: githubUrl,
        githubToken: githubToken,
        priority: priority,
        teamLead: teamLead || undefined,
      });

      // Reset form
      setProjectName("");
      setProjectDescription("");
      setStartingPhase("development");
      setGithubUrl("");
      setGithubToken("");
      setShowToken(false);
      setTokenValidation({ status: 'idle' });
      setPriority("medium");
      setTeamLead("");
      setIsNewProjectOpen(false);
    } catch (err) {
      console.error("Error creating project:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <p className="text-muted-foreground whitespace-nowrap">
          {filteredProjectsCount}{" "}
          {filteredProjectsCount === 1 ? "project" : "projects"}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        {/* Add Project Button */}
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Project</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Add a new project to your workspace with all details
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="flex flex-col gap-2">
                <label htmlFor="projectName" className="text-sm font-medium">
                  Project Name
                </label>
                <Input
                  id="projectName"
                  placeholder="Enter project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="description"
                  placeholder="Describe your project"
                  rows={3}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="phase" className="text-sm font-medium">
                    Starting Phase
                  </label>
                  <Select
                    value={startingPhase}
                    onValueChange={setStartingPhase}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product-modeling">
                        Legacy planning
                      </SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="priority" className="text-sm font-medium">
                    Priority
                  </label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="githubUrl" className="text-sm font-medium">
                  GitHub Repository URL (optional while planning)
                </label>
                <Input
                  id="githubUrl"
                  type="url"
                  placeholder="https://github.com/username/repository"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="githubToken" className="text-sm font-medium">
                  GitHub Personal Access Token <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="githubToken"
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => handleTokenChange(e.target.value)}
                    required
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {tokenValidation.status === 'validating' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {tokenValidation.status === 'valid' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {tokenValidation.status === 'invalid' && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {tokenValidation.message && (
                  <p className={`text-xs ${tokenValidation.status === 'valid' ? 'text-green-600' : 'text-destructive'}`}>
                    {tokenValidation.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Required when connecting a private repository. Publication needs separate approval.
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-1"
                  >
                    Create token
                  </a>
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleAddProject}
                  className="flex-1 gap-2"
                  disabled={isSubmitting || !projectName || (!!githubUrl && (!githubToken || tokenValidation.status !== 'valid'))}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Project...</span>
                    </>
                  ) : (
                    "Add Project"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsNewProjectOpen(false);
                    setProjectName("");
                    setProjectDescription("");
                    setStartingPhase("development");
                    setGithubUrl("");
                    setGithubToken("");
                    setShowToken(false);
                    setTokenValidation({ status: 'idle' });
                    setPriority("medium");
                    setTeamLead("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search and Filters */}
        <div className="relative w-full sm:hidden mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary pl-9 border-border focus:bg-background"
          />
        </div>
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 lg:w-64 bg-secondary pl-9 border-border focus:bg-background"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{phaseFilter === "all" ? "All Phases" : phaseLabels[phaseFilter]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filter by Phase</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPhaseFilter("all")}>
              All Phases
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setPhaseFilter("product-modeling")}
            >
              Legacy planning
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPhaseFilter("development")}>
              Development
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPhaseFilter("marketing")}>
              Marketing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPhaseFilter("completed")}>
              Completed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {viewMode === "grid" ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid3X3 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{viewMode === "grid" ? "List View" : "Grid View"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>View Mode</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setViewMode("grid")}>
              Grid View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewMode("list")}>
              List View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
