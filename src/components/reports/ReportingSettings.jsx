// ReportingSettings.jsx -- Staff Reports' configuration section, for holders
// of staff_reports.schedule.manage. Three cards: the biweekly schedule (with
// a preview of the next deadlines computed the same way the database does),
// who reviews, and the health of the email copies (p6b) so a provider
// outage is visible instead of silent. Who reports follows roles (staff_reports.submit, managed
// under Administration -> Roles); granting "Reviewer" is what lets someone
// read other staff's reports -- being an administrator does not.
import { useEffect, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { fetchProgramStaff, setProgramRole } from "../../lib/programStaff.js";
import {
  REVIEWER_ROLES, dueAtFor, fetchQueueHealth, fetchSchedules, fmtDueAt, fmtPeriod, localDateIn, periodForDate, periodForIndex, updateSchedule
} from "../../lib/staffReports.js";
import { roleLabel } from "../../lib/utils.js";
import EmptyState from "../EmptyState.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Button } from "../ui/button.jsx";
import { REPORT_CONTROL, TD, TH } from "./ReportParts.jsx";

const PROGRAM = "staff_reports";
const INPUT = REPORT_CONTROL + " h-10";
const TIME_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Port-au-Prince", "UTC"];
const OFFSETS = [-7, -5, -3, -2, -1, 0, 1, 2, 3];

function Field({ id, label, help, children }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted">{label}</label>
      {children}
      {help && <p className="!m-0 !text-xs text-muted">{help}</p>}
    </div>
  );
}

function ScheduleCard({ schedule, onSaved }) {
  const { lang, showToast } = useApp();
  const t = useT();
  const [draft, setDraft] = useState(schedule);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setDraft((d) => Object.assign({}, d, { [k]: v }));
  const valid = draft.firstPeriodStart && draft.periodDays >= 7 && draft.periodDays <= 62 && draft.deadlineDaysAfterEnd >= 0
    && draft.graceHours >= 0 && draft.deadlineTime;

  const today = localDateIn(draft.timeZone);
  const firstIndex = valid ? Math.max(0, periodForDate(draft, today).index) : 0;
  const preview = valid ? [0, 1, 2].map((i) => periodForIndex(draft, firstIndex + i)) : [];

  async function save(e) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await updateSchedule(draft);
      showToast(t("srScheduleSaved"));
      onSaved();
    } catch (err) {
      console.warn("updateSchedule failed", err);
      // t4: a schedule with reports keeps its length and start date.
      const locked = err && /already has reports/.test(err.message || "");
      showToast(t(locked ? "srScheduleLocked" : "srScheduleSaveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title={t("srScheduleTitle")}>
      <form className="grid gap-5" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="sched-start" label={t("srFirstPeriodStart")} help={t("srFirstPeriodStartHelp")}>
            <input id="sched-start" type="date" className={INPUT} value={draft.firstPeriodStart} onChange={(e) => set("firstPeriodStart", e.target.value)} required />
          </Field>
          <Field id="sched-days" label={t("srPeriodDays")} help={t("srPeriodDaysHelp")}>
            <input id="sched-days" type="number" min={7} max={62} className={INPUT} value={draft.periodDays} onChange={(e) => set("periodDays", Number(e.target.value))} required />
          </Field>
          <Field id="sched-tz" label={t("srTimeZone")}>
            <select id="sched-tz" className={INPUT} value={draft.timeZone} onChange={(e) => set("timeZone", e.target.value)}>
              {TIME_ZONES.concat(TIME_ZONES.indexOf(draft.timeZone) === -1 ? [draft.timeZone] : []).map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <Field id="sched-due-days" label={t("srDeadlineDays")} help={t("srDeadlineDaysHelp")}>
            <input id="sched-due-days" type="number" min={0} max={30} className={INPUT} value={draft.deadlineDaysAfterEnd} onChange={(e) => set("deadlineDaysAfterEnd", Number(e.target.value))} required />
          </Field>
          <Field id="sched-due-time" label={t("srDeadlineTime")}>
            <input id="sched-due-time" type="time" className={INPUT} value={draft.deadlineTime} onChange={(e) => set("deadlineTime", e.target.value)} required />
          </Field>
          <Field id="sched-grace" label={t("srGraceHours")} help={t("srGraceHoursHelp")}>
            <input id="sched-grace" type="number" min={0} max={168} className={INPUT} value={draft.graceHours} onChange={(e) => set("graceHours", Number(e.target.value))} required />
          </Field>
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-1.5 text-xs font-semibold text-muted">{t("srReminders")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {OFFSETS.map((o) => (
              <label key={o} className="flex items-center gap-1.5 text-sm text-card-foreground">
                <input type="checkbox" checked={draft.reminderOffsets.indexOf(o) !== -1}
                  onChange={() => set("reminderOffsets", draft.reminderOffsets.indexOf(o) !== -1
                    ? draft.reminderOffsets.filter((x) => x !== o) : draft.reminderOffsets.concat([o]).sort((a, b) => a - b))} />
                {o < 0 ? t("srOffsetBefore").replace("{n}", -o) : o === 0 ? t("srOffsetOnDay") : t("srOffsetAfter").replace("{n}", o)}
              </label>
            ))}
          </div>
          <p className="!mb-0 !mt-1.5 !text-xs text-muted">{t("srRemindersHelp")}</p>
        </fieldset>

        <div className="info-callout"><p className="!m-0 !text-xs">{t("srWhoReportsRoles")}</p></div>

        <label className="flex items-center gap-2 text-sm text-card-foreground">
          <input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /> {t("srScheduleActive")}
        </label>

        {preview.length > 0 && (
          <div className="rounded-lg bg-background px-4 py-3">
            <p className="!m-0 !text-xs font-semibold uppercase tracking-wide text-muted">{t("srSchedulePreview")}</p>
            <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-sm text-card-foreground">
              {preview.map((p) => (
                <li key={p.start}>{fmtPeriod(p.start, p.end, lang)} — {t("srDue")} {fmtDueAt(dueAtFor(draft, p.end).toISOString(), draft.timeZone, lang)}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="!m-0 !text-xs text-muted">{t("srScheduleChangeNote")}</p>
        <div className="flex justify-end"><Button type="submit" disabled={busy || !valid}>{t("srSaveSchedule")}</Button></div>
      </form>
    </SectionCard>
  );
}

function PeopleCard() {
  const { data, lang, session, showToast, refetchProgramRoles } = useApp();
  const t = useT();
  const [roles, setRoles] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  function load() {
    return fetchProgramStaff(PROGRAM)
      .then(setRoles)
      .catch((err) => { console.warn("people load failed", err); setRoles({}); });
  }
  useEffect(() => { load(); }, []);

  async function run(key, fn) {
    setSavingKey(key);
    try { await fn(); await load(); showToast(t("srSaved")); } catch (err) { console.warn("people save failed", err); showToast(t("srSaveError")); } finally { setSavingKey(null); }
  }

  const staff = (data.profiles || []).filter((p) => p.active !== false).slice()
    .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
  const roleOf = (userId) => (roles[userId] && roles[userId].active ? roles[userId].role : "");

  return (
    <SectionCard title={t("srPeopleTitle")}>
      <div className="info-callout mb-4">
        <ShieldCheck className="icon h-5 w-5" aria-hidden="true" />
        <p>{t("srPeopleHelp")}</p>
      </div>
      {roles === null ? null : !staff.length ? <EmptyState icon="users" message={t("snapNoActiveStaff")} /> : (
        <div className="overflow-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className={TH}>{t("srStaffMember")}</th><th className={TH}>{t("srReportingRole")}</th></tr></thead>
            <tbody>
              {staff.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className={TD}>
                    <div className="font-semibold text-card-foreground">{p.name || p.email}</div>
                    <div className="text-xs text-muted">{roleLabel(p.role, lang)}</div>
                  </td>
                  <td className={TD}>
                    <select aria-label={t("srReportingRole") + " — " + (p.name || p.email)} className={REPORT_CONTROL + " h-9 w-auto"}
                      value={roleOf(p.id)} disabled={savingKey === p.id}
                      onChange={(e) => run(p.id, async () => {
                        await setProgramRole(p.id, PROGRAM, e.target.value || null, session && session.id);
                        if (session && p.id === session.id) await refetchProgramRoles();
                      })}>
                      <option value="">{t("srRoleNone")}</option>
                      {REVIEWER_ROLES.map((r) => <option key={r} value={r}>{t("srRole_" + r)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function EmailCard() {
  const { lang } = useApp();
  const t = useT();
  const [health, setHealth] = useState(undefined);
  useEffect(() => { fetchQueueHealth().then(setHealth); }, []);
  if (!health) return null;
  const stats = [["srEmailQueued", health.queued], ["srEmailSent7d", health.sent7d], ["srEmailFailed", health.failed]];
  return (
    <SectionCard title={t("srEmailTitle")}>
      <div className="info-callout mb-4">
        <Mail className="icon h-5 w-5" aria-hidden="true" />
        <p>{t(health.configured ? "srEmailConfigured" : "srEmailNotConfigured")}</p>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-background px-4 py-3">
            <dt className="text-xs font-semibold text-muted">{t(label)}</dt>
            <dd className={"m-0 mt-1 text-2xl font-bold " + (label === "srEmailFailed" && value ? "text-accent" : "text-card-foreground")}>{value}</dd>
          </div>
        ))}
      </dl>
      {health.lastError ? (
        <p className="!mb-0 !mt-3 !text-xs text-muted">{t("srEmailLastError")}: {health.lastError}{health.lastErrorAt ? " · " + fmtDueAt(health.lastErrorAt, "America/New_York", lang) : ""}</p>
      ) : null}
      <p className="!mb-0 !mt-3 !text-xs text-muted">{t("srEmailPrivacy")}</p>
    </SectionCard>
  );
}

export default function ReportingSettings() {
  const t = useT();
  const [schedules, setSchedules] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [n, setN] = useState(0);

  function load() {
    return fetchSchedules()
      .then((s) => { setSchedules(s); setN((x) => x + 1); setLoadError(false); })
      .catch((err) => { console.warn("settings load failed", err); setLoadError(true); });
  }
  useEffect(() => { load(); }, []);

  if (loadError) return <SectionCard title={t("srSectionSettings")}><EmptyState icon="inbox" message={t("srLoadError")} /></SectionCard>;
  if (schedules === null) return null;
  return (
    <div className="grid gap-5">
      {schedules.map((s) => <ScheduleCard key={s.id + n} schedule={s} onSaved={load} />)}
      <PeopleCard />
      <EmailCard />
    </div>
  );
}
