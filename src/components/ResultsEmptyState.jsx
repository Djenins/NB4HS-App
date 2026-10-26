// ResultsEmptyState.jsx -- the "nothing here" panel for a Workforce results
// area: the design system's EmptyState on a card, standing where the list
// would be. A secondary action means "clear your filters" (no-results);
// otherwise it's the first-record case (none). Pages pass their own icon,
// copy and action.
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { EmptyState } from "./ui/empty-state.jsx";

export default function ResultsEmptyState({ icon, title, description, actionLabel, actionIcon: ActionIcon, actionVariant, onAction }) {
  return (
    <Card>
      <EmptyState
        variant={actionVariant === "secondary" ? "no-results" : "none"}
        icon={icon}
        title={title}
        description={description}
        action={actionLabel ? (
          <Button variant={actionVariant} onClick={onAction}>
            {ActionIcon ? <ActionIcon className="h-4 w-4" aria-hidden="true" /> : null}{actionLabel}
          </Button>
        ) : null}
      />
    </Card>
  );
}
