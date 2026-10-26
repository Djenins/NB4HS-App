// ReferralListItem.jsx -- one referral as a full-width row in the Referrals
// page's list view. Same record and the same click-to-edit target as the
// kanban's ReferralCard.jsx, laid out wide: participant and position on the
// left, pipeline stage on the right, then a footer of the referral's dates
// and its assigned job developer.
//
// Unlike the kanban card this row is not draggable -- stage changes stay a
// board gesture, so a list row that looked draggable but wasn't would be a
// lie. The whole card is the button (click, Enter or Space) and opens the
// same edit modal, which can change the stage; the trailing "Edit" is its
// visible label, not a second control.
import { CalendarCheck, CalendarDays, Pencil, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { stageLabel } from "../lib/referrals.js";
import { fmtDateLong } from "../lib/utils.js";
import { Card } from "./ui/card.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function ReferralListItem({ referral, lang, onEdit }) {
  const t = useT();

  function open() { onEdit(referral); }

  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      className="cursor-pointer p-4 focus-visible:outline-none focus-visible:ring-2 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-section font-semibold text-card-foreground">
            {referral.participantName || "—"}
          </h3>
          <p className="m-0 mt-1 truncate text-meta text-muted">
            {[referral.positionTitle, referral.employerName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <StatusBadge domain="referral" status={referral.status} className="shrink-0">{stageLabel(referral.status)}</StatusBadge>
      </div>

      {referral.notes && <p className="m-0 mt-3 line-clamp-2 text-ui text-card-foreground">{referral.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-meta text-muted">
          <span className="flex items-center gap-1.5 tabular-nums">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("referralDateLabel")}: {fmtDateLong(referral.referralDate, lang)}
          </span>
          {referral.interviewDate && (
            <span className="flex items-center gap-1.5 tabular-nums">
              <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("interviewDateLabel")}: {fmtDateLong(referral.interviewDate, lang)}
            </span>
          )}
          {referral.assignedJobDeveloperEmail && (
            <span className="flex min-w-0 items-center gap-1.5">
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t("assignedJobDeveloperLabel")}: </span>
              <span className="truncate">{referral.assignedJobDeveloperEmail}</span>
            </span>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-ui font-semibold text-primary">
          <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editLabel")}
        </span>
      </div>
    </Card>
  );
}
