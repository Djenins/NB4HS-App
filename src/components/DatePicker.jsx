// DatePicker.jsx -- a small popover calendar (month and year menus, arrows,
// and a Sunday-first grid of the month's days) that replaces native <input type="date"> app-wide, per a
// reference design the client shared. Deliberately scoped to single-date
// selection only -- every date field in this app (intake date, DOB, work
// permit expiration, appointment date, report from/to) picks one date, not
// a range, so there's no Start/End-time range picker here. `min`
// ("YYYY-MM-DD", optional) disables earlier days.
//
// Drop-in replacement: the underlying value is still a plain "YYYY-MM-DD"
// string, so none of the surrounding validation/business logic (buildClient,
// buildAppointment, rangeForPreset, etc.) had to change -- only the call
// site that renders the field.
//
// Works in two modes, mirroring how a native <input> supports both:
//   - Controlled: pass value + onChange(newValueString). Used by every
//     call site that already tracked the date in React state.
//   - Uncontrolled: pass name (+ optional defaultValue) and read the value
//     via FormData at submit time, same as the native input did -- a hidden
//     <input type="hidden" name={name}> is kept in sync internally. Used by
//     FormField.jsx's type="date" case (ApptRequest.jsx).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { buildMonthGrid, daysInMonth, fmtDateLong, monthNamesLong, pad2, todayStr, weekdayShortLabels } from "../lib/utils.js";
import Icon from "./Icon.jsx";

export default function DatePicker({ id, name, value, defaultValue, onChange, required, invalid, placeholder, min, max, disabled }) {
  const { lang } = useApp();
  const t = useT();
  const isControlled = value !== undefined && typeof onChange === "function";
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const current = isControlled ? (value || "") : internalValue;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(current || todayStr());
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  // Opens upward when the calendar won't fit below the field but does fit
  // above it.
  const [dropUp, setDropUp] = useState(false);
  const today = todayStr();

  useEffect(() => {
    if (open) setViewDate(current || todayStr());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Measured before paint, so the panel never flashes on the wrong side.
  // "Room" is bounded by the nearest ancestor that clips (a dialog's
  // scrolling body, an overflow-hidden card) or else the window.
  useLayoutEffect(() => {
    if (!open || !containerRef.current || !panelRef.current) { setDropUp(false); return; }
    const field = containerRef.current.getBoundingClientRect();
    const needed = panelRef.current.offsetHeight + 8;
    let top = 0, bottom = window.innerHeight;
    for (let el = containerRef.current.parentElement; el && el !== document.body; el = el.parentElement) {
      const o = getComputedStyle(el);
      if (/(auto|scroll|hidden|clip)/.test(o.overflowY + " " + o.overflow)) {
        const r = el.getBoundingClientRect();
        top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom);
        break;
      }
    }
    const below = bottom - field.bottom, above = field.top - top;
    const up = below < needed && above >= needed;
    setDropUp(up);
    // Fits on neither side (a short dialog): open below and scroll the
    // dialog or page just enough to show the whole calendar.
    if (below < needed && !up) panelRef.current.scrollIntoView({ block: "nearest" });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // min/max ("YYYY-MM-DD", optional) bound the pickable days; strings
  // compare in date order.
  const outOfRange = (ds) => (!!min && ds < min) || (!!max && ds > max);

  function commit(v) {
    if (isControlled) onChange(v); else setInternalValue(v);
    setOpen(false);
  }

  const viewD = new Date(viewDate + "T00:00:00");
  const viewYear = viewD.getFullYear();
  const viewMonth = viewD.getMonth();

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    const p2 = (n) => (n < 10 ? "0" + n : "" + n);
    setViewDate(d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()));
  }

  // Drop the trailing week(s) that hold only next month's days.
  const grid = buildMonthGrid(viewYear, viewMonth);
  const cells = grid.slice(0, Math.ceil((grid.findIndex((c) => c.inMonth) + daysInMonth(viewYear, viewMonth)) / 7) * 7);
  const weekdays = weekdayShortLabels(lang);
  const monthNames = monthNamesLong(lang);
  const thisRealYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 111 }, (_, i) => thisRealYear + 10 - i);

  function setYear(y) {
    const d = new Date(y, viewMonth, Math.min(viewD.getDate(), daysInMonth(y, viewMonth)));
    setViewDate(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
  }
  function setMonth(m) {
    const d = new Date(viewYear, m, Math.min(viewD.getDate(), daysInMonth(viewYear, m)));
    setViewDate(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
  }

  return (
    <div className={"date-picker" + (invalid ? " field-invalid" : "")} ref={containerRef}>
      <button
        type="button"
        id={id}
        className="date-picker-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="calendar" />
        <span className={current ? "" : "muted"}>{current ? fmtDateLong(current, lang) : (placeholder || t("selectDate"))}</span>
      </button>
      {name && <input type="hidden" name={name} value={current} readOnly required={required} />}

      {open && (
        <div ref={panelRef} className={"date-picker-panel" + (dropUp ? " drop-up" : "")} role="dialog" aria-label={t("pleaseSelect")}>
          <div className="date-picker-head">
            <div className="date-picker-titles">
              <select
                className="date-picker-select"
                aria-label={t("monthLabel")}
                value={viewMonth}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              >
                {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                className="date-picker-select"
                aria-label={t("yearLabel")}
                value={viewYear}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="date-picker-arrows">
              <button type="button" className="date-picker-arrow" aria-label={t("prevPage")} title={t("prevPage")} onClick={() => shiftMonth(-1)}>
                <Icon name="chevronrt" className="icon-flip-x" />
              </button>
              <button type="button" className="date-picker-arrow" aria-label={t("nextPage")} title={t("nextPage")} onClick={() => shiftMonth(1)}>
                <Icon name="chevronrt" />
              </button>
            </div>
          </div>
          <div className="date-picker-weekdays">
            {weekdays.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="date-picker-grid">
            {cells.map((c) => {
              // Only this month's days are shown; the others keep their place.
              if (!c.inMonth) return <span key={c.dateStr} aria-hidden="true" />;
              const isSelected = !!current && c.dateStr === current;
              const isToday = c.dateStr === today;
              const blocked = outOfRange(c.dateStr);
              return (
                <button
                  type="button"
                  key={c.dateStr}
                  className={"date-picker-day" + (isSelected ? " selected" : "") + (isToday ? " today" : "")}
                  onClick={() => commit(c.dateStr)}
                  aria-pressed={isSelected}
                  aria-label={fmtDateLong(c.dateStr, lang)}
                  disabled={blocked}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
