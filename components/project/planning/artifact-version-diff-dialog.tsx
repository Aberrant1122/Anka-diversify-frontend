"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, GitCompare, PlusCircle, MinusCircle, Edit3, CheckCircle2, AlertCircle } from "lucide-react";
import { projectApi } from "@/lib/project-api";
import type { PhaseArtifact, ArtifactDiffSummary } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phase: string;
  artifacts: PhaseArtifact[];
  initialBaseId?: string;
  initialCompareId?: string;
}

export function ArtifactVersionDiffDialog({
  open,
  onOpenChange,
  projectId,
  phase,
  artifacts,
  initialBaseId,
  initialCompareId,
}: Props) {
  const [baseId, setBaseId] = useState<string>(initialBaseId || "");
  const [compareId, setCompareId] = useState<string>(initialCompareId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<ArtifactDiffSummary | null>(null);

  // Initialize selected versions if not already set
  useEffect(() => {
    if (artifacts.length >= 2) {
      if (!compareId) setCompareId(initialCompareId || artifacts[0]?.id || "");
      if (!baseId) setBaseId(initialBaseId || artifacts[1]?.id || "");
    } else if (artifacts.length === 1) {
      setCompareId(artifacts[0]?.id || "");
      setBaseId(artifacts[0]?.id || "");
    }
  }, [artifacts, initialBaseId, initialCompareId, open]);

  // Fetch diff whenever baseId or compareId change
  useEffect(() => {
    if (!open || !baseId || !compareId) return;

    if (baseId === compareId) {
      setDiffResult(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    projectApi.getArtifactDiff(projectId, compareId, baseId, phase)
      .then((res) => {
        if (active) setDiffResult(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to compute version difference.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, baseId, compareId, projectId, phase]);

  const diffData = diffResult?.diff as any;
  const changedSections: string[] = diffData?.changedRootSections || [];
  const addedIds: string[] = diffData?.addedIds || [];
  const removedIds: string[] = diffData?.removedIds || [];
  const modifiedIds: string[] = diffData?.modifiedIds || [];
  const retainedIds: string[] = diffData?.retainedIds || [];

  const hasAnyChanges =
    changedSections.length > 0 ||
    addedIds.length > 0 ||
    removedIds.length > 0 ||
    modifiedIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" /> Version Comparison
          </DialogTitle>
          <DialogDescription>
            Inspect deterministic differences between two persisted artifact revisions.
          </DialogDescription>
        </DialogHeader>

        {/* Version Selectors */}
        <div className="grid grid-cols-2 gap-4 py-3 border-y bg-muted/20 px-3 rounded-md">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Base Version (Original):</label>
            <Select value={baseId} onValueChange={setBaseId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select base version" />
              </SelectTrigger>
              <SelectContent>
                {artifacts.map((art) => (
                  <SelectItem key={art.id} value={art.id} className="text-xs">
                    v{art.version} — {art.title} ({art.lifecycleStatus || "DRAFT"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Compare Version (Successor):</label>
            <Select value={compareId} onValueChange={setCompareId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select target version" />
              </SelectTrigger>
              <SelectContent>
                {artifacts.map((art) => (
                  <SelectItem key={art.id} value={art.id} className="text-xs">
                    v{art.version} — {art.title} ({art.lifecycleStatus || "DRAFT"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {baseId === compareId ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
              <p>Selected versions are identical (v{artifacts.find(a => a.id === baseId)?.version}).</p>
              <p className="text-xs">Select two different versions above to compare differences.</p>
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <p>Computing deterministic version difference...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Diff Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : diffResult ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg border bg-card/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Added</span>
                  <p className="text-lg font-bold text-emerald-400">+{addedIds.length}</p>
                </div>
                <div className="p-2.5 rounded-lg border bg-card/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Modified</span>
                  <p className="text-lg font-bold text-amber-400">~{modifiedIds.length}</p>
                </div>
                <div className="p-2.5 rounded-lg border bg-card/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Removed</span>
                  <p className="text-lg font-bold text-rose-400">-{removedIds.length}</p>
                </div>
                <div className="p-2.5 rounded-lg border bg-card/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Unchanged</span>
                  <p className="text-lg font-bold text-muted-foreground">{retainedIds.length}</p>
                </div>
              </div>

              {/* Changed Root Sections */}
              {changedSections.length > 0 && (
                <Card>
                  <CardHeader className="py-2.5 px-3.5">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Modified Root Sections ({changedSections.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3.5 flex flex-wrap gap-1.5">
                    {changedSections.map((sec) => (
                      <Badge key={sec} variant="secondary" className="font-mono text-xs">
                        {sec}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Added Entities */}
              {addedIds.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <PlusCircle className="h-3.5 w-3.5" /> Added Entities ({addedIds.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {addedIds.map((id) => (
                      <Badge key={id} variant="outline" className="font-mono text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                        +{id}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Modified Entities */}
              {modifiedIds.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Edit3 className="h-3.5 w-3.5" /> Modified Entities ({modifiedIds.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {modifiedIds.map((id) => (
                      <Badge key={id} variant="outline" className="font-mono text-xs text-amber-400 border-amber-500/30 bg-amber-500/5">
                        ~{id}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed Entities */}
              {removedIds.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <MinusCircle className="h-3.5 w-3.5" /> Removed Entities ({removedIds.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {removedIds.map((id) => (
                      <Badge key={id} variant="outline" className="font-mono text-xs text-rose-400 border-rose-500/30 bg-rose-500/5">
                        -{id}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!hasAnyChanges && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <p>No structural differences detected between these versions.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
