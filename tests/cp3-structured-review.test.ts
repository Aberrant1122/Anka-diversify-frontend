import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequirementsItemReview } from "../components/project/planning/requirements-item-review";
import { DocumentationItemReview } from "../components/project/planning/documentation-item-review";
import { ArchitectureItemReview } from "../components/project/planning/architecture-item-review";
import type {
  RequirementsStructuredContent,
  DocumentationStructuredContent,
  ArchitectureStructuredContent,
} from "../lib/types";

test("Task D: RequirementsItemReview renders canonical backend-schema fixture accurately across all tabs", () => {
  const canonicalRequirements: RequirementsStructuredContent = {
    projectGoal: "Build an automated, deterministic planning OS.",
    problemStatement: "Manual planning is slow, brittle, and lacks verified lineage.",
    usersAndActors: [
      { id: "ACT-001", name: "Project Owner", description: "Authorizes planning artifacts and revisions." },
    ],
    userStories: [
      {
        id: "US-001",
        actor: "Project Owner",
        capability: "recover stale documentation after requirements change",
        benefit: "the system maintains verified authority without manual re-entry",
        acceptanceCriteriaIds: ["AC-001"],
      },
    ],
    functionalRequirements: [
      { id: "FR-001", title: "Deterministic Rebase", description: "Rebase documentation when upstream requirements are updated." },
    ],
    nonFunctionalRequirements: [
      { id: "NFR-001", title: "Audit Immutability", description: "Artifact history must never be mutated in place." },
    ],
    constraints: [
      { id: "CONST-001", description: "PostgreSQL isolated schemas must be used for all test migrations." },
    ],
    integrations: [
      { id: "INT-001", name: "GitHub Sync", description: "Repository webhook dispatching", required: true },
    ],
    assumptions: [
      { id: "ASSUMP-001", description: "Prisma client provides transactional read isolation." },
    ],
    acceptanceCriteria: [
      { id: "AC-001", description: "Rebase API succeeds and returns a successor version.", relatedRequirementIds: ["FR-001"] },
    ],
    outOfScope: [
      { id: "OOS-001", description: "Manual database table schema modifications without migration." },
    ],
    unresolvedQuestions: [
      { id: "Q-001", question: "Will background jobs be queued via Redis or PostgreSQL?" },
    ],
  };

  // Tab 1: Stories & Actors (default tab)
  const storiesHtml = renderToStaticMarkup(React.createElement(RequirementsItemReview, { content: canonicalRequirements, initialTab: "stories" }));
  assert.ok(storiesHtml.includes("Build an automated, deterministic planning OS."));
  assert.ok(storiesHtml.includes("Manual planning is slow, brittle, and lacks verified lineage."));
  assert.ok(storiesHtml.includes("Project Owner"));
  assert.ok(storiesHtml.includes("Authorizes planning artifacts and revisions."));
  assert.ok(storiesHtml.includes("recover stale documentation after requirements change"));

  // Tab 2: Requirements (functional & non-functional)
  const reqsHtml = renderToStaticMarkup(React.createElement(RequirementsItemReview, { content: canonicalRequirements, initialTab: "requirements" }));
  assert.ok(reqsHtml.includes("Deterministic Rebase"));
  assert.ok(reqsHtml.includes("Rebase documentation when upstream requirements are updated."));
  assert.ok(reqsHtml.includes("Audit Immutability"));
  assert.ok(reqsHtml.includes("Artifact history must never be mutated in place."));

  // Tab 3: Acceptance Criteria
  const acHtml = renderToStaticMarkup(React.createElement(RequirementsItemReview, { content: canonicalRequirements, initialTab: "acceptance" }));
  assert.ok(acHtml.includes("AC-001"));
  assert.ok(acHtml.includes("Rebase API succeeds and returns a successor version."));

  // Tab 4: Scope, Constraints, Assumptions, Out of Scope, Integrations, Questions
  const scopeHtml = renderToStaticMarkup(React.createElement(RequirementsItemReview, { content: canonicalRequirements, initialTab: "scope" }));
  assert.ok(scopeHtml.includes("CONST-001"));
  assert.ok(scopeHtml.includes("PostgreSQL isolated schemas must be used for all test migrations."));
  assert.ok(scopeHtml.includes("ASSUMP-001"));
  assert.ok(scopeHtml.includes("Prisma client provides transactional read isolation."));
  assert.ok(scopeHtml.includes("OOS-001"));
  assert.ok(scopeHtml.includes("Manual database table schema modifications without migration."));
  assert.ok(scopeHtml.includes("GitHub Sync"));
  assert.ok(scopeHtml.includes("Repository webhook dispatching"));
  assert.ok(scopeHtml.includes("Required"));
  assert.ok(scopeHtml.includes("Q-001"));
  assert.ok(scopeHtml.includes("Will background jobs be queued via Redis or PostgreSQL?"));
  assert.ok(!scopeHtml.includes("undefined"));
});

test("Task D: RequirementsItemReview handles empty and missing optional fields without crashing", () => {
  const emptyContent: RequirementsStructuredContent = {};
  const html = renderToStaticMarkup(React.createElement(RequirementsItemReview, { content: emptyContent }));
  assert.ok(typeof html === "string");
  assert.ok(html.includes("No user stories defined."));
  assert.ok(!html.includes("undefined"));
});

test("Task D: DocumentationItemReview renders canonical backend-schema fixture accurately without undefined relations", () => {
  const canonicalDocumentation: DocumentationStructuredContent = {
    overview: {
      summary: "System specification for ANKA OS Planning Module.",
      scope: "CP3 Planning lifecycle covering Requirements through Architecture.",
      goals: ["Provide auditable planning lineage", "Enforce owner authority"],
    },
    systemActors: [
      { id: "DOC-ACT-001", name: "System Admin", description: "Administers platform tenants." },
    ],
    features: [
      {
        id: "FEAT-001",
        title: "Stale Recovery Engine",
        description: "Recovers out-of-date planning artifacts when upstream changes occur.",
        workflowSteps: ["Detect upstream change", "Mark downstream stale", "Execute rebase run"],
        actorIds: ["DOC-ACT-001"],
        access: "controlled",
      },
    ],
    apiContracts: {
      applicable: true,
      rationale: "REST API exposed for project management.",
      items: [
        {
          id: "API-001",
          name: "Rebase Documentation",
          description: "Initiates documentation revision rebased to current requirements.",
          interaction: {
            kind: "http",
            method: "POST",
            path: "/api/projects/:projectId/phases/documentation/artifacts/:artifactId/revisions",
          },
          access: "controlled",
          input: {
            description: "Revision payload with rebase flag.",
            fields: [
              { name: "rebaseToCurrentRequirements", logicalType: "boolean", required: true },
            ],
          },
          success: {
            description: "New documentation artifact version.",
            fields: [
              { name: "artifactId", logicalType: "string" },
            ],
          },
        },
      ],
    },
    dataEntities: {
      applicable: true,
      items: [
        {
          id: "DOC-ENT-001",
          name: "PhaseArtifact",
          description: "Immutable planning document record.",
          fields: [
            { name: "id", logicalType: "identifier", required: true, description: "Primary key" },
            { name: "contentHash", logicalType: "string", required: true, description: "SHA-256 hash" },
          ],
          relationships: [
            {
              targetEntityId: "DOC-ENT-002",
              cardinality: "one_to_many",
              required: true,
              description: "Artifact owns its approvals.",
            },
          ],
        },
        {
          id: "DOC-ENT-002",
          name: "PhaseApproval",
          description: "Explicit owner approval signature.",
          fields: [
            { name: "id", logicalType: "identifier", required: true },
            { name: "approverId", logicalType: "identifier", required: true },
          ],
          relationships: [],
        },
      ],
    },
    businessRules: [
      {
        id: "BR-001",
        title: "Owner Only Approval",
        condition: "Caller is not the project owner.",
        expectedBehavior: "Reject with 403 Forbidden.",
      },
    ],
    permissionRules: {
      applicable: true,
      items: [
        {
          id: "PERM-001",
          title: "Artifact Approval",
          description: "Only project owner may sign approvals.",
          effect: "allow",
          actions: ["phases.artifacts.approve"],
        },
      ],
    },
    errorBehaviors: [
      {
        id: "ERR-001",
        code: "PLANNING_INITIAL_ARTIFACT_EXISTS",
        scenario: "Initial generation requested when artifact already exists.",
        expectedSystemBehavior: "Return 409 Conflict with resolution guidance.",
        recoveryBehavior: "Invoke rebase revision endpoint instead.",
        httpStatus: 409,
      },
    ],
    edgeCases: [
      {
        id: "EDGE-001",
        scenario: "Concurrent approval attempts on same artifact version.",
        expectedHandling: "First succeeds, second fails idempotently.",
      },
    ],
    unresolvedQuestions: [
      {
        id: "DOC-Q-001",
        question: "Should approval signatures support hardware security tokens?",
        impact: "Future security hardening.",
      },
    ],
  };

  // Tab 1: API Contracts
  const apiHtml = renderToStaticMarkup(React.createElement(DocumentationItemReview, { content: canonicalDocumentation, initialTab: "api" }));
  assert.ok(apiHtml.includes("System specification for ANKA OS Planning Module."));
  assert.ok(apiHtml.includes("Rebase Documentation"));
  assert.ok(apiHtml.includes("/api/projects/:projectId/phases/documentation/artifacts/:artifactId/revisions"));
  assert.ok(apiHtml.includes("rebaseToCurrentRequirements"));

  // Tab 2: Data Entities & Relationships (CRITICAL: ensure NO "undefined → undefined")
  const entitiesHtml = renderToStaticMarkup(React.createElement(DocumentationItemReview, { content: canonicalDocumentation, initialTab: "entities" }));
  assert.ok(entitiesHtml.includes("PhaseArtifact"));
  assert.ok(entitiesHtml.includes("DOC-ENT-001"));
  assert.ok(entitiesHtml.includes("one to many"));
  assert.ok(entitiesHtml.includes("DOC-ENT-002"));
  assert.ok(entitiesHtml.includes("Artifact owns its approvals."));
  assert.ok(!entitiesHtml.includes("undefined → undefined"), "Must not render undefined → undefined in relationships");

  // Tab 3: Features
  const featuresHtml = renderToStaticMarkup(React.createElement(DocumentationItemReview, { content: canonicalDocumentation, initialTab: "features" }));
  assert.ok(featuresHtml.includes("Stale Recovery Engine"));
  assert.ok(featuresHtml.includes("Recovers out-of-date planning artifacts"));

  // Tab 4: Rules & Errors
  const rulesHtml = renderToStaticMarkup(React.createElement(DocumentationItemReview, { content: canonicalDocumentation, initialTab: "rules" }));
  assert.ok(rulesHtml.includes("Owner Only Approval"));
  assert.ok(rulesHtml.includes("Reject with 403 Forbidden."));
  assert.ok(rulesHtml.includes("PLANNING_INITIAL_ARTIFACT_EXISTS"));
  assert.ok(rulesHtml.includes("409"));
});

test("Task D: DocumentationItemReview handles empty states and missing optional fields", () => {
  const emptyContent: DocumentationStructuredContent = {};
  const html = renderToStaticMarkup(React.createElement(DocumentationItemReview, { content: emptyContent }));
  assert.ok(typeof html === "string");
  assert.ok(html.includes("No API contracts documented."));
  assert.ok(!html.includes("undefined"));
});

test("Task D: ArchitectureItemReview renders canonical backend-schema fixture accurately across all tabs", () => {
  const canonicalArchitecture: ArchitectureStructuredContent = {
    overview: {
      approach: "Modular monolith with strict transactional domain boundaries.",
      systemBoundary: "ANKA OS Core Engine",
      technicalDirection: "TypeScript, Express, Prisma ORM, PostgreSQL",
    },
    components: [
      {
        id: "ARCH-COMP-001",
        name: "PlanningAuthorityService",
        responsibility: "Maintains canonical artifact currentness and lineage validation.",
        boundary: "Core Domain",
        dependencyIds: ["ARCH-COMP-002"],
        documentationFeatureIds: ["FEAT-001"],
        designNotes: "Cached SHA-256 hashes must be verified on every read.",
      },
    ],
    interfaceDesign: {
      applicable: true,
      items: [
        {
          id: "ARCH-IFACE-001",
          documentationApiId: "API-001",
          componentId: "ARCH-COMP-001",
          boundary: "REST Gateway",
          enforcement: "Strict JSON schema validation",
          transport: "HTTP/1.1 JSON",
        },
      ],
    },
    dataDesign: {
      applicable: true,
      items: [
        {
          id: "ARCH-DATA-001",
          documentationEntityId: "DOC-ENT-001",
          componentId: "ARCH-COMP-001",
          persistence: "PostgreSQL Prisma Table",
          lifecycle: "Append-only immutable",
          consistency: "Strong transactional consistency",
        },
      ],
    },
    integrationDesign: {
      applicable: true,
      items: [
        {
          id: "ARCH-INT-001",
          componentId: "ARCH-COMP-001",
          requirementIntegrationIds: ["INT-001"],
          externalBoundary: "GitHub REST API v3",
          failureStrategy: "Exponential backoff with dead-letter queue",
          credentialOwner: "project_owner",
          reliability: "At-least-once delivery",
        },
      ],
    },
    crossCuttingDesign: {
      security: "Strict JWT authentication with session expiration.",
      authorization: "Owner-only default-deny policy for artifact lifecycle changes.",
      reliability: "Transactions rollback completely on unhandled exceptions.",
      observability: "Structured JSON logging with request tracing correlation IDs.",
      enforcedFeatureIds: ["FEAT-001"],
      nfrTreatments: [
        { requirementId: "NFR-001", treatment: "PostgreSQL unique index and append-only constraints." },
      ],
    },
    implementationSequence: [
      "Phase 1: Setup isolated database schemas",
      "Phase 2: Implement PlanningAuthorityService",
      "Phase 3: Connect revision rebase endpoints",
    ],
    unresolvedQuestions: [
      {
        id: "ARCH-Q-001",
        question: "Should read operations leverage replica databases?",
        blocksDecision: false,
      },
    ],
  };

  // Tab 1: Components
  const compHtml = renderToStaticMarkup(React.createElement(ArchitectureItemReview, { content: canonicalArchitecture, initialTab: "components" }));
  assert.ok(compHtml.includes("Modular monolith with strict transactional domain boundaries."));
  assert.ok(compHtml.includes("PlanningAuthorityService"));
  assert.ok(compHtml.includes("Maintains canonical artifact currentness and lineage validation."));
  assert.ok(compHtml.includes("Cached SHA-256 hashes must be verified on every read."));
  assert.ok(compHtml.includes("ARCH-COMP-002"));

  // Tab 2: Interfaces & Integrations
  const ifaceHtml = renderToStaticMarkup(React.createElement(ArchitectureItemReview, { content: canonicalArchitecture, initialTab: "interfaces" }));
  assert.ok(ifaceHtml.includes("API-001"));
  assert.ok(ifaceHtml.includes("HTTP/1.1 JSON"));
  assert.ok(ifaceHtml.includes("Strict JSON schema validation"));
  assert.ok(ifaceHtml.includes("GitHub REST API v3"));
  assert.ok(ifaceHtml.includes("project owner"));
  assert.ok(ifaceHtml.includes("Exponential backoff with dead-letter queue"));

  // Tab 3: Data Design
  const dataHtml = renderToStaticMarkup(React.createElement(ArchitectureItemReview, { content: canonicalArchitecture, initialTab: "data" }));
  assert.ok(dataHtml.includes("DOC-ENT-001"));
  assert.ok(dataHtml.includes("PostgreSQL Prisma Table"));
  assert.ok(dataHtml.includes("Append-only immutable"));
  assert.ok(dataHtml.includes("Strong transactional consistency"));

  // Tab 4: Cross-Cutting & Sequence
  const crossHtml = renderToStaticMarkup(React.createElement(ArchitectureItemReview, { content: canonicalArchitecture, initialTab: "cross-cutting" }));
  assert.ok(crossHtml.includes("Owner-only default-deny policy"));
  assert.ok(crossHtml.includes("PostgreSQL unique index and append-only constraints."));
  assert.ok(crossHtml.includes("Phase 1: Setup isolated database schemas"));
  assert.ok(crossHtml.includes("Phase 3: Connect revision rebase endpoints"));
  assert.ok(crossHtml.includes("Should read operations leverage replica databases?"));
  assert.ok(!crossHtml.includes("undefined"));
});

test("Task D: ArchitectureItemReview handles empty states and missing optional fields", () => {
  const emptyContent: ArchitectureStructuredContent = {};
  const html = renderToStaticMarkup(React.createElement(ArchitectureItemReview, { content: emptyContent }));
  assert.ok(typeof html === "string");
  assert.ok(html.includes("No components documented."));
  assert.ok(!html.includes("undefined"));
});
