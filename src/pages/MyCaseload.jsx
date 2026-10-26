// MyCaseload.jsx -- "my clients today" view for case managers/job
// developers (and administrators, who can see it for oversight). There's no
// per-client staff-assignment column in the schema (case_clients/job_clients
// aren't owned by a specific staffer), so "my caseload" is derived entirely
// from `appointments.assignedEmail` -- the one place staff assignment
// already exists (see AppointmentsSection.jsx). On the NB4HS Operate design
// system: PageHeader, KpiCard row, one SectionCard per list, StatusBadge
// ("appointment" domain) and EmptyState.
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarPlus, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { Button } from "../components/ui/button.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";

function ApptRow({ a, lang, navigate, t }) {
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ");
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="truncate text-ui font-semibold text-card-foreground">{name}</div>
        <div className="text-meta tabular-nums text-muted">
          {fmtDateLong(a.date, lang)}{a.time ? " · " + a.time : ""} · {meetingWithLabel(a.meetingWith, lang)}
        </div>
        {a.reason ? <div className="mt-0.5 truncate text-meta text-muted">{a.reason}</div> : null}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
        <StatusBadge domain="appointment" status={a.status}>{apptStatusLabel(a.status, lang)}</StatusBadge>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(a.meetingWith === "job_developer" ? "/workforce/participants" : "/case-management")}
        >
          {t("viewLabel")}
        </Button>
      </div>
    </li>
  );
}

function ApptList({ items, lang, navigate, t, empty }) {
  if (!items.length) return empty;
  return (
    <ul className="m-0 list-none divide-y divide-line-subtle p-0">
      {items.map((a) => <ApptRow a={a} lang={lang} navigate={navigate} t={t} key={a.id} />)}
    </ul>
  );
}

export default function MyCaseload() {
  const { data, lang, session } = useApp();
  const t = useT();
  const navigate = useNavigate();

  const myEmail = (session && session.currentUserEmail || "").toLowerCase();
  const mine = (data.appointments || []).filter((a) => (a.assignedEmail || "").toLowerCase() === myEmail);
  const today = todayStr();

  const upcoming = mine
    .filter((a) => a.status === "scheduled" && a.date >= today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
    .slice(0, 10);
  const needsScheduling = mine
    .filter((a) => a.status === "requested")
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const overdue = mine
    .filter((a) => a.status === "scheduled" && a.date < today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  const myClientCount = new Set(
    mine.map((a) => a.clientId || (a.firstName + " " + a.lastName).toLowerCase())
  ).size;

  return (
    <>
      <PageHeader title={t("navMyCaseload")} description={t("myCaseloadSubtitle")} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("myCaseloadMyClientsLabel")} value={myClientCount} icon={Users} tone="info" />
        <KpiCard label={t("statUpcomingAppointmentsLabel")} value={upcoming.length} icon={CalendarClock} tone="violet" />
        <KpiCard label={t("myCaseloadNeedsSchedulingLabel")} value={needsScheduling.length} icon={CalendarPlus} tone="warning" />
        {/* Red is reserved for overdue work, so only this card uses danger. */}
        <KpiCard label={t("followUpOverdueLabel")} value={overdue.length} icon={AlertTriangle} tone={overdue.length ? "danger" : "neutral"} />
      </div>

      <div className="space-y-6">
        <SectionCard title={t("followUpOverdueLabel")}>
          <ApptList
            items={overdue} lang={lang} navigate={navigate} t={t}
            empty={<EmptyState compact icon={CalendarCheck} title={t("myCaseloadOverdueEmptyTitle")} description={t("myCaseloadOverdueEmptyHint")} />}
          />
        </SectionCard>

        <SectionCard title={t("myCaseloadNeedsSchedulingLabel")}>
          <ApptList
            items={needsScheduling} lang={lang} navigate={navigate} t={t}
            empty={<EmptyState compact icon={CalendarPlus} title={t("myCaseloadNeedsSchedulingEmptyTitle")} description={t("myCaseloadNeedsSchedulingEmptyHint")} />}
          />
        </SectionCard>

        <SectionCard title={t("statUpcomingAppointmentsLabel")}>
          <ApptList
            items={upcoming} lang={lang} navigate={navigate} t={t}
            empty={<EmptyState compact icon={CalendarClock} title={t("myCaseloadUpcomingEmptyTitle")} description={t("myCaseloadUpcomingEmptyHint")} />}
          />
        </SectionCard>
      </div>
    </>
  );
}
