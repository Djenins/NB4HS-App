// WorkforceDashboard.jsx -- Phase 5 of the Employer & Job Opportunity
// Management module. Pure aggregation over data Phases 1-4 already built --
// no new database table. KPI definitions are spelled out inline (see the
// Phase 5 plan) so they're auditable rather than guessed at. The activity
// feed's "follow-up completed" source (employer_activity) is fetched with
// its own dashboard-scoped fetchAllEmployerActivity() rather than promoted
// into global AppContext state, same idiom as Reports.jsx's
// fetchAllApplications/fetchAllDistributions.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Briefcase, Building2, CalendarClock, CheckCircle2, FileText, Percent, Phone, UserPlus, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { isCandidateEligible } from "../lib/candidateMatching.js";
import { fetchAllEmployerActivity } from "../lib/clientsData.js";
import { activityTypeLabel, EMPLOYER_PARTNERSHIP_STAGES, partnershipStageLabel } from "../lib/employerProfile.js";
import { computeRetentionRate } from "../lib/placements.js";
import { formatPayRange, statusBadgeVariant, statusLabel } from "../lib/jobOpenings.js";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

function KpiCard({ icon: Icon, tint, label, value }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl " + tint}>
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
        <div className="mt-3 truncate text-sm font-semibold text-muted">{label}</div>
        <div className="mt-1 text-4xl font-extrabold tracking-tight text-card-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

const ACTIVITY_ICON = { opening: FileText, referral: UserPlus, interview: CalendarClock, placement: CheckCircle2, followup: Phone };

export default function WorkforceDashboard() {
  const { data } = useApp();
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

  return (
    <>
      <div className="mb-5">
        <h1 className="mb-1">{t("workforceDashboardTitle")}</h1>
        <p className="m-0 text-sm text-muted">{t("workforceDashboardDesc")}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Building2} tint="bg-primary-tint text-primary" label={t("statActiveEmployersLabel")} value={activeEmployers} />
        <KpiCard icon={Briefcase} tint="bg-tint-success text-success" label={t("statActiveJobOpeningsLabel")} value={activeJobOpenings} />
        <KpiCard icon={Users} tint="bg-violet-100 text-violet-700" label={t("statCandidatesAwaitingReferralLabel")} value={candidatesAwaitingReferral} />
        <KpiCard icon={CalendarClock} tint="bg-tint-warn text-gold-ink" label={t("statInterviewsScheduledLabel")} value={interviewsScheduled} />
        <KpiCard icon={CheckCircle2} tint="bg-cyan-100 text-cyan-700" label={t("statPlacementsThisMonthLabel")} value={placementsThisMonth} />
        <KpiCard icon={Percent} tint="bg-primary-tint text-primary" label={t("retentionRateLabel")} value={retentionRate === null ? "—" : retentionRate + "%"} />
        <KpiCard icon={AlertCircle} tint="bg-tint-danger text-accent" label={t("statEmployerFollowUpsDueLabel")} value={followUpsDue} />
      </div>

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="m-0 text-sm font-bold text-card-foreground">{t("recentJobOpportunitiesLabel")}</h3>
            <Button size="sm" variant="secondary" onClick={() => navigate("/jobopenings")}>{t("viewAllBtn")}</Button>
          </div>
          {recentOpenings.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t("noJobOpeningsYet")}</p> : (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("positionLabel")}</th>
                    <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("companyLabel")}</th>
                    <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("city")}</th>
                    <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("payLabel")}</th>
                    <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("openingsCountLabel")}</th>
                    <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("referralsLabel")}</th>
                    <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("statusLabel")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOpenings.map((o) => (
                    <tr key={o.id} className="hover:bg-tint-neutral">
                      <td className="px-3 py-2 font-semibold text-card-foreground">{o.title}</td>
                      <td className="px-3 py-2 text-card-foreground">{o.employerName}</td>
                      <td className="px-3 py-2 text-card-foreground">{o.employerCity || "—"}</td>
                      <td className="px-3 py-2 text-card-foreground">{formatPayRange(o) || "—"}</td>
                      <td className="px-3 py-2 text-card-foreground">{o.openingsCount}</td>
                      <td className="px-3 py-2 text-card-foreground">{referralCountFor(o.id)}</td>
                      <td className="px-3 py-2"><Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-5">
          <h3 className="m-0 mb-3 text-sm font-bold text-card-foreground">{t("employerPipelineLabel")}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stageCounts.map((s) => (
              <div key={s.key} className="rounded-xl border border-border p-3 text-center">
                <div className="text-2xl font-extrabold tracking-tight text-card-foreground">{s.count}</div>
                <div className="mt-1 text-xs font-semibold text-muted">{partnershipStageLabel(s.key)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="m-0 mb-3 text-sm font-bold text-card-foreground">{t("recentEmployerActivityLabel")}</h3>
          {feedItems.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t("noRecentActivityMessage")}</p> : (
            <div className="space-y-2">
              {feedItems.map((item, i) => {
                const Icon = ACTIVITY_ICON[item.type] || FileText;
                return (
                  <div key={i} className="flex items-center gap-3 border-b border-border py-2 text-sm last:border-b-0">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-card-foreground">{item.text}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted">{fmtDateLong(item.date)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
