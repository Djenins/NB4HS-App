// EventMenu.jsx -- "+ New Event" dropdown. Scoped to the two event kinds
// calendar_events actually stores (Office Visit, Appointment); Class blocks
// are a derived recurring schedule managed on the Manage page, not created
// here. See Calendar.jsx header comment for the full category gap vs. the
// original 10-item design brief.
import { CalendarDays, ChevronDown, Plus, UserRound } from "lucide-react";
import { Button } from "../ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.jsx";

export default function EventMenu({ t, onPick }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />{t("calendarNewEvent")}<ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onPick("visit")}>
          <UserRound className="h-4 w-4 text-success" />{t("calendarAddVisit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("appointment")}>
          <CalendarDays className="h-4 w-4 text-[#6b21a8]" />{t("calendarAddAppointment")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
