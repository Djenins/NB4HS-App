// EmployerListItem.jsx -- one employer as a full-width row in the Employer
// Directory's list view. Same record, same profile target and the same
// delete action as EmployerCard.jsx, laid out wide so more of the contact
// detail fits on one line.
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

export default function EmployerListItem({ employer, industryLabel, openPositions, placementsCount, lang, onRemove }) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <Card className="p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={function () { navigate("/employers/" + employer.id); }}
          className="flex min-w-0 items-center gap-3 border-0 bg-transparent p-0 text-left font-normal transform-none min-h-0"
        >
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarFallback className={avatarColorFor(employer.businessName)}>{businessInitials(employer.businessName)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight text-card-foreground hover:text-primary hover:underline">
              {employer.businessName || "—"}
            </span>
            <span className="mt-1 block truncate text-sm text-muted">
              {[industryLabel, employer.city].filter(Boolean).join(" · ") || "—"}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={partnershipStageBadgeVariant(employer.partnershipStage)}>{partnershipStageLabel(employer.partnershipStage)}</Badge>
          <Button
            variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove}
            className="h-8 w-8 shrink-0 text-muted hover:bg-tint-danger hover:text-accent"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
        {employer.contactName && (
          <span className="flex items-center gap-1.5 text-card-foreground">
            <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> {employer.contactName}
          </span>
        )}
        {employer.contactPhone && (
          <span className="flex items-center gap-1.5">
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatPhone(employer.contactPhone)}
          </span>
        )}
        {employer.contactEmail && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{employer.contactEmail}</span>
          </span>
        )}
        {!employer.contactName && !employer.contactPhone && !employer.contactEmail && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {employer.city || "—"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("openPositionsLabel")}: <span className="font-semibold text-card-foreground">{openPositions}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ContactRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("placementsCountLabel")}: <span className="font-semibold text-card-foreground">{placementsCount}</span>
          </span>
        </div>
        {employer.lastMeetingDate && (
          <span>{t("lastContactLabel")}: {fmtDateLong(employer.lastMeetingDate, lang)}</span>
        )}
      </div>
    </Card>
  );
}
