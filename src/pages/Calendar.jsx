// Calendar.jsx -- shared weekly calendar: Level 1/2/3 class schedule
// (fixed 9:30-12:30 block, derived from data.classes -- see lib/calendar.js)
// plus staff-added "office visit" and "appointment" entries (calendar_events
// table, see lib/calendarData.js). Any signed-in staff can add either kind;
// everyone with calendar access can see the whole week at a glance.
//
// Redesigned as a true time-grid week view (WeekView/DayColumn/EventCard,
// see components/calendar/) with a slide-out EventDrawer, in the style of
// Google/Outlook/Notion Calendar. The design brief this was built from asked
// for 9 event categories (Immigration, Housing, Job Development, Case
// Management, Staff Meetings, ...) and drawer fields like Related Case and
// Documents -- none of that exists in calendar_events today (type is only
// class/visit/appointment; no client/staff/status/case-link columns), so
// per explicit product decision this pass is UI-only for the 3 real
// categories: no fabricated data, no controls that silently do nothing.
// Month/Day views and the richer category set are left as future work.
import { CalendarPlus, Info, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { addDays, classBlocksForDay, sortDayBlocks, startOfWeek, weekDays } from "../lib/calendar.js";
import { createCalendarEvent, deleteCalendarEvent, duplicateCalendarEvent, fetchCalendarEvents, subscribeCalendarEvents, updateCalendarEvent } from "../lib/calendarData.js";
import { dateStrFromDate, todayStr } from "../lib/utils.js";
import { Button } from "../components/ui/button.jsx";
import { FILTERS, KIND_STYLE } from "../components/calendar/kindStyle.js";
import CalendarHeader from "../components/calendar/CalendarHeader.jsx";
import CalendarToolbar from "../components/calendar/CalendarToolbar.jsx";
import WeekView from "../components/calendar/WeekView.jsx";
import EventDrawer from "../components/calendar/EventDrawer.jsx";
import EventMenu from "../components/calendar/EventMenu.jsx";
import Legend from "../components/calendar/Legend.jsx";
import { cn } from "../lib/cn.js";

const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

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

function fmtMonthDay(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CalendarPage() {
  const { data, session, config, updateConfig, requestConfirm, showToast } = useApp();
  const t = useT();
  const weekStartDay = config.calendarWeekStartsMonday ? 1 : 0;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), weekStartDay));
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState(config.calendarDefaultFilter || "all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(config.calendarDefaultView === "list" ? "list" : "week");
  const [addModalType, setAddModalType] = useState(null);
  const [addModalDate, setAddModalDate] = useState(todayStr());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeBlock, setActiveBlock] = useState(null);

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

  async function handleUpdate(id, fields) {
    try {
      await updateCalendarEvent(id, fields);
      showToast(t("calendarUpdated"));
      setActiveBlock(null);
    } catch (err) {
      showToast(err.message || "Couldn't save that event.");
    }
  }

  async function handleDuplicate(block) {
    if (!block.event) return;
    try {
      await duplicateCalendarEvent(block.event);
      showToast(t("calendarDuplicated"));
    } catch (err) {
      showToast(err.message || "Couldn't duplicate that event.");
    }
  }

  async function handleDelete(block) {
    const id = block.event ? block.event.id : block;
    if (!(await requestConfirm(t("calendarDelete") + "?"))) return;
    try {
      await deleteCalendarEvent(id);
      setActiveBlock(null);
    } catch (err) {
      showToast(err.message || "Couldn't delete that event.");
    }
  }

  const dayBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return days.map((d) => {
      const dateStr = dateStrFromDate(d);
      const classBlocks = classBlocksForDay(data.classes, d.getDay(), config.calendarClassStartTime, config.calendarClassEndTime);
      const dayEvents = events.filter((e) => e.date === dateStr);
      let blocks = sortDayBlocks(
        classBlocks.concat(dayEvents.map((e) => ({ key: e.id, kind: e.type, title: e.title, startTime: e.startTime, endTime: e.endTime, event: e })))
      );
      if (filter !== "all") blocks = blocks.filter((b) => b.kind === filter);
      if (q) blocks = blocks.filter((b) => b.title.toLowerCase().includes(q) || (b.event?.personName || "").toLowerCase().includes(q));
      return { date: d, dateStr, blocks };
    });
  }, [days, data.classes, events, filter, search, config.calendarClassStartTime, config.calendarClassEndTime]);

  const summary = useMemo(() => {
    let classes = 0, visits = 0, appointments = 0;
    dayBlocks.forEach((day) => day.blocks.forEach((b) => {
      if (b.kind === "class") classes++;
      else if (b.kind === "visit") visits++;
      else appointments++;
    }));
    return { days: days.length, classes, visits, appointments };
  }, [dayBlocks, days.length]);

  const weekdayLabels = days.map((d) => WEEKDAYS.en[d.getDay()].slice(0, 3).toUpperCase());

  return (
    <div className="flex flex-col gap-4">
      <CalendarHeader
        t={t}
        days={days}
        onToday={() => setWeekStart(startOfWeek(new Date(), weekStartDay))}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CalendarToolbar
          t={t}
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          view={view}
          onViewChange={setView}
          onUnavailableView={() => showToast(t("calendarViewComingSoon"))}
        />
        <EventMenu t={t} onPick={(type) => { setAddModalDate(todayStr()); setAddModalType(type); }} />
      </div>

      {view === "week" ? (
        <WeekView
          dayBlocks={dayBlocks}
          weekdayLabels={weekdayLabels}
          todayStr={todayStr()}
          t={t}
          onOpen={setActiveBlock}
          onEdit={setActiveBlock}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onAddEvent={(dateStr) => { setAddModalDate(dateStr); setAddModalType("visit"); }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {dayBlocks.map(({ date: d, dateStr, blocks }) => (
            <div key={dateStr} className={cn("rounded-xl border p-3", dateStr === todayStr() ? "border-primary bg-primary-tint/30" : "border-border bg-card")}>
              <p className="mb-2 text-sm font-bold text-card-foreground">{WEEKDAYS.en[d.getDay()]}, {fmtMonthDay(d)}</p>
              {blocks.length === 0 ? (
                <button type="button" className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-muted hover:border-primary hover:text-primary" onClick={() => { setAddModalDate(dateStr); setAddModalType("visit"); }}>
                  {t("calendarNewEvent")}
                </button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {blocks.map((b) => {
                    const style = KIND_STYLE[b.kind];
                    const Icon = style.icon;
                    return (
                      <button key={b.key} type="button" onClick={() => setActiveBlock(b)} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2 text-left hover:border-primary/40">
                        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", style.chipBg, style.chipFg)}><Icon className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-card-foreground">{b.title}</span>
                          <span className="block text-xs text-muted">{b.startTime}{b.endTime ? " – " + b.endTime : ""}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Legend t={t} />

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

      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
          <CalendarPlus className="h-5 w-5" />
        </span>
        <p className="shrink-0 text-sm font-bold text-card-foreground">{t("calendarSummaryTitle")}</p>
        <div className="flex gap-4">
          <div className="text-center"><p className="text-lg font-bold text-card-foreground">{summary.days}</p><p className="text-[11px] text-muted">{t("calendarSummaryDays")}</p></div>
          <div className="text-center"><p className="text-lg font-bold text-primary">{summary.classes}</p><p className="text-[11px] text-muted">{t("calendarClassLabel")}</p></div>
          <div className="text-center"><p className="text-lg font-bold text-success">{summary.visits}</p><p className="text-[11px] text-muted">{t("calendarVisitLabel")}</p></div>
          <div className="text-center"><p className="text-lg font-bold text-[#6b21a8]">{summary.appointments}</p><p className="text-[11px] text-muted">{t("calendarAppointmentLabel")}</p></div>
        </div>
      </div>

      <EventDrawer
        block={activeBlock}
        t={t}
        onClose={() => setActiveBlock(null)}
        onSave={handleUpdate}
        onDelete={(block) => handleDelete(block)}
        onDuplicate={(block) => { handleDuplicate(block); setActiveBlock(null); }}
      />

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
            setView(patch.calendarDefaultView === "list" ? "list" : "week");
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
