export interface Named {
  id: string;
  description: string;
}
export interface Question {
  id: string;
  question: string;
  blocking: boolean;
}
export interface MainDocument {
  schemaVersion: 1;
  brief: string;
  purpose: string;
  requirements: {
    id: string;
    description: string;
    acceptanceCriteria: Named[];
  }[];
  features: Named[];
  journeys: Named[];
  constraints: string[];
  exclusions: string[];
  questions: Question[];
  decisions: Named[];
  legacySources: string[];
}
export interface VerificationCommand {
  id: string;
  criterionId: string;
  argv: string[];
  cwd: string;
  timeoutMs: number;
}
export interface WorkspaceCapabilities {
  aiGeneration: boolean;
  isolatedValidation?: boolean;
  publication?: boolean;
  runtimeAcceptanceVerified?: boolean;
}
export interface Unit {
  id: string;
  title: string;
  requirementIds: string[];
  dependsOn: string[];
  repositoryId: string;
  files: { path: string; action: "create" | "modify" | "delete" }[];
  commands?: VerificationCommand[];
  checks: {
    id: string;
    criterionId: string;
    type: "contains" | "not_contains" | "json" | "absent";
    path: string;
    expected: string;
  }[];
}
export interface ImplementationArchitectureDocument {
  schemaVersion: 1;
  sourceMain: { id: string; hash: string };
  overview: string;
  components: Named[];
  dataMigrations: string[];
  interfaces: string[];
  security: string[];
  operations: string[];
  repositories: { id: string; baseline: string }[];
  units: Unit[];
  questions: Question[];
}

export interface ValidationArchitectureDocument extends Omit<ImplementationArchitectureDocument,'schemaVersion'> {
  schemaVersion:2;
  validationProfiles:import('./baseline-validation').ValidationProfile[];
}
export type ArchitectureDocument = ImplementationArchitectureDocument | ValidationArchitectureDocument;
export function isImplementationRun(run:WorkspaceRun){return run.purpose===undefined||run.purpose==='IMPLEMENTATION';}

export interface WorkspaceRevision<T = MainDocument | ArchitectureDocument> {
  id: string;
  kind: "MAIN" | "ARCHITECTURE";
  version: number;
  contentHash: string;
  content: T;
  previousId: string | null;
  sourceMainId: string | null;
}
export interface WorkspaceEvent<T = Record<string, unknown>> {
  id: string;
  kind: string;
  payload: T;
}
export interface WorkspaceRun {
  purpose?:"IMPLEMENTATION"|"BASELINE_VALIDATION";
  id: string;
  approvalId: string;
  authority: { unitIds: string[]; units?: Unit[] };
  events: WorkspaceEvent[];
}
export interface WorkspaceView {
  head: {
    stateVersion: number;
    mainId: string | null;
    architectureId: string | null;
    approvalId: string | null;
  };
  documents: WorkspaceRevision[];
  approvals: {
    id: string;
    architectureId: string;
    mainId: string;
    snapshot: { main: MainDocument; architecture: ArchitectureDocument };
  }[];
  runs: WorkspaceRun[];
  operations: {
    id: string;
    kind: string;
    status: string;
    errorCode: string | null;
    result: unknown;
  }[];
  readiness: {
    invalidatedUnitIds: string[];
    approvedMainId: string | null;
    currentMainId: string | null;
  };
  events: WorkspaceEvent[];
  repositories: {
    id: string;
    name: string;
    currentIndexedCommit: string | null;
    materialized: boolean;
  }[];
}
export async function workspaceRequest<T>(
  projectId: string,
  path = "",
  body?: unknown,
): Promise<T> {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("authToken");
  if (!token) throw new Error("Sign in to open this project.");
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const response = await fetch(
    base + "/projects/" + encodeURIComponent(projectId) + "/workspace" + path,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to complete the operation.");
  return result.data;
}

export interface ImplementationEvidence {
  verification: string;
  changeHash: string;
  checks: { passed: boolean }[];
  diffs: { repositoryId: string; diff: string }[];
}
export function isImplementation(
  event: WorkspaceEvent,
): event is WorkspaceEvent<ImplementationEvidence & Record<string, unknown>> {
  return event.kind === "IMPLEMENTED";
}
export interface DocumentChangeEvidence {
  reason: string;
  invalidatedUnitIds: string[];
}
export function isDocumentChange(
  event: WorkspaceEvent,
): event is WorkspaceEvent<DocumentChangeEvidence & Record<string, unknown>> {
  return event.kind === "DOCUMENT_CHANGED";
}
export interface GenerationOperation {
  status: string;
  errorCode: string | null;
  result: {
    output: {
      scopeChangeRequired: boolean;
      reason: string;
      changes: unknown[];
    };
  } | null;
}

export interface IsolatedValidationEvidence {
  result: {
    passed: boolean;
    evidenceClass: string;
    results: {
      id: string;
      exitCode: number | null;
      timedOut: boolean;
      stdout: string;
      stderr: string;
    }[];
  };
}
export interface PublicationBundle {
  bundleHash: string;
  targets: {
    repositoryId: string;
    head: string;
    baseline: string;
    branch: string;
    remote: string;
  }[];
}
export function commandValidationRequired(run: WorkspaceRun): boolean {
  return isImplementationRun(run) && !!run.authority.units?.some((u) => u.commands?.length);
}
export function commandValidationPassed(run: WorkspaceRun): boolean {
  return isImplementationRun(run) && run.events.some(
    (e) =>
      e.kind === "SANDBOX_VALIDATED" &&
      (e.payload as unknown as IsolatedValidationEvidence).result?.passed ===
        true,
  );
}
export function commandValidationFailed(run: WorkspaceRun): boolean {
  return run.events.some(
    (e) =>
      e.kind === "SANDBOX_VALIDATED" &&
      (e.payload as unknown as IsolatedValidationEvidence).result?.passed ===
        false,
  );
}

export function architecturePurpose(raw:unknown):'IMPLEMENTATION'|'BASELINE_VALIDATION'|null {
  if(!raw||typeof raw!=='object')return null;
  const value=raw as {schemaVersion?:unknown;validationProfiles?:unknown};
  if(value.schemaVersion===1 && !Object.prototype.hasOwnProperty.call(value,'validationProfiles'))return 'IMPLEMENTATION';
  if(value.schemaVersion===2 && Array.isArray(value.validationProfiles))return 'BASELINE_VALIDATION';
  return null;
}
