// EmployerListItem.jsx -- one employer as a full-width row in the Employer
// Directory's list view. Same record, same profile target, the same stage
// badge, counts and delete action as EmployerCard.jsx, laid out wide so
// more of the contact detail fits on one line.
import { Mail, MapPin, Phone, Trash2, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { businessInitials } from "../lib/employerProfile.js";
import { formatPhone, fmtDateLong } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import { EmployerCounts, EmployerStageBadge } from "./EmployerCard.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { BUTTON_RESET } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { IconButton } from "./ui/icon-button.jsx";

export default function EmployerListItem({ employer, industryLabel, openPositions, placementsCount, lang, onRemove }) {
  const t = useT();
  const navigate = useNavigate();
  const noContact = !employer.contactName && !employer.contactPhone && !employer.contactEmail;

  return (
    <Card interactive className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={function () { navigate("/workforce/employers/" + employer.id); }}
          className={BUTTON_RESET + " group flex min-w-0 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2"}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className={avatarColorFor(employer.businessName)}>{businessInitials(employer.businessName)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-section font-semibold text-card-foreground group-hover:text-primary group-hover:underline">
              {employer.businessName || "—"}
            </span>
            <span className="block truncate text-meta text-muted">
              {[industryLabel, employer.city].filter(Boolean).join(" · ") || "—"}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden sm:inline-flex"><EmployerStageBadge stage={employer.partnershipStage} /></span>
          <IconButton size="sm" label={t("deleteLabel")} onClick={onRemove} className="hover:bg-tone-danger-bg hover:text-tone-danger-ink">
            <Trash2 aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* On phones the badge drops under the name so the name keeps its width. */}
      <div className="mt-3 sm:hidden">
        <EmployerStageBadge stage={employer.partnershipStage} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-meta text-muted">
        {employer.contactName && (
          <span className="flex items-center gap-1.5 text-card-foreground">
            <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> {employer.contactName}
          </span>
        )}
        {employer.contactPhone && (
          <span className="flex items-center gap-1.5 tabular-nums">
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatPhone(employer.contactPhone)}
          </span>
        )}
        {employer.contactEmail && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{employer.contactEmail}</span>
          </span>
        )}
        {noContact && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {employer.city || "—"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3 text-meta text-muted">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <EmployerCounts openPositions={openPositions} placementsCount={placementsCount} />
        </div>
        {employer.lastMeetingDate && (
          <span className="tabular-nums">{t("lastContactLabel")}: {fmtDateLong(employer.lastMeetingDate, lang)}</span>
        )}
      </div>
    </Card>
  );
}
