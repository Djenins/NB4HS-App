// ClientHeader.jsx -- the master-client identity header shown at the top of
// the unified Client Profile page (src/pages/ClientProfile.jsx). Purely
// presentational + action callbacks -- the page owns what "Edit Profile"/
// "Add to Program" actually do.
import { CalendarPlus, FileText, MessageSquarePlus, MoreHorizontal, Pencil, UserPlus } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent } from "./ui/card.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.jsx";

function DisabledActionButton({ icon: Icon, label, tooltip }) {
  const t = useT();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip || t("clientActionComingSoon")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ClientHeader({ client, name, onEditProfile, onAddToProgram, onScheduleAppointment, onAddNote, onUploadDocument, onToggleStatus }) {
  const t = useT();
  const isActive = client.status !== "inactive";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className={avatarColorFor(name) + " text-lg"}>{initialsOf(client)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-xl">{name}</h1>
              <NbIdBadge nbId={client.nbId} />
              <Badge variant={isActive ? "success" : "neutral"}>{isActive ? t("statusActive") : t("statusInactive")}</Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span>{formatPhone(client.phone) || "—"}</span>
              <span>{client.email || "—"}</span>
              <span>{formatAddress(client) || "—"}</span>
              <span>{t("intakeDateLabel")}: {fmtDateLong(client.intakeDate)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={onEditProfile}>
            <Pencil className="h-3.5 w-3.5" /> {t("editProfileBtn")}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onAddToProgram}>
            <UserPlus className="h-3.5 w-3.5" /> {t("addToProgramBtn")}
          </Button>
          {onScheduleAppointment ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onScheduleAppointment}>
              <CalendarPlus className="h-3.5 w-3.5" /> {t("scheduleAppointmentBtn")}
            </Button>
          ) : (
            <DisabledActionButton icon={CalendarPlus} label={t("scheduleAppointmentBtn")} tooltip={t("scheduleAppointmentDisabledTooltip")} />
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onAddNote}>
            <MessageSquarePlus className="h-3.5 w-3.5" /> {t("addNoteBtn")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onUploadDocument}>
            <FileText className="h-3.5 w-3.5" /> {t("uploadDocumentBtn")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={t("moreActionsBtn")}><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onToggleStatus}>
                {isActive ? t("deactivateClientBtn") : t("activateClientBtn")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
