// Project Phase Engine Types
export type ProjectPhase =
  | "product-modeling"
  | "development"
  | "marketing"
  | "completed";

export interface Project {
  id: string;
  ownerId?: string;
  userId?: string;
  name: string;
  description: string;
  phase: ProjectPhase;
  progress: number;
  team: TeamMember[];
  members: ProjectMember[];
  startDate: string;
  dueDate: string;
  tasks: Task[];
  priority: "low" | "medium" | "high" | "critical";
  status: "active" | "on-hold" | "completed";
  githubUrl?: string;
  localPath?: string;
  lastCommit?: {
    message: string;
    author: string;
    timestamp: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "todo" | "in-progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "critical";
  assignee?: TeamMember;
  projectId: string;
  phase: ProjectPhase;
  dueDate: string;
  createdAt: string;
  tags: string[];
  blockingIds?: string[];
  blockedByIds?: string[];
  commentCount?: number;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  projectId: string;
  text: string;
  checked: boolean;
  position: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  department: string;
  status: "online" | "away" | "offline";
}

export interface Sprint {
  id: string;
  name: string;
  projectId: string;
  startDate: string;
  endDate: string;
  status: "planning" | "active" | "completed";
  tasks: Task[];
  velocity: number;
}

export interface Document {
  id: string;
  title: string;
  type: "doc" | "spreadsheet" | "presentation" | "design" | "code";
  projectId?: string;
  author: TeamMember;
  lastModified: string;
  size: string;
}

export interface GitCommit {
  id: string;
  hash: string;
  message: string;
  author: TeamMember;
  branch: string;
  timestamp: string;
  additions: number;
  deletions: number;
}

export interface GitBranch {
  name: string;
  isDefault: boolean;
  lastCommit: string;
  author: TeamMember;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: TeamMember | "ai";
  timestamp: string;
  type: "text" | "code" | "file";
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  timestamp: string;
  link?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "developer" | "designer" | "viewer";
  department: string;
  avatar: string;
  status: "active" | "inactive" | "suspended";
  lastActive: string;
  createdAt: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: "security" | "workflow" | "access" | "notification";
  enabled: boolean;
  conditions: string[];
  actions: string[];
  createdBy: string;
  createdAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  type: "doc" | "image" | "spreadsheet" | "design" | "code" | "other";
  phase: string;
  url?: string;
  size?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentExtractionStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type EvidenceLocatorType = "PDF_PAGE" | "DOCX_PARAGRAPH";

export interface DocumentExtractionSummary {
  eligible: boolean;
  registrationStatus?: "NOT_PROCESSED" | "PROCESSING" | "FAILED" | "REGISTERED";
  registrationAttempt?: number | null;
  canRetry?: boolean;
  sourceId?: string | null;
  sourceVersion?: number | null;
  contentHash?: string | null;
  status?: DocumentExtractionStatus | null;
  currentAttempt?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  passageCount: number;
}

export interface EvidenceSpan {
  id: string;
  ordinal: number;
  text: string;
  locatorType: EvidenceLocatorType;
  pageNumber?: number | null;
  paragraphNumber?: number | null;
  startOffset?: number | null;
  endOffset?: number | null;
  sourceId: string;
  sourceVersion: number;
  contentHash: string;
  textHash?: string;
}

export interface EvidencePageResponse {
  spans: EvidenceSpan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ProjectMember {
  id: string;
  name?: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  joinedAt: string;
}

export interface Activity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  meta?: Record<string, any>;
  createdAt: string;
}

export interface ProjectChatMessage {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  head: TeamMember;
  members: TeamMember[];
  projects: Project[];
}

export interface GitCommitItem {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorLogin: string;
  authorAvatar: string;
  timestamp: string;
  url: string;
  branch: string;
}

export interface GitBranchItem {
  name: string;
  isDefault: boolean;
  commitSha: string;
  url: string;
  protected: boolean;
}

export interface GitPullItem {
  number: number;
  title: string;
  author: string;
  state: "open" | "closed" | "merged";
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
  draft: boolean;
  labels: string[];
  baseBranch: string;
  headBranch: string;
}

// â”€â”€ Phased workflow (Documentation â†’ Architecture â†’ Implementation â†’ Testing) â”€â”€
// Distinct from ProjectPhase above, which is the coarse product-modeling/development/
// marketing category. This is the fine-grained lifecycle within a project.

export type WorkflowPhase =
  | "requirements"
  | "documentation"
  | "architecture"
  | "implementation"
  | "testing"
  | "review";

export const WORKFLOW_PHASES: WorkflowPhase[] = [
  "requirements",
  "documentation",
  "architecture",
  "implementation",
  "testing",
  "review",
];

export type WorkflowPhaseStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "completed";

export interface ProjectPhaseState {
  id: string;
  projectId: string;
  phase: WorkflowPhase;
  status: WorkflowPhaseStatus;
  startedAt?: string;
  completedAt?: string;
  approvedById?: string;
  approvedAt?: string;
  notes?: string;
  currentArtifactId?: string | null;
  approvalCandidateArtifactId?: string | null;
  currentApprovedArtifactId?: string | null;
  activeRunId?: string | null;
  stateVersion: number;
  isCurrent?: boolean;
  hasUsableAuthority?: boolean;
  isStale?: boolean;
  staleReason?: string | null;
  upstreamPhase?: string | null;
  activeConfirmationId?: string | null;
  artifactConfirmationId?: string | null;
}

export interface PhaseArtifact {
  id: string;
  projectId: string;
  phase: WorkflowPhase;
  type: string;
  title: string;
  content: string;
  structuredContent?: unknown;
  schemaVersion?: number;
  contentHash?: string | null;
  version: number;
  previousVersionId?: string | null;
  basedOnArtifactId?: string | null;
  lifecycleStatus?: "DRAFT" | "AWAITING_APPROVAL" | "APPROVED" | "SUPERSEDED";
  createdBy: string;
  createdAt: string;
  approved: boolean;
}

export interface PhaseApproval {
  id: string;
  projectId: string;
  phase: WorkflowPhase;
  artifactId?: string | null;
  artifactVersion?: number | null;
  artifactContentHash?: string | null;
  approvedById: string;
  approvedAt: string;
  decision: "approved" | "changes_requested" | "rejected";
  comments?: string;
}

export interface PhaseReadiness {
  ready: boolean;
  artifactId: string;
  contentHash: string;
  errors?: Array<string | { code?: string; message?: string; path?: string }>;
  warnings?: Array<string | { code?: string; message?: string; path?: string }>;
  [key: string]: unknown;
}

export interface KanbanTaskDependency {
  taskId: string;
  dependencyTaskId: string;
  dependencyTask?: {
    id: string;
    title: string;
    implementationState?: string | null;
  };
}

export interface ImplementationExecution {
  id: string;
  taskId: string;
  state: string;
  changedFiles?: string[];
  diffSummary?: string | null;
  validationEvidence?: Record<string, unknown> | null;
  failureDiagnostic?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface ImplementationTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  targetFiles: string[];
  status: string;
  implementationEligible: boolean;
  implementationState?: string | null;
  stateVersion: number;
  repositoryId?: string | null;
  architectureComponentIds: string[];
  dependencies: KanbanTaskDependency[];
}

export interface KanbanStage {
  id: string;
  title: string;
  order: number;
  tasks: ImplementationTask[];
}

export interface KanbanBoard {
  id: string;
  projectId: string;
  stages: KanbanStage[];
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  triggerType: string;
  operation?: string;
  currentPhase: WorkflowPhase;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  modelUsage?: { model: string; prompt_tokens: number; completion_tokens: number };
  costUSD?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export type LiveBriefClaimCategory = "GOAL" | "USER_PERSONA" | "WORKFLOW" | "SCOPE_IN" | "SCOPE_OUT" | "CONSTRAINT" | "ACCEPTANCE_CRITERION";
export type LiveBriefClaimStatus = "PROPOSED" | "ACCEPTED" | "CONTESTED" | "SUPERSEDED" | "REJECTED";

export interface LiveBriefRevision {
  id: string;
  projectId: string;
  revisionNumber: number;
  title: string;
  markdownContent: string;
  structuredClaims: Array<Record<string, unknown>>;
  evidenceManifest: Array<Record<string, unknown>>;
  contentHash: string;
  changeSummary: string;
  createdAt: string;
}

export interface LiveBriefConfirmation {
  id: string;
  briefRevisionId: string;
  briefRevisionNumber: number;
  briefContentHash: string;
  status: "ACTIVE" | "STALE";
  confirmedAt: string;
}

export interface LiveBriefClaim {
  id: string;
  claimKey: string;
  version: number;
  category: LiveBriefClaimCategory;
  title: string;
  content: string;
  provenance: "DOCUMENT_EVIDENCE" | "USER_STATED" | "MODEL_PROPOSED";
  status: LiveBriefClaimStatus;
  sourceSpanIds: string[];
}

export interface LiveBriefQuestion {
  id: string;
  category: LiveBriefClaimCategory;
  question: string;
  suggestedOptions: string[];
  status: "OPEN" | "ANSWERED" | "DISMISSED";
  answer?: string | null;
}

export interface LiveBriefContradiction {
  id: string;
  claimKeyA: string;
  claimKeyB: string;
  description: string;
  status: "ACTIVE" | "RESOLVED" | "DISMISSED";
  resolutionNote?: string | null;
}

export interface LiveBriefWorkspace {
  state: {
    status: "EMPTY" | "EXPLORING" | "READY_FOR_CONFIRMATION" | "CONFIRMED";
    activeSessionId?: string | null;
    currentBriefRevision: LiveBriefRevision | null;
    currentConfirmation: LiveBriefConfirmation | null;
  } | null;
  readiness: {
    ready: boolean;
    blockers: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  };
  claims: LiveBriefClaim[];
  questions: LiveBriefQuestion[];
  contradictions: LiveBriefContradiction[];
  revisions: LiveBriefRevision[];
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: string }>;
  sources: Array<{ id: string; projectFileId: string; sourceVersion: number; originalFilename: string; extractionStatus: DocumentExtractionStatus }>;
}

// â”€â”€ Multi-Repository Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type ProjectRepositoryRole =
  | "frontend"
  | "backend"
  | "mobile"
  | "infrastructure"
  | "shared_library"
  | "documentation"
  | "data"
  | "custom";

export interface ProjectRepository {
  id: string;
  projectId: string;
  name: string;
  role: ProjectRepositoryRole;
  githubUrl: string;
  defaultBranch: string;
  buildCommand?: string | null;
  testCommand?: string | null;
  lintCommand?: string | null;
  typecheckCommand?: string | null;
  localPath?: string | null;
  currentIndexedCommit?: string | null;
  languages?: string[];
  frameworks?: string[];
  isPrimary: boolean;
  dependencies?: string[];
  hasToken: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectRepositoryInput {
  name: string;
  role: ProjectRepositoryRole;
  githubUrl: string;
  githubToken?: string;
  defaultBranch?: string;
  buildCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  typecheckCommand?: string;
  dependencies?: string[];
  localPath?: string;
}

export interface BindExistingRepositoryInput {
  localPath: string;
  name?: string;
  role?: ProjectRepositoryRole | string;
  defaultBranch?: string;
  githubUrl?: string;
  githubToken?: string;
  isPrimary?: boolean;
}

export interface BootstrapPlan {
  idempotencyKey: string;
  templateId: string;
  templateName: string;
  description: string;
  selectedStack: {
    language: string;
    framework?: string;
    buildCommand?: string;
    testCommand?: string;
    lintCommand?: string;
    typecheckCommand?: string;
  };
  repositoryRoot: string;
  baseBranch: string;
  architectureFingerprint: string;
  plannedFiles: Array<{
    path: string;
    description: string;
    preview?: string;
  }>;
  status: "PREPARED";
}

export interface BootstrapResult {
  repository: ProjectRepository;
  baselineCommitSha: string;
  baseBranch: string;
  selectedStack: {
    language: string;
    framework?: string;
  };
  attemptId: string;
}

export interface BootstrapTemplateInfo {
  id: string;
  name: string;
  language: string;
  framework?: string;
  description: string;
}

export interface ArtifactCurrentnessInfo {
  isCurrent: boolean;
  isStale: boolean;
  status: "CURRENT" | "STALE" | "NO_ACTIVE_BRIEF" | "NO_AUTHORITY" | string;
  staleReason?: string | null;
  upstreamPhase?: string | null;
  activeConfirmationId?: string | null;
  artifactConfirmationId?: string | null;
  phase?: string;
  artifactId?: string;
}

export interface ArtifactDiffSummary {
  phase: "requirements" | "documentation" | "architecture";
  baseArtifact: {
    id: string;
    version: number;
    title: string;
    contentHash: string | null;
  };
  targetArtifact: {
    id: string;
    version: number;
    title: string;
    contentHash: string | null;
  };
  diff: {
    changedRootSections?: string[];
    addedIds?: string[];
    removedIds?: string[];
    retainedIds?: string[];
    modifiedIds?: string[];
    [key: string]: unknown;
  };
}

// ── Canonical Structured Planning Artifact Schemas ──────────────────────────

export interface RequirementsStructuredContent {
  projectGoal?: string;
  problemStatement?: string;
  usersAndActors?: Array<{ id: string; name: string; description: string }>;
  userStories?: Array<{
    id: string;
    actor: string;
    capability: string;
    benefit: string;
    acceptanceCriteriaIds: string[];
  }>;
  functionalRequirements?: Array<{ id: string; title: string; description: string }>;
  nonFunctionalRequirements?: Array<{ id: string; title: string; description: string }>;
  constraints?: Array<{ id: string; description: string }>;
  integrations?: Array<{ id: string; name: string; description: string; required: boolean }>;
  assumptions?: Array<{ id: string; description: string }>;
  acceptanceCriteria?: Array<{ id: string; description: string; relatedRequirementIds: string[] }>;
  outOfScope?: Array<{ id: string; description: string }>;
  unresolvedQuestions?: Array<{ id: string; question: string }>;
}

export interface DocumentationStructuredContent {
  overview?: {
    summary?: string;
    scope?: string;
    goals?: string[];
    nonGoals?: string[];
  };
  systemActors?: Array<{
    id: string;
    name: string;
    description: string;
    sourceActorIds?: string[];
  }>;
  features?: Array<{
    id: string;
    title: string;
    description: string;
    workflowSteps?: string[];
    actorIds?: string[];
    access?: "public" | "controlled" | string;
    sourceRequirementIds?: string[];
    sourceUserStoryIds?: string[];
  }>;
  apiContracts?: {
    applicable: boolean;
    rationale?: string;
    items?: Array<{
      id: string;
      name: string;
      description?: string;
      interaction: {
        kind: "http" | "event" | "command" | "file" | string;
        method?: string;
        path?: string;
        channel?: string;
        command?: string;
        direction?: string;
        contractName?: string;
      };
      access?: "public" | "controlled" | string;
      input?: {
        description?: string;
        fields?: Array<{
          name: string;
          logicalType: string;
          required: boolean;
          description?: string;
          allowedValues?: string[];
          validationRules?: string[];
        }>;
      };
      success?: {
        description?: string;
        fields?: Array<{
          name: string;
          logicalType: string;
          required?: boolean;
          description?: string;
          allowedValues?: string[];
          validationRules?: string[];
        }>;
      };
      relatedFeatureIds?: string[];
      relatedEntityIds?: string[];
      errorBehaviorIds?: string[];
      sourceRequirementIds?: string[];
      sourceUserStoryIds?: string[];
    }>;
  };
  dataEntities?: {
    applicable: boolean;
    rationale?: string;
    items?: Array<{
      id: string;
      name: string;
      description?: string;
      fields?: Array<{
        name: string;
        logicalType: string;
        required: boolean;
        description?: string;
        allowedValues?: string[];
        validationRules?: string[];
      }>;
      relationships?: Array<{
        targetEntityId: string;
        cardinality: "one_to_one" | "one_to_many" | "many_to_one" | "many_to_many" | string;
        required: boolean;
        description: string;
      }>;
      sourceRequirementIds?: string[];
      sourceUserStoryIds?: string[];
    }>;
  };
  businessRules?: Array<{
    id: string;
    title: string;
    condition: string;
    expectedBehavior: string;
    relatedFeatureIds?: string[];
    relatedEntityIds?: string[];
    sourceRequirementIds?: string[];
    sourceUserStoryIds?: string[];
  }>;
  permissionRules?: {
    applicable: boolean;
    rationale?: string;
    items?: Array<{
      id: string;
      title: string;
      description?: string;
      effect: "allow" | "deny";
      actorIds?: string[];
      actions?: string[];
      relatedFeatureIds?: string[];
      relatedApiContractIds?: string[];
    }>;
  };
  errorBehaviors?: Array<{
    id: string;
    code: string;
    scenario: string;
    expectedSystemBehavior: string;
    recoveryBehavior?: string;
    relatedFeatureIds?: string[];
    relatedApiContractIds?: string[];
    httpStatus?: number;
  }>;
  edgeCases?: Array<{
    id: string;
    scenario: string;
    expectedHandling: string;
    relatedFeatureIds?: string[];
    relatedApiContractIds?: string[];
    relatedEntityIds?: string[];
  }>;
  unresolvedQuestions?: Array<{
    id: string;
    question: string;
    impact: string;
  }>;
}

export interface ArchitectureStructuredContent {
  overview?: {
    approach?: string;
    systemBoundary?: string;
    technicalDirection?: string;
  };
  components?: Array<{
    id: string;
    name: string;
    responsibility: string;
    boundary: string;
    dependencyIds: string[];
    documentationFeatureIds: string[];
    designNotes: string;
  }>;
  dataDesign?: {
    applicable: boolean;
    rationale?: string;
    items?: Array<{
      id: string;
      documentationEntityId: string;
      componentId: string;
      persistence: string;
      lifecycle: string;
      consistency: string;
    }>;
  };
  interfaceDesign?: {
    applicable: boolean;
    rationale?: string;
    items?: Array<{
      id: string;
      documentationApiId: string;
      componentId: string;
      boundary: string;
      enforcement: string;
      transport: string;
    }>;
  };
  integrationDesign?: {
    applicable: boolean;
    rationale?: string;
    items?: Array<{
      id: string;
      componentId: string;
      requirementIntegrationIds: string[];
      externalBoundary: string;
      failureStrategy: string;
      credentialOwner: "project_owner" | "platform_operator" | "external_operator" | string;
      reliability: string;
    }>;
  };
  crossCuttingDesign?: {
    authorization?: string;
    security?: string;
    reliability?: string;
    observability?: string;
    enforcedFeatureIds?: string[];
    nfrTreatments?: Array<{ requirementId: string; treatment: string }>;
  };
  implementationSequence?: string[];
  unresolvedQuestions?: Array<{
    id: string;
    question: string;
    blocksDecision: boolean;
  }>;
}


