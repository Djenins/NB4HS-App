// ReferralListItem.jsx -- one referral as a full-width row in the Referrals
// page's list view. Same record and the same click-to-edit target as the
// kanban's ReferralCard.jsx, laid out wide: participant and position on the
// left, pipeline stage on the right, then a footer of the referral's dates
// and its assigned job developer.
//
// Unlike the kanban card this row is not draggable -- stage changes stay a
// board gesture, so a list row that looked draggable but wasn't would be a
// lie. Clicking still opens the same edit modal, which can change the stage.
import { CalendarCheck, CalendarDays, Pencil, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { stageBadgeVariant, stageLabel } from "../lib/referrals.js";
import { fmtDateLong } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export default function ReferralListItem({ referral, lang, onEdit }) {
  const t = useT();

  return (
    <Card className="p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-base font-bold leading-tight text-card-foreground">
            {referral.participantName || "—"}
          </h3>
          <p className="m-0 mt-1 truncate text-sm text-muted">
            {[referral.positionTitle, referral.employerName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Badge variant={stageBadgeVariant(referral.status)}>{stageLabel(referral.status)}</Badge>
      </div>

      {referral.notes && <p className="m-0 mt-3 line-clamp-2 text-sm text-card-foreground">{referral.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("referralDateLabel")}: {fmtDateLong(referral.referralDate, lang)}
          </span>
          {referral.interviewDate && (
            <span className="flex items-center gap-1.5">
              <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("interviewDateLabel")}: {fmtDateLong(referral.interviewDate, lang)}
            </span>
          )}
          {referral.assignedJobDeveloperEmail && (
            <span className="flex min-w-0 items-center gap-1.5">
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{referral.assignedJobDeveloperEmail}</span>
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={function () { onEdit(referral); }}
          className="h-8 gap-1.5 px-2 text-sm font-semibold text-primary hover:bg-primary-tint"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editLabel")}
        </Button>
      </div>
    </Card>
  );
}
