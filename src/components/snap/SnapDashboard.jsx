// SnapDashboard.jsx -- an outreach program's landing section. Every number
// comes from outreach_dashboard() (SECURITY INVOKER, so RLS scopes it: a
// worker's case and follow-up figures are their own; contacts and activity
// are program-wide) -- no sample statistics. Milestone tiles are labelled by
// the stage configured for that milestone and hidden when there is none.
// Appointments, events and partner referrals arrive in later phases and are
// named as not-yet-built, not faked.
//
// Layout follows the dashboard template (plans/ui-design-system.md §2.4):
// PageHeader with the range as a SegmentedControl, a KpiCard row, then
// SectionCards on a 12-column grid at lg.
import { useEffect, useState } from "react";
import {
  AlarmClock, CalendarCheck, ClipboardCheck, FolderOpen, ListPlus, MessageSquarePlus, Percent, Send, UserPlus, Users
} from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { casesNeedingAttention, fetchCaseStages, fetchCases, milestoneStage, stageLabel } from "../../lib/assistanceCases.js";
import { cn } from "../../lib/cn.js";
import { programName, programScopeNote } from "../../lib/outreachPrograms.js";
import { addDays, completionRate, fetchOutreachDashboard, fetchRecentActivity, fetchTasks, taskBuckets } from "../../lib/snapTasks.js";
import { fmtDateLong, fmtTime, todayStr } from "../../lib/utils.js";
import BarList from "../BarList.jsx";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button, BUTTON_RESET } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { KpiCard } from "../ui/kpi-card.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import { SnapTaskRows } from "./SnapTaskList.jsx";

const RANGES = [7, 30, 90];

// Placeholder shaped like a BarList while the dashboard aggregate loads.
function BarListSkeleton() {
  return (
    <div className="grid gap-3">
      {["w-full", "w-4/5", "w-3/5", "w-2/5"].map((w) => (
        <div key={w} className="flex items-center gap-3">
          <Skeleton className="h-4 w-24 shrink-0" />
          <Skeleton className={cn("h-6", w)} />
        </div>
      ))}
    </div>
  );
}


export default function SnapDashboard({ onNavigate }) {
  const { data, lang, session } = useApp();
  const t = useT();
  const userId = session ? session.id : null;
  const { program, programRole, info } = useOutreachProgram();
  const [days, setDays] = useState(30);
  const [metrics, setMetrics] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [stages, setStages] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [attention, setAttention] = useState([]);
  const [recent, setRecent] = useState([]);
  const today = todayStr();

  useEffect(() => {
    let cancelled = false;
    fetchOutreachDashboard(program, addDays(today, -(days - 1)), today)
      .then((m) => { if (!cancelled) { setMetrics(m); setLoadError(false); } })
      .catch((err) => { console.warn("outreach_dashboard failed", err); if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [program, days, today, reloadKey]);

  function loadLists() {
    fetchCaseStages(program).then(setStages).catch(() => {});
    fetchTasks({ program, assignedTo: userId }).then((rows) => { const b = taskBuckets(rows, today); setMyTasks(b.overdue.concat(b.dueSoon).slice(0, 6)); }).catch(() => {});
    fetchCases(program).then((rows) => setAttention(casesNeedingAttention(rows, today).slice(0, 6))).catch(() => {});
    fetchRecentActivity(program, 8).then(setRecent).catch(() => {});
  }
  useEffect(loadLists, [program, userId, today]);

  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : "—"; };
  const m = metrics || {};
  const rate = completionRate(Number(m.tasks_due_in_range || 0), Number(m.tasks_done_in_range || 0));
  const bars = (rows, labelFor) => (rows || []).map((r) => ({ label: labelFor(r), count: Number(r.count) }));
  const assisted = milestoneStage(stages, "application_assisted");
  const referred = milestoneStage(stages, "referred_external");
  const overdue = Number(m.overdue_tasks || 0);
  // A value, or a skeleton the size of one while the aggregate loads.
  const val = (v) => (metrics ? v : <Skeleton className="mt-1 h-8 w-14" />);

  // 6, 7 or 8 tiles depending on which milestones the program configures.
  // 6 sits as 3+3 at lg; 7 and 8 as 4+3 / 4+4. On the two-column phone grid
  // an odd count lets the last tile (completion rate) span the row.
  const kpiCount = 6 + (assisted ? 1 : 0) + (referred ? 1 : 0);
  const kpiCols = kpiCount === 6 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  const lastSpan = kpiCount % 2 ? "col-span-2 lg:col-span-1" : "";

  const rangeControl = (
    <SegmentedControl
      label={t("snapRangeLabel")}
      value={days}
      onChange={setDays}
      options={RANGES.map((n) => ({ value: n, label: t("snapRange_" + n) }))}
    />
  );

  return (
    <div className="grid gap-5">
      <PageHeader
        className="mb-0"
        title={programName(info, lang)}
        description={programRole === "worker" ? t("snapDashboardScopeWorker") : undefined}
        actions={rangeControl}
      />

      <SectionCard title={t("snapQuickActions")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onNavigate("contacts", "new")}><UserPlus className="h-4 w-4" aria-hidden="true" />{t("snapAddContact")}</Button>
          <Button variant="secondary" onClick={() => onNavigate("cases", "new")}><FolderOpen className="h-4 w-4" aria-hidden="true" />{t("snapOpenCase")}</Button>
          <Button variant="secondary" onClick={() => onNavigate("contacts")}><MessageSquarePlus className="h-4 w-4" aria-hidden="true" />{t("snapLogActivity")}</Button>
          <Button variant="secondary" onClick={() => onNavigate("tasks", "new")}><ListPlus className="h-4 w-4" aria-hidden="true" />{t("snapAddTask")}</Button>
        </div>
      </SectionCard>

      {loadError ? (
        <Card>
          <EmptyState
            variant="error"
            compact
            title={t("snapDashboardLoadError")}
            description={t("snapDashboardLoadErrorHint")}
            action={<Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>{t("snapDashboardRetry")}</Button>}
          />
        </Card>
      ) : (
        <div className={cn("grid grid-cols-2 gap-4", kpiCols)}>
          <KpiCard icon={Users} tone="info" label={t("snapKpiIndividuals")} value={val(m.individuals_contacted)} onClick={() => onNavigate("contacts")} />
          <KpiCard icon={UserPlus} tone="info" label={t("snapKpiNewContacts")} value={val(m.new_contacts)} onClick={() => onNavigate("contacts")} />
          <KpiCard icon={FolderOpen} tone="success" label={t("snapKpiCasesOpened")} value={val(m.cases_opened)} onClick={() => onNavigate("cases")} />
          {assisted && <KpiCard icon={ClipboardCheck} tone="success" label={t("snapKpiApplications")} value={val(m.applications_assisted)} onClick={() => onNavigate("cases")} />}
          {referred && <KpiCard icon={Send} tone="violet" label={stageLabel(stages, referred.key, lang)} value={val(m.referred_external)} onClick={() => onNavigate("cases")} />}
          <KpiCard icon={CalendarCheck} tone="warning" label={t("snapKpiFollowUpsDue")} value={val(m.follow_ups_due)} onClick={() => onNavigate("tasks")} />
          <KpiCard icon={AlarmClock} tone={overdue > 0 ? "danger" : "neutral"} label={t("snapKpiOverdue")} value={val(m.overdue_tasks)} onClick={() => onNavigate("tasks")} />
          <KpiCard className={lastSpan} icon={Percent} tone="neutral" label={t("snapKpiCompletion")} value={val(rate === null ? "—" : rate + "%")} />
        </div>
      )}

      {!loadError && (
        <div className="grid gap-5 lg:grid-cols-12">
          <SectionCard className="lg:col-span-6" title={t("snapChartActivity")}>
            {metrics ? <BarList items={bars(m.activity_by_week, (r) => fmtDateLong(r.week, lang))} /> : <BarListSkeleton />}
          </SectionCard>
          <SectionCard className="lg:col-span-6" title={t("snapChartByType")}>
            {metrics ? <BarList items={bars(m.activity_by_type, (r) => t("snapType_" + r.key))} /> : <BarListSkeleton />}
          </SectionCard>
          <SectionCard className="lg:col-span-6" title={t("snapChartBySource")}>
            {metrics ? <BarList items={bars(m.contacts_by_source, (r) => t("snapSource_" + r.key))} /> : <BarListSkeleton />}
          </SectionCard>
          <SectionCard className="lg:col-span-6" title={t("snapChartByStage")}>
            {metrics ? <BarList items={bars((m.cases_by_stage || []).filter((r) => Number(r.count) > 0), (r) => stageLabel(stages, r.key, lang))} /> : <BarListSkeleton />}
          </SectionCard>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <SectionCard className="lg:col-span-4" title={t("snapMyFollowUps")}>
          <SnapTaskRows tasks={myTasks} onChanged={loadLists} emptyMessage={t("snapNothingHere")} showClient />
        </SectionCard>
        <SectionCard className="lg:col-span-4" title={t("snapCasesAttention")} flush={attention.length > 0}>
          {attention.length ? (
            <ul className="m-0 list-none divide-y divide-border border-t border-border p-0">
              {attention.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate("cases")}
                    className={cn(BUTTON_RESET, "block w-full px-5 py-3 text-left transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 sm:px-6")}
                  >
                    <span className="block text-ui font-semibold leading-snug text-card-foreground">
                      {(c.firstName + " " + c.lastName).trim()} · <span className="tabular-nums">{c.caseNumber}</span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="neutral">{stageLabel(stages, c.stageKey, lang)}</Badge>
                      {c.reviewStatus === "requested" && <StatusBadge domain="caseReview" status="requested">{t("snapReview_requested")}</StatusBadge>}
                      {c.followUpDate && c.followUpDate < today && (
                        <StatusBadge domain="task" status="overdue">{t("snapFollowUpDate")}: {fmtDateLong(c.followUpDate, lang)}</StatusBadge>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact title={t("snapNothingHere")} description={t("snapCasesAttentionEmptyHint")} />}
        </SectionCard>
        <SectionCard className="lg:col-span-4" title={t("snapRecentActivity")}>
          {recent.length ? (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {recent.map((a) => (
                <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{t("snapType_" + a.type)}</Badge>
                    <span className="text-ui text-card-foreground">{a.clientName}</span>
                  </div>
                  <div className="mt-1 text-meta tabular-nums text-muted">
                    {fmtDateLong(a.occurredAt.slice(0, 10), lang)} {fmtTime(a.occurredAt)} · {nameOf(a.staffId)}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact title={t("snapNothingHere")} description={t("snapRecentActivityEmptyHint")} />}
        </SectionCard>
      </div>

      <Alert tone="info">{t("snapComingNext")} {programScopeNote(info, lang)}</Alert>
    </div>
  );
}
