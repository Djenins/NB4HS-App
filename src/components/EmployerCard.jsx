// EmployerCard.jsx -- one card in the Employer Directory's responsive grid
// (src/pages/Employers.jsx). Cards, not table rows, per the Employer
// Directory spec -- mirrors JobClientCard.jsx's avatar/badge idioms, just
// laid out as a Card instead of a <tr>.
import { Building2, Mail, MapPin, Phone, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { businessInitials, partnershipStageBadgeVariant, partnershipStageLabel } from "../lib/employerProfile.js";
import { formatPhone, fmtDateLong } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent } from "./ui/card.jsx";

export default function EmployerCard({ employer, onRemove }) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate("/employers/" + employer.id)}
            className="flex min-w-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left"
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className={avatarColorFor(employer.businessName)}>{businessInitials(employer.businessName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-card-foreground hover:text-primary hover:underline">{employer.businessName || "—"}</div>
              {employer.industry && <div className="truncate text-xs text-muted">{employer.industry}</div>}
            </div>
          </button>
          <Button variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove} className="h-8 w-8 shrink-0 text-muted hover:bg-tint-danger hover:text-accent">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1.5 text-sm text-card-foreground">
          {employer.city && (
            <div className="flex items-center gap-1.5 text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" /> {employer.city}</div>
          )}
          {employer.contactName && (
            <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0 text-muted" /> {employer.contactName}</div>
          )}
          {employer.contactPhone && (
            <div className="flex items-center gap-1.5 text-muted"><Phone className="h-3.5 w-3.5 shrink-0" /> {formatPhone(employer.contactPhone)}</div>
          )}
          {employer.contactEmail && (
            <div className="flex items-center gap-1.5 text-muted"><Mail className="h-3.5 w-3.5 shrink-0" /> {employer.contactEmail}</div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
          <div className="flex gap-4">
            <span>{t("openPositionsLabel")}: —</span>
            <span>{t("placementsCountLabel")}: —</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <Badge variant={partnershipStageBadgeVariant(employer.partnershipStage)}>{partnershipStageLabel(employer.partnershipStage)}</Badge>
          {employer.lastMeetingDate && <span className="text-muted">{t("lastContactLabel")}: {fmtDateLong(employer.lastMeetingDate)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
