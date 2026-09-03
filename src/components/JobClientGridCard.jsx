// JobClientGridCard.jsx -- one job seeker as a card in the Job Developer
// caseload's grid view. Same record, same profile link, same bulk-select
// checkbox and the same follow-up chip as JobClientListItem.jsx, stacked for
// a narrow column.
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

export default function JobClientGridCard({ client, lang, onRemove, selected, onToggleSelect, followUp }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(client);
  const address = formatAddress(client);

  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={name} className="mt-1 shrink-0" />
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

      <button
        type="button"
        onClick={function () { navigate("/jobdeveloper/" + client.id); }}
        className="mt-3 flex min-h-0 min-w-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left font-normal transform-none"
      >
        <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-card-foreground hover:text-primary hover:underline">{name}</span>
          <span className="block truncate text-xs text-muted">{employmentStatusLabel(client.employmentStatus)}</span>
        </span>
      </button>

      <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
        {client.phone && (
          <span className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatPhone(client.phone)}</span>
        )}
        {client.email && (
          <span className="flex min-w-0 items-center gap-2">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{client.email}</span>
          </span>
        )}
        {address && (
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{address}</span>
          </span>
        )}
      </div>

      <div className="mb-4 mt-3 flex flex-wrap items-center gap-1.5">
        {client.workPermit
          ? <Badge>{t("workPermitLabel") + ": " + t("yesOption")}</Badge>
          : <Badge variant="neutral">{t("workPermitLabel") + ": " + t("noOption")}</Badge>}
        <Badge variant={client.hasResume ? "success" : "neutral"}>
          {client.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}
        </Badge>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          {fmtDateLong(client.intakeDate, lang)}
        </span>
        {followUp ? (
          <Badge variant={followUp.nextStepDate < todayStr() ? "accent" : "warn"}>
            {followUp.nextStepDate < todayStr() ? t("followUpOverdueLabel") : t("followUpDueTodayLabel")}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}
