"use client";

import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_PHASES, type WorkflowPhase, type ProjectPhaseState, type WorkflowPhaseStatus } from "@/lib/types";

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  requirements: "Requirements",
  documentation: "Documentation",
  architecture: "Architecture",
  implementation: "Implementation",
  testing: "Testing",
  review: "Review",
};

const STATUS_STYLES: Record<
  WorkflowPhaseStatus,
  { icon: typeof Circle; className: string; iconClassName?: string; label: string }
> = {
  not_started: { icon: Circle, className: "text-muted-foreground border-muted-foreground/30", label: "Not Started" },
  in_progress: { icon: Clock, className: "text-primary border-primary/40 bg-primary/10", iconClassName: "text-primary", label: "In Progress" },
  awaiting_approval: { icon: AlertCircle, className: "text-amber-400 border-amber-500/40 bg-amber-500/10", iconClassName: "text-amber-400", label: "Awaiting Approval" },
  approved: { icon: CheckCircle2, className: "text-muted-foreground hover:text-foreground border-border/80 bg-card/40", iconClassName: "text-emerald-400", label: "Approved" },
  completed: { icon: CheckCircle2, className: "text-muted-foreground hover:text-foreground border-border/80 bg-card/40", iconClassName: "text-emerald-400", label: "Completed" },
};

interface PhaseStepperProps {
  states: ProjectPhaseState[];
  activePhase: WorkflowPhase;
  onSelectPhase: (phase: WorkflowPhase) => void;
}

export function PhaseStepper({ states, activePhase, onSelectPhase }: PhaseStepperProps) {
  const stateByPhase = new Map(states.map((s) => [s.phase, s]));

  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4 py-3 border-t bg-card/30 backdrop-blur-md">
      {WORKFLOW_PHASES.map((phase, i) => {
        const state = stateByPhase.get(phase);
        const status = state?.status || "not_started";
        const isStale = Boolean(state?.isStale);
        const style = STATUS_STYLES[status];
        const Icon = isStale ? AlertCircle : style.icon;
        const iconColor = isStale ? "text-amber-500" : style.iconClassName;
        const isActive = phase === activePhase;

        return (
          <div key={phase} className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onSelectPhase(phase)}
              title={isStale ? `${style.label} (Stale Authority)` : style.label}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 rounded-full border px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm whitespace-nowrap transition-colors",
                isStale ? "text-amber-500 border-amber-500/40 bg-amber-500/10" : style.className,
                isActive ? "bg-background text-foreground shadow-sm ring-1 ring-primary/30" : "hover:bg-background/50",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0", iconColor)} />
              <span className={cn(isActive && "font-medium text-foreground")}>{PHASE_LABELS[phase]}</span>
              {isStale && <span className="text-[10px] text-amber-500 font-semibold" title="Stale authority">!</span>}
              {phase === "architecture" && !isStale && (
                <span className="text-[10px] text-warning" title="Most important human gate">★</span>
              )}
            </button>
            {i < WORKFLOW_PHASES.length - 1 && (
              <div className="h-px w-3 sm:w-6 bg-border shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
