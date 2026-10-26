// EmployerPipelineTracker.jsx -- horizontal 6-stage tracker (Prospect ->
// Contacted -> Meeting Scheduled -> Partner -> Hiring -> Inactive) for the
// Employer Profile page. A sibling component rather than a generalization
// of JobPipelineTracker.jsx (the job-seeker equivalent), to keep the two
// pipelines fully independent -- same numbered-step idiom, own stage list.
// Clicking a stage sets partnershipStage directly (no drag/drop, matching
// JobPipelineTracker's precedent).
//
// Info-tone stepper: completed steps tinted, the current step solid (and
// aria-current="step"), later steps outlined. Every step keeps its number
// and label visible, so colour is never the only signal. On a phone the row
// scrolls sideways inside itself instead of squeezing the labels.
import { useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { EMPLOYER_PARTNERSHIP_STAGES, partnershipStageIndex } from "../lib/employerProfile.js";
import { BUTTON_RESET } from "./ui/button.jsx";

const CIRCLE = {
  done: "border-tone-info-border bg-tone-info-chip text-tone-info-ink",
  current: "border-tone-info-solid bg-tone-info-solid text-tone-info-on-solid",
  todo: "border-line-strong bg-card text-muted group-hover:border-primary group-hover:text-primary"
};

export default function EmployerPipelineTracker({ stage, onChange }) {
  const t = useT();
  const activeIndex = partnershipStageIndex(stage);
  const last = EMPLOYER_PARTNERSHIP_STAGES.length - 1;

  return (
    <ol aria-label={t("partnershipStageLabel")} className="m-0 flex list-none overflow-x-auto p-0">
      {EMPLOYER_PARTNERSHIP_STAGES.map((s, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "current" : "todo";
        return (
          <li key={s.key} className="relative flex min-w-[4.5rem] flex-1 justify-center">
            {i < last ? (
              <span
                aria-hidden="true"
                className={cn("absolute left-1/2 top-5 h-0.5 w-full -translate-y-1/2", i < activeIndex ? "bg-tone-info-solid" : "bg-line-strong")}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onChange(s.key)}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(BUTTON_RESET, "group relative flex w-full flex-col items-center gap-1.5 rounded-control px-1 py-1 text-center focus-visible:outline-none focus-visible:ring-2")}
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-chip border border-solid text-meta font-bold tabular-nums transition-colors duration-fast", CIRCLE[state])}>
                {i + 1}
              </span>
              <span className={cn("text-meta leading-tight", state === "current" ? "font-semibold text-card-foreground" : "font-medium text-muted")}>
                {s.en}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
