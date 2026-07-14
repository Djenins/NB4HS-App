// JobPipelineTracker.jsx -- horizontal 5-stage tracker (Resume -> Applying
// -> Interview -> Offer -> Employed) for the Job Developer client detail
// page. Clicking a stage sets pipelineStage directly (no drag/drop --
// matches the mockup's simple clickable-dot tracker).
import { Briefcase, CheckCircle2, FileText, Send, Users } from "lucide-react";
import { JOB_PIPELINE_STAGES, pipelineStageIndex } from "../lib/jobProfile.js";

const STAGE_ICON = { resume: FileText, applying: Send, interview: Users, offer: Briefcase, employed: CheckCircle2 };

export default function JobPipelineTracker({ stage, onChange }) {
  const activeIndex = pipelineStageIndex(stage);

  return (
    <div className="flex items-center">
      {JOB_PIPELINE_STAGES.map((s, i) => {
        const Icon = STAGE_ICON[s.key];
        const isDone = i <= activeIndex;
        const isActive = i === activeIndex;
        return (
          <div key={s.key} className="flex items-center">
            <button
              type="button"
              onClick={() => onChange(s.key)}
              title={s.en}
              className="flex flex-col items-center gap-1 border-0 bg-transparent p-0"
            >
              <span
                className={
                  "flex h-9 w-9 items-center justify-center rounded-full " +
                  (isActive ? "bg-primary text-white" : isDone ? "bg-primary-tint text-primary" : "bg-tint-neutral text-muted")
                }
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className={"text-xs font-semibold " + (isActive ? "text-primary" : "text-muted")}>{s.en}</span>
            </button>
            {i < JOB_PIPELINE_STAGES.length - 1 && (
              <span className={"mx-1.5 mb-4 h-px w-8 " + (i < activeIndex ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
