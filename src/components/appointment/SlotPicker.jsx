// SlotPicker.jsx -- on the Request an Appointment form, once the client has
// picked a person: that person's open 30-minute times for the next 4 weeks
// (their My Availability hours, minus time off and appointments already
// booked -- see lib/availability.js). Days with openings first, then the
// chosen day's times. The form is uncontrolled, so the pick is carried in
// hidden `date` / `time` inputs it reads at submit.
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock, Loader2 } from "lucide-react";
import { WEEKDAYS } from "../../lib/constants.js";
import { cn } from "../../lib/cn.js";
import { fetchOpenSlots, fmtSlotTime } from "../../lib/availability.js";
import { fmtDateLong, todayStr } from "../../lib/utils.js";
import { ApptFieldError, ApptLabel } from "./ApptRequestField.jsx";

const LOOKAHEAD_DAYS = 28;

function slotTimeLabel(hhmm, lang) {
  return lang === "fr" ? hhmm.replace(":", " h ") : fmtSlotTime(hhmm);
}

function dayChip(dateStr, lang) {
  const d = new Date(dateStr + "T00:00:00");
  const names = WEEKDAYS[lang] || WEEKDAYS.en;
  return { weekday: names[d.getDay()].slice(0, 3), date: (d.getMonth() + 1) + "/" + d.getDate() };
}

export default function SlotPicker({ staffId, staffName, t, lang, error }) {
  const [slots, setSlots] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSlots(null); setLoadFailed(false); setDay(""); setTime("");
    fetchOpenSlots(staffId, todayStr(), LOOKAHEAD_DAYS)
      .then((rows) => { if (cancelled) return; setSlots(rows); if (rows.length) setDay(rows[0].date); })
      .catch(() => { if (!cancelled) { setSlots([]); setLoadFailed(true); } });
    return () => { cancelled = true; };
  }, [staffId]);

  const days = useMemo(() => {
    const out = [];
    (slots || []).forEach((s) => { if (out.indexOf(s.date) === -1) out.push(s.date); });
    return out;
  }, [slots]);
  const times = (slots || []).filter((s) => s.date === day).map((s) => s.time);
  const errorId = error ? "appt-req-slot-error" : undefined;

  return (
    <div id="appt-req-date" tabIndex={-1} className="min-w-0 outline-none" aria-describedby={errorId}>
      <input type="hidden" name="date" value={time ? day : ""} />
      <input type="hidden" name="time" value={time} />
      <ApptLabel required>{t("apptSlotPickerLabel")}</ApptLabel>

      {slots === null ? (
        <p className="m-0 flex items-center gap-2 rounded-touch border border-border bg-surface-sunken px-4 py-3.5 text-touch-label text-muted">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />{t("apptSlotLoading")}
        </p>
      ) : loadFailed ? (
        <p role="alert" className="m-0 rounded-touch border border-tone-danger-border bg-tone-danger-bg px-4 py-3 text-touch-label font-semibold text-tone-danger-ink">{t("apptSlotError")}</p>
      ) : !days.length ? (
        <p className="m-0 rounded-touch border border-border bg-surface-sunken px-4 py-3 text-touch-label leading-snug text-muted">
          {t("apptSlotNone").replace("{name}", staffName || "")}
        </p>
      ) : (
        <>
          <div role="radiogroup" aria-label={t("apptPreferredDateLabel")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => {
              const c = dayChip(d, lang);
              const on = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={fmtDateLong(d, lang)}
                  onClick={() => { setDay(d); setTime(""); }}
                  className={cn(
                    "flex min-h-[60px] min-w-[64px] shrink-0 flex-col items-center justify-center rounded-touch border-2 px-2 font-bold leading-tight transform-none transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-navy hover:border-primary dark:text-[color:var(--text)]"
                  )}
                >
                  <span className="text-touch-meta uppercase tracking-wide">{c.weekday}</span>
                  <span className="text-touch-lead">{c.date}</span>
                </button>
              );
            })}
          </div>

          <p className="m-0 mb-2 mt-3 flex items-center gap-1.5 text-touch-label font-semibold text-navy dark:text-[color:var(--text)]">
            <CalendarCheck size={18} strokeWidth={2} aria-hidden="true" className="text-primary" />
            {t("apptSlotTimesFor").replace("{date}", fmtDateLong(day, lang))}
          </p>
          <div role="radiogroup" aria-label={t("apptPreferredTimeLabel")} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {times.map((tm) => {
              const on = tm === time;
              return (
                <button
                  key={tm}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTime(tm)}
                  className={cn(
                    "flex min-h-[48px] items-center justify-center gap-1.5 rounded-touch border-2 px-2 text-touch-label font-bold tabular-nums transform-none transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-navy hover:border-primary dark:text-[color:var(--text)]"
                  )}
                >
                  {on && <Clock size={16} strokeWidth={2.4} aria-hidden="true" />}
                  {slotTimeLabel(tm, lang)}
                </button>
              );
            })}
          </div>
        </>
      )}
      <ApptFieldError id={errorId}>{error}</ApptFieldError>
    </div>
  );
}
