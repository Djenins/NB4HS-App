// EventMenu.jsx -- "+ New Event" dropdown. Scoped to the two event kinds
// calendar_events actually stores (Office Visit, Appointment); Class blocks
// are a derived recurring schedule managed on the Manage page, not created
// here, and holidays are computed. See Calendar.jsx's header comment for the
// full category gap vs. the original design brief.
//
// The pick is held until the menu has closed and handed focus back to its
// trigger, then the dialog opens. Opening it straight from onSelect let the
// menu's focus return land after the dialog had focused its first field, so
// focus sat on "New Event" behind the dialog.
import { CalendarClock, ChevronDown, Plus, UserRound } from "lucide-react";
import { useRef } from "react";
import { Button } from "../ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.jsx";

export default function EventMenu({ t, onPick }) {
  const picked = useRef(null);
  function handleCloseAutoFocus() {
    const type = picked.current;
    picked.current = null;
    if (type) setTimeout(() => onPick(type), 0);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg" className="w-full shadow-card lg:w-auto">
          <Plus className="h-5 w-5" />
          {t("calendarNewEvent")}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={handleCloseAutoFocus}>
        <DropdownMenuItem onSelect={() => { picked.current = "visit"; }}>
          <UserRound className="h-4 w-4 text-tone-success-ink" />{t("calendarAddVisit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { picked.current = "appointment"; }}>
          <CalendarClock className="h-4 w-4 text-tone-violet-ink" />{t("calendarAddAppointment")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
