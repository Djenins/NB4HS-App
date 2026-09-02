// EventMenu.jsx -- "+ New Event" dropdown. Scoped to the two event kinds
// calendar_events actually stores (Office Visit, Appointment); Class blocks
// are a derived recurring schedule managed on the Manage page, not created
// here, and holidays are computed. See Calendar.jsx's header comment for the
// full category gap vs. the original design brief.
import { CalendarClock, ChevronDown, Plus, UserRound } from "lucide-react";
import { Button } from "../ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.jsx";

export default function EventMenu({ t, onPick }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-[52px] w-full rounded-xl px-5 text-[15px] shadow-card lg:w-auto">
          <Plus className="h-5 w-5" />
          {t("calendarNewEvent")}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onPick("visit")}>
          <UserRound className="h-4 w-4 text-success" />{t("calendarAddVisit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("appointment")}>
          <CalendarClock className="h-4 w-4 text-[var(--ev-appt-fg)]" />{t("calendarAddAppointment")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
