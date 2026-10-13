"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  File,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  Eye,
} from "lucide-react";
import { projectApi } from "@/lib/project-api";
import type { ProjectFile, DocumentExtractionSummary } from "@/lib/types";
import { DocumentEvidenceViewerDialog } from "./document-evidence-viewer-dialog";
import { createDocumentEvidencePoller } from "./document-evidence-poller";

interface ProjectFileItemProps {
  file: ProjectFile;
  projectId: string;
  onDeleteClick: (file: ProjectFile) => void;
}

export function isSupportedEvidenceDocument(filename: string, fileType?: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || ext === "docx") return true;
  if (fileType === "application/pdf") return true;
  if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return true;
  return false;
}

interface DocumentEvidenceStatusProps {
  extraction: DocumentExtractionSummary | null;
  retryError: string | null;
  isRetrying: boolean;
  isOptimistic?: boolean;
  onRetry: (event: React.MouseEvent) => void;
  onView: () => void;
}

export function DocumentEvidenceStatus({ extraction, retryError, isRetrying, isOptimistic, onRetry, onView }: DocumentEvidenceStatusProps) {
  return (
            <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-1.5 text-xs">
                {isOptimistic ? (
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Uploading...
                  </Badge>
                ) : !extraction ? (
                  <Badge variant="outline">Checking status...</Badge>
                ) : null}
                {extraction?.status === "PENDING" && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Uploaded / Pending
                  </Badge>
                )}

                {extraction?.status === "PROCESSING" && (
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Processing...
                  </Badge>
                )}

                {extraction?.status === "READY" && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Ready · {extraction?.passageCount} passages
                  </Badge>
                )}

                {extraction?.status === "FAILED" && (
                  <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/20 gap-1">
                    <AlertCircle className="h-2.5 w-2.5" />
                    Failed
                  </Badge>
                )}
                {!extraction?.status && extraction?.registrationStatus === "PROCESSING" && (
                  <Badge variant="outline"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Registering...</Badge>
                )}
                {!extraction?.status && extraction?.registrationStatus === "FAILED" && (
                  <Badge variant="outline" className="text-rose-700 border-rose-500/30">Registration failed</Badge>
                )}
                {!extraction?.status && (extraction?.registrationStatus === "NOT_PROCESSED" ||
                  extraction?.registrationStatus === "REGISTERED") && (
                  <Badge variant="outline">Not processed</Badge>
                )}
              </div>

              {/* Error diagnostic and Retry button on FAILED */}
              {(extraction?.status === "FAILED" || (!extraction?.status &&
                (extraction?.registrationStatus === "FAILED" || extraction?.registrationStatus === "NOT_PROCESSED" ||
                  extraction?.registrationStatus === "REGISTERED"))) && (
                <div className="flex flex-col gap-1.5 bg-rose-500/5 p-2 rounded border border-rose-500/20">
                  <p className="text-[11px] text-rose-700 leading-tight">
                    {retryError || extraction?.errorMessage || "This document has not been processed yet."}
                  </p>
                  {extraction?.canRetry !== false && <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] gap-1 px-2 border-rose-500/30 text-rose-700 hover:bg-rose-500/10 self-start"
                    onClick={onRetry}
                    disabled={isRetrying}
                  >
                    <RotateCw className={`h-2.5 w-2.5 ${isRetrying ? "animate-spin" : ""}`} />
                    Retry Processing
                  </Button>}
                </div>
              )}

              {/* View Extracted Passages button on READY */}
              {extraction?.status === "READY" && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-7 text-xs gap-1.5 mt-0.5"
                  onClick={onView}
                >
                  <Eye className="h-3 w-3" />
                  View Extracted Passages
                </Button>
              )}
            </div>
  );
}

export function ProjectFileItem({ file, projectId, onDeleteClick }: ProjectFileItemProps) {
  const isEvidenceEligible = isSupportedEvidenceDocument(file.name, file.type);
  const isOptimistic = Boolean(file.id && (file.id.startsWith("tmp-") || file.id.startsWith("temp-")));

  const [extraction, setExtraction] = useState<DocumentExtractionSummary | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const [retryError, setRetryError] = useState<string | null>(null);
  const retryInFlightRef = useRef(false);
  const activeRef = useRef(false);
  const identityRef = useRef(`${projectId}:${file.id}`);

  // File Icon
  const Icon =
    file.type === "image"
      ? ImageIcon
      : file.type === "code"
      ? FileText
      : isEvidenceEligible
      ? FileText
      : File;

  // Poll for extraction status if eligible and already persisted
  useEffect(() => {
    if (!isEvidenceEligible || isOptimistic || !file.id) return;

    identityRef.current = `${projectId}:${file.id}`;
    activeRef.current = true;
    const poller = createDocumentEvidencePoller(
      () => projectApi.getFileExtraction(projectId, file.id),
      setExtraction,
      (error) => console.error("Failed to check extraction status:", error),
    );
    poller.start();

    return () => {
      activeRef.current = false;
      poller.stop();
    };
  }, [file.id, projectId, isEvidenceEligible, pollVersion]);

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    if (retryInFlightRef.current || isOptimistic) return;
    retryInFlightRef.current = true;
    setIsRetrying(true);
    setRetryError(null);
    const identity = `${projectId}:${file.id}`;
    try {
      const summary = await projectApi.retryFileExtraction(projectId, file.id);
      if (!activeRef.current || identityRef.current !== identity) return;
      setExtraction(summary);
      // Restart the same polling loop used after upload. Its cleanup cancels
      // the old timer, and it stops itself on READY or FAILED.
      setPollVersion((version) => version + 1);
    } catch (err) {
      console.error("Failed to retry extraction:", err);
      setRetryError("Retry could not be started. Please try again.");
    } finally {
      retryInFlightRef.current = false;
      setIsRetrying(false);
    }
  }

  async function handleDownloadClick() {
    if (isOptimistic) return;
    try {
      const url = await projectApi.getFileDownloadUrl(projectId, file.id);
      window.open(url, "_blank");
    } catch {
      if (file.url) {
        window.open(file.url, "_blank");
      }
    }
  }

  return (
    <>
      <Card className="group hover:border-primary/50 transition-all relative flex flex-col justify-between">
        <CardContent className="p-4 flex flex-col h-full">
          {/* Delete button */}
          <button
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(file);
            }}
            title="Delete file"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Icon / Thumbnail */}
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-3">
            <button
              onClick={handleDownloadClick}
              className="flex items-center justify-center w-full h-full cursor-pointer"
              title="Download / view original file"
            >
              <Icon className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>

          {/* Filename and Meta */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(file.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {file.size && ` · ${file.size}`}
            </p>
          </div>

          {isEvidenceEligible && <DocumentEvidenceStatus
            extraction={extraction}
            retryError={retryError}
            isRetrying={isRetrying}
            isOptimistic={isOptimistic}
            onRetry={handleRetry}
            onView={() => setIsViewerOpen(true)}
          />}
        </CardContent>
      </Card>

      {/* Evidence Viewer Dialog */}
      {isEvidenceEligible && (
        <DocumentEvidenceViewerDialog
          open={isViewerOpen}
          onOpenChange={setIsViewerOpen}
          projectId={projectId}
          fileId={file.id}
          fileName={file.name}
          summary={extraction}
        />
      )}
    </>
  );
}
