"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertCircle, HelpCircle, Layers, Shield, Ban, Cpu, Users, FileQuestion, Lightbulb } from "lucide-react";
import type { RequirementsStructuredContent } from "@/lib/types";

export function RequirementsItemReview({ content, initialTab = "stories" }: { content: RequirementsStructuredContent; initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const stories = content.userStories || [];
  const acList = content.acceptanceCriteria || [];
  const functional = content.functionalRequirements || [];
  const nonFunctional = content.nonFunctionalRequirements || [];
  const actors = content.usersAndActors || [];
  const constraints = content.constraints || [];
  const integrations = content.integrations || [];
  const assumptions = content.assumptions || [];
  const outOfScope = content.outOfScope || [];
  const questions = content.unresolvedQuestions || [];

  return (
    <div className="space-y-6">
      {/* High-level Goal and Problem Statement */}
      {(content.projectGoal || content.problemStatement) && (
        <div className="grid gap-4 md:grid-cols-2">
          {content.projectGoal && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Project Goal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{content.projectGoal}</p>
              </CardContent>
            </Card>
          )}
          {content.problemStatement && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-500">
                  <AlertCircle className="h-4 w-4" /> Problem Statement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{content.problemStatement}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Structured Sections Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="stories" className="text-xs">
            User Stories ({stories.length})
          </TabsTrigger>
          <TabsTrigger value="requirements" className="text-xs">
            Requirements ({functional.length + nonFunctional.length})
          </TabsTrigger>
          <TabsTrigger value="acceptance" className="text-xs">
            Acceptance Criteria ({acList.length})
          </TabsTrigger>
          <TabsTrigger value="scope" className="text-xs">
            Scope & Constraints ({constraints.length + outOfScope.length + assumptions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: User Stories & Actors */}
        <TabsContent value="stories" className="space-y-4 mt-4">
          {actors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Users & Actors
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {actors.map((actor) => (
                  <div key={actor.id} className="p-2.5 rounded-lg border bg-card/50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{actor.name}</span>
                      <Badge variant="outline" className="text-[10px]">{actor.id}</Badge>
                    </div>
                    <p className="text-muted-foreground">{actor.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> User Stories
            </h4>
            {stories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No user stories defined.</p>
            ) : (
              stories.map((story) => (
                <div key={story.id} className="p-3.5 rounded-lg border bg-card/60 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{story.id}</Badge>
                      <Badge variant="secondary" className="text-xs">{story.actor}</Badge>
                    </div>
                    {story.acceptanceCriteriaIds && story.acceptanceCriteriaIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">Criteria:</span>
                        {story.acceptanceCriteriaIds.map((acId) => (
                          <Badge key={acId} variant="outline" className="text-[10px] font-mono">{acId}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-1 pl-1">
                    <p><span className="text-muted-foreground font-medium">As a </span>{story.actor}</p>
                    <p><span className="text-muted-foreground font-medium">I want to </span>{story.capability}</p>
                    <p><span className="text-muted-foreground font-medium">So that </span>{story.benefit}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Functional and Non-Functional Requirements */}
        <TabsContent value="requirements" className="space-y-6 mt-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> Functional Requirements ({functional.length})
            </h4>
            {functional.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No functional requirements recorded.</p>
            ) : (
              <div className="grid gap-3">
                {functional.map((req) => (
                  <div key={req.id} className="p-3.5 rounded-lg border bg-card/60 space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{req.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{req.id}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{req.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-blue-400">
              <Shield className="h-3.5 w-3.5" /> Non-Functional Requirements ({nonFunctional.length})
            </h4>
            {nonFunctional.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No non-functional requirements recorded.</p>
            ) : (
              <div className="grid gap-3">
                {nonFunctional.map((req) => (
                  <div key={req.id} className="p-3.5 rounded-lg border bg-card/60 space-y-1 text-sm border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{req.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px] border-blue-500/30 text-blue-400">{req.id}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{req.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Acceptance Criteria */}
        <TabsContent value="acceptance" className="space-y-4 mt-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Acceptance Criteria ({acList.length})
            </h4>
            {acList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No acceptance criteria defined.</p>
            ) : (
              <div className="grid gap-2.5">
                {acList.map((ac) => (
                  <div key={ac.id} className="p-3 rounded-lg border bg-card/50 flex items-start justify-between gap-3 text-sm">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30">{ac.id}</Badge>
                        {ac.relatedRequirementIds && ac.relatedRequirementIds.map((rId) => (
                          <Badge key={rId} variant="secondary" className="text-[10px] font-mono">{rId}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed pt-1">{ac.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Scope, Constraints, Assumptions, Questions */}
        <TabsContent value="scope" className="space-y-6 mt-4">
          {constraints.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" /> Constraints ({constraints.length})
              </h4>
              <div className="grid gap-2.5">
                {constraints.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-amber-300 font-mono text-[11px]">{c.id}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">Constraint</Badge>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assumptions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-sky-400">
                <Lightbulb className="h-3.5 w-3.5" /> Assumptions ({assumptions.length})
              </h4>
              <div className="grid gap-2.5">
                {assumptions.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 border-sky-500/20">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sky-300 font-mono text-[11px]">{a.id}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">Assumption</Badge>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outOfScope.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
                <Ban className="h-3.5 w-3.5" /> Out of Scope ({outOfScope.length})
              </h4>
              <div className="grid gap-2.5">
                {outOfScope.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1 border-rose-500/20">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-rose-300 font-mono text-[11px]">{item.id}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">Out of Scope</Badge>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {integrations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> External Integrations ({integrations.length})
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {integrations.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border bg-card/50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="font-mono text-[10px]">{item.id}</Badge>
                        <Badge variant={item.required ? "default" : "secondary"} className="text-[10px]">
                          {item.required ? "Required" : "Optional"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" /> Unresolved Questions ({questions.length})
                </h4>
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">
                  Must be resolved before approval
                </Badge>
              </div>
              <div className="grid gap-2">
                {questions.map((q) => (
                  <div key={q.id} className="p-3 rounded-lg border border-amber-500/20 bg-card/50 text-xs flex justify-between items-center gap-3">
                    <span className="text-foreground/90 leading-relaxed">{q.question}</span>
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0 text-amber-400 border-amber-500/30">{q.id}</Badge>
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
