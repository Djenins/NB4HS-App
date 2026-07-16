// kindStyle.js -- visual style per calendar event kind. Only class/visit/
// appointment are real (calendar_events.type + derived class blocks) --
// see Calendar.jsx header comment for why the design brief's other
// categories (Immigration, Housing, etc.) aren't included here.
import { CalendarDays, GraduationCap, PartyPopper, UserRound } from "lucide-react";

export var KIND_STYLE = {
  class: { icon: GraduationCap, label: "calendarClassLabel", chipBg: "bg-primary-tint", chipFg: "text-primary", dot: "bg-primary", border: "border-l-primary", cardBg: "bg-primary-tint/60" },
  visit: { icon: UserRound, label: "calendarVisitLabel", chipBg: "bg-tint-success", chipFg: "text-success", dot: "bg-success", border: "border-l-success", cardBg: "bg-tint-success/60" },
  appointment: { icon: CalendarDays, label: "calendarAppointmentLabel", chipBg: "bg-[#6b21a8]/10", chipFg: "text-[#6b21a8]", dot: "bg-[#6b21a8]", border: "border-l-[#6b21a8]", cardBg: "bg-[#6b21a8]/10" },
  // Holidays are US federal holidays computed by lib/holidays.js, not a
  // calendar_events row -- they render as an all-day banner, not a timed
  // EventCard, so they have no border/cardBg entries here.
  holiday: { icon: PartyPopper, label: "calendarHolidayLabel", chipBg: "bg-accent/10", chipFg: "text-accent", dot: "bg-accent" }
};

export var FILTERS = [
  { key: "all", label: "calendarFilterAll", style: null },
  { key: "class", label: "calendarFilterClasses", style: KIND_STYLE.class },
  { key: "visit", label: "calendarFilterVisits", style: KIND_STYLE.visit },
  { key: "appointment", label: "calendarFilterAppointments", style: KIND_STYLE.appointment },
  { key: "holiday", label: "calendarFilterHolidays", style: KIND_STYLE.holiday }
];
