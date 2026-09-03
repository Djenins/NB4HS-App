// ReferralCard.jsx -- one draggable card in a Referrals kanban column
// (src/pages/Referrals.jsx). Drag wiring copied verbatim from
// StudentCard.jsx's kanban card (src/components/StudentCard.jsx:78-82):
// draggable="true" + onDragStart setting a plain-text dataTransfer payload.
// Clicking (not dragging) opens the edit modal instead of navigating.
// ReferralListItem.jsx is the same record in the page's list view; the two
// show the same fields so a referral reads the same in either layout.
import { CalendarCheck, CalendarDays, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";

export default function ReferralCard({ referral, lang, onClick }) {
  const t = useT();

  return (
    <div
      className="cursor-grab rounded-[12px] border border-border bg-card p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-soft hover:shadow-card-hover active:cursor-grabbing"
      draggable="true"
      onDragStart={function (e) { e.dataTransfer.setData("text/plain", referral.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="truncate text-sm font-bold text-card-foreground">{referral.participantName || "—"}</div>
      <div className="mt-0.5 truncate text-xs text-muted">
        {[referral.positionTitle, referral.employerName].filter(Boolean).join(" · ") || "—"}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {fmtDateLong(referral.referralDate, lang)}
        </span>
        {referral.assignedJobDeveloperEmail && (
          <span className="flex min-w-0 items-center gap-1">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{referral.assignedJobDeveloperEmail}</span>
          </span>
        )}
      </div>

      {referral.interviewDate && (
        <div className="mt-2">
          <Badge variant="warn" className="gap-1">
            <CalendarCheck className="h-3 w-3" aria-hidden="true" />
            {t("interviewDateLabel")}: {fmtDateLong(referral.interviewDate, lang)}
          </Badge>
        </div>
      )}

      {referral.notes && <div className="mt-2 truncate text-xs text-muted">{referral.notes}</div>}
    </div>
  );
}
