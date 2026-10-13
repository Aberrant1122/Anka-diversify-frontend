"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, FileText, Layers, Loader2, AlertCircle } from "lucide-react";
import { projectApi } from "@/lib/project-api";
import type { EvidenceSpan, DocumentExtractionSummary } from "@/lib/types";

interface DocumentEvidenceViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  fileId: string;
  fileName: string;
  summary: DocumentExtractionSummary | null;
}

export function DocumentEvidenceViewerDialog({
  open,
  onOpenChange,
  projectId,
  fileId,
  fileName,
  summary,
}: DocumentEvidenceViewerDialogProps) {
  const [spans, setSpans] = useState<EvidenceSpan[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const loadInitialEvidence = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSpans([]);
    setPage(1);
    setTotal(0);
    setHasMore(false);
    try {
      const res = await projectApi.getFileEvidence(projectId, fileId, { page: 1, limit: 50 });
      setSpans(res.spans);
      setTotal(res.total);
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load evidence passages");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, fileId]);

  useEffect(() => {
    if (!open || !fileId) return;
    const timer = setTimeout(() => { void loadInitialEvidence(); }, 0);
    return () => clearTimeout(timer);
  }, [open, fileId, loadInitialEvidence]);

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await projectApi.getFileEvidence(projectId, fileId, { page: nextPage, limit: 50 });
      setSpans((prev) => [...prev, ...res.spans]);
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch (err: unknown) {
      console.error("Failed to load more evidence:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleCopyHash(hash: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  }

  const hash = summary?.contentHash || (spans[0]?.contentHash ?? "");
  const version = summary?.sourceVersion ?? spans[0]?.sourceVersion ?? 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-lg font-semibold truncate">{fileName}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <span>Source v{version}</span>
            <span>•</span>
            <Badge variant="outline" className="text-[11px] font-mono py-0 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              Ready
            </Badge>
            <span>•</span>
            <span>{total} addressable passage{total === 1 ? "" : "s"}</span>
          </DialogDescription>

          {/* Compact copyable SHA-256 hash */}
          {hash && (
            <div className="mt-2 flex items-center gap-2 bg-muted/60 px-2.5 py-1.5 rounded-md text-xs font-mono border">
              <span className="text-muted-foreground shrink-0 font-sans">SHA-256:</span>
              <span className="truncate text-foreground select-all" title={hash}>
                {hash}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 ml-auto"
                onClick={() => handleCopyHash(hash)}
                title="Copy SHA-256 hash"
              >
                {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Content body */}
        <div className="flex-1 min-h-0 py-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
              <p className="text-sm">Loading extracted evidence passages...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive gap-2">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={loadInitialEvidence} className="mt-2">
                Retry
              </Button>
            </div>
          ) : spans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Layers className="h-8 w-8 opacity-30 mb-2" />
              <p className="text-sm">No passages extracted for this document.</p>
            </div>
          ) : (
            <ScrollArea className="h-[52vh] pr-4">
              <div className="space-y-3 pt-1">
                {spans.map((span) => {
                  const locatorLabel =
                    span.locatorType === "PDF_PAGE"
                      ? `Page ${span.pageNumber ?? 1}`
                      : `Extracted paragraph ${span.paragraphNumber ?? 1}`;

                  return (
                    <div
                      key={span.id}
                      className="rounded-lg border bg-card p-3.5 text-card-foreground shadow-xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                            #{span.ordinal}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-medium px-2 py-0">
                            {locatorLabel}
                          </Badge>
                          {span.startOffset !== null && span.endOffset !== null && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              offset {span.startOffset}–{span.endOffset}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono opacity-70" title={`Span Hash: ${span.textHash}`}>
                          {span.textHash ? span.textHash.slice(0, 8) : ""}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground/90 bg-muted/30 p-2.5 rounded border border-border/40">
                        {span.text}
                      </p>
                    </div>
                  );
                })}

                {hasMore && (
                  <div className="pt-2 pb-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="gap-2"
                    >
                      {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Load More Passages (Showing {spans.length} of {total})
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
