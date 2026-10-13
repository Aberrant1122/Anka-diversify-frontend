"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Server, Database, ShieldCheck, ArrowRight, HelpCircle, Layers, Cpu, Globe, KeyRound } from "lucide-react";
import type { ArchitectureStructuredContent } from "@/lib/types";

export function ArchitectureItemReview({ content, initialTab = "components" }: { content: ArchitectureStructuredContent; initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const overview = content.overview;
  const components = content.components || [];
  const interfaces = content.interfaceDesign?.items || [];
  const dataDesign = content.dataDesign?.items || [];
  const crossCutting = content.crossCuttingDesign;
  const sequence = content.implementationSequence || [];
  const integrations = content.integrationDesign?.items || [];
  const questions = content.unresolvedQuestions || [];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      {overview && (overview.approach || overview.systemBoundary || overview.technicalDirection) && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-400">
              <Network className="h-4 w-4 shrink-0" /> Architectural Approach & Boundary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed min-w-0">
            {overview.approach && <p className="break-words">{overview.approach}</p>}
            {overview.systemBoundary && (
              <p className="text-xs text-muted-foreground break-words">
                <span className="font-semibold text-foreground/80">Boundary: </span>
                {overview.systemBoundary}
              </p>
            )}
            {overview.technicalDirection && (
              <p className="text-xs text-muted-foreground break-words">
                <span className="font-semibold text-foreground/80">Direction: </span>
                {overview.technicalDirection}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="components" className="text-xs">
            Components ({components.length})
          </TabsTrigger>
          <TabsTrigger value="interfaces" className="text-xs">
            Interfaces & Integrations ({interfaces.length + integrations.length})
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs">
            Data Storage ({dataDesign.length})
          </TabsTrigger>
          <TabsTrigger value="cross-cutting" className="text-xs">
            Cross-Cutting & Sequence
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Components */}
        <TabsContent value="components" className="space-y-4 mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 shrink-0" /> System Components ({components.length})
          </h4>
          {components.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No components documented.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {components.map((comp: any) => {
                const respText = comp.responsibility || (Array.isArray(comp.responsibilities) ? comp.responsibilities.join("; ") : "");
                return (
                  <div key={comp.id} className="p-4 rounded-lg border bg-card/60 space-y-3 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm leading-snug break-words flex-1">{comp.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">{comp.id}</Badge>
                    </div>

                    {comp.boundary && (
                      <div className="text-xs space-y-0.5">
                        <span className="text-[11px] font-medium text-muted-foreground">Boundary:</span>
                        <p className="text-muted-foreground leading-relaxed break-words">{comp.boundary}</p>
                      </div>
                    )}

                    {respText && (
                      <div className="text-xs space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Responsibility:</span>
                        <p className="text-foreground/90 leading-relaxed break-words">{respText}</p>
                      </div>
                    )}

                    {comp.designNotes && (
                      <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded break-words">
                        <span className="font-medium text-foreground/70">Notes: </span>
                        {comp.designNotes}
                      </div>
                    )}

                    <div className="space-y-1.5 pt-2 border-t text-[10px]">
                      {comp.dependencyIds && comp.dependencyIds.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="text-muted-foreground font-medium shrink-0">Deps:</span>
                          {comp.dependencyIds.map((dId: string) => (
                            <Badge key={dId} variant="outline" className="font-mono text-[9px] break-all">{dId}</Badge>
                          ))}
                        </div>
                      )}
                      {comp.documentationFeatureIds && comp.documentationFeatureIds.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="text-muted-foreground font-medium shrink-0">Features:</span>
                          {comp.documentationFeatureIds.map((fId: string) => (
                            <Badge key={fId} variant="secondary" className="font-mono text-[9px] break-all">{fId}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Interface Design & Integration Design */}
        <TabsContent value="interfaces" className="space-y-6 mt-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 shrink-0" /> System Interface Design ({interfaces.length})
            </h4>
            {interfaces.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No system interfaces defined.</p>
            ) : (
              <div className="grid gap-3">
                {interfaces.map((iface: any) => {
                  const apiId = iface.documentationApiId || iface.endpointOrChannel || iface.name;
                  const transport = iface.transport || iface.protocol || "HTTP";
                  return (
                    <div key={iface.id} className="p-3.5 rounded-lg border bg-card/60 space-y-2 text-sm min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Badge variant="outline" className="font-mono text-xs font-semibold text-purple-400 border-purple-500/30 shrink-0">
                            {transport}
                          </Badge>
                          <span className="font-mono text-xs font-medium text-foreground break-all">
                            {apiId}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="font-mono text-[10px] shrink-0">{iface.id}</Badge>
                          {iface.boundary && <Badge variant="secondary" className="text-[10px] break-all">{iface.boundary}</Badge>}
                          <Badge variant="outline" className="text-[10px] shrink-0">{iface.componentId}</Badge>
                        </div>
                      </div>
                      {iface.enforcement && (
                        <p className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded break-words">
                          Enforcement: {iface.enforcement}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {integrations.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-sky-400">
                <Globe className="h-3.5 w-3.5 shrink-0" /> External Integration Design ({integrations.length})
              </h4>
              <div className="grid gap-3">
                {integrations.map((item: any) => (
                  <div key={item.id} className="p-3.5 rounded-lg border bg-card/60 space-y-2 text-sm border-sky-500/20 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge variant="outline" className="font-mono text-xs text-sky-400 border-sky-500/30 shrink-0">
                          {item.id}
                        </Badge>
                        <span className="font-mono text-xs font-medium text-foreground break-all">
                          {item.externalBoundary}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] flex items-center gap-1 shrink-0">
                          <KeyRound className="h-3 w-3" /> {String(item.credentialOwner).replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] shrink-0">{item.componentId}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="break-words">
                        <span className="text-muted-foreground">Failure Strategy: </span>
                        <span className="text-foreground/90">{item.failureStrategy}</span>
                      </div>
                      <div className="break-words">
                        <span className="text-muted-foreground">Reliability: </span>
                        <span className="text-foreground/90">{item.reliability}</span>
                      </div>
                      {item.requirementIntegrationIds && item.requirementIntegrationIds.length > 0 && (
                        <div className="col-span-1 sm:col-span-2 flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-muted-foreground font-medium shrink-0">Requirements: </span>
                          {item.requirementIntegrationIds.map((rId: string) => (
                            <Badge key={rId} variant="outline" className="font-mono text-[9px] break-all">{rId}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Data Design */}
        <TabsContent value="data" className="space-y-4 mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 shrink-0" /> Data Storage & Persistence Design ({dataDesign.length})
          </h4>
          {dataDesign.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No persistence models defined.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {dataDesign.map((d: any) => {
                const entity = d.documentationEntityId || d.entityName;
                const persist = d.persistence || d.storageKind;
                return (
                  <div key={d.id} className="p-3.5 rounded-lg border bg-card/60 space-y-2 text-sm min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-foreground font-mono break-all">{entity}</span>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        <Badge variant="outline" className="font-mono text-[10px]">{d.id}</Badge>
                        <Badge variant="secondary" className="font-mono text-[10px]">{d.componentId}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="break-words">
                        <span className="text-muted-foreground">Store: </span>
                        <span className="font-mono text-foreground">{persist}</span>
                      </div>
                      {d.lifecycle && (
                        <div className="break-words">
                          <span className="text-muted-foreground">Lifecycle: </span>
                          <span className="text-foreground">{d.lifecycle}</span>
                        </div>
                      )}
                      {d.consistency && (
                        <div className="col-span-1 sm:col-span-2 break-words">
                          <span className="text-muted-foreground">Consistency: </span>
                          <span className="text-foreground">{d.consistency}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Cross-Cutting & Sequence */}
        <TabsContent value="cross-cutting" className="space-y-6 mt-4">
          {crossCutting && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Security & Quality Attributes
              </h4>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {crossCutting.security && (
                  <div className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 min-w-0 overflow-hidden">
                    <span className="font-semibold text-foreground">Security</span>
                    <p className="text-muted-foreground break-words leading-relaxed">{crossCutting.security}</p>
                  </div>
                )}
                {crossCutting.authorization && (
                  <div className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 min-w-0 overflow-hidden">
                    <span className="font-semibold text-foreground">Authorization</span>
                    <p className="text-muted-foreground break-words leading-relaxed">{crossCutting.authorization}</p>
                  </div>
                )}
                {crossCutting.reliability && (
                  <div className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 min-w-0 overflow-hidden">
                    <span className="font-semibold text-foreground">Reliability</span>
                    <p className="text-muted-foreground break-words leading-relaxed">{crossCutting.reliability}</p>
                  </div>
                )}
                {crossCutting.observability && (
                  <div className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 min-w-0 overflow-hidden">
                    <span className="font-semibold text-foreground">Observability</span>
                    <p className="text-muted-foreground break-words leading-relaxed">{crossCutting.observability}</p>
                  </div>
                )}
              </div>

              {crossCutting.nfrTreatments && crossCutting.nfrTreatments.length > 0 && (
                <div className="pt-2 space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">NFR Treatments:</span>
                  <div className="grid gap-2">
                    {crossCutting.nfrTreatments.map((t, idx) => (
                      <div key={idx} className="p-2.5 rounded border bg-card/40 text-xs flex justify-between gap-3 min-w-0 overflow-hidden">
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">{t.requirementId}</Badge>
                        <span className="text-muted-foreground flex-1 break-words">{t.treatment}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {sequence.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-blue-400">
                <Layers className="h-3.5 w-3.5 shrink-0" /> Implementation Sequence ({sequence.length} phases)
              </h4>
              <div className="space-y-1.5">
                {sequence.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card/40 text-xs min-w-0 overflow-hidden">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground w-6 shrink-0">0{idx + 1}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-foreground/90 break-words flex-1">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" /> Architectural Inquiries ({questions.length})
              </h4>
              <div className="grid gap-2">
                {questions.map((q) => (
                  <div key={q.id} className="p-3 rounded-lg border bg-card/50 text-xs flex justify-between items-start gap-3 min-w-0 overflow-hidden">
                    <span className="text-muted-foreground flex-1 break-words leading-relaxed">{q.question}</span>
                    {q.blocksDecision && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">Blocks Decision</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
