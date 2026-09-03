// ResultsEmptyState.jsx -- the standard "nothing here" panel for a results
// area: pale-blue circular icon, dark-navy heading, muted supporting line,
// and an optional call to action. Shared by the Job Openings and Candidate
// Matching pages, which pass their own icon, copy and action so the two
// never drift apart visually.
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export default function ResultsEmptyState({ icon: Icon, title, description, actionLabel, actionIcon: ActionIcon, actionVariant, onAction }) {
  return (
    <Card className="flex min-h-[300px] flex-col items-center justify-center px-6 py-14 text-center shadow-card hover:shadow-card">
      <span className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="m-0 text-xl font-extrabold tracking-tight text-card-foreground">{title}</h2>
      <p className="m-0 mt-2 max-w-[380px] text-[15px] leading-relaxed text-muted">{description}</p>
      {actionLabel && (
        <Button variant={actionVariant} onClick={onAction} className="mt-6 h-11 gap-2 rounded-[12px] px-6 text-[15px]">
          {ActionIcon && <ActionIcon className="h-[18px] w-[18px]" aria-hidden="true" />} {actionLabel}
        </Button>
      )}
    </Card>
  );
}
