// DatePicker.jsx -- a small popover calendar (Today/Tomorrow quick-picks +
// month grid) that replaces native <input type="date"> app-wide, per a
// reference design the client shared. Deliberately scoped to single-date
// selection only -- every date field in this app (intake date, DOB, work
// permit expiration, appointment date, report from/to) picks one date, not
// a range, so there's no Start/End-time range picker here.
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
import { useEffect, useRef, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { addDays, buildMonthGrid, daysInMonth, fmtDateLong, monthNamesLong, pad2, todayStr, weekdayShortLabels } from "../lib/utils.js";
import Icon from "./Icon.jsx";

export default function DatePicker({ id, name, value, defaultValue, onChange, required, invalid, placeholder }) {
  const { lang } = useApp();
  const t = useT();
  const isControlled = value !== undefined && typeof onChange === "function";
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const current = isControlled ? (value || "") : internalValue;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(current || todayStr());
  const containerRef = useRef(null);
  const today = todayStr();

  useEffect(() => {
    if (open) setViewDate(current || todayStr());
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const cells = buildMonthGrid(viewYear, viewMonth);
  const weekdays = weekdayShortLabels(lang);
  const monthNames = monthNamesLong(lang);
  const currentDate = current ? new Date(current + "T00:00:00") : null;
  const selectedDay = currentDate && currentDate.getFullYear() === viewYear && currentDate.getMonth() === viewMonth ? currentDate.getDate() : "";
  const dayCount = daysInMonth(viewYear, viewMonth);
  const dayOptions = Array.from({ length: dayCount }, (_, i) => i + 1);
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
  function setDay(day) {
    commit(viewYear + "-" + pad2(viewMonth + 1) + "-" + pad2(day));
  }

  return (
    <div className={"date-picker" + (invalid ? " field-invalid" : "")} ref={containerRef}>
      <button
        type="button"
        id={id}
        className="date-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="calendar" />
        <span className={current ? "" : "muted"}>{current ? fmtDateLong(current, lang) : (placeholder || t("pleaseSelect"))}</span>
      </button>
      {name && <input type="hidden" name={name} value={current} readOnly required={required} />}

      {open && (
        <div className="date-picker-panel" role="dialog" aria-label={t("pleaseSelect")}>
          <div className="date-picker-quick">
            <button type="button" className="pill" onClick={() => commit(today)}>{t("today")}</button>
            <button type="button" className="pill" onClick={() => commit(addDays(today, 1))}>{t("tomorrow")}</button>
          </div>
          <div className="date-picker-nav">
            <button type="button" className="btn-icon" aria-label={t("prevPage")} onClick={() => shiftMonth(-1)}>
              <Icon name="chevronrt" className="icon-flip-x" />
            </button>
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
            <button type="button" className="btn-icon" aria-label={t("nextPage")} onClick={() => shiftMonth(1)}>
              <Icon name="chevronrt" />
            </button>
          </div>
          <div className="date-picker-day-select">
            <label>
              {t("dayLabel")}
              <select
                aria-label={t("dayLabel")}
                value={selectedDay}
                onChange={(e) => setDay(parseInt(e.target.value, 10))}
              >
                <option value="" disabled>{t("pleaseSelect")}</option>
                {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <div className="date-picker-weekdays">
            {weekdays.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="date-picker-grid">
            {cells.map((c) => {
              const isSelected = !!current && c.dateStr === current;
              const isToday = c.dateStr === today;
              return (
                <button
                  type="button"
                  key={c.dateStr}
                  className={"date-picker-day" + (c.inMonth ? "" : " outside") + (isSelected ? " selected" : "") + (isToday ? " today" : "")}
                  onClick={() => commit(c.dateStr)}
                  aria-pressed={isSelected}
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
