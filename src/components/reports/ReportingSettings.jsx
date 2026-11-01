// ReportingSettings.jsx -- Staff Reports' configuration section, for holders
// of staff_reports.schedule.manage. Three cards: who reviews (first, with a
// warning while nobody does, since then every submission goes unread), the
// biweekly schedule (a two-column layout: the schedule and reminder cards,
// and beside them a preview of the next deadlines computed the same way the
// database does and who submits), and the health of the
// email copies (p6b) so a provider outage is visible instead of silent. Who reports follows roles (staff_reports.submit, managed
// under Administration -> Roles); granting "Reviewer" is what lets someone
// read other staff's reports -- being an administrator does not.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { fetchProgramStaff, setProgramRole } from "../../lib/programStaff.js";
import {
  REVIEWER_ROLES, dueAtFor, fetchQueueHealth, fetchSchedules, fmtDueAt, fmtPeriod, localDateIn, periodForDate, periodForIndex, updateSchedule
} from "../../lib/staffReports.js";
import { DATE_LOCALE } from "../../lib/constants.js";
import { roleLabel } from "../../lib/utils.js";
import DatePicker from "../DatePicker.jsx";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { Switch } from "../ui/switch.jsx";

const PROGRAM = "staff_reports";
const TIME_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Port-au-Prince", "UTC"];
const BEFORE = [-7, -5, -3, -2, -1];
const AFTER = [1, 2, 3];
const PERIOD_DAYS = [7, 14, 21, 28, 30, 31];
const DUE_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];
const GRACE = [0, 1, 2, 4, 8, 12, 24, 48, 72];

// The preset choices plus whatever the schedule already holds, so a value
// set before these dropdowns existed still shows (and saves) as itself.
function withCurrent(list, value) {
  return list.indexOf(value) === -1 ? list.concat([value]).sort((a, b) => a - b) : list;
}

// The design's card headings run larger than SectionCard's default.
const big = (text) => <span className="text-lg">{text}</span>;

// One reminder as a tinted check chip, as in the schedule design.
function OffsetChip({ checked, onChange, children }) {
  return (
    <label className={"flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors "
      + (checked ? "border-primary/40 bg-primary-tint font-semibold text-primary" : "border-border bg-card text-card-foreground hover:bg-surface-sunken")}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={checked} onChange={onChange} />
      {children}
    </label>
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
  const loc = DATE_LOCALE[lang] || "en-US";

  const today = localDateIn(draft.timeZone);
  const firstIndex = valid ? Math.max(0, periodForDate(draft, today).index) : 0;
  const preview = valid ? [0, 1, 2].map((i) => periodForIndex(draft, firstIndex + i)) : [];

  const hm = (draft.deadlineTime || "00:00").split(":");
  const timeLabel = new Date(2000, 0, 1, Number(hm[0]), Number(hm[1])).toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  const zoneOf = (iso) => new Date(iso).toLocaleTimeString(loc, { timeZone: draft.timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const dayOf = (iso) => new Date(iso).toLocaleDateString(loc, { timeZone: draft.timeZone, weekday: "short", month: "short", day: "numeric" });
  const days = (n) => (n === 1 ? t("srOneDay") : t("srNDays").replace("{n}", n));
  const hours = (n) => (n === 1 ? t("srOneHour") : t("srNHours").replace("{n}", n));

  const has = (o) => draft.reminderOffsets.indexOf(o) !== -1;
  const toggle = (o) => set("reminderOffsets", has(o)
    ? draft.reminderOffsets.filter((x) => x !== o) : draft.reminderOffsets.concat([o]).sort((a, b) => a - b));

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
    <form className="grid gap-5" onSubmit={save}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-card-foreground">{t("srScheduleTitle")}</h2>
          <p className="!m-0 !mt-1 text-sm text-muted">{t("srScheduleSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={draft.active ? "success" : "neutral"} dot className="px-3 py-1 text-meta">
            {t(draft.active ? "srActive" : "srPaused")}
          </Badge>
          <Switch checked={draft.active} onCheckedChange={(v) => set("active", v)} label={t("srScheduleActive")} />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="grid gap-5">
          <SectionCard title={big(t("srScheduleDeadlineTitle"))} className="overflow-visible">
            <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field htmlFor="sched-start" label={t("srFirstPeriodStart")} hint={t("srFirstPeriodStartHelp")}>
                <DatePicker id="sched-start" value={draft.firstPeriodStart} onChange={(v) => set("firstPeriodStart", v)} required />
              </Field>
              <Field htmlFor="sched-days" label={t("srPeriodDays")} hint={t("srPeriodDaysHelp")}>
                <Select id="sched-days" value={draft.periodDays} onChange={(e) => set("periodDays", Number(e.target.value))}>
                  {withCurrent(PERIOD_DAYS, draft.periodDays).map((n) => <option key={n} value={n}>{days(n)}</option>)}
                </Select>
              </Field>
              <Field htmlFor="sched-tz" label={t("srTimeZone")}>
                <Select id="sched-tz" value={draft.timeZone} onChange={(e) => set("timeZone", e.target.value)}>
                  {TIME_ZONES.concat(TIME_ZONES.indexOf(draft.timeZone) === -1 ? [draft.timeZone] : []).map((z) => <option key={z} value={z}>{z}</option>)}
                </Select>
              </Field>
              <Field htmlFor="sched-due-days" label={t("srDeadlineDays")} hint={t("srDeadlineDaysHelp")}>
                <Select id="sched-due-days" value={draft.deadlineDaysAfterEnd} onChange={(e) => set("deadlineDaysAfterEnd", Number(e.target.value))}>
                  {withCurrent(DUE_DAYS, draft.deadlineDaysAfterEnd).map((n) => <option key={n} value={n}>{days(n)}</option>)}
                </Select>
              </Field>
              <Field htmlFor="sched-due-time" label={t("srDeadlineTime")}>
                <Input id="sched-due-time" type="time" className="tabular-nums" value={draft.deadlineTime} onChange={(e) => set("deadlineTime", e.target.value)} required />
              </Field>
              <Field htmlFor="sched-grace" label={t("srGraceHours")} hint={t("srGraceHoursHelp")}>
                <Select id="sched-grace" value={draft.graceHours} onChange={(e) => set("graceHours", Number(e.target.value))}>
                  {withCurrent(GRACE, draft.graceHours).map((n) => <option key={n} value={n}>{hours(n)}</option>)}
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={big(t("srReminders"))}>
            <p className="!-mt-2 !mb-4 text-sm text-muted">{t("srRemindersStop")}</p>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 text-sm font-semibold text-card-foreground">{t("srBeforeDeadline")}</legend>
              <div className="flex flex-wrap gap-2">
                {BEFORE.map((o) => (
                  <OffsetChip key={o} checked={has(o)} onChange={() => toggle(o)}>
                    {o === -1 ? t("srOffsetBefore1") : t("srOffsetBefore").replace("{n}", -o)}
                  </OffsetChip>
                ))}
              </div>
            </fieldset>
            <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
              <legend className="mb-2 w-full border-t border-border pt-4 text-sm font-semibold text-card-foreground">{t("srOnDeadline")}</legend>
              <div className="flex flex-wrap gap-2">
                <OffsetChip checked={has(0)} onChange={() => toggle(0)}>{t("srOffsetAt").replace("{time}", timeLabel)}</OffsetChip>
              </div>
            </fieldset>
            <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
              <legend className="mb-2 w-full border-t border-border pt-4 text-sm text-muted">
                <span className="font-semibold text-card-foreground">{t("srAfterDeadline")}</span> · {t("srOnlyIfNotSubmitted")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {AFTER.map((o) => (
                  <OffsetChip key={o} checked={has(o)} onChange={() => toggle(o)}>
                    {o === 1 ? t("srOffsetAfter1") : t("srOffsetAfterN").replace("{n}", o)}
                  </OffsetChip>
                ))}
              </div>
            </fieldset>
            <p className="!mb-0 !mt-4 !text-meta text-muted">{t("srReviewersNotified")}</p>
          </SectionCard>
        </div>

        <div className="grid gap-5">
          <SectionCard title={<span className="flex items-center gap-2 text-lg">{t("srSchedulePreview")}<Badge variant="info">{t("srPreview")}</Badge></span>}>
            {preview.length > 0 ? (
              <>
                <p className="!-mt-2 !mb-4 text-sm text-muted">
                  {t("srEveryNDays").replace("{n}", draft.periodDays)} · {zoneOf(dueAtFor(draft, preview[0].end))}
                </p>
                <ul className="m-0 grid list-none gap-3 p-0">
                  {preview.map((p) => {
                    const due = dueAtFor(draft, p.end).toISOString();
                    return (
                      <li key={p.start} className="rounded-lg bg-background px-4 py-3">
                        <div className="text-caption font-semibold uppercase tracking-wide text-muted">{fmtPeriod(p.start, p.end, lang)}</div>
                        <div className="mt-1 text-base font-bold text-card-foreground">{t("srDue")} {dayOf(due)}</div>
                        <div className="mt-0.5 text-meta text-muted">{zoneOf(due)}</div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : <p className="m-0 text-meta text-muted">—</p>}
          </SectionCard>

          <SectionCard title={big(t("srWhoSubmitsTitle"))}>
            <p className="!m-0 text-sm text-muted">{t("srWhoSubmitsHelp")}</p>
            <Link to="/admin/roles" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary no-underline hover:underline">
              {t("srManageRoles")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </SectionCard>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="!m-0 text-sm text-muted">{t("srScheduleChangeNote")}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(schedule)}>{t("cancelLabel")}</Button>
          <Button type="submit" disabled={busy || !valid}>{t("srSaveChanges")}</Button>
        </div>
      </div>
    </form>
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
  const roleOf = (userId) => (roles && roles[userId] && roles[userId].active ? roles[userId].role : "");
  const reviewers = roles === null ? null : staff.filter((p) => roleOf(p.id) === "reviewer").length;
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
    <SectionCard
      title={t("srPeopleTitle")}
      description={t("srPeopleHelp")}
      action={reviewers ? <span className="text-meta font-semibold tabular-nums text-muted">{t("srReviewerCount").replace("{n}", reviewers)}</span> : null}
    >
      {reviewers === 0 ? <Alert tone="warning" className="mb-4" title={t("srNoReviewerTitle")}>{t("srNoReviewerBody")}</Alert> : null}
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
      <PeopleCard />
      {schedules.map((s) => <ScheduleCard key={s.id + n} schedule={s} onSaved={load} />)}
      <EmailCard />
    </div>
  );
}
