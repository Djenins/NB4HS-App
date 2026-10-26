// ReferralCard.jsx -- one draggable card in a Referrals kanban column
// (src/pages/Referrals.jsx). Drag wiring copied verbatim from
// StudentCard.jsx's kanban card (src/components/StudentCard.jsx:78-82):
// draggable="true" + onDragStart setting a plain-text dataTransfer payload.
// Clicking (not dragging) -- or Enter/Space on the focused card -- opens the
// edit modal instead of navigating; that modal can also change the stage,
// so the board is never drag-only.
// ReferralListItem.jsx is the same record in the page's list view; the two
// show the same fields so a referral reads the same in either layout.
import { CalendarCheck, CalendarDays, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { Card } from "./ui/card.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function ReferralCard({ referral, lang, onClick }) {
  const t = useT();

  return (
    <Card
      interactive
      className="cursor-grab p-3 focus-visible:outline-none focus-visible:ring-2 active:cursor-grabbing"
      draggable="true"
      onDragStart={function (e) { e.dataTransfer.setData("text/plain", referral.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onClick}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
    >
      <div className="truncate text-ui font-semibold text-card-foreground">{referral.participantName || "—"}</div>
      <div className="mt-0.5 truncate text-meta text-muted">
        {[referral.positionTitle, referral.employerName].filter(Boolean).join(" · ") || "—"}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
        <span className="flex items-center gap-1 tabular-nums">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t("referralDateLabel")}: </span>
          {fmtDateLong(referral.referralDate, lang)}
        </span>
        {referral.assignedJobDeveloperEmail && (
          <span className="flex min-w-0 items-center gap-1">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("assignedJobDeveloperLabel")}: </span>
            <span className="truncate">{referral.assignedJobDeveloperEmail}</span>
          </span>
        )}
      </div>

      {referral.interviewDate && (
        <div className="mt-2">
          <StatusBadge domain="referral" status="interview" className="tabular-nums">
            <CalendarCheck className="h-3 w-3" aria-hidden="true" />
            {t("interviewDateLabel")}: {fmtDateLong(referral.interviewDate, lang)}
          </StatusBadge>
        </div>
      )}

      {referral.notes && <div className="mt-2 truncate text-meta text-muted">{referral.notes}</div>}
    </Card>
  );
}
