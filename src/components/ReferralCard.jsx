// ReferralCard.jsx -- one draggable card on the Referrals kanban
// (src/pages/Referrals.jsx). Drag wiring copied verbatim from
// StudentCard.jsx's kanban card (src/components/StudentCard.jsx:78-82):
// draggable="true" + onDragStart setting a plain-text dataTransfer payload.
// Clicking (not dragging) opens the edit modal instead of navigating.
import { useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";

export default function ReferralCard({ referral, onClick }) {
  const t = useT();
  return (
    <div
      className="cursor-grab rounded-lg border border-border bg-card p-2.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:cursor-grabbing"
      draggable="true"
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", referral.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="text-sm font-bold text-card-foreground">{referral.participantName || "—"}</div>
      <div className="mt-0.5 text-xs text-muted">{referral.positionTitle} · {referral.employerName}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span>{t("referralDateLabel")}: {fmtDateLong(referral.referralDate)}</span>
        {referral.interviewDate && <Badge variant="warn">{fmtDateLong(referral.interviewDate)}</Badge>}
      </div>
      {referral.assignedJobDeveloperEmail && <div className="mt-1 truncate text-xs text-muted">{referral.assignedJobDeveloperEmail}</div>}
      {referral.notes && <div className="mt-1 truncate text-xs text-muted">{referral.notes}</div>}
    </div>
  );
}
