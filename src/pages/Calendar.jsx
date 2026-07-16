// Calendar.jsx -- shared week-view calendar: Level 1/2/3 class schedule
// (fixed 9:30-12:30 block, derived from data.classes -- see lib/calendar.js)
// plus staff-added "office visit" and "appointment" entries (calendar_events
// table, see lib/calendarData.js). Any signed-in staff can add either kind;
// everyone with calendar access can see the whole week at a glance.
//
// Layout redesigned to match the client-provided reference mockup: a type
// filter pill row + Week/List view toggle, per-day cards with an event-count
// badge and colored icon chips per event kind, an info banner, and a Quick
// Add + Calendar Summary footer row. Blue/Green/Purple map to
// Class/Office Visit/Appointment respectively -- blue and green are the
// existing --primary/--success brand tokens; purple is the same #6b21a8 the
// app already uses as its 4th chart/classroom-accent color (COLUMN_ACCENTS
// in constants.js), not a new hue.
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, GraduationCap, Info, LayoutGrid, List, Plus, Settings, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { addDays, classBlocksForDay, sortDayBlocks, startOfWeek, weekDays } from "../lib/calendar.js";
import { createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents, subscribeCalendarEvents } from "../lib/calendarData.js";
import { dateStrFromDate, todayStr } from "../lib/utils.js";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/cn.js";

const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

// Purple isn't one of the app's named design tokens (only primary/accent/
// success/gold exist) -- these mirror COLUMN_ACCENTS[3]/CHART_PALETTE's
// existing #6b21a8 rather than inventing a new hue.
const KIND_STYLE = {
  class: { icon: GraduationCap, label: "calendarClassLabel", chipBg: "bg-primary-tint", chipFg: "text-primary", dot: "bg-primary" },
  visit: { icon: UserRound, label: "calendarVisitLabel", chipBg: "bg-tint-success", chipFg: "text-success", dot: "bg-success" },
  appointment: { icon: CalendarDays, label: "calendarAppointmentLabel", chipBg: "bg-[#6b21a8]/10", chipFg: "text-[#6b21a8]", dot: "bg-[#6b21a8]" }
};

const FILTERS = [
  { key: "all", label: "calendarFilterAll", style: null },
  { key: "class", label: "calendarFilterClasses", style: KIND_STYLE.class },
  { key: "visit", label: "calendarFilterVisits", style: KIND_STYLE.visit },
  { key: "appointment", label: "calendarFilterAppointments", style: KIND_STYLE.appointment }
];

function AddEventModal({ type, defaultDate, createdByName, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({
    title: "", personName: "", notes: "",
    date: defaultDate, startTime: "09:00", endTime: "",
    availability: "busy"
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  const label = type === "visit" ? t("calendarAddVisit") : t("calendarAddAppointment");

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-xl" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{label}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarEventTitle")} *</label><input className={inputClass} value={fields.title} onChange={(e) => setField("title", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarPersonName")}</label><input className={inputClass} value={fields.personName} onChange={(e) => setField("personName", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarDate")} *</label><input type="date" className={inputClass} value={fields.date} onChange={(e) => setField("date", e.target.value)} /></div>
          {type === "appointment" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarAvailability")}</label>
              <select className={inputClass} value={fields.availability} onChange={(e) => setField("availability", e.target.value)}>
                <option value="busy">{t("calendarBusy")}</option>
                <option value="available">{t("calendarAvailable")}</option>
              </select>
            </div>
          )}
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarStartTime")} *</label><input type="time" className={inputClass} value={fields.startTime} onChange={(e) => setField("startTime", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarEndTime")}</label><input type="time" className={inputClass} value={fields.endTime} onChange={(e) => setField("endTime", e.target.value)} /></div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarNotes")}</label>
          <input className={inputClass} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} />
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <Button type="button" variant="secondary" onClick={onCancel}>{t("calendarCancel")}</Button>
          <Button disabled={!fields.title.trim() || !fields.date || !fields.startTime} onClick={() => onSave(Object.assign({}, fields, { type, createdByName }))}>{t("calendarSave")}</Button>
        </div>
      </div>
    </div>
  );
}

function CalendarSettingsModal({ config, onSave, onCancel }) {
  const t = useT();
  const [defaultView, setDefaultView] = useState(config.calendarDefaultView || "week");
  const [weekStartsMonday, setWeekStartsMonday] = useState(!!config.calendarWeekStartsMonday);
  const [defaultFilter, setDefaultFilter] = useState(config.calendarDefaultFilter || "all");
  const [classStartTime, setClassStartTime] = useState(config.calendarClassStartTime || "09:30");
  const [classEndTime, setClassEndTime] = useState(config.calendarClassEndTime || "12:30");

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-md" role="dialog" aria-modal="true">
        <p className="mb-1 text-base font-bold text-card-foreground">{t("calendarSettings")}</p>
        <p className="mb-4 text-xs text-muted">{t("calendarSettingsDesc")}</p>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarDefaultViewLabel")}</label>
          <select className={inputClass} value={defaultView} onChange={(e) => setDefaultView(e.target.value)}>
            <option value="week">{t("calendarWeekView")}</option>
            <option value="list">{t("calendarListView")}</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarWeekStartsLabel")}</label>
          <select className={inputClass} value={weekStartsMonday ? "monday" : "sunday"} onChange={(e) => setWeekStartsMonday(e.target.value === "monday")}>
            <option value="sunday">{t("calendarStartsSunday")}</option>
            <option value="monday">{t("calendarStartsMonday")}</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarDefaultFilterLabel")}</label>
          <select className={inputClass} value={defaultFilter} onChange={(e) => setDefaultFilter(e.target.value)}>
            {FILTERS.map((f) => <option key={f.key} value={f.key}>{t(f.label)}</option>)}
          </select>
        </div>

        <div className="mb-1">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarClassTimesLabel")}</label>
          <p className="mb-1.5 text-xs text-muted">{t("calendarClassTimesDesc")}</p>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className={inputClass} value={classStartTime} onChange={(e) => setClassStartTime(e.target.value)} />
            <input type="time" className={inputClass} value={classEndTime} onChange={(e) => setClassEndTime(e.target.value)} />
          </div>
        </div>

        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <Button type="button" variant="secondary" onClick={onCancel}>{t("calendarCancel")}</Button>
          <Button onClick={() => onSave({
            calendarDefaultView: defaultView,
            calendarWeekStartsMonday: weekStartsMonday,
            calendarDefaultFilter: defaultFilter,
            calendarClassStartTime: classStartTime,
            calendarClassEndTime: classEndTime
          })}>{t("calendarSave")}</Button>
        </div>
      </div>
    </div>
  );
}

function fmtTimeRange(startTime, endTime) {
  return endTime ? startTime + " – " + endTime : startTime;
}

function fmtMonthDay(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EventCard({ block, onDelete, t }) {
  const style = KIND_STYLE[block.kind];
  const Icon = style.icon;
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-start gap-2">
          <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md", style.chipBg, style.chipFg)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide", style.chipFg)}>{t(style.label)}</p>
            <p className="text-sm font-semibold text-card-foreground">{block.title}</p>
            {block.event?.personName && <p className="text-xs text-muted">{block.event.personName}</p>}
            {block.event?.type === "appointment" && block.event.availability && (
              <p className="text-xs text-muted">{block.event.availability === "busy" ? t("calendarBusy") : t("calendarAvailable")}</p>
            )}
            <p className="text-xs text-muted">{fmtTimeRange(block.startTime, block.endTime)}</p>
          </div>
        </div>
        {block.event && (
          <button type="button" className="text-muted hover:text-accent" onClick={() => onDelete(block.event.id)} aria-label={t("calendarDelete")}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { data, session, config, updateConfig, requestConfirm, showToast } = useApp();
  const t = useT();
  const weekStartDay = config.calendarWeekStartsMonday ? 1 : 0;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), weekStartDay));
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState(config.calendarDefaultFilter || "all");
  const [view, setView] = useState(config.calendarDefaultView || "week");
  const [addModalType, setAddModalType] = useState(null);
  const [addModalDate, setAddModalDate] = useState(todayStr());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { setWeekStart((prev) => startOfWeek(prev, weekStartDay)); }, [weekStartDay]);

  const days = weekDays(weekStart);
  const rangeStart = dateStrFromDate(days[0]);
  const rangeEnd = dateStrFromDate(days[6]);

  useEffect(() => {
    let cancelled = false;
    fetchCalendarEvents(rangeStart, rangeEnd).then((rows) => { if (!cancelled) setEvents(rows); });
    const unsub = subscribeCalendarEvents(() => {
      fetchCalendarEvents(rangeStart, rangeEnd).then((rows) => { if (!cancelled) setEvents(rows); });
    });
    return () => { cancelled = true; unsub(); };
  }, [rangeStart, rangeEnd]);

  async function handleSave(fields) {
    try {
      await createCalendarEvent(fields);
      setAddModalType(null);
    } catch (err) {
      showToast(err.message || "Couldn't save that event.");
    }
  }

  async function handleDelete(id) {
    if (!(await requestConfirm(t("calendarDelete") + "?"))) return;
    try {
      await deleteCalendarEvent(id);
    } catch (err) {
      showToast(err.message || "Couldn't delete that event.");
    }
  }

  const dayBlocks = useMemo(() => {
    return days.map((d) => {
      const dateStr = dateStrFromDate(d);
      const classBlocks = classBlocksForDay(data.classes, d.getDay(), config.calendarClassStartTime, config.calendarClassEndTime);
      const dayEvents = events.filter((e) => e.date === dateStr);
      const blocks = sortDayBlocks(
        classBlocks.concat(dayEvents.map((e) => ({ key: e.id, kind: e.type, title: e.title, startTime: e.startTime, endTime: e.endTime, event: e })))
      );
      return { date: d, dateStr, blocks: filter === "all" ? blocks : blocks.filter((b) => b.kind === filter) };
    });
  }, [days, data.classes, events, filter, config.calendarClassStartTime, config.calendarClassEndTime]);

  const summary = useMemo(() => {
    let classes = 0, visits = 0, appointments = 0;
    dayBlocks.forEach((day) => day.blocks.forEach((b) => {
      if (b.kind === "class") classes++;
      else if (b.kind === "visit") visits++;
      else appointments++;
    }));
    return { days: days.length, classes, visits, appointments };
  }, [dayBlocks, days.length]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-card-foreground">{t("calendarTitle")}</h1>
          <p className="text-sm text-muted">{t("calendarSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), weekStartDay))}>
            <CalendarDays className="mr-1.5 h-4 w-4" />{t("calendarToday")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("calendarPrevWeek")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("calendarNextWeek")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-card-foreground">
            {fmtMonthDay(days[0])} – {fmtMonthDay(days[6])}, {days[6].getFullYear()}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-card-foreground">{t("calendarShowLabel")}</span>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const dotClass = f.style?.dot;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex min-h-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? f.key === "all" ? "border-primary bg-primary text-primary-foreground" : cn("border-transparent", f.style.chipBg, f.style.chipFg)
                    : "border-border bg-background text-muted hover:text-card-foreground"
                )}
              >
                {dotClass && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />}
                {t(f.label)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          <button type="button" onClick={() => setView("week")} className={cn("flex min-h-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", view === "week" ? "bg-primary text-primary-foreground" : "text-muted hover:text-card-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" />{t("calendarWeekView")}
          </button>
          <button type="button" onClick={() => setView("list")} className={cn("flex min-h-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", view === "list" ? "bg-primary text-primary-foreground" : "text-muted hover:text-card-foreground")}>
            <List className="h-3.5 w-3.5" />{t("calendarListView")}
          </button>
        </div>
      </div>

      {view === "week" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {dayBlocks.map(({ date: d, dateStr, blocks }) => {
            const isToday = dateStr === todayStr();
            return (
              <div key={dateStr} className={cn("flex flex-col gap-2 rounded-xl border p-3", isToday ? "border-primary bg-primary-tint/30" : "border-border bg-card")}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{WEEKDAYS.en[d.getDay()]}</p>
                    <p className="text-sm font-bold text-card-foreground">{fmtMonthDay(d)}</p>
                  </div>
                  {blocks.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-tint px-1.5 text-xs font-bold text-primary">{blocks.length}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {blocks.length === 0 && <p className="py-2 text-center text-xs text-muted">{t("calendarNoEvents")}</p>}
                  {blocks.map((b) => <EventCard key={b.key} block={b} onDelete={handleDelete} t={t} />)}
                </div>

                <div className="mt-auto flex flex-col gap-1.5 pt-1">
                  <button type="button" className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-success/40 py-1.5 text-xs font-semibold text-success hover:bg-tint-success" onClick={() => { setAddModalDate(dateStr); setAddModalType("visit"); }}>
                    <Plus className="h-3 w-3" /> {t("calendarAddVisit")}
                  </button>
                  <button type="button" className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#6b21a8]/40 py-1.5 text-xs font-semibold text-[#6b21a8] hover:bg-[#6b21a8]/10" onClick={() => { setAddModalDate(dateStr); setAddModalType("appointment"); }}>
                    <Plus className="h-3 w-3" /> {t("calendarAddAppointment")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dayBlocks.map(({ date: d, dateStr, blocks }) => (
            <div key={dateStr} className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-sm font-bold text-card-foreground">{WEEKDAYS.en[d.getDay()]}, {fmtMonthDay(d)}</p>
              {blocks.length === 0 ? (
                <p className="py-1 text-xs text-muted">{t("calendarNoEvents")}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {blocks.map((b) => <EventCard key={b.key} block={b} onDelete={handleDelete} t={t} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary-tint/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-bold text-card-foreground">{t("calendarAboutTitle")}</p>
            <p className="text-sm text-muted">{t("calendarAboutBody")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSettingsOpen(true)}>
          <Settings className="mr-1.5 h-4 w-4" />{t("calendarSettings")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
              <CalendarPlus className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-card-foreground">{t("calendarQuickAddTitle")}</p>
              <p className="text-xs text-muted">{t("calendarQuickAddBody")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddModalDate(todayStr()); setAddModalType("visit"); }}>
              <UserRound className="mr-1.5 h-4 w-4 text-success" />{t("calendarAddVisit")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setAddModalDate(todayStr()); setAddModalType("appointment"); }}>
              <CalendarDays className="mr-1.5 h-4 w-4 text-[#6b21a8]" />{t("calendarAddAppointment")}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <p className="shrink-0 text-sm font-bold text-card-foreground">{t("calendarSummaryTitle")}</p>
          <div className="flex gap-4">
            <div className="text-center"><p className="text-lg font-bold text-card-foreground">{summary.days}</p><p className="text-[11px] text-muted">{t("calendarSummaryDays")}</p></div>
            <div className="text-center"><p className="text-lg font-bold text-primary">{summary.classes}</p><p className="text-[11px] text-muted">{t("calendarClassLabel")}</p></div>
            <div className="text-center"><p className="text-lg font-bold text-success">{summary.visits}</p><p className="text-[11px] text-muted">{t("calendarVisitLabel")}</p></div>
            <div className="text-center"><p className="text-lg font-bold text-[#6b21a8]">{summary.appointments}</p><p className="text-[11px] text-muted">{t("calendarAppointmentLabel")}</p></div>
          </div>
        </div>
      </div>

      {addModalType && (
        <AddEventModal
          type={addModalType}
          defaultDate={addModalDate}
          createdByName={session?.currentUserName || ""}
          onSave={handleSave}
          onCancel={() => setAddModalType(null)}
        />
      )}

      {settingsOpen && (
        <CalendarSettingsModal
          config={config}
          onCancel={() => setSettingsOpen(false)}
          onSave={(patch) => {
            updateConfig(patch);
            setView(patch.calendarDefaultView);
            setFilter(patch.calendarDefaultFilter);
            setWeekStart((prev) => startOfWeek(prev, patch.calendarWeekStartsMonday ? 1 : 0));
            setSettingsOpen(false);
            showToast(t("calendarSave") + " ✓");
          }}
        />
      )}
    </div>
  );
}
