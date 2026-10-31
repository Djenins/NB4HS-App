// ClientHeader.jsx -- the record-page header of the unified Client Profile
// page (src/pages/ClientProfile.jsx), built on the shared RecordHeader:
// back link, initials avatar, the person's name as the page's h1, the NB ID
// and status as badges, a contact line, the page's "at a glance" facts, then
// the profile actions. Purely presentational + action callbacks -- the page
// owns the facts and what "Edit Profile"/"Add to Program" actually do.
import { CalendarDays, CalendarPlus, FileText, Mail, MapPin, MessageSquarePlus, MoreHorizontal, Pencil, Phone, UserPlus } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import NbIdBadge from "./NbIdBadge.jsx";
import RecordHeader, { ContactItem } from "./RecordHeader.jsx";
import { Button } from "./ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function ClientHeader({ client, name, facts, onBack, onEditProfile, onAddToProgram, onScheduleAppointment, onAddNote, onUploadDocument, onToggleStatus }) {
  const t = useT();
  const isActive = client.status !== "inactive";

  // Two visible actions; the rest live in More so the header offers one
  // clear next step. Each tab also carries its own add button.
  function moreMenu(size) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={t("moreActionsBtn")} variant="secondary" size={size}>
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {onScheduleAppointment ? (
            <DropdownMenuItem onSelect={onScheduleAppointment}>
              <CalendarPlus className="h-4 w-4 text-muted" aria-hidden="true" />{t("scheduleAppointmentBtn")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
              <span className="flex items-center gap-2"><CalendarPlus className="h-4 w-4 text-muted" aria-hidden="true" />{t("scheduleAppointmentBtn")}</span>
              <span className="pl-6 text-meta font-normal text-muted">{t("scheduleAppointmentDisabledTooltip")}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onAddNote}>
            <MessageSquarePlus className="h-4 w-4 text-muted" aria-hidden="true" />{t("addNoteBtn")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onUploadDocument}>
            <FileText className="h-4 w-4 text-muted" aria-hidden="true" />{t("uploadDocumentBtn")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onToggleStatus}>
            {isActive ? t("deactivateClientBtn") : t("activateClientBtn")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <RecordHeader
      name={name}
      initials={initialsOf(client)}
      onBack={onBack}
      facts={facts}
      badges={
        <>
          <NbIdBadge nbId={client.nbId} />
          <StatusBadge domain="client" status={isActive ? "active" : "inactive"}>
            {isActive ? t("statusActive") : t("statusInactive")}
          </StatusBadge>
        </>
      }
      contact={
        <>
          <ContactItem icon={Phone} label={t("phone")}><span className="tabular-nums">{formatPhone(client.phone) || "—"}</span></ContactItem>
          <ContactItem icon={Mail} label={t("email")}>{client.email || "—"}</ContactItem>
          <ContactItem icon={MapPin} label={t("address")}>{formatAddress(client) || "—"}</ContactItem>
          <ContactItem icon={CalendarDays} label={t("intakeDateLabel")}>
            <span>{t("intakeDateLabel")}: <span className="tabular-nums">{fmtDateLong(client.intakeDate)}</span></span>
          </ContactItem>
        </>
      }
      actions={
        <>
          <Button onClick={onAddToProgram}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> {t("addToProgramBtn")}
          </Button>
          <Button variant="secondary" onClick={onEditProfile}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editProfileBtn")}
          </Button>
          {moreMenu("lg")}
        </>
      }
      compactActions={
        <>
          <Button size="sm" onClick={onAddToProgram}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t("addToProgramBtn")}</span>
          </Button>
          {moreMenu("sm")}
        </>
      }
    />
  );
}
