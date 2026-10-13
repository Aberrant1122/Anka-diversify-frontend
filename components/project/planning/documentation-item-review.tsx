"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Code2, Database, ShieldAlert, Sparkles, FileText, CheckCircle2, AlertTriangle, Workflow, Shield, HelpCircle } from "lucide-react";
import type { DocumentationStructuredContent } from "@/lib/types";

export function DocumentationItemReview({ content, initialTab = "api" }: { content: DocumentationStructuredContent; initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const overview = content.overview;
  const features = content.features || [];
  const apis = content.apiContracts?.items || [];
  const entities = content.dataEntities?.items || [];
  const businessRules = content.businessRules || [];
  const errorBehaviors = content.errorBehaviors || [];
  const edgeCases = content.edgeCases || [];
  const permissionRules = content.permissionRules?.items || [];
  const questions = content.unresolvedQuestions || [];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      {overview && (overview.summary || overview.scope || (overview.goals && overview.goals.length > 0)) && (
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-400">
              <FileText className="h-4 w-4" /> System Overview & Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            {overview.summary && <p>{overview.summary}</p>}
            {overview.scope && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">Scope: </span>
                {overview.scope}
              </p>
            )}
            {overview.goals && overview.goals.length > 0 && (
              <div className="pt-1">
                <span className="text-xs font-semibold text-foreground/80">Goals: </span>
                <span className="text-xs text-muted-foreground">{overview.goals.join("; ")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="api" className="text-xs">
            APIs ({apis.length})
          </TabsTrigger>
          <TabsTrigger value="entities" className="text-xs">
            Data Entities ({entities.length})
          </TabsTrigger>
          <TabsTrigger value="features" className="text-xs">
            Features ({features.length})
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">
            Rules & Errors ({businessRules.length + errorBehaviors.length + permissionRules.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: API Contracts */}
        <TabsContent value="api" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> API Contracts ({apis.length})
            </h4>
            {content.apiContracts?.rationale && (
              <span className="text-xs text-muted-foreground italic">{content.apiContracts.rationale}</span>
            )}
          </div>
          {apis.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No API contracts documented.</p>
          ) : (
            <div className="grid gap-3">
              {apis.map((api) => {
                const method = api.interaction?.method || (api.interaction?.kind === "event" ? api.interaction.direction?.toUpperCase() : "GET");
                const methodColor =
                  method === "POST" ? "text-emerald-400 border-emerald-500/30" :
                  method === "PUT" || method === "PATCH" ? "text-amber-400 border-amber-500/30" :
                  method === "DELETE" ? "text-rose-400 border-rose-500/30" : "text-sky-400 border-sky-500/30";

                const interactionPath = api.interaction?.path || api.interaction?.channel || api.interaction?.command;

                return (
                  <div key={api.id} className="p-3.5 rounded-lg border bg-card/60 space-y-2 text-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`font-mono text-xs font-semibold ${methodColor}`}>
                          {method}
                        </Badge>
                        <span className="font-semibold text-xs text-foreground">
                          {api.name}
                        </span>
                        {interactionPath && (
                          <span className="font-mono text-xs text-muted-foreground">
                            ({interactionPath})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-[10px]">{api.id}</Badge>
                        {api.access && <Badge variant="secondary" className="text-[10px]">{api.access}</Badge>}
                      </div>
                    </div>
                    {api.description && <p className="text-xs text-muted-foreground">{api.description}</p>}
                    {api.input?.fields && api.input.fields.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Input parameters: </span>
                        <span className="text-[11px] font-mono text-foreground/80">
                          {api.input.fields.map((f) => `${f.name}${f.required ? "*" : ""}: ${f.logicalType}`).join(", ")}
                        </span>
                      </div>
                    )}
                    {api.success?.fields && api.success.fields.length > 0 && (
                      <div className="pt-0.5">
                        <span className="text-[11px] font-medium text-muted-foreground">Success payload: </span>
                        <span className="text-[11px] font-mono text-foreground/80">
                          {api.success.fields.map((f) => `${f.name}: ${f.logicalType}`).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Data Entities */}
        <TabsContent value="entities" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" /> Data Entities ({entities.length})
            </h4>
            {content.dataEntities?.rationale && (
              <span className="text-xs text-muted-foreground italic">{content.dataEntities.rationale}</span>
            )}
          </div>
          {entities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No data entities documented.</p>
          ) : (
            <div className="grid gap-4">
              {entities.map((entity) => (
                <div key={entity.id} className="p-4 rounded-lg border bg-card/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">{entity.name}</span>
                      {entity.description && <p className="text-xs text-muted-foreground mt-0.5">{entity.description}</p>}
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">{entity.id}</Badge>
                  </div>

                  {entity.fields && entity.fields.length > 0 && (
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead className="py-1.5 h-8">Field</TableHead>
                            <TableHead className="py-1.5 h-8">Type</TableHead>
                            <TableHead className="py-1.5 h-8">Required</TableHead>
                            <TableHead className="py-1.5 h-8">Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {entity.fields.map((f) => (
                            <TableRow key={f.name}>
                              <TableCell className="font-mono font-medium py-1.5">{f.name}</TableCell>
                              <TableCell className="font-mono text-muted-foreground py-1.5">{f.logicalType}</TableCell>
                              <TableCell className="py-1.5">
                                {f.required ? (
                                  <Badge variant="outline" className="text-[10px] text-emerald-400">Required</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">Optional</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground py-1.5">{f.description || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {entity.relationships && entity.relationships.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Relationships:</span>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {entity.relationships.map((rel: any, idx) => {
                          const target = rel.targetEntityId || rel.relatedEntityId;
                          const card = rel.cardinality || rel.relationshipType || "references";
                          const isReq = rel.required !== undefined ? rel.required : false;
                          const desc = rel.description || "";
                          return (
                            <div key={idx} className="flex items-center gap-1.5 p-1 px-2 rounded border bg-card/40 text-[11px]" title={desc}>
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                {String(card).replace(/_/g, " ")}
                              </Badge>
                              <span className="text-muted-foreground font-mono">→</span>
                              <span className="font-mono font-semibold text-foreground/90">{target}</span>
                              {isReq && <Badge variant="outline" className="text-[9px] text-emerald-400">req</Badge>}
                              {desc && <span className="text-muted-foreground text-[10px] italic">({desc})</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Features */}
        <TabsContent value="features" className="space-y-4 mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Feature Catalog ({features.length})
          </h4>
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No features documented.</p>
          ) : (
            <div className="grid gap-3">
              {features.map((feat) => (
                <div key={feat.id} className="p-3.5 rounded-lg border bg-card/60 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{feat.title}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{feat.id}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{feat.description}</p>
                  {feat.workflowSteps && feat.workflowSteps.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Workflow className="h-3 w-3" /> Workflow Steps:
                      </span>
                      <ol className="list-decimal pl-5 text-xs text-foreground/80 space-y-0.5">
                        {feat.workflowSteps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Business Rules, Permissions & Errors */}
        <TabsContent value="rules" className="space-y-6 mt-4">
          {permissionRules.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-sky-400">
                <Shield className="h-3.5 w-3.5" /> Permission Rules ({permissionRules.length})
              </h4>
              <div className="grid gap-2.5">
                {permissionRules.map((rule) => (
                  <div key={rule.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{rule.title}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={rule.effect === "allow" ? "default" : "destructive"} className="text-[10px]">
                          {rule.effect.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">{rule.id}</Badge>
                      </div>
                    </div>
                    {rule.description && <p className="text-muted-foreground">{rule.description}</p>}
                    {rule.actions && rule.actions.length > 0 && (
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Actions: {rule.actions.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {businessRules.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" /> Business Rules ({businessRules.length})
              </h4>
              <div className="grid gap-2.5">
                {businessRules.map((rule) => (
                  <div key={rule.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{rule.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{rule.id}</Badge>
                    </div>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground/70">When: </span>{rule.condition}</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground/70">Expect: </span>{rule.expectedBehavior}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorBehaviors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5" /> Error Behaviors ({errorBehaviors.length})
              </h4>
              <div className="grid gap-2.5">
                {errorBehaviors.map((err) => (
                  <div key={err.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 border-rose-500/20">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-rose-400">{err.code}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        HTTP {err.httpStatus || 400}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground"><span className="font-medium">Scenario: </span>{err.scenario}</p>
                    <p className="text-muted-foreground"><span className="font-medium">System Behavior: </span>{err.expectedSystemBehavior}</p>
                    {err.recoveryBehavior && (
                      <p className="text-muted-foreground"><span className="font-medium">Recovery: </span>{err.recoveryBehavior}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {edgeCases.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Edge Cases ({edgeCases.length})
              </h4>
              <div className="grid gap-2.5">
                {edgeCases.map((edge) => (
                  <div key={edge.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 border-amber-500/20">
                    <p className="font-medium text-amber-300">{edge.scenario}</p>
                    <p className="text-muted-foreground">{edge.expectedHandling}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" /> Unresolved Questions ({questions.length})
              </h4>
              <div className="grid gap-2">
                {questions.map((q) => (
                  <div key={q.id} className="p-3 rounded-lg border bg-card/50 text-xs flex justify-between items-center gap-3">
                    <span className="text-muted-foreground leading-relaxed">{q.question}</span>
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">{q.id}</Badge>
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
