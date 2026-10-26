// WorkforceDashboard.jsx -- Phase 5 of the Employer & Job Opportunity
// Management module. Pure aggregation over data Phases 1-4 already built --
// no new database table. KPI definitions are spelled out inline (see the
// Phase 5 plan) so they're auditable rather than guessed at. The activity
// feed's "follow-up completed" source (employer_activity) is fetched with
// its own dashboard-scoped fetchAllEmployerActivity() rather than promoted
// into global AppContext state, same idiom as Reports.jsx's
// fetchAllApplications/fetchAllDistributions.
//
// Presentation follows the design system's dashboard template: PageHeader,
// one KpiCard row, then SectionCards on a 12-column grid at lg. There is no
// range control -- every number here is current state, not a date range;
// the range-scoped view is WorkforceReports.jsx.
//
// KPI row: seven cards in grid-cols-2 xl:grid-cols-4, so desktop reads 4+3.
// Below xl the seventh card spans both columns instead of sitting alone.
//
// The KPI cards that CAN be drilled into now are. Every one of those numbers
// is a question one of the module's list pages can now answer with a filter,
// so the card links there carrying that filter in router state -- see
// initialFilters in JobOpenings.jsx / Referrals.jsx / Employers.jsx. Only the
// cards whose definition matches a filter EXACTLY are linked: a card that
// sent you to a list showing a different number would be worse than a card
// that sends you nowhere. That is also why the Employers follow-up filter
// grew a "due today or overdue" option -- it is this page's Follow-Ups Due
// definition, and the link would otherwise land on a smaller set.
//
// Not linked, and why: Active Employers (no active/inactive filter exists),
// Candidates Awaiting Referral (a cross-page set, not one list's filter),
// Placements This Month (no month filter; the tenure buckets are a different
// question), Retention Rate (a computed ratio, not a subset).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowRight, Briefcase, Building2, CalendarClock, CheckCircle2, FileText, Percent, Phone, UserPlus, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { fetchAllEmployerActivity } from "../lib/clientsData.js";
import { activityTypeLabel, EMPLOYER_PARTNERSHIP_STAGES, partnershipStageLabel } from "../lib/employerProfile.js";
import { computeRetentionRate } from "../lib/placements.js";
import {
  countActiveEmployers, countActiveJobOpenings, countCandidatesAwaitingReferral, countFollowUpsDue,
  countInterviewsScheduled, countPlacementsThisMonth, employerStageCounts, mergeActivityFeed,
  recentOpenings, referralCountForOpening
} from "../lib/workforceMetrics.js";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import DashboardOpeningRow from "../components/DashboardOpeningRow.jsx";
import { Button } from "../components/ui/button.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";

const ACTIVITY_ICON = { opening: FileText, referral: UserPlus, interview: CalendarClock, placement: CheckCircle2, followup: Phone };

export default function WorkforceDashboard() {
  const { data, lang } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [employerActivity, setEmployerActivity] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchAllEmployerActivity().then((rows) => { if (!cancelled) setEmployerActivity(rows); });
    return () => { cancelled = true; };
  }, []);

  const employers = data.employers || [];
  const jobOpenings = data.jobOpenings || [];
  const jobClients = data.jobClients || [];
  const referrals = data.referrals || [];
  const placements = data.placements || [];
  const today = todayStr();

  const employerById = {};
  employers.forEach((e) => { employerById[e.id] = e; });

  const activeEmployers = countActiveEmployers(employers);
  const activeJobOpenings = countActiveJobOpenings(jobOpenings);
  const candidatesAwaitingReferral = countCandidatesAwaitingReferral(jobClients, referrals);
  const interviewsScheduled = countInterviewsScheduled(referrals);
  const placementsThisMonth = countPlacementsThisMonth(placements, today);
  const retentionRate = computeRetentionRate(placements);
  const followUpsDue = countFollowUpsDue(employers, today);

  const recent = recentOpenings(jobOpenings, 8);
  const stageCounts = employerStageCounts(employers, EMPLOYER_PARTNERSHIP_STAGES);

  const feedItems = []
    .concat(jobOpenings.map((o) => ({ date: o.postedDate, type: "opening", text: o.employerName + " " + t("activityPostedOpeningLabel") + " " + o.title })))
    .concat(referrals.map((r) => ({ date: r.referralDate, type: "referral", text: r.participantName + " " + t("activityReferredLabel") + " " + r.positionTitle + " " + t("activityWithLabel") + " " + r.employerName })))
    .concat(referrals.filter((r) => r.interviewDate).map((r) => ({ date: r.interviewDate, type: "interview", text: r.participantName + " " + t("activityInterviewScheduledLabel") + " " + r.employerName })))
    .concat(placements.map((p) => ({ date: p.startDate, type: "placement", text: p.participantName + " " + t("activityPlacedLabel") + " " + p.employerName + " (" + p.positionTitle + ")" })))
    .concat(employerActivity.map((a) => ({ date: a.date, type: "followup", text: activityTypeLabel(a.type) + " " + t("activityWithLabel") + " " + (employerById[a.employerId] ? employerById[a.employerId].businessName : "") })))
    .slice();
  const feed = mergeActivityFeed(feedItems, 15);

  function drill(path, filters) {
    return function () { navigate(path, { state: { filters } }); };
  }

  // Drillable cards say so in their hint line; the whole card is the button.
  const drillHint = (
    <span className="inline-flex items-center gap-1 font-semibold text-primary">
      {t("viewListLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </span>
  );

  return (
    <>
      <PageHeader title={t("workforceDashboardTitle")} description={t("workforceDashboardDesc")} />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard icon={Building2} tone="info" label={t("statActiveEmployersLabel")} value={activeEmployers} />
        <KpiCard
          icon={Briefcase} tone="success" label={t("statActiveJobOpeningsLabel")} value={activeJobOpenings}
          onClick={drill("/jobopenings", { status: "active" })} hint={drillHint}
        />
        <KpiCard icon={Users} tone="warning" label={t("statCandidatesAwaitingReferralLabel")} value={candidatesAwaitingReferral} />
        <KpiCard
          icon={CalendarClock} tone="violet" label={t("statInterviewsScheduledLabel")} value={interviewsScheduled}
          onClick={drill("/referrals", { stage: "interview" })} hint={drillHint}
        />
        <KpiCard icon={CheckCircle2} tone="success" label={t("statPlacementsThisMonthLabel")} value={placementsThisMonth} />
        <KpiCard icon={Percent} tone="neutral" label={t("retentionRateLabel")} value={retentionRate === null ? "—" : retentionRate + "%"} />
        <KpiCard
          icon={AlertCircle} tone="warning" label={t("statEmployerFollowUpsDueLabel")} value={followUpsDue}
          onClick={drill("/employers", { followUp: "due" })} hint={drillHint}
          className="col-span-2 xl:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SectionCard title={t("employerPipelineLabel")} className="lg:col-span-12">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {stageCounts.map(function (s) {
              return (
                <Button
                  key={s.key}
                  variant="outline"
                  onClick={drill("/employers", { stage: s.key })}
                  className="h-auto min-h-[72px] flex-col gap-1 whitespace-normal px-3 py-3 text-center leading-tight [@media(pointer:coarse)]:h-auto"
                >
                  <span className="block text-heading font-bold tabular-nums text-card-foreground">{s.count}</span>
                  <span className="block text-meta font-medium text-muted">{partnershipStageLabel(s.key, lang)}</span>
                </Button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title={t("recentJobOpportunitiesLabel")}
          className="lg:col-span-7"
          action={
            <Button variant="secondary" size="sm" onClick={function () { navigate("/jobopenings"); }}>
              {t("viewAllBtn")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              compact
              title={t("noJobOpeningsYet")}
              description={t("wfDashNoOpeningsHint")}
              action={<Button variant="secondary" onClick={function () { navigate("/jobopenings"); }}>{t("jobOpeningsTitle")}</Button>}
            />
          ) : (
            <div className="divide-y divide-line-subtle">
              {recent.map(function (o) {
                return <DashboardOpeningRow key={o.id} opening={o} referralCount={referralCountForOpening(referrals, o.id)} />;
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t("recentEmployerActivityLabel")} className="lg:col-span-5">
          {feed.length === 0 ? (
            <EmptyState compact title={t("noRecentActivityMessage")} description={t("wfDashNoActivityHint")} />
          ) : (
            <ul className="m-0 list-none divide-y divide-line-subtle p-0">
              {feed.map(function (item, i) {
                const Icon = ACTIVITY_ICON[item.type] || FileText;
                return (
                  <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-tone-info-chip text-tone-info-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-ui text-card-foreground [overflow-wrap:anywhere]">{item.text}</div>
                      <div className="mt-0.5 text-meta tabular-nums text-muted">{fmtDateLong(item.date, lang)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
