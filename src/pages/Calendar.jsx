// Calendar.jsx -- shared calendar: Level 1/2/3 class schedule (one fixed
// block per class day, derived from data.classes -- see lib/calendar.js)
// plus staff-added "office visit" and "appointment" entries (calendar_events
// table, see lib/calendarData.js) plus US federal holidays (computed, see
// lib/holidays.js). Any signed-in staff can add either stored kind;
// everyone with calendar access sees the whole range at a glance.
//
// The design brief this screen was built from asked for 9 event categories
// (Immigration, Housing, Job Development, Case Management, Staff Meetings,
// ...) and drawer fields like Related Case and Documents -- none of that
// exists in calendar_events today (type is only class/visit/appointment; no
// client/staff/status/case-link columns), so per explicit product decision
// this stays UI-only for the 4 real categories: no fabricated data, no
// controls that silently do nothing.
//
// Week/Day/Month/Agenda all share one `anchor` date and one `days` array
// (see visibleDays() below) so there's a single source of truth for what
// range is on screen -- Day view reuses WeekView/DayColumn with a 1-day
// array rather than a separate component, since the time grid is identical.
//
// The page owns everything the four views need to agree on: the visible
// days, the fetched events, the derived dayBlocks, the time grid built from
// them (buildTimeGrid widens past 8-6 for anything scheduled outside office
// hours) and the minute-resolution clock behind the "now" line.
import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { addDays, addMonths, addWorkdays, classBlocksForDay, classGroupAccents, nearestWorkday, sortDayBlocks, startOfMonth, workMonthGridDays, workWeekDays } from "../lib/calendar.js";
import { createCalendarEvent, deleteCalendarEvent, duplicateCalendarEvent, fetchCalendarEvents, subscribeCalendarEvents, updateCalendarEvent } from "../lib/calendarData.js";
import { dateStrFromDate, fullServiceList, labelFor, todayStr } from "../lib/utils.js";
import { studentsForClass } from "../lib/students.js";
import { holidaysByDate } from "../lib/holidays.js";
import { Button } from "../components/ui/button.jsx";
import { FILTERS } from "../components/calendar/kindStyle.js";
import { buildTimeGrid } from "../components/calendar/calendarLayout.js";
import CalendarHeader from "../components/calendar/CalendarHeader.jsx";
import CalendarToolbar from "../components/calendar/CalendarToolbar.jsx";
import WeekView from "../components/calendar/WeekView.jsx";
import MonthView from "../components/calendar/MonthView.jsx";
import AgendaView from "../components/calendar/AgendaView.jsx";
import EventDrawer from "../components/calendar/EventDrawer.jsx";
import EventMenu from "../components/calendar/EventMenu.jsx";
import Legend from "../components/calendar/Legend.jsx";
import { CalendarError, CalendarSkeleton } from "../components/calendar/CalendarStatus.jsx";

const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary";

// The switcher in CalendarHeader. Week/Month/Day is the trio the redesign
// reference puts there; Agenda stays on the end because it's a saved
// default (Calendar Settings' "List view") -- dropping it would strand
// anyone whose configured view is "list" with no way back to it.
const VIEWS = [
  { key: "week", label: "calendarWeekShort" },
  { key: "month", label: "calendarMonthView" },
  { key: "day", label: "calendarDayView" },
  { key: "list", label: "calendarAgendaView" }
];

const VIEW_TITLE = {
  week: "calendarTitleWeek",
  month: "calendarTitleMonth",
  day: "calendarTitleDay",
  list: "calendarTitleAgenda"
};

// A five-column week grid is unreadable on a phone, so a narrow first paint
// opens on the single-day timeline instead. Only the *default* moves --
// every view stays reachable from the switcher at any width.
function initialView(configuredView) {
  const saved = configuredView === "list" ? "list" : "week";
  if (saved === "week" && typeof window !== "undefined" && window.innerWidth < 768) return "day";
  return saved;
}

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
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarEventTitle")} *</label><input className={inputClass} value={fields.title} onChange={(e) => setField("title", e.target.value)} placeholder={t("phEventTitle")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarPersonName")}</label><input className={inputClass} value={fields.personName} onChange={(e) => setField("personName", e.target.value)} placeholder={t("phPersonName")} /></div>
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
          <input className={inputClass} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t("phEventNotes")} />
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

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export default function CalendarPage() {
  const { data, session, config, lang, updateConfig, requestConfirm, showToast } = useApp();
  const t = useT();
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState(config.calendarDefaultFilter || "all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(() => initialView(config.calendarDefaultView));
  const [addModalType, setAddModalType] = useState(null);
  const [addModalDate, setAddModalDate] = useState(todayStr());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeBlock, setActiveBlock] = useState(null);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(() => minutesOfDay(new Date()));

  function openEvent(block) { setDrawerEditMode(false); setActiveBlock(block); }
  function editEvent(block) { setDrawerEditMode(true); setActiveBlock(block); }

  // Office is closed Sat/Sun, so every view is Mon-Fri only -- see
  // workWeekDays()/workMonthGridDays() in lib/calendar.js.
  const days = useMemo(() => {
    if (view === "day") return [nearestWorkday(anchor)];
    if (view === "month") return workMonthGridDays(anchor);
    return workWeekDays(anchor);
  }, [view, anchor]);

  const rangeStart = dateStrFromDate(days[0]);
  const rangeEnd = dateStrFromDate(days[days.length - 1]);

  function handleViewChange(nextView) {
    if (nextView === "day") setAnchor((d) => nearestWorkday(d));
    setView(nextView);
  }
  function goToday() { setAnchor(view === "day" ? nearestWorkday(new Date()) : new Date()); }
  function goPrev() {
    if (view === "day") setAnchor((d) => addWorkdays(d, -1));
    else if (view === "month") setAnchor((d) => addMonths(d, -1));
    else setAnchor((d) => addDays(d, -7));
  }
  function goNext() {
    if (view === "day") setAnchor((d) => addWorkdays(d, 1));
    else if (view === "month") setAnchor((d) => addMonths(d, 1));
    else setAnchor((d) => addDays(d, 7));
  }

  const rangeLabel = useMemo(() => {
    if (view === "day") return days[0].toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    if (view === "month") return startOfMonth(anchor).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return fmtMonthDay(days[0]) + " – " + fmtMonthDay(days[days.length - 1]) + ", " + days[days.length - 1].getFullYear();
  }, [view, days, anchor]);

  const navLabels = view === "day"
    ? { prev: t("calendarPrevDay"), next: t("calendarNextDay") }
    : view === "month"
      ? { prev: t("calendarPrevMonth"), next: t("calendarNextMonth") }
      : { prev: t("calendarPrevWeek"), next: t("calendarNextWeek") };

  // One fetch per visible range (plus a realtime re-fetch of that same
  // range) -- navigating a week forward asks only for the new week, and
  // nothing refetches while the user types in the search box, since search
  // and the filter chips both run over the rows already in memory.
  useEffect(() => {
    let cancelled = false;
    let seen = false;
    function load(initial) {
      if (initial) setStatus("loading");
      fetchCalendarEvents(rangeStart, rangeEnd).then((rows) => {
        if (cancelled) return;
        seen = true;
        setEvents(rows);
        setStatus("ready");
      }).catch((err) => {
        if (cancelled) return;
        console.warn("fetchCalendarEvents failed", err);
        // A realtime re-fetch that fails after a good load leaves the
        // already-rendered week alone rather than blanking it.
        if (!seen) setStatus("error");
      });
    }
    load(true);
    const unsub = subscribeCalendarEvents(() => load(false));
    return () => { cancelled = true; unsub(); };
  }, [rangeStart, rangeEnd, reloadKey]);

  // Drives the "now" line. A minute is as precise as an hour-tall row can
  // show, and it stops the page re-rendering on a timer any faster.
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(minutesOfDay(new Date())), 60000);
    return () => clearInterval(id);
  }, []);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

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

  // Which palette slot each distinct class grouping draws from -- derived
  // from the schedule itself, so Level 1 & 2 (Mon/Wed/Fri) and Level 3
  // (Tue/Thu) are visually distinct without either being hard-coded.
  const classAccents = useMemo(() => classGroupAccents(data.classes), [data.classes]);
  const classGroupCount = useMemo(() => Object.keys(classAccents).length, [classAccents]);

  // The two things a class block can only learn up here: the service it
  // belongs to (its card subtitle) and how many students are enrolled in
  // it right now. Both are real rows -- classes.service and the students
  // table's class_key -- so a class with no roster gets no count rather
  // than a fabricated one.
  const classMeta = useMemo(() => {
    const services = fullServiceList(data.customServices);
    const byKey = {};
    (data.classes || []).forEach((c) => { byKey[c.key] = c; });
    return function metaFor(classKeys) {
      const list = (classKeys || []).map((k) => byKey[k]).filter(Boolean);
      const labels = [];
      list.forEach((c) => {
        const label = c.service ? labelFor(services, c.service, lang) : "";
        if (label && labels.indexOf(label) === -1) labels.push(label);
      });
      const count = list.reduce((n, c) => n + studentsForClass(data.students, c.key).length, 0);
      return { subtitle: labels.join(" · "), count: count };
    };
  }, [data.classes, data.students, data.customServices, lang]);

  const dayBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return days.map((d) => {
      const dateStr = dateStrFromDate(d);
      const classBlocks = classBlocksForDay(data.classes, d.getDay(), config.calendarClassStartTime, config.calendarClassEndTime, classAccents)
        .map((b) => Object.assign({}, b, classMeta(b.classKeys)));
      const dayEvents = events.filter((e) => e.date === dateStr);
      let blocks = sortDayBlocks(
        classBlocks.concat(dayEvents.map((e) => ({ key: e.id, kind: e.type, title: e.title, startTime: e.startTime, endTime: e.endTime, event: e })))
      );
      if (filter !== "all") blocks = blocks.filter((b) => b.kind === filter);
      if (q) blocks = blocks.filter((b) => b.title.toLowerCase().includes(q) || (b.event?.personName || "").toLowerCase().includes(q));
      return { date: d, dateStr, blocks };
    });
  }, [days, data.classes, events, filter, search, config.calendarClassStartTime, config.calendarClassEndTime, classAccents, classMeta]);

  // Day view gets a taller hour so a single column can carry more detail;
  // the grid otherwise spans 8 AM-6 PM, widened to cover anything actually
  // scheduled outside that window.
  const grid = useMemo(() => buildTimeGrid(dayBlocks, view === "day" ? 84 : 64), [dayBlocks, view]);

  const summary = useMemo(() => {
    let classes = 0, visits = 0, appointments = 0;
    dayBlocks.forEach((day) => day.blocks.forEach((b) => {
      if (b.kind === "class") classes++;
      else if (b.kind === "visit") visits++;
      else appointments++;
    }));
    return { days: days.length, classes, visits, appointments };
  }, [dayBlocks, days.length]);

  const weekdayLabels = view === "day"
    ? [days[0].toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()]
    : days.map((d) => WEEKDAYS.en[d.getDay()].slice(0, 3).toUpperCase());

  const rangeHolidays = useMemo(() => {
    if (filter !== "all" && filter !== "holiday") return {};
    const years = Array.from(new Set(days.map((d) => d.getFullYear())));
    return holidaysByDate(years);
  }, [days, filter]);

  const today = todayStr();
  const isEmptyRange = status === "ready" && dayBlocks.every((d) => d.blocks.length === 0);

  function renderCalendar() {
    if (status === "loading") return <CalendarSkeleton columns={view === "day" ? 1 : 5} rows={view === "day" ? 6 : 8} />;
    if (status === "error") return <CalendarError t={t} onRetry={reload} />;
    if (view === "month") {
      return (
        <MonthView
          dayBlocks={dayBlocks}
          monthAnchor={anchor}
          todayStr={today}
          holidaysByDate={rangeHolidays}
          t={t}
          onSelectDay={(dateStr) => { setAnchor(new Date(dateStr + "T00:00:00")); setView("day"); }}
          onOpenEvent={openEvent}
          onAddEvent={(dateStr) => { setAddModalDate(dateStr); setAddModalType("visit"); }}
        />
      );
    }
    if (view === "list") {
      return (
        <AgendaView
          dayBlocks={dayBlocks}
          todayStr={today}
          holidaysByDate={rangeHolidays}
          t={t}
          onOpenEvent={openEvent}
          onAddEvent={(dateStr) => { setAddModalDate(dateStr); setAddModalType("visit"); }}
        />
      );
    }
    return (
      <WeekView
        dayBlocks={dayBlocks}
        onPrev={goPrev}
        onNext={goNext}
        weekdayLabels={weekdayLabels}
        todayStr={today}
        holidaysByDate={rangeHolidays}
        grid={grid}
        nowMinutes={nowMinutes}
        t={t}
        onOpen={openEvent}
        onEdit={editEvent}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onAddEvent={(dateStr) => { setAddModalDate(dateStr); setAddModalType("visit"); }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <CalendarHeader
        t={t}
        title={t(VIEW_TITLE[view] || "calendarTitleWeek")}
        rangeLabel={rangeLabel}
        prevLabel={navLabels.prev}
        nextLabel={navLabels.next}
        views={VIEWS}
        view={view}
        onViewChange={handleViewChange}
        onToday={goToday}
        onPrev={goPrev}
        onNext={goNext}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <CalendarToolbar
            t={t}
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
        <EventMenu t={t} onPick={(type) => { setAddModalDate(todayStr()); setAddModalType(type); }} />
      </div>

      {/* The grid itself always stays on screen when a range is empty -- the
          note sits above it so staff can still navigate or add an event. */}
      {isEmptyRange && (
        <p className="m-0 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          {search.trim() || filter !== "all" ? t("calendarNoMatches") : t("calendarNoEventsRange")}
        </p>
      )}

      {renderCalendar()}

      <Legend t={t} summary={status === "ready" ? summary : null} classGroups={classGroupCount} />

      <p className="m-0 flex items-start gap-2 px-1 text-xs text-muted">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
        {t("calendarAboutBody")}
      </p>

      <EventDrawer
        block={activeBlock}
        openInEditMode={drawerEditMode}
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
            setSettingsOpen(false);
            showToast(t("calendarSave") + " ✓");
          }}
        />
      )}
    </div>
  );
}
