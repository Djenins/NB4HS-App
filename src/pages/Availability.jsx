// Availability.jsx -- "My Availability": every staff login's weekly booking
// calendar (lib/availability.js). Staff paint the 30-minute blocks they can
// take appointments in, add time off, and see what clients have booked with
// them. Clients booking an appointment (kiosk / phone) only see open blocks
// from here. Administrators can switch to anyone's calendar.
//
// The grid paints by click/tap per block, or by dragging with a mouse; on a
// touch screen dragging scrolls the page instead, so each block is a tap.
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CalendarOff, Check, Clock, Plus, Trash2, X } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import {
  DAY_END_MIN, DAY_START_MIN, SLOT_MINUTES, addTimeOff, cellKey, cellsToRanges, deleteTimeOff,
  fetchOpenSlots, fetchTimeOff, fetchWeeklyAvailability, fmtSlotTime, minToHHMM, rangesToCells, saveWeeklyAvailability
} from "../lib/availability.js";
import { updateAppointmentStatus } from "../lib/clientsData.js";
import { cn } from "../lib/cn.js";
import { fmtDateLong, roleLabel, todayStr } from "../lib/utils.js";
import DatePicker from "../components/DatePicker.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";

// Monday-first, the way staff think about a work week.
const DAYS = [
  { wd: 1, short: "Mon", long: "Monday" }, { wd: 2, short: "Tue", long: "Tuesday" }, { wd: 3, short: "Wed", long: "Wednesday" },
  { wd: 4, short: "Thu", long: "Thursday" }, { wd: 5, short: "Fri", long: "Friday" }, { wd: 6, short: "Sat", long: "Saturday" },
  { wd: 0, short: "Sun", long: "Sunday" }
];
const ROWS = [];
for (let m = DAY_START_MIN; m < DAY_END_MIN; m += SLOT_MINUTES) ROWS.push(m);

function presetCells(fromMin, toMin, weekdays) {
  const cells = new Set();
  weekdays.forEach((wd) => { for (let m = fromMin; m < toMin; m += SLOT_MINUTES) cells.add(cellKey(wd, m)); });
  return cells;
}

function hoursPerWeek(cells) {
  return (cells.size * SLOT_MINUTES) / 60;
}

function WeeklyGrid({ cells, onChange }) {
  // Mouse drag paints: the first block decides whether the drag adds or
  // removes, every block the pointer crosses follows suit.
  const drag = useRef(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const end = () => { drag.current = null; };
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, []);

  function apply(key, on) {
    const next = new Set(cells);
    if (on) next.add(key); else next.delete(key);
    onChange(next);
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] select-none grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-px rounded-xl border border-border bg-border">
        <div className="bg-card" />
        {DAYS.map((d) => (
          <div key={d.wd} className="bg-card px-1 py-2 text-center text-xs font-bold uppercase tracking-wide text-muted">{d.short}</div>
        ))}
        {ROWS.map((m) => (
          <div key={m} className="contents">
            <div className="bg-card pr-2 text-right text-xs leading-[28px] text-muted tabular-nums">{m % 60 === 0 ? fmtSlotTime(minToHHMM(m)).replace(":00", "") : ""}</div>
            {DAYS.map((d) => {
              const key = cellKey(d.wd, m);
              const on = cells.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.long + " " + fmtSlotTime(minToHHMM(m))}
                  onPointerDown={(e) => {
                    if (e.pointerType !== "mouse") return;
                    drag.current = !on;
                    suppressClick.current = true;
                    apply(key, !on);
                  }}
                  onPointerEnter={() => { if (drag.current !== null && on !== drag.current) apply(key, drag.current); }}
                  onClick={() => {
                    if (suppressClick.current) { suppressClick.current = false; return; }
                    apply(key, !on);
                  }}
                  className={cn(
                    "h-7 min-h-0 rounded-none border-0 p-0 transform-none transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                    on ? "bg-primary hover:bg-primary-dark" : "bg-card hover:bg-primary-tint"
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
  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [offNote, setOffNote] = useState("");

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

  async function addOff() {
    if (!offStart) { showToast("Pick the first day off."); return; }
    if (offEnd && offEnd < offStart) { showToast("The last day can't be before the first day."); return; }
    try {
      await addTimeOff(personId, { startDate: offStart, endDate: offEnd || offStart, note: offNote.trim() });
      setOffStart(""); setOffEnd(""); setOffNote("");
      setTimeOff(await fetchTimeOff(personId));
      showToast("Time off added");
    } catch (err) {
      console.warn("add time off failed", err);
      showToast("Couldn't add the time off. Try again.");
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

  const upcomingOff = timeOff.filter((o) => o.endDate >= today);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="mb-1">{isAdmin && personId !== session.id ? (person.name || "Staff") + "'s Availability" : "My Availability"}</h1>
            <p className="m-0 text-sm text-muted">Mark when you can meet clients. They can only book the times you open here.</p>
          </div>
        </div>
        {isAdmin && (
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="whitespace-nowrap">Calendar for</span>
            <select
              value={personId || ""}
              onChange={(e) => setPersonId(e.target.value)}
              className="h-11 min-h-0 min-w-[16rem] max-w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
            >
              {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}{p.id === session.id ? " (me)" : ""} — {roleLabel(p.role, "en")}</option>)}
            </select>
          </label>
        )}
      </div>

      {loadError && (
        <div role="alert" className="mb-5 rounded-xl border border-accent-soft bg-accent-tint px-4 py-3 text-sm font-semibold text-accent">
          Couldn't load this calendar. Check your connection and refresh the page.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Weekly hours</CardTitle>
              <CardDescription className="mt-0.5">
                Tap a block to open or close it, or drag across blocks with a mouse. Each block is a 30-minute appointment.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCells(presetCells(9 * 60, 17 * 60, [1, 2, 3, 4, 5]))}>Weekdays 9–5</Button>
              <Button variant="secondary" size="sm" onClick={() => setCells(new Set())}>Clear all</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {saved === null ? <p className="text-sm text-muted">Loading…</p> : <WeeklyGrid cells={cells} onChange={setCells} />}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-sm text-muted">
                <span className="font-semibold text-card-foreground">{hoursPerWeek(cells)} hours</span> a week open for appointments
                {openCount !== null && !dirty ? <> · <span className="font-semibold text-card-foreground">{openCount}</span> open slots in the next 2 weeks</> : null}
              </p>
              <div className="flex gap-2">
                {dirty && <Button variant="ghost" onClick={() => setCells(new Set(saved))}>Undo changes</Button>}
                <Button onClick={save} disabled={!dirty || saving} className="gap-2">
                  <Check className="h-4 w-4" />{saving ? "Saving…" : dirty ? "Save availability" : "Saved"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarOff className="h-4.5 w-4.5 text-muted" />Time off</CardTitle>
              <CardDescription className="mt-0.5">Days you're away. Clients can't book them, whatever your weekly hours say.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="off-start" className="mb-1 block text-xs font-semibold text-card-foreground">First day</label>
                  <DatePicker id="off-start" value={offStart} onChange={setOffStart} />
                </div>
                <div>
                  <label htmlFor="off-end" className="mb-1 block text-xs font-semibold text-card-foreground">Last day (optional)</label>
                  <DatePicker id="off-end" value={offEnd} onChange={setOffEnd} />
                </div>
              </div>
              <input
                type="text"
                value={offNote}
                maxLength={120}
                onChange={(e) => setOffNote(e.target.value)}
                placeholder="Note, e.g. Training, vacation (optional)"
                aria-label="Time off note"
                className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
              <Button variant="secondary" className="w-full gap-2" onClick={addOff}><Plus className="h-4 w-4" />Add time off</Button>
              {upcomingOff.length ? (
                <ul className="m-0 list-none divide-y divide-border rounded-xl border border-border p-0">
                  {upcomingOff.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-card-foreground">
                          {fmtDateLong(o.startDate)}{o.endDate !== o.startDate ? " – " + fmtDateLong(o.endDate) : ""}
                        </div>
                        {o.note && <div className="truncate text-xs text-muted">{o.note}</div>}
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Remove time off" className="h-8 w-8 text-muted hover:bg-tint-danger hover:text-accent" onClick={() => removeOff(o.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="m-0 text-sm text-muted">No time off coming up.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-4.5 w-4.5 text-muted" />Upcoming appointments</CardTitle>
              <CardDescription className="mt-0.5">Client requests hold their time until you confirm or cancel them.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {upcoming.length ? (
                <ul className="m-0 list-none space-y-2 p-0">
                  {upcoming.slice(0, 12).map((a) => (
                    <li key={a.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-card-foreground">{a.firstName} {a.lastName}</div>
                          <div className="text-xs text-muted">{fmtDateLong(a.date)} · {a.time ? fmtSlotTime(a.time) : "—"}</div>
                        </div>
                        <Badge variant={a.status === "requested" ? "warn" : "success"}>{a.status === "requested" ? "Requested" : "Confirmed"}</Badge>
                      </div>
                      {a.reason && <p className="m-0 mt-1.5 line-clamp-2 text-xs text-muted">{a.reason}</p>}
                      <div className="mt-2 flex gap-2">
                        {a.status === "requested" && (
                          <Button size="sm" className="gap-1.5" onClick={() => setStatus(a, "scheduled")}><Check className="h-3.5 w-3.5" />Confirm</Button>
                        )}
                        <Button size="sm" variant="ghost" className="gap-1.5 text-accent hover:bg-tint-danger" onClick={() => setStatus(a, "cancelled")}><X className="h-3.5 w-3.5" />Cancel</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon="calendar" message="No upcoming appointments." />}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
