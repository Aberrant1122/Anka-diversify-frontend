import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentEvidenceStatus, isSupportedEvidenceDocument } from "../components/project/project-file-item";
import type {
  DocumentExtractionSummary,
  EvidenceSpan,
  EvidencePageResponse,
} from "../lib/types";

test("Document Evidence Frontend Contract & Logic Tests (CP1.1)", async (t) => {
  await t.test("registration failure renders readable diagnosis and recovery after refresh", () => {
    const stored: DocumentExtractionSummary = {
      eligible: true, registrationStatus: "FAILED", registrationAttempt: 1,
      status: null, sourceId: null, canRetry: true, errorCode: "SNAPSHOT_FAILED",
      errorMessage: "We could not preserve this document for processing. Please retry processing.",
      passageCount: 0,
    };
    const render = () => renderToStaticMarkup(React.createElement(DocumentEvidenceStatus, {
      extraction: stored, retryError: null, isRetrying: false,
      onRetry: () => undefined, onView: () => undefined,
    }));
    for (const html of [render(), render()]) {
      assert.match(html, /Registration failed/);
      assert.match(html, /could not preserve this document/);
      assert.match(html, /Retry Processing/);
    }
    const busy = renderToStaticMarkup(React.createElement(DocumentEvidenceStatus, {
      extraction: stored, retryError: null, isRetrying: true,
      onRetry: () => undefined, onView: () => undefined,
    }));
    assert.match(busy, /disabled=""/);
  });

  await t.test("legacy file can retry; active registration and extraction reach honest states", () => {
    const summary: DocumentExtractionSummary = { eligible: true, registrationStatus: "NOT_PROCESSED",
      status: null, canRetry: true, passageCount: 0 };
    const show = () => renderToStaticMarkup(React.createElement(DocumentEvidenceStatus, {
      extraction: summary, retryError: null, isRetrying: false,
      onRetry: () => undefined, onView: () => undefined,
    }));
    assert.match(show(), /Not processed/);
    assert.match(show(), /Retry Processing/);
    summary.registrationStatus = "PROCESSING";
    assert.match(show(), /Registering/);
    summary.registrationStatus = "REGISTERED";
    summary.status = "PENDING";
    assert.match(show(), /Pending/);
    summary.status = "PROCESSING";
    assert.match(show(), /Processing/);
    summary.status = "READY";
    summary.passageCount = 2;
    assert.match(show(), /Ready/);
    assert.doesNotMatch(show(), /Retry Processing/);
    summary.status = "FAILED";
    summary.errorMessage = "Could not parse this document.";
    assert.match(show(), /Could not parse this document/);
    assert.match(show(), /Retry Processing/);
  });
  await t.test("1. isSupportedEvidenceDocument correctly identifies eligible files", () => {
    // Eligible
    assert.equal(isSupportedEvidenceDocument("requirements.pdf"), true);
    assert.equal(isSupportedEvidenceDocument("REQUIREMENTS.PDF"), true);
    assert.equal(isSupportedEvidenceDocument("architecture_spec.docx"), true);
    assert.equal(isSupportedEvidenceDocument("design.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), true);
    assert.equal(isSupportedEvidenceDocument("contract", "application/pdf"), true);

    // Unsupported ordinary deliverables (no misleading extraction state)
    assert.equal(isSupportedEvidenceDocument("diagram.png", "image/png"), false);
    assert.equal(isSupportedEvidenceDocument("budget.xlsx", "spreadsheet"), false);
    assert.equal(isSupportedEvidenceDocument("notes.txt", "text/plain"), false);
    assert.equal(isSupportedEvidenceDocument("code.ts", "code"), false);
    assert.equal(isSupportedEvidenceDocument("legacy.doc"), false);
  });

  await t.test("2. DocumentExtractionSummary contract validation", () => {
    const summaryReady: DocumentExtractionSummary = {
      eligible: true,
      sourceId: "source-1",
      sourceVersion: 1,
      contentHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
      status: "READY",
      currentAttempt: 1,
      errorCode: null,
      errorMessage: null,
      startedAt: "2026-10-08T00:00:00.000Z",
      completedAt: "2026-10-08T00:00:01.000Z",
      passageCount: 14,
    };

    assert.equal(summaryReady.eligible, true);
    assert.equal(summaryReady.status, "READY");
    assert.equal(summaryReady.passageCount, 14);
    assert.equal(summaryReady.contentHash?.length, 64);

    const summaryFailed: DocumentExtractionSummary = {
      eligible: true,
      sourceId: "source-2",
      sourceVersion: 1,
      contentHash: "f0e1d2c3b4a567890123456789abcdef0123456789abcdef0123456789abcdef0",
      status: "FAILED",
      currentAttempt: 1,
      errorCode: "INVALID_DOCUMENT_SIGNATURE",
      errorMessage: "The uploaded file does not match a valid PDF or DOCX binary signature.",
      startedAt: "2026-10-08T00:00:00.000Z",
      completedAt: "2026-10-08T00:00:01.000Z",
      passageCount: 0,
    };

    assert.equal(summaryFailed.status, "FAILED");
    assert.equal(summaryFailed.errorCode, "INVALID_DOCUMENT_SIGNATURE");
    assert.ok(summaryFailed.errorMessage && !summaryFailed.errorMessage.includes("stack"));
  });

  await t.test("3. EvidenceSpan and EvidencePageResponse contract validation", () => {
    const span1: EvidenceSpan = {
      id: "span-1",
      ordinal: 1,
      text: "System shall authenticate users using OAuth 2.0 with PKCE.",
      locatorType: "PDF_PAGE",
      pageNumber: 3,
      paragraphNumber: null,
      startOffset: 0,
      endOffset: 59,
      sourceId: "source-1",
      sourceVersion: 1,
      contentHash: "hash-source-1",
      textHash: "hash-text-1",
    };

    const span2: EvidenceSpan = {
      id: "span-2",
      ordinal: 2,
      text: "Architecture boundary: no direct database queries from frontend clients.",
      locatorType: "DOCX_PARAGRAPH",
      pageNumber: null,
      paragraphNumber: 5,
      startOffset: 0,
      endOffset: 73,
      sourceId: "source-2",
      sourceVersion: 1,
      contentHash: "hash-source-2",
      textHash: "hash-text-2",
    };

    const pageResponse: EvidencePageResponse = {
      spans: [span1, span2],
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasMore: false,
    };

    assert.equal(pageResponse.total, 2);
    assert.equal(pageResponse.spans[0].locatorType, "PDF_PAGE");
    assert.equal(pageResponse.spans[0].pageNumber, 3);
    assert.equal(pageResponse.spans[1].locatorType, "DOCX_PARAGRAPH");
    assert.equal(pageResponse.spans[1].paragraphNumber, 5);
  });
});
