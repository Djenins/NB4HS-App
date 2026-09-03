// WorkforceDashboard.jsx -- Phase 5 of the Employer & Job Opportunity
// Management module. Pure aggregation over data Phases 1-4 already built --
// no new database table. KPI definitions are spelled out inline (see the
// Phase 5 plan) so they're auditable rather than guessed at. The activity
// feed's "follow-up completed" source (employer_activity) is fetched with
// its own dashboard-scoped fetchAllEmployerActivity() rather than promoted
// into global AppContext state, same idiom as Reports.jsx's
// fetchAllApplications/fetchAllDistributions.
//
// Presentation now matches the rest of the module: the "Recent Job
// Opportunities" table became components/DashboardOpeningRow.jsx rows, the
// pipeline counts became the same 12px tile idiom the filter panels use, and
// the sections share one header treatment.
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
import { isCandidateEligible } from "../lib/candidateMatching.js";
import { fetchAllEmployerActivity } from "../lib/clientsData.js";
import { activityTypeLabel, EMPLOYER_PARTNERSHIP_STAGES, partnershipStageLabel } from "../lib/employerProfile.js";
import { computeRetentionRate } from "../lib/placements.js";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import DashboardOpeningRow from "../components/DashboardOpeningRow.jsx";
import { SectionCard, SectionEmpty } from "../components/SectionCard.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";

// main.css styles the bare `button` tag app-wide (min-height:52px, 20px
// padding, 2px border) and adds a 1px hover lift, so anything built as a
// button here has to cancel it, same as ModuleNav.jsx.
const BTN_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal transform-none text-left";

function KpiCard({ icon: Icon, tint, label, value, onDrill, drillLabel }) {
  const Wrapper = onDrill ? "button" : "div";
  const props = onDrill
    ? { type: "button", onClick: onDrill, "aria-label": drillLabel, className: cn(BTN_RESET, "w-full") }
    : {};

  return (
    <Card className={cn("p-6 shadow-card hover:shadow-card", onDrill && "transition-colors hover:border-primary-soft")}>
      <Wrapper {...props}>
        <span className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl " + tint}>
          <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="mt-3 block truncate text-sm font-semibold text-muted">{label}</span>
        <span className="mt-1 block text-4xl font-extrabold tracking-tight text-card-foreground">{value}</span>
        {onDrill && (
          <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
            {drillLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </Wrapper>
    </Card>
  );
}

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

  const activeEmployers = employers.filter((e) => e.active !== false).length;
  const activeJobOpenings = jobOpenings.filter((o) => o.status === "active").length;
  const referredClientIds = new Set(referrals.map((r) => r.jobClientId));
  const candidatesAwaitingReferral = jobClients.filter((c) => isCandidateEligible(c) && !referredClientIds.has(c.id)).length;
  const interviewsScheduled = referrals.filter((r) => r.status === "interview").length;
  const thisMonthPrefix = today.slice(0, 7);
  const placementsThisMonth = placements.filter((p) => (p.startDate || "").slice(0, 7) === thisMonthPrefix).length;
  const retentionRate = computeRetentionRate(placements);
  const followUpsDue = employers.filter((e) => e.nextFollowUpDate && e.nextFollowUpDate <= today).length;

  const recentOpenings = jobOpenings.slice().sort((a, b) => (b.postedDate || "").localeCompare(a.postedDate || "")).slice(0, 8);
  const referralCountFor = (openingId) => referrals.filter((r) => r.jobOpeningId === openingId).length;

  const stageCounts = EMPLOYER_PARTNERSHIP_STAGES.map((s) => ({ ...s, count: employers.filter((e) => e.partnershipStage === s.key).length }));

  const feedItems = []
    .concat(jobOpenings.map((o) => ({ date: o.postedDate, type: "opening", text: o.employerName + " " + t("activityPostedOpeningLabel") + " " + o.title })))
    .concat(referrals.map((r) => ({ date: r.referralDate, type: "referral", text: r.participantName + " " + t("activityReferredLabel") + " " + r.positionTitle + " " + t("activityWithLabel") + " " + r.employerName })))
    .concat(referrals.filter((r) => r.interviewDate).map((r) => ({ date: r.interviewDate, type: "interview", text: r.participantName + " " + t("activityInterviewScheduledLabel") + " " + r.employerName })))
    .concat(placements.map((p) => ({ date: p.startDate, type: "placement", text: p.participantName + " " + t("activityPlacedLabel") + " " + p.employerName + " (" + p.positionTitle + ")" })))
    .concat(employerActivity.map((a) => ({ date: a.date, type: "followup", text: activityTypeLabel(a.type) + " " + t("activityWithLabel") + " " + (employerById[a.employerId] ? employerById[a.employerId].businessName : "") })))
    .filter((item) => item.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15);

  function drill(path, filters) {
    return function () { navigate(path, { state: { filters } }); };
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="mb-1">{t("workforceDashboardTitle")}</h1>
        <p className="m-0 text-sm text-muted">{t("workforceDashboardDesc")}</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Building2} tint="bg-primary-tint text-primary" label={t("statActiveEmployersLabel")} value={activeEmployers} />
        <KpiCard
          icon={Briefcase} tint="bg-tint-success text-success" label={t("statActiveJobOpeningsLabel")} value={activeJobOpenings}
          onDrill={drill("/jobopenings", { status: "active" })} drillLabel={t("viewListLabel")}
        />
        <KpiCard icon={Users} tint="bg-violet-100 text-violet-700" label={t("statCandidatesAwaitingReferralLabel")} value={candidatesAwaitingReferral} />
        <KpiCard
          icon={CalendarClock} tint="bg-tint-warn text-gold-ink" label={t("statInterviewsScheduledLabel")} value={interviewsScheduled}
          onDrill={drill("/referrals", { stage: "interview" })} drillLabel={t("viewListLabel")}
        />
        <KpiCard icon={CheckCircle2} tint="bg-cyan-100 text-cyan-700" label={t("statPlacementsThisMonthLabel")} value={placementsThisMonth} />
        <KpiCard icon={Percent} tint="bg-primary-tint text-primary" label={t("retentionRateLabel")} value={retentionRate === null ? "—" : retentionRate + "%"} />
        <KpiCard
          icon={AlertCircle} tint="bg-tint-danger text-accent" label={t("statEmployerFollowUpsDueLabel")} value={followUpsDue}
          onDrill={drill("/employers", { followUp: "due" })} drillLabel={t("viewListLabel")}
        />
      </div>

      <div className="flex flex-col gap-5">
        <SectionCard
          title={t("recentJobOpportunitiesLabel")}
          action={
            <Button
              variant="secondary" onClick={function () { navigate("/jobopenings"); }}
              className="h-9 gap-1.5 rounded-[10px] px-4 text-sm"
            >
              {t("viewAllBtn")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          }
        >
          {recentOpenings.length === 0 ? <SectionEmpty message={t("noJobOpeningsYet")} /> : (
            <div className="flex flex-col gap-2">
              {recentOpenings.map(function (o) {
                return <DashboardOpeningRow key={o.id} opening={o} referralCount={referralCountFor(o.id)} />;
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t("employerPipelineLabel")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stageCounts.map(function (s) {
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={drill("/employers", { stage: s.key })}
                  className={cn(
                    BTN_RESET,
                    "rounded-[12px] border border-border p-3 text-center transition-colors hover:border-primary-soft hover:bg-primary-tint"
                  )}
                >
                  <span className="block text-2xl font-extrabold tracking-tight text-card-foreground">{s.count}</span>
                  <span className="mt-1 block text-xs font-semibold text-muted">{partnershipStageLabel(s.key)}</span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title={t("recentEmployerActivityLabel")}>
          {feedItems.length === 0 ? <SectionEmpty message={t("noRecentActivityMessage")} /> : (
            <div className="flex flex-col">
              {feedItems.map(function (item, i) {
                const Icon = ACTIVITY_ICON[item.type] || FileText;
                return (
                  <div key={i} className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-b-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-primary-tint text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-card-foreground">{item.text}</span>
                    <span className="shrink-0 text-xs text-muted">{fmtDateLong(item.date, lang)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
