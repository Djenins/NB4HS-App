// EmployerCard.jsx -- one card in the Employer Directory's responsive grid
// (src/pages/Employers.jsx). Cards, not table rows, per the Employer
// Directory spec -- which is also why grid, not list, stays this page's
// default view. EmployerListItem.jsx is the same record laid out wide.
//
// The page passes in the industry's label (not its raw key) and the real
// Open Positions / Placements counts -- job_openings and placements carry
// employer_id. The partnership stage is a StatusBadge on the "employer"
// domain of lib/statusTone.js.
import { Briefcase, ContactRound, Mail, MapPin, Phone, Trash2, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { businessInitials, partnershipStageLabel } from "../lib/employerProfile.js";
import { formatPhone, fmtDateLong } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { BUTTON_RESET } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export function EmployerStageBadge({ stage }) {
  return <StatusBadge domain="employer" status={stage}>{partnershipStageLabel(stage)}</StatusBadge>;
}

// "Open positions: 3 · Placements: 1" -- the two counts both layouts show.
export function EmployerCounts({ openPositions, placementsCount }) {
  const t = useT();
  return (
    <>
      <span className="flex items-center gap-1.5">
        <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("openPositionsLabel")}: <span className="font-semibold tabular-nums text-card-foreground">{openPositions}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <ContactRound className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("placementsCountLabel")}: <span className="font-semibold tabular-nums text-card-foreground">{placementsCount}</span>
      </span>
    </>
  );
}

export default function EmployerCard({ employer, industryLabel, openPositions, placementsCount, lang, onRemove }) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <Card interactive className="flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={function () { navigate("/employers/" + employer.id); }}
          className={BUTTON_RESET + " group flex min-w-0 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2"}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className={avatarColorFor(employer.businessName)}>{businessInitials(employer.businessName)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-section font-semibold text-card-foreground group-hover:text-primary group-hover:underline">
              {employer.businessName || "—"}
            </span>
            {industryLabel && <span className="block truncate text-meta text-muted">{industryLabel}</span>}
          </span>
        </button>
        <IconButton size="sm" label={t("deleteLabel")} onClick={onRemove} className="hover:bg-tone-danger-bg hover:text-tone-danger-ink">
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>

      <div className="mt-3">
        <EmployerStageBadge stage={employer.partnershipStage} />
      </div>

      <div className="mb-4 mt-3 flex flex-col gap-1.5 text-meta">
        {employer.city && (
          <span className="flex items-center gap-2 text-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {employer.city}
          </span>
        )}
        {employer.contactName && (
          <span className="flex items-center gap-2 text-card-foreground">
            <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> {employer.contactName}
          </span>
        )}
        {employer.contactPhone && (
          <span className="flex items-center gap-2 tabular-nums text-muted">
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatPhone(employer.contactPhone)}
          </span>
        )}
        {employer.contactEmail && (
          <span className="flex min-w-0 items-center gap-2 text-muted">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{employer.contactEmail}</span>
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-line-subtle pt-3 text-meta text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <EmployerCounts openPositions={openPositions} placementsCount={placementsCount} />
        </div>
        {employer.lastMeetingDate && (
          <span className="tabular-nums">{t("lastContactLabel")}: {fmtDateLong(employer.lastMeetingDate, lang)}</span>
        )}
      </div>
    </Card>
  );
}
