// kindStyle.js -- one semantic style entry per calendar event kind. Only
// class/visit/appointment are real timed events (calendar_events.type +
// derived class blocks); holiday comes from lib/holidays.js and only ever
// renders in the all-day row -- see Calendar.jsx's header comment for why
// the design brief's other categories (Immigration, Housing, etc.) aren't
// here.
//
// Colours come from the design system's six tones (main.css --tone-*,
// exposed as bg-tone-<tone>-<slot> etc.): Class = info (NB4HS blue), Office
// Visit = success, Appointment = violet, Holiday = danger. Every slot is a
// named token, never a hex value or a Tailwind `/opacity` modifier -- the
// palette in tailwind.config.js maps every colour to a var(), and an opacity
// modifier on one of those compiles to an invalid rgb(var(--x) / .5).
//
// Each entry carries the whole card recipe -- tint, border, left accent,
// icon disc, coloured time -- so the week grid, month chips, agenda rows,
// legend and drawer all draw the same event the same way. `iconBg` is the
// disc behind the card's icon, one step deeper than `cardBg`; `chipBg` is the
// same chip slot, used for the square icon tiles in the agenda and drawer.
// `tone` is the tone's name, for shared components (FilterChips) that take one.
import { CalendarClock, FileText, Monitor, PartyPopper, UserRound } from "lucide-react";

function toneStyle(tone, icon, label) {
  return {
    tone: tone,
    icon: icon,
    label: label,
    chipBg: "bg-tone-" + tone + "-chip",
    iconBg: "bg-tone-" + tone + "-chip",
    chipFg: "text-tone-" + tone + "-ink",
    dot: "bg-tone-" + tone + "-solid",
    cardBg: "bg-tone-" + tone + "-bg",
    cardBorder: "border-tone-" + tone + "-border",
    accent: "border-l-tone-" + tone + "-solid",
    hover: "hover:border-tone-" + tone + "-solid"
  };
}

// Tailwind only generates classes it finds written out in full, and
// toneStyle() builds its strings, so every one it can return is listed here:
//   bg-tone-info-chip text-tone-info-ink bg-tone-info-solid bg-tone-info-bg border-tone-info-border border-l-tone-info-solid hover:border-tone-info-solid
//   bg-tone-success-chip text-tone-success-ink bg-tone-success-solid bg-tone-success-bg border-tone-success-border border-l-tone-success-solid hover:border-tone-success-solid
//   bg-tone-violet-chip text-tone-violet-ink bg-tone-violet-solid bg-tone-violet-bg border-tone-violet-border border-l-tone-violet-solid hover:border-tone-violet-solid
//   bg-tone-danger-chip text-tone-danger-ink bg-tone-danger-solid bg-tone-danger-bg border-tone-danger-border border-l-tone-danger-solid hover:border-tone-danger-solid
export var KIND_STYLE = {
  class: toneStyle("info", Monitor, "calendarClassLabel"),
  visit: toneStyle("success", UserRound, "calendarVisitLabel"),
  appointment: toneStyle("violet", CalendarClock, "calendarAppointmentLabel"),
  holiday: toneStyle("danger", PartyPopper, "calendarHolidayLabel")
};

export var CLASS_ACCENTS = [
  KIND_STYLE.class,
  {
    tone: null,
    icon: FileText,
    label: "calendarClassLabel",
    chipBg: "bg-[var(--ev-class-alt-chip)]",
    iconBg: "bg-[var(--ev-class-alt-chip)]",
    chipFg: "text-[var(--ev-class-alt-fg)]",
    dot: "bg-[var(--ev-class-alt-fg)]",
    cardBg: "bg-[var(--ev-class-alt-bg)]",
    cardBorder: "border-[var(--ev-class-alt-border)]",
    accent: "border-l-[var(--ev-class-alt-fg)]",
    hover: "hover:border-[var(--ev-class-alt-fg)]"
  }
];

// The single lookup every view uses to draw a block. Non-class kinds fall
// straight through to KIND_STYLE; class blocks pick their palette slot.
export function blockStyle(block) {
  if (block && block.kind === "class") {
    return CLASS_ACCENTS[(block.accentIndex || 0) % CLASS_ACCENTS.length];
  }
  return KIND_STYLE[block ? block.kind : "class"];
}

export var FILTERS = [
  { key: "all", label: "calendarFilterAll", style: null },
  { key: "class", label: "calendarFilterClasses", style: KIND_STYLE.class },
  { key: "visit", label: "calendarFilterVisits", style: KIND_STYLE.visit },
  { key: "appointment", label: "calendarFilterAppointments", style: KIND_STYLE.appointment },
  { key: "holiday", label: "calendarFilterHolidays", style: KIND_STYLE.holiday }
];
