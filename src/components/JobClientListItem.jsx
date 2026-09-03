// JobClientListItem.jsx -- one job seeker as a full-width row in the Job
// Developer caseload's list view (the default). Was JobClientCard.jsx, a
// <tr> in the 10-column table this replaces; it keeps that row's whole
// vocabulary -- the bulk-select checkbox, the name link into the client
// profile, work-permit and resume state, and the follow-up chip that reads
// overdue vs due today off computeFollowUps().
//
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
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export default function JobClientListItem({ client, lang, onRemove, selected, onToggleSelect, followUp }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(client);
  const address = formatAddress(client);

  return (
    <Card className="p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start gap-3">
        <input
          type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={name}
          className="mt-1 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={function () { navigate("/jobdeveloper/" + client.id); }}
              className="flex min-h-0 min-w-0 items-center gap-3 border-0 bg-transparent p-0 text-left font-normal transform-none"
            >
              <Avatar className="h-11 w-11 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
              <span className="min-w-0">
                <span className="block truncate text-base font-bold leading-tight text-card-foreground hover:text-primary hover:underline">{name}</span>
                <span className="mt-1 block truncate text-sm text-muted">{employmentStatusLabel(client.employmentStatus)}</span>
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              {client.nbId && <NbIdBadge nbId={client.nbId} />}
              <Button
                variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove}
                className="h-8 w-8 text-muted hover:bg-tint-danger hover:text-accent"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
            {client.phone && (
              <span className="flex items-center gap-1.5">
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

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {client.workPermit
              ? <Badge>{t("workPermitLabel") + ": " + t("yesOption") + (client.workPermitExpiration ? " (" + fmtDateLong(client.workPermitExpiration, lang) + ")" : "")}</Badge>
              : <Badge variant="neutral">{t("workPermitLabel") + ": " + t("noOption")}</Badge>}
            <Badge variant={client.hasResume ? "success" : "neutral"}>
              {client.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("intakeDateLabel")}: {fmtDateLong(client.intakeDate, lang)}
            </span>
            {followUp ? (
              <button
                type="button"
                onClick={function () { navigate("/jobdeveloper/" + client.id); }}
                className="flex min-h-0 items-center gap-2 border-0 bg-transparent p-0 text-left font-normal transform-none"
                title={followUp.company ? followUp.company + (followUp.position ? " · " + followUp.position : "") : undefined}
              >
                <Badge variant={followUp.nextStepDate < todayStr() ? "accent" : "warn"}>
                  {followUp.nextStepDate < todayStr() ? t("followUpOverdueLabel") : t("followUpDueTodayLabel")}
                </Badge>
                <span className="text-xs">{fmtDateLong(followUp.nextStepDate, lang)}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
