// JobPipelineTracker.jsx -- horizontal 5-stage tracker (Resume -> Applying
// -> Interview -> Offer -> Employed) for the Job Developer client detail
// page. Clicking a stage sets pipelineStage directly (no drag/drop --
// matches the mockup's simple clickable-step tracker).
//
// A numbered stepper on the info tone: completed steps take the tinted
// chip, the current step the solid fill (and aria-current="step"), later
// steps an outlined circle. Colour is never the only signal -- every step
// keeps its number and its label visible. On a phone the row scrolls
// sideways inside itself rather than squeezing the labels.
import { useApp, useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { JOB_PIPELINE_STAGES, pipelineStageIndex } from "../lib/jobProfile.js";
import { BUTTON_RESET } from "./ui/button.jsx";

const CIRCLE = {
  done: "border-tone-info-border bg-tone-info-chip text-tone-info-ink",
  current: "border-tone-info-solid bg-tone-info-solid text-tone-info-on-solid",
  todo: "border-line-strong bg-card text-muted group-hover:border-primary group-hover:text-primary"
};

export default function JobPipelineTracker({ stage, onChange }) {
  const t = useT();
  const { lang } = useApp();
  const activeIndex = pipelineStageIndex(stage);
  const last = JOB_PIPELINE_STAGES.length - 1;

  return (
    <ol aria-label={t("pipelineStageLabel")} className="m-0 flex list-none overflow-x-auto p-0">
      {JOB_PIPELINE_STAGES.map((s, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "current" : "todo";
        return (
          <li key={s.key} className="relative flex min-w-16 flex-1 justify-center">
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
                {s[lang] || s.en}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
