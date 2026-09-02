// kindStyle.js -- one semantic style entry per calendar event kind. Only
// class/visit/appointment are real timed events (calendar_events.type +
// derived class blocks); holiday comes from lib/holidays.js and only ever
// renders in the all-day row -- see Calendar.jsx's header comment for why
// the design brief's other categories (Immigration, Housing, etc.) aren't
// here.
//
// Colors are design-system tokens from main.css, not new hex values:
// Class = --primary (NB4HS blue), Office Visit = --success (green), Holiday
// = --accent (red), and Appointment = the purple --ev-appt-* pair, the one
// kind with no brand token of its own. Each kind's soft card tint and
// hairline border come from the --ev-*-bg/--ev-*-border variables added for
// this screen, referenced as bg-[var(--x)] rather than a Tailwind
// `/opacity` modifier -- the palette in tailwind.config.js maps every color
// to a var(), and an opacity modifier on one of those compiles to an
// invalid rgb(var(--x) / .5) that renders as no background at all.
//
// Each entry carries the whole card recipe -- tint, border, 3px left accent,
// colored title -- so the week grid, month chips, agenda rows, legend and
// drawer all draw the same event the same way.
import { CalendarClock, GraduationCap, PartyPopper, UserRound } from "lucide-react";

export var KIND_STYLE = {
  class: {
    icon: GraduationCap,
    label: "calendarClassLabel",
    chipBg: "bg-primary-tint",
    chipFg: "text-primary",
    dot: "bg-primary",
    cardBg: "bg-[var(--ev-class-bg)]",
    cardBorder: "border-[var(--ev-class-border)]",
    accent: "border-l-primary",
    hover: "hover:border-primary"
  },
  visit: {
    icon: UserRound,
    label: "calendarVisitLabel",
    chipBg: "bg-tint-success",
    chipFg: "text-success",
    dot: "bg-success",
    cardBg: "bg-[var(--ev-visit-bg)]",
    cardBorder: "border-[var(--ev-visit-border)]",
    accent: "border-l-success",
    hover: "hover:border-success"
  },
  appointment: {
    icon: CalendarClock,
    label: "calendarAppointmentLabel",
    chipBg: "bg-[var(--ev-appt-bg)]",
    chipFg: "text-[var(--ev-appt-fg)]",
    dot: "bg-[var(--ev-appt-fg)]",
    cardBg: "bg-[var(--ev-appt-bg)]",
    cardBorder: "border-[var(--ev-appt-border)]",
    accent: "border-l-[var(--ev-appt-fg)]",
    hover: "hover:border-[var(--ev-appt-fg)]"
  },
  holiday: {
    icon: PartyPopper,
    label: "calendarHolidayLabel",
    chipBg: "bg-accent-tint",
    chipFg: "text-accent",
    dot: "bg-accent",
    cardBg: "bg-[var(--ev-holiday-bg)]",
    cardBorder: "border-[var(--ev-holiday-border)]",
    accent: "border-l-accent",
    hover: "hover:border-accent"
  }
};

export var FILTERS = [
  { key: "all", label: "calendarFilterAll", style: null },
  { key: "class", label: "calendarFilterClasses", style: KIND_STYLE.class },
  { key: "visit", label: "calendarFilterVisits", style: KIND_STYLE.visit },
  { key: "appointment", label: "calendarFilterAppointments", style: KIND_STYLE.appointment },
  { key: "holiday", label: "calendarFilterHolidays", style: KIND_STYLE.holiday }
];
