// SectionCard.jsx -- the standard panel for a dashboard/report section: one
// card, a bold section title, an optional action on the right. Shared by
// WorkforceDashboard.jsx and WorkforceReports.jsx so the two read as one
// module rather than two takes on a heading.
//
// SectionEmpty is the compact "nothing here" line that goes inside one.
// Deliberately NOT ResultsEmptyState: that is a 300px panel with an icon and
// a call to action, which is right when a page's whole result set is empty
// and wrong for one chart among twelve that happens to have no data.
import { Card } from "./ui/card.jsx";

export function SectionCard({ title, action, children, className }) {
  return (
    <Card className={"p-5 shadow-card hover:shadow-card sm:p-6 " + (className || "")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-bold text-card-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function SectionEmpty({ message }) {
  return <p className="m-0 py-8 text-center text-sm text-muted">{message}</p>;
}
