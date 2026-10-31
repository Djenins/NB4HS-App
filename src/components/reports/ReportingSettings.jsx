// ReportingSettings.jsx -- Staff Reports' configuration section, for holders
// of staff_reports.schedule.manage. Three cards: the biweekly schedule (with
// a preview of the next deadlines computed the same way the database does),
// who reviews, and the health of the email copies (p6b) so a provider
// outage is visible instead of silent. Who reports follows roles (staff_reports.submit, managed
// under Administration -> Roles); granting "Reviewer" is what lets someone
// read other staff's reports -- being an administrator does not.
import { useEffect, useState } from "react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { fetchProgramStaff, setProgramRole } from "../../lib/programStaff.js";
import {
  REVIEWER_ROLES, dueAtFor, fetchQueueHealth, fetchSchedules, fmtDueAt, fmtPeriod, localDateIn, periodForDate, periodForIndex, updateSchedule
} from "../../lib/staffReports.js";
import { roleLabel } from "../../lib/utils.js";
import { Alert } from "../ui/alert.jsx";
import { Button } from "../ui/button.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { Skeleton } from "../ui/skeleton.jsx";

const PROGRAM = "staff_reports";
const TIME_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Port-au-Prince", "UTC"];
const OFFSETS = [-7, -5, -3, -2, -1, 0, 1, 2, 3];

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
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field htmlFor="sched-start" label={t("srFirstPeriodStart")} hint={t("srFirstPeriodStartHelp")}>
            <Input id="sched-start" aria-describedby="sched-start-hint" type="date" className="tabular-nums" value={draft.firstPeriodStart} onChange={(e) => set("firstPeriodStart", e.target.value)} required />
          </Field>
          <Field htmlFor="sched-days" label={t("srPeriodDays")} hint={t("srPeriodDaysHelp")}>
            <Input id="sched-days" aria-describedby="sched-days-hint" type="number" min={7} max={62} className="tabular-nums" value={draft.periodDays} onChange={(e) => set("periodDays", Number(e.target.value))} required />
          </Field>
          <Field htmlFor="sched-tz" label={t("srTimeZone")}>
            <Select id="sched-tz" value={draft.timeZone} onChange={(e) => set("timeZone", e.target.value)}>
              {TIME_ZONES.concat(TIME_ZONES.indexOf(draft.timeZone) === -1 ? [draft.timeZone] : []).map((z) => <option key={z} value={z}>{z}</option>)}
            </Select>
          </Field>
          <Field htmlFor="sched-due-days" label={t("srDeadlineDays")} hint={t("srDeadlineDaysHelp")}>
            <Input id="sched-due-days" aria-describedby="sched-due-days-hint" type="number" min={0} max={30} className="tabular-nums" value={draft.deadlineDaysAfterEnd} onChange={(e) => set("deadlineDaysAfterEnd", Number(e.target.value))} required />
          </Field>
          <Field htmlFor="sched-due-time" label={t("srDeadlineTime")}>
            <Input id="sched-due-time" type="time" className="tabular-nums" value={draft.deadlineTime} onChange={(e) => set("deadlineTime", e.target.value)} required />
          </Field>
          <Field htmlFor="sched-grace" label={t("srGraceHours")} hint={t("srGraceHoursHelp")}>
            <Input id="sched-grace" aria-describedby="sched-grace-hint" type="number" min={0} max={168} className="tabular-nums" value={draft.graceHours} onChange={(e) => set("graceHours", Number(e.target.value))} required />
          </Field>
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-1.5 p-0 text-meta font-semibold text-card-foreground">{t("srReminders")}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {OFFSETS.map((o) => (
              <label key={o} className="flex min-h-9 items-center gap-2 text-ui text-card-foreground">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.reminderOffsets.indexOf(o) !== -1}
                  onChange={() => set("reminderOffsets", draft.reminderOffsets.indexOf(o) !== -1
                    ? draft.reminderOffsets.filter((x) => x !== o) : draft.reminderOffsets.concat([o]).sort((a, b) => a - b))} />
                {o < 0 ? t("srOffsetBefore").replace("{n}", -o) : o === 0 ? t("srOffsetOnDay") : t("srOffsetAfter").replace("{n}", o)}
              </label>
            ))}
          </div>
          <p className="m-0 mt-1 text-meta text-muted">{t("srRemindersHelp")}</p>
        </fieldset>

        <Alert tone="info">{t("srWhoReportsRoles")}</Alert>

        <label className="flex min-h-10 items-center gap-2 text-ui font-semibold text-card-foreground">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /> {t("srScheduleActive")}
        </label>

        {preview.length > 0 && (
          <div className="rounded-control bg-surface-sunken px-4 py-3">
            <p className="m-0 text-meta font-semibold text-muted">{t("srSchedulePreview")}</p>
            <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-ui tabular-nums text-card-foreground">
              {preview.map((p) => (
                <li key={p.start}>{fmtPeriod(p.start, p.end, lang)} — {t("srDue")} {fmtDueAt(dueAtFor(draft, p.end).toISOString(), draft.timeZone, lang)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-meta text-muted">{t("srScheduleChangeNote")}</p>
          <Button type="submit" className="shrink-0" disabled={busy || !valid}>{t("srSaveSchedule")}</Button>
        </div>
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
  const roleSelect = (p) => (
    <Select aria-label={t("srReportingRole") + " — " + (p.name || p.email)}
      value={roleOf(p.id)} disabled={savingKey === p.id}
      onChange={(e) => run(p.id, async () => {
        await setProgramRole(p.id, PROGRAM, e.target.value || null, session && session.id);
        if (session && p.id === session.id) await refetchProgramRoles();
      })}>
      <option value="">{t("srRoleNone")}</option>
      {REVIEWER_ROLES.map((r) => <option key={r} value={r}>{t("srRole_" + r)}</option>)}
    </Select>
  );

  return (
    <SectionCard title={t("srPeopleTitle")}>
      <Alert tone="info" className="mb-4">{t("srPeopleHelp")}</Alert>
      {roles === null ? <Skeleton className="h-40 w-full" /> : (
        <DataTable
          caption={t("srPeopleTitle")}
          columns={[
            { key: "name", header: t("srStaffMember"), cell: (p) => (
              <>
                <div className="font-semibold text-card-foreground">{p.name || p.email}</div>
                <div className="text-meta text-muted">{roleLabel(p.role, lang)}</div>
              </>
            ) },
            { key: "role", header: t("srReportingRole"), className: "w-64", cell: (p) => roleSelect(p) }
          ]}
          rows={staff}
          getRowId={(p) => p.id}
          renderCard={(p) => (
            <div className="grid gap-2">
              <div>
                <div className="text-ui font-semibold text-card-foreground">{p.name || p.email}</div>
                <div className="text-meta text-muted">{roleLabel(p.role, lang)}</div>
              </div>
              {roleSelect(p)}
            </div>
          )}
          empty={<EmptyState compact title={t("snapNoActiveStaff")} />}
        />
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
      <Alert tone={health.configured ? "info" : "warning"} className="mb-4">{t(health.configured ? "srEmailConfigured" : "srEmailNotConfigured")}</Alert>
      <dl className="m-0 grid grid-cols-3 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-control bg-surface-sunken px-4 py-3">
            <dt className="text-meta font-semibold text-muted">{t(label)}</dt>
            <dd className={"m-0 mt-1 text-kpi tabular-nums " + (label === "srEmailFailed" && value ? "text-tone-danger-ink" : "text-card-foreground")}>{value}</dd>
          </div>
        ))}
      </dl>
      {health.lastError ? (
        <p className="m-0 mt-3 text-meta text-muted">{t("srEmailLastError")}: {health.lastError}{health.lastErrorAt ? " · " + fmtDueAt(health.lastErrorAt, "America/New_York", lang) : ""}</p>
      ) : null}
      <p className="m-0 mt-3 text-meta text-muted">{t("srEmailPrivacy")}</p>
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

  if (loadError) return <SectionCard><EmptyState variant="error" title={t("srLoadError")} /></SectionCard>;
  if (schedules === null) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="grid gap-6">
      {schedules.map((s) => <ScheduleCard key={s.id + n} schedule={s} onSaved={load} />)}
      <PeopleCard />
      <EmailCard />
    </div>
  );
}
