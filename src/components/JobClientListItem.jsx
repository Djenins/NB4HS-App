// JobClientListItem.jsx -- one job seeker as a full-width row in the Job
// Developer caseload's list view (the default). Was JobClientCard.jsx, a
// <tr> in the 10-column table this replaces; it keeps that row's whole
// vocabulary -- the bulk-select checkbox, the name link into the client
// profile, employment, work-permit and resume state, and the follow-up chip
// that reads overdue vs due today off computeFollowUps().
//
// One interactive Card on the design system; every status is a StatusBadge
// (colour from lib/statusTone.js, the label always carries the meaning).
// JobClientGridCard.jsx is the same record in the grid view, checkbox
// included, so bulk selection works identically in either layout.
import { CalendarDays, Mail, MapPin, Phone, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { employmentStatusLabel } from "../lib/jobProfile.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf, todayStr } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { BUTTON_RESET } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

// Shared by the list item and the grid card: the status badges for one
// job seeker, in the same order in both layouts.
export function JobClientBadges({ client, lang, withPermitExpiry }) {
  const t = useT();
  const permitText = client.workPermit
    ? t("workPermitLabel") + ": " + t("yesOption") + (withPermitExpiry && client.workPermitExpiration ? " (" + fmtDateLong(client.workPermitExpiration, lang) + ")" : "")
    : t("workPermitLabel") + ": " + t("noOption");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {client.employmentStatus ? (
        <StatusBadge domain="employment" status={client.employmentStatus}>{employmentStatusLabel(client.employmentStatus)}</StatusBadge>
      ) : null}
      <StatusBadge domain="workPermit" status={client.workPermit ? "yes" : "no"}>{permitText}</StatusBadge>
      <StatusBadge domain="resume" status={client.hasResume ? "onFile" : "none"}>
        {client.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}
      </StatusBadge>
    </div>
  );
}

export function FollowUpBadge({ followUp }) {
  const t = useT();
  const overdue = followUp.nextStepDate < todayStr();
  return (
    <StatusBadge domain="followUp" status={overdue ? "overdue" : "dueToday"}>
      {overdue ? t("followUpOverdueLabel") : t("followUpDueTodayLabel")}
    </StatusBadge>
  );
}

export default function JobClientListItem({ client, lang, onRemove, selected, onToggleSelect, followUp }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(client);
  const address = formatAddress(client);
  const openProfile = function () { navigate("/jobdeveloper/" + client.id); };

  return (
    <Card interactive className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={name}
          className="mt-3 h-4 w-4 shrink-0 cursor-pointer accent-primary"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={openProfile}
              className={BUTTON_RESET + " group flex min-w-0 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2"}
            >
              <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
              <span className="min-w-0 truncate text-section font-semibold text-card-foreground group-hover:text-primary group-hover:underline">{name}</span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              {client.nbId && <NbIdBadge nbId={client.nbId} />}
              <IconButton size="sm" label={t("deleteLabel")} onClick={onRemove} className="hover:bg-tone-danger-bg hover:text-tone-danger-ink">
                <Trash2 aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-meta text-muted">
            {client.phone && (
              <span className="flex items-center gap-1.5 tabular-nums">
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatPhone(client.phone)}
              </span>
            )}
            {client.email && (
              <span className="flex min-w-0 items-center gap-1.5">
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{client.email}</span>
              </span>
            )}
            {address && (
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{address}</span>
              </span>
            )}
          </div>

          <div className="mt-3">
            <JobClientBadges client={client} lang={lang} withPermitExpiry />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3 text-meta text-muted">
            <span className="flex items-center gap-1.5 tabular-nums">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("intakeDateLabel")}: {fmtDateLong(client.intakeDate, lang)}
            </span>
            {followUp ? (
              <button
                type="button"
                onClick={openProfile}
                className={BUTTON_RESET + " flex items-center gap-2 rounded-control text-left text-meta text-muted focus-visible:outline-none focus-visible:ring-2"}
                title={followUp.company ? followUp.company + (followUp.position ? " · " + followUp.position : "") : undefined}
              >
                <FollowUpBadge followUp={followUp} />
                <span className="tabular-nums">{fmtDateLong(followUp.nextStepDate, lang)}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
