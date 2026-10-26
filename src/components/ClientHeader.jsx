// ClientHeader.jsx -- the record-page header of the unified Client Profile
// page (src/pages/ClientProfile.jsx): back link, initials avatar, the
// person's name as the page's h1 (entity title, text-heading), the NB ID and
// status as meta, a contact line, then the profile actions. It follows
// ui/page-header.jsx's anatomy but is hand-built because PageHeader has no
// avatar slot. Purely presentational + action callbacks -- the page owns
// what "Edit Profile"/"Add to Program" actually do.
import {
  ArrowLeft, CalendarDays, CalendarPlus, FileText, Mail, MapPin, MessageSquarePlus, MoreHorizontal, Pencil, Phone, UserPlus
} from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Button } from "./ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

function ContactItem({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default function ClientHeader({ client, name, onBack, onEditProfile, onAddToProgram, onScheduleAppointment, onAddNote, onUploadDocument, onToggleStatus }) {
  const t = useT();
  const isActive = client.status !== "inactive";

  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {onBack ? (
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("back")}
          </Button>
        ) : null}
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0" aria-hidden="true">
            <AvatarFallback className={avatarColorFor(name) + " text-section"}>{initialsOf(client)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {/* m-0 and explicit weight: main.css still styles bare h1 at 2rem/800. */}
            <h1 className="m-0 text-heading font-bold text-card-foreground [text-wrap:balance]">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <NbIdBadge nbId={client.nbId} />
              <StatusBadge domain="client" status={isActive ? "active" : "inactive"}>
                {isActive ? t("statusActive") : t("statusInactive")}
              </StatusBadge>
            </div>
            <dl className="m-0 mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-muted">
              <ContactItem icon={Phone} label={t("phone")}><span className="tabular-nums">{formatPhone(client.phone) || "—"}</span></ContactItem>
              <ContactItem icon={Mail} label={t("email")}>{client.email || "—"}</ContactItem>
              <ContactItem icon={MapPin} label={t("address")}>{formatAddress(client) || "—"}</ContactItem>
              <ContactItem icon={CalendarDays} label={t("intakeDateLabel")}>
                <span>{t("intakeDateLabel")}: <span className="tabular-nums">{fmtDateLong(client.intakeDate)}</span></span>
              </ContactItem>
            </dl>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button onClick={onAddToProgram}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> {t("addToProgramBtn")}
        </Button>
        <Button variant="secondary" onClick={onEditProfile}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editProfileBtn")}
        </Button>
        {/* Two visible actions; the rest live in More so the header offers one
            clear next step. Each tab also carries its own add button. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={t("moreActionsBtn")} variant="secondary" size="lg">
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
      </div>
    </header>
  );
}
