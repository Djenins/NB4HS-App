// JobClientGridCard.jsx -- one job seeker as a card in the Job Developer
// caseload's grid view. Same record, same profile link, same bulk-select
// checkbox, the same status badges and the same follow-up chip as
// JobClientListItem.jsx, stacked for a narrow column.
import { CalendarDays, Mail, MapPin, Phone, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { FollowUpBadge, JobClientBadges } from "./JobClientListItem.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { BUTTON_RESET } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { IconButton } from "./ui/icon-button.jsx";

export default function JobClientGridCard({ client, lang, onRemove, selected, onToggleSelect, followUp }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(client);
  const address = formatAddress(client);

  return (
    <Card interactive className="flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={name} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />
        <div className="flex shrink-0 items-center gap-1">
          {client.nbId && <NbIdBadge nbId={client.nbId} />}
          <IconButton size="sm" label={t("deleteLabel")} onClick={onRemove} className="hover:bg-tone-danger-bg hover:text-tone-danger-ink">
            <Trash2 aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <button
        type="button"
        onClick={function () { navigate("/workforce/participants/" + client.id); }}
        className={BUTTON_RESET + " group mt-3 flex min-w-0 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2"}
      >
        <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
        <span className="min-w-0 truncate text-section font-semibold text-card-foreground group-hover:text-primary group-hover:underline">{name}</span>
      </button>

      <div className="mt-3 flex flex-col gap-1.5 text-meta text-muted">
        {client.phone && (
          <span className="flex items-center gap-2 tabular-nums"><Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatPhone(client.phone)}</span>
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

      <div className="mb-4 mt-3">
        <JobClientBadges client={client} lang={lang} />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3 text-meta text-muted">
        <span className="flex items-center gap-1.5 tabular-nums">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t("intakeDateLabel")}: </span>
          {fmtDateLong(client.intakeDate, lang)}
        </span>
        {followUp ? <FollowUpBadge followUp={followUp} /> : null}
      </div>
    </Card>
  );
}
