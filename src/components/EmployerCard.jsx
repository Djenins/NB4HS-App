// EmployerCard.jsx -- one card in the Employer Directory's responsive grid
// (src/pages/Employers.jsx). Cards, not table rows, per the Employer
// Directory spec -- which is also why grid, not list, stays this page's
// default view. EmployerListItem.jsx is the same record laid out wide.
//
// Two things this card used to get wrong, both fixed by the page now passing
// them in: `industry` was rendered as its raw key ("food_service") instead of
// its label, and the Open Positions / Placements counts were hard-coded em
// dashes. Both numbers are real -- job_openings and placements carry
// employer_id -- so the page counts them and hands them down.
import { Briefcase, ContactRound, Mail, MapPin, Phone, Trash2, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { businessInitials, partnershipStageBadgeVariant, partnershipStageLabel } from "../lib/employerProfile.js";
import { formatPhone, fmtDateLong } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export default function EmployerCard({ employer, industryLabel, openPositions, placementsCount, lang, onRemove }) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={function () { navigate("/employers/" + employer.id); }}
          className="flex min-w-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left font-normal transform-none min-h-0"
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className={avatarColorFor(employer.businessName)}>{businessInitials(employer.businessName)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-card-foreground hover:text-primary hover:underline">
              {employer.businessName || "—"}
            </span>
            {industryLabel && <span className="block truncate text-xs text-muted">{industryLabel}</span>}
          </span>
        </button>
        <Button
          variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove}
          className="h-8 w-8 shrink-0 text-muted hover:bg-tint-danger hover:text-accent"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mb-4 mt-3 flex flex-col gap-1.5 text-sm">
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
          <span className="flex items-center gap-2 text-muted">
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

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("openPositionsLabel")}: <span className="font-semibold text-card-foreground">{openPositions}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <ContactRound className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("placementsCountLabel")}: <span className="font-semibold text-card-foreground">{placementsCount}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Badge variant={partnershipStageBadgeVariant(employer.partnershipStage)}>{partnershipStageLabel(employer.partnershipStage)}</Badge>
        {employer.lastMeetingDate && (
          <span className="text-xs text-muted">{t("lastContactLabel")}: {fmtDateLong(employer.lastMeetingDate, lang)}</span>
        )}
      </div>
    </Card>
  );
}
