// Availability.jsx -- "My Availability": every staff login's weekly booking
// calendar (lib/availability.js). Staff paint the 30-minute blocks they can
// take appointments in, add time off, and see what clients have booked with
// them. Clients booking an appointment (kiosk / phone) only see open blocks
// from here. Administrators can switch to anyone's calendar.
//
// The hours repeat every week (one row per weekday in staff_availability),
// so the grid is labelled by weekday only, never by date. Block states:
//   Available    open and saved -- clients can book it
//   Selected     changed here but not saved yet (opened, or closed: dashed)
//   Unavailable  closed -- clients can't book it
//
// The grid paints by click/tap per block, or by dragging with a mouse; on a
// touch screen dragging scrolls the page instead, so each block is a tap.
// Arrow keys move between blocks (one tab stop for the whole grid) and
// Space/Enter toggles the focused block.
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarDays, Check, ChevronDown, Clock, Info, NotebookPen, Plane, Plus, Trash2, X } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import {
  DAY_END_MIN, DAY_START_MIN, SLOT_MINUTES, addTimeOff, cellKey, cellsToRanges, deleteTimeOff,
  fetchOpenSlots, fetchTimeOff, fetchWeeklyAvailability, fmtSlotTime, minToHHMM, rangesToCells, saveWeeklyAvailability
} from "../lib/availability.js";
import { updateAppointmentStatus } from "../lib/clientsData.js";
import { cn } from "../lib/cn.js";
import { fmtDateLong, roleLabel, todayStr } from "../lib/utils.js";
import DatePicker from "../components/DatePicker.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { BUTTON_RESET, Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";
import { Input, Select } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";

// Monday-first, the way staff think about a work week.
const DAYS = [
  { wd: 1, short: "Mon", long: "Monday" }, { wd: 2, short: "Tue", long: "Tuesday" }, { wd: 3, short: "Wed", long: "Wednesday" },
  { wd: 4, short: "Thu", long: "Thursday" }, { wd: 5, short: "Fri", long: "Friday" }, { wd: 6, short: "Sat", long: "Saturday" },
  { wd: 0, short: "Sun", long: "Sunday" }
];
const ROWS = [];
for (let m = DAY_START_MIN; m < DAY_END_MIN; m += SLOT_MINUTES) ROWS.push(m);

const WEEKDAYS = [1, 2, 3, 4, 5];
// Starting points for the grid; staff adjust from there. Each fills whole
// 30-minute blocks inside the editable day (DAY_START_MIN..DAY_END_MIN).
const PRESETS = [
  { key: "weekdays-9-5", label: "Weekdays 9–5", from: 9 * 60, to: 17 * 60, days: WEEKDAYS },
  { key: "weekdays-8-4", label: "Weekdays 8–4", from: 8 * 60, to: 16 * 60, days: WEEKDAYS },
  { key: "weekday-mornings", label: "Weekday mornings 9–12", from: 9 * 60, to: 12 * 60, days: WEEKDAYS },
  { key: "mon-sat-9-5", label: "Mon–Sat 9–5", from: 9 * 60, to: 17 * 60, days: [1, 2, 3, 4, 5, 6] }
];

function presetCells(fromMin, toMin, weekdays) {
  const cells = new Set();
  weekdays.forEach((wd) => { for (let m = fromMin; m < toMin; m += SLOT_MINUTES) cells.add(cellKey(wd, m)); });
  return cells;
}

function hoursPerWeek(cells) {
  return (cells.size * SLOT_MINUTES) / 60;
}

// "9:00 AM – 9:30 AM" for an appointment starting at hh:mm.
function slotRange(hhmm) {
  const p = String(hhmm).split(":");
  const start = Number(p[0]) * 60 + Number(p[1]);
  return fmtSlotTime(hhmm) + " – " + fmtSlotTime(minToHHMM(start + SLOT_MINUTES));
}

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Icon tile + heading + description, the header every card on this page uses.
function CardIntro({ icon: Icon, title, description, titleTag: Tag = "h2" }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-tone-info-chip text-primary">
        <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Tag className="m-0 text-heading font-semibold text-card-foreground">{title}</Tag>
        <p className="m-0 mt-1 text-ui text-muted">{description}</p>
      </div>
    </div>
  );
}

// One look per block state, shared by the grid and its legend.
const CELL = {
  available: "border-tone-success-border bg-tone-success-chip hover:border-tone-success-ink",
  selected: "border-primary bg-tone-info-chip hover:bg-tone-info-border",
  removed: "border-dashed border-primary bg-card hover:bg-tone-info-bg",
  unavailable: "border-border bg-card hover:border-primary hover:bg-tone-info-bg"
};

function Legend() {
  const items = [
    { key: "available", label: "Available", hint: "Open and saved. Clients can book it." },
    { key: "selected", label: "Selected", hint: "Changed here, not saved yet." },
    { key: "unavailable", label: "Unavailable", hint: "Closed. Clients can't book it." }
  ];
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Legend">
      {items.map((it) => (
        <li key={it.key} title={it.hint} className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-sunken px-3 text-meta font-medium text-muted">
          <span aria-hidden="true" className={cn("h-3.5 w-3.5 rounded-[4px] border", CELL[it.key])} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function WeeklyGrid({ cells, saved, onChange }) {
  // Mouse drag paints: the first block decides whether the drag adds or
  // removes, every block the pointer crosses follows suit. A quick drag
  // can jump over blocks between pointer events, so each step fills the
  // straight line from the last painted block. drag = { on, r, c } | null.
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const gridRef = useRef(null);
  // Roving tab stop: the grid is one stop in the tab order, arrows move.
  const [focus, setFocus] = useState({ r: 0, c: 0 });

  useEffect(() => {
    // The click that follows a drag's pointerup (if it lands on the block
    // the drag started on) runs before this timeout; after it, clicks --
    // including Space/Enter on a focused block -- count again.
    const end = () => { drag.current = null; setTimeout(() => { suppressClick.current = false; }, 0); };
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, []);

  // Updaters, not values: pointer events during a quick drag can arrive
  // before React re-renders, and must build on each other's changes.
  function apply(key, on) {
    onChange((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  }

  function paintTo(r, c) {
    const d = drag.current;
    const steps = Math.max(Math.abs(r - d.r), Math.abs(c - d.c));
    const keys = [];
    for (let i = 1; i <= steps; i++) {
      keys.push(cellKey(DAYS[Math.round(d.c + ((c - d.c) * i) / steps)].wd, ROWS[Math.round(d.r + ((r - d.r) * i) / steps)]));
    }
    drag.current = { on: d.on, r, c };
    onChange((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => { if (d.on) next.add(k); else next.delete(k); });
      return next;
    });
  }

  function moveFocus(r, c) {
    const nr = Math.max(0, Math.min(ROWS.length - 1, r));
    const nc = Math.max(0, Math.min(DAYS.length - 1, c));
    setFocus({ r: nr, c: nc });
    const el = gridRef.current && gridRef.current.querySelector('[data-cell="' + nr + "-" + nc + '"]');
    if (el) el.focus();
  }

  function onKeyDown(e, r, c) {
    const moves = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1], Home: [r, 0], End: [r, DAYS.length - 1] };
    if (!moves[e.key]) return;
    e.preventDefault();
    moveFocus(moves[e.key][0], moves[e.key][1]);
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        ref={gridRef}
        role="group"
        aria-label="Weekly hours. Use the arrow keys to move between blocks, Space to open or close one."
        className="grid min-w-[620px] select-none grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-1.5 [-webkit-user-select:none]"
      >
        {/* The time column stays pinned while the days scroll sideways (phones). */}
        <div className="sticky left-0 z-[2] flex h-12 items-center justify-center rounded-[10px] bg-surface-sunken text-caption font-semibold uppercase tracking-wide text-muted">Time</div>
        {DAYS.map((d) => (
          <div key={d.wd} className="flex h-12 items-center justify-center rounded-[10px] bg-surface-sunken text-meta font-semibold uppercase tracking-wide text-card-foreground">
            <abbr title={d.long} className="no-underline">{d.short}</abbr>
          </div>
        ))}
        {ROWS.map((m, r) => (
          <div key={m} className="contents">
            <div className="sticky left-0 z-[2] flex h-[34px] items-center justify-end whitespace-nowrap bg-card pr-2 text-meta tabular-nums text-muted">{fmtSlotTime(minToHHMM(m))}</div>
            {DAYS.map((d, c) => {
              const key = cellKey(d.wd, m);
              const on = cells.has(key);
              const wasOn = saved.has(key);
              const state = on ? (wasOn ? "available" : "selected") : (wasOn ? "removed" : "unavailable");
              return (
                <button
                  key={key}
                  type="button"
                  data-cell={r + "-" + c}
                  tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                  aria-pressed={on}
                  aria-label={d.long + " " + fmtSlotTime(minToHHMM(m)) + (on ? ", open" : ", closed") + (on !== wasOn ? ", not saved" : "")}
                  onFocus={() => setFocus({ r, c })}
                  onKeyDown={(e) => onKeyDown(e, r, c)}
                  onPointerDown={(e) => {
                    if (e.pointerType !== "mouse") return;
                    e.preventDefault(); // no text selection or focus jump while painting
                    drag.current = { on: !on, r, c };
                    suppressClick.current = true;
                    setFocus({ r, c });
                    apply(key, !on);
                  }}
                  onPointerEnter={() => { if (drag.current) paintTo(r, c); }}
                  onClick={() => {
                    if (suppressClick.current) { suppressClick.current = false; return; }
                    apply(key, !on);
                  }}
                  className={cn(
                    BUTTON_RESET,
                    "h-[34px] w-full touch-manipulation rounded-[8px] border transition-colors duration-fast motion-reduce:transition-none",
                    "focus-visible:relative focus-visible:z-10",
                    FOCUS,
                    CELL[state]
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Split button: the main part applies Weekdays 9–5 in one click, as it
// always has; the chevron opens the other starting points.
function PresetMenu({ onPick }) {
  return (
    <DropdownMenu>
      <div className="inline-flex">
        <Button variant="outline" className="gap-2 rounded-l-[12px] rounded-r-none" onClick={() => onPick(PRESETS[0])}>
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
          {PRESETS[0].label}
        </Button>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="More presets" className="-ml-px rounded-l-none rounded-r-[12px] px-2.5">
            <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start">
        {PRESETS.map((p) => (
          <DropdownMenuItem key={p.key} onSelect={() => onPick(p)}>{p.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TimeOffCard({ timeOff, today, onAdd, onRemove }) {
  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [offNote, setOffNote] = useState("");
  const [busy, setBusy] = useState(false);
  const upcomingOff = timeOff.filter((o) => o.endDate >= today);

  async function add() {
    setBusy(true);
    const ok = await onAdd({ startDate: offStart, endDate: offEnd, note: offNote });
    setBusy(false);
    if (ok) { setOffStart(""); setOffEnd(""); setOffNote(""); }
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardIntro icon={Plane} title="Time off" description="Days you're away. Clients can't book them, whatever your weekly hours say." />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="ds-control min-w-0">
          <label htmlFor="off-start" className="mb-1.5 block text-meta font-semibold text-card-foreground">First day</label>
          <DatePicker id="off-start" value={offStart} onChange={setOffStart} placeholder="Select date" />
        </div>
        <div className="ds-control min-w-0">
          <label htmlFor="off-end" className="mb-1.5 block text-meta font-semibold text-card-foreground">Last day (optional)</label>
          <DatePicker id="off-end" value={offEnd} onChange={setOffEnd} placeholder="Select date" />
        </div>
      </div>
      <div className="relative mt-3">
        <NotebookPen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input
          value={offNote}
          maxLength={120}
          onChange={(e) => setOffNote(e.target.value)}
          placeholder="Note, e.g. Training, vacation (optional)"
          aria-label="Time off note"
          className="pl-9"
        />
      </div>
      <Button
        variant="ghost"
        onClick={add}
        disabled={busy}
        className="mt-3 h-11 w-full gap-2 rounded-[12px] border border-tone-info-border bg-tone-info-bg font-semibold text-primary hover:bg-tone-info-chip"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />{busy ? "Adding…" : "Add time off"}
      </Button>

      {upcomingOff.length ? (
        <ul className="m-0 mt-4 list-none space-y-2 p-0">
          {upcomingOff.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-surface-sunken px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-ui font-semibold text-card-foreground">
                    {fmtDateLong(o.startDate)}{o.endDate !== o.startDate ? " – " + fmtDateLong(o.endDate) : ""}
                  </div>
                  {o.note && <div className="truncate text-meta text-muted">{o.note}</div>}
                </div>
              </div>
              <IconButton size="sm" variant="danger" label={"Remove time off " + fmtDateLong(o.startDate)} onClick={() => onRemove(o.id)}>
                <Trash2 aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-4 flex items-center gap-3 rounded-[12px] bg-tone-info-bg px-3 py-3 text-ui text-muted">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-tone-info-chip text-primary"><Info className="h-4 w-4" aria-hidden="true" /></span>
          No time off coming up.
        </p>
      )}
    </Card>
  );
}

function UpcomingCard({ upcoming, onStatus }) {
  return (
    <Card className="p-5 sm:p-6">
      <CardIntro icon={Clock} title="Upcoming appointments" description="Client requests hold their time until you confirm or cancel them." />
      {upcoming.length ? (
        <ul className="m-0 mt-5 list-none space-y-2.5 p-0">
          {upcoming.slice(0, 12).map((a) => {
            const requested = a.status === "requested";
            return (
              <li key={a.id} className="rounded-[14px] border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-ui font-semibold text-card-foreground">{a.firstName} {a.lastName}</div>
                    <div className="mt-0.5 text-meta tabular-nums text-muted">
                      {fmtDateLong(a.date)} · {a.time ? slotRange(a.time) : "—"}
                    </div>
                  </div>
                  <Badge variant={requested ? "warning" : "success"} dot>{requested ? "Requested" : "Confirmed"}</Badge>
                </div>
                {a.reason && <p className="m-0 mt-2 line-clamp-2 text-meta text-muted">{a.reason}</p>}
                <div className="mt-3 flex gap-2">
                  {requested && (
                    <Button size="sm" onClick={() => onStatus(a, "scheduled")} aria-label={"Confirm appointment with " + a.firstName + " " + a.lastName}>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />Confirm
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-tone-danger-ink hover:bg-tone-danger-bg" onClick={() => onStatus(a, "cancelled")} aria-label={"Cancel appointment with " + a.firstName + " " + a.lastName}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />Cancel
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 flex flex-col items-center rounded-[14px] border border-border bg-surface-sunken px-4 py-7 text-center">
          <CalendarCheck className="h-8 w-8 text-muted" strokeWidth={1.6} aria-hidden="true" />
          <p className="m-0 mt-3 text-ui font-semibold text-card-foreground">No upcoming appointments.</p>
          <p className="m-0 mt-1 text-meta text-muted">New appointment requests will appear here.</p>
        </div>
      )}
    </Card>
  );
}

export default function Availability() {
  const { session, data, showToast, requestConfirm } = useApp();
  const isAdmin = session && session.role === "administrator";
  const [personId, setPersonId] = useState(session ? session.id : null);
  const people = (data.profiles || []).filter((p) => p.active !== false).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const person = people.find((p) => p.id === personId) || { id: personId, name: session && session.currentUserName, email: session && session.currentUserEmail };

  const [saved, setSaved] = useState(null); // Set of cells as stored
  const [cells, setCells] = useState(new Set());
  const [timeOff, setTimeOff] = useState([]);
  const [openCount, setOpenCount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function loadAll(id) {
    setLoadError(false);
    try {
      const [rows, off] = await Promise.all([fetchWeeklyAvailability(id), fetchTimeOff(id)]);
      const c = rangesToCells(rows);
      setSaved(c);
      setCells(new Set(c));
      setTimeOff(off);
    } catch (err) {
      console.warn("load availability failed", err);
      setLoadError(true);
      setSaved(new Set());
    }
    fetchOpenSlots(id, todayStr(), 14).then((s) => setOpenCount(s.length)).catch(() => setOpenCount(null));
  }

  useEffect(() => { if (personId) loadAll(personId); }, [personId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (!saved) return false;
    if (saved.size !== cells.size) return true;
    for (const k of cells) if (!saved.has(k)) return true;
    return false;
  }, [saved, cells]);

  async function save() {
    setSaving(true);
    try {
      await saveWeeklyAvailability(personId, cellsToRanges(cells));
      setSaved(new Set(cells));
      showToast("Availability saved");
      fetchOpenSlots(personId, todayStr(), 14).then((s) => setOpenCount(s.length)).catch(() => {});
    } catch (err) {
      console.warn("save availability failed", err);
      showToast("Couldn't save your availability. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Resolves true when the time off was added, so the form can clear itself.
  async function addOff({ startDate, endDate, note }) {
    if (!startDate) { showToast("Pick the first day off."); return false; }
    if (endDate && endDate < startDate) { showToast("The last day can't be before the first day."); return false; }
    try {
      await addTimeOff(personId, { startDate, endDate: endDate || startDate, note: note.trim() });
      setTimeOff(await fetchTimeOff(personId));
      showToast("Time off added");
      return true;
    } catch (err) {
      console.warn("add time off failed", err);
      showToast("Couldn't add the time off. Try again.");
      return false;
    }
  }

  async function removeOff(id) {
    const ok = await requestConfirm("Remove this time off? Clients will be able to book those days again.", { danger: true });
    if (!ok) return;
    try { await deleteTimeOff(id); setTimeOff((list) => list.filter((o) => o.id !== id)); }
    catch (err) { console.warn("delete time off failed", err); showToast("Couldn't remove it. Try again."); }
  }

  // Upcoming appointments booked with this person (by staff link or email).
  const today = todayStr();
  const email = (person.email || "").toLowerCase();
  const upcoming = (data.appointments || [])
    .filter((a) => a.status !== "cancelled" && a.status !== "completed" && a.date >= today)
    .filter((a) => (a.staffId && a.staffId === personId) || (email && (a.assignedEmail || "").toLowerCase() === email))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  async function setStatus(appt, status) {
    if (status === "cancelled") {
      const ok = await requestConfirm("Cancel this appointment? The time opens up for other clients.", { danger: true });
      if (!ok) return;
    }
    try { await updateAppointmentStatus(appt.id, status); }
    catch (err) { console.warn("update appointment failed", err); showToast("Couldn't update the appointment. Try again."); }
  }

  const hours = hoursPerWeek(cells);

  return (
    <>
      <PageHeader
        title={isAdmin && personId !== session.id ? (person.name || "Staff") + "'s Availability" : "My Availability"}
        description="Mark when you can meet clients. They can only book the times you open here."
        actions={isAdmin ? (
          <label className="flex flex-wrap items-center gap-2 text-ui font-semibold text-card-foreground">
            <span className="whitespace-nowrap">Calendar for</span>
            <Select value={personId || ""} onChange={(e) => setPersonId(e.target.value)} className="min-w-[16rem] max-w-full font-normal">
              {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}{p.id === session.id ? " (me)" : ""} — {roleLabel(p.role, "en")}</option>)}
            </Select>
          </label>
        ) : null}
      />

      {loadError && (
        <div role="alert" className="mb-5 rounded-[12px] border border-tone-danger-border bg-tone-danger-bg px-4 py-3 text-ui font-semibold text-tone-danger-ink">
          Couldn't load this calendar. Check your connection and refresh the page.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,31%)]">
        <Card className="min-w-0 p-5 sm:p-6">
          <CardIntro
            icon={CalendarDays}
            titleTag="h2"
            title="Weekly Hours"
            description="Tap a block to open or close it, or drag across blocks with a mouse. Each block is a 30-minute appointment."
          />

          <div className="mb-4 mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <PresetMenu onPick={(p) => setCells(presetCells(p.from, p.to, p.days))} />
              <Button variant="outline" className="gap-2 rounded-[12px]" onClick={() => setCells(new Set())}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />Clear all
              </Button>
            </div>
            <Legend />
          </div>

          {saved === null ? (
            <p className="m-0 py-10 text-center text-ui text-muted">Loading…</p>
          ) : (
            <WeeklyGrid cells={cells} saved={saved} onChange={setCells} />
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="m-0 text-ui text-muted" aria-live="polite">
              <span className="font-semibold text-card-foreground">{hours} {hours === 1 ? "hour" : "hours"}</span> a week open for appointments
              {openCount !== null && !dirty ? <> · <span className="font-semibold text-card-foreground">{openCount}</span> open slots in the next 2 weeks</> : null}
              {dirty ? <> · <span className="font-semibold text-primary">Unsaved changes</span></> : null}
            </p>
            <div className="flex gap-2">
              {dirty && <Button variant="ghost" onClick={() => setCells(new Set(saved))}>Undo changes</Button>}
              <Button onClick={save} disabled={!dirty || saving}>
                <Check className="h-4 w-4" aria-hidden="true" />{saving ? "Saving…" : dirty ? "Save availability" : "Saved"}
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1">
          <TimeOffCard timeOff={timeOff} today={today} onAdd={addOff} onRemove={removeOff} />
          <UpcomingCard upcoming={upcoming} onStatus={setStatus} />
        </div>
      </div>
    </>
  );
}
