// SnapDashboard.jsx -- an outreach program's landing section. Every number
// comes from outreach_dashboard() (SECURITY INVOKER, so RLS scopes it: a
// worker's case and follow-up figures are their own; contacts and activity
// are program-wide) -- no sample statistics. Milestone tiles are labelled by
// the stage configured for that milestone and hidden when there is none.
// Appointments, events and partner referrals arrive in later phases and are
// named as not-yet-built, not faked.
import { useEffect, useState } from "react";
import {
  AlarmClock, ArrowRight, CalendarCheck, ClipboardCheck, FolderOpen, ListPlus, MessageSquarePlus, Send, UserPlus, Users
} from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { casesNeedingAttention, fetchCaseStages, fetchCases, milestoneStage, stageLabel } from "../../lib/assistanceCases.js";
import { cn } from "../../lib/cn.js";
import { programName, programScopeNote } from "../../lib/outreachPrograms.js";
import { addDays, completionRate, fetchOutreachDashboard, fetchRecentActivity, fetchTasks, taskBuckets } from "../../lib/snapTasks.js";
import { fmtDateLong, fmtTime, todayStr } from "../../lib/utils.js";
import BarList from "../BarList.jsx";
import { SectionCard, SectionEmpty } from "../SectionCard.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { SNAP_CONTROL } from "./SnapField.jsx";
import { SnapTaskRows } from "./SnapTaskList.jsx";

const RANGES = [7, 30, 90];
const BTN_RESET = "min-h-0 rounded-none border-0 bg-transparent p-0 font-normal text-left transform-none";

function Kpi({ icon: Icon, tint, label, value, onDrill }) {
  const body = (
    <>
      <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + tint}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="mt-3 block text-sm font-semibold text-muted">{label}</span>
      <span className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-card-foreground">
        {value}{onDrill && <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />}
      </span>
    </>
  );
  return (
    <Card className={cn("p-5 shadow-card hover:shadow-card", onDrill && "transition-colors hover:border-primary-soft")}>
      {onDrill ? <button type="button" onClick={onDrill} className={cn(BTN_RESET, "block w-full")}>{body}</button> : body}
    </Card>
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
  }, [program, days, today]);

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

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0">{programName(info, lang)}</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="snap-range" className="text-sm text-muted">{t("snapRangeLabel")}</label>
          <select id="snap-range" className={SNAP_CONTROL + " !w-auto"} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((n) => <option key={n} value={n}>{t("snapRange_" + n)}</option>)}
          </select>
        </div>
      </div>
      {programRole === "worker" && <p className="!m-0 !text-sm text-muted">{t("snapDashboardScopeWorker")}</p>}

      <SectionCard title={t("snapQuickActions")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="gap-1.5" onClick={() => onNavigate("contacts", "new")}><UserPlus className="h-4 w-4" aria-hidden="true" />{t("snapAddContact")}</Button>
          <Button variant="secondary" className="gap-1.5" onClick={() => onNavigate("cases", "new")}><FolderOpen className="h-4 w-4" aria-hidden="true" />{t("snapOpenCase")}</Button>
          <Button variant="secondary" className="gap-1.5" onClick={() => onNavigate("contacts")}><MessageSquarePlus className="h-4 w-4" aria-hidden="true" />{t("snapLogActivity")}</Button>
          <Button variant="secondary" className="gap-1.5" onClick={() => onNavigate("tasks", "new")}><ListPlus className="h-4 w-4" aria-hidden="true" />{t("snapAddTask")}</Button>
        </div>
      </SectionCard>

      {loadError ? <SectionEmpty message={t("snapDashboardLoadError")} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Users} tint="bg-primary-tint text-primary" label={t("snapKpiIndividuals")} value={metrics ? m.individuals_contacted : "…"} onDrill={() => onNavigate("contacts")} />
          <Kpi icon={UserPlus} tint="bg-primary-tint text-primary" label={t("snapKpiNewContacts")} value={metrics ? m.new_contacts : "…"} onDrill={() => onNavigate("contacts")} />
          <Kpi icon={FolderOpen} tint="bg-tint-success text-success" label={t("snapKpiCasesOpened")} value={metrics ? m.cases_opened : "…"} onDrill={() => onNavigate("cases")} />
          {assisted && <Kpi icon={ClipboardCheck} tint="bg-tint-success text-success" label={t("snapKpiApplications")} value={metrics ? m.applications_assisted : "…"} onDrill={() => onNavigate("cases")} />}
          {referred && <Kpi icon={Send} tint="bg-tint-neutral text-muted" label={stageLabel(stages, referred.key, lang)} value={metrics ? m.referred_external : "…"} onDrill={() => onNavigate("cases")} />}
          <Kpi icon={CalendarCheck} tint="bg-tint-warn text-gold-ink" label={t("snapKpiFollowUpsDue")} value={metrics ? m.follow_ups_due : "…"} onDrill={() => onNavigate("tasks")} />
          <Kpi icon={AlarmClock} tint="bg-accent-tint text-accent" label={t("snapKpiOverdue")} value={metrics ? m.overdue_tasks : "…"} onDrill={() => onNavigate("tasks")} />
          <Kpi icon={ClipboardCheck} tint="bg-tint-neutral text-muted" label={t("snapKpiCompletion")} value={metrics ? (rate === null ? "—" : rate + "%") : "…"} />
        </div>
      )}

      {metrics && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title={t("snapChartActivity")}><BarList items={bars(m.activity_by_week, (r) => fmtDateLong(r.week, lang))} /></SectionCard>
          <SectionCard title={t("snapChartByType")}><BarList items={bars(m.activity_by_type, (r) => t("snapType_" + r.key))} /></SectionCard>
          <SectionCard title={t("snapChartBySource")}><BarList items={bars(m.contacts_by_source, (r) => t("snapSource_" + r.key))} /></SectionCard>
          <SectionCard title={t("snapChartByStage")}><BarList items={bars((m.cases_by_stage || []).filter((r) => Number(r.count) > 0), (r) => stageLabel(stages, r.key, lang))} /></SectionCard>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title={t("snapMyFollowUps")}>
          <SnapTaskRows tasks={myTasks} onChanged={loadLists} emptyMessage={t("snapNothingHere")} showClient />
        </SectionCard>
        <SectionCard title={t("snapCasesAttention")}>
          {attention.length ? (
            <ul className="m-0 list-none space-y-2 p-0">
              {attention.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onNavigate("cases")} className={cn(BTN_RESET, "block w-full rounded-lg border border-border p-3 text-sm hover:bg-background")}>
                    <span className="block font-semibold text-card-foreground">{(c.firstName + " " + c.lastName).trim()} · {c.caseNumber}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{stageLabel(stages, c.stageKey, lang)}</Badge>
                      {c.reviewStatus === "requested" && <Badge variant="warn">{t("snapReview_requested")}</Badge>}
                      {c.followUpDate && c.followUpDate < today && <Badge variant="accent">{t("snapFollowUpDate")}: {fmtDateLong(c.followUpDate, lang)}</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <SectionEmpty message={t("snapNothingHere")} />}
        </SectionCard>
        <SectionCard title={t("snapRecentActivity")}>
          {recent.length ? (
            <ul className="m-0 list-none space-y-2 p-0 text-sm">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge>{t("snapType_" + a.type)}</Badge>
                  <span className="text-card-foreground">{a.clientName}</span>
                  <span className="ml-auto text-xs text-muted">{fmtDateLong(a.occurredAt.slice(0, 10), lang)} {fmtTime(a.occurredAt)} · {nameOf(a.staffId)}</span>
                </li>
              ))}
            </ul>
          ) : <SectionEmpty message={t("snapNothingHere")} />}
        </SectionCard>
      </div>

      <div className="info-callout !mb-0">
        <p className="!m-0 !text-sm">{t("snapComingNext")} {programScopeNote(info, lang)}</p>
      </div>
    </div>
  );
}
