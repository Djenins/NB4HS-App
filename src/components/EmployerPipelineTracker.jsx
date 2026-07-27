// EmployerPipelineTracker.jsx -- horizontal 6-stage tracker (Prospect ->
// Contacted -> Meeting Scheduled -> Partner -> Hiring -> Inactive) for the
// Employer Profile page. A new sibling component rather than a
// generalization of JobPipelineTracker.jsx (the job-seeker equivalent), to
// keep the two pipelines fully independent -- same clickable-dot idiom,
// own stage list/icon map. Clicking a stage sets partnershipStage directly
// (no drag/drop, matching JobPipelineTracker's precedent).
import { Briefcase, Calendar, Handshake, PauseCircle, Phone, Search } from "lucide-react";
import { EMPLOYER_PARTNERSHIP_STAGES, partnershipStageIndex } from "../lib/employerProfile.js";

const STAGE_ICON = {
  prospect: Search, contacted: Phone, meeting_scheduled: Calendar,
  partner: Handshake, hiring: Briefcase, inactive: PauseCircle
};

export default function EmployerPipelineTracker({ stage, onChange }) {
  const activeIndex = partnershipStageIndex(stage);

  return (
    <div className="flex flex-wrap items-center">
      {EMPLOYER_PARTNERSHIP_STAGES.map((s, i) => {
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
            {i < EMPLOYER_PARTNERSHIP_STAGES.length - 1 && (
              <span className={"mx-1.5 mb-4 h-px w-8 " + (i < activeIndex ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
