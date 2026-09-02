// MyCaseload.jsx -- "my clients today" view for case managers/job
// developers (and administrators, who can see it for oversight). There's no
// per-client staff-assignment column in the schema (case_clients/job_clients
// aren't owned by a specific staffer), so "my caseload" is derived entirely
// from `appointments.assignedEmail` -- the one place staff assignment
// already exists (see AppointmentsSection.jsx). Same Tailwind/shadcn idiom
// as CaseManagement.jsx/Dashboard.jsx.
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, CalendarPlus, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusBadgeClass, apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import EmptyState from "../components/EmptyState.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";

function KpiStat({ icon: Icon, tint, iconColor, label, value }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tint)}>
          <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold tracking-tight text-card-foreground">{value}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-muted">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApptRow({ a, lang, navigate }) {
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ");
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate font-semibold text-card-foreground">{name}</div>
        <div className="truncate text-xs text-muted">
          {fmtDateLong(a.date, lang)}{a.time ? " · " + a.time : ""} · {meetingWithLabel(a.meetingWith, lang)}
        </div>
        {a.reason ? <div className="mt-0.5 truncate text-xs text-muted">{a.reason}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("badge", apptStatusBadgeClass(a.status))}>{apptStatusLabel(a.status, lang)}</span>
        <Button
          variant="secondary"
          className="h-8 px-3 text-xs"
          onClick={() => navigate(a.meetingWith === "job_developer" ? "/jobdeveloper" : "/casemanagement")}
        >
          View
        </Button>
      </div>
    </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-card-foreground">{t("navMyCaseload")}</h1>
        <p className="mt-1 text-sm text-muted">Appointments assigned to you across Case Management and Workforce, at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStat icon={Users} tint="bg-primary-tint" iconColor="text-primary" value={myClientCount} label="My Clients" />
        <KpiStat icon={CalendarClock} tint="bg-tint-success" iconColor="text-success" value={upcoming.length} label="Upcoming Appointments" />
        <KpiStat icon={CalendarPlus} tint="bg-gold-tint" iconColor="text-gold-dark" value={needsScheduling.length} label="Needs Scheduling" />
        <KpiStat icon={AlertTriangle} tint="bg-tint-warn" iconColor="text-gold-ink" value={overdue.length} label="Overdue" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-gold-ink" /> Overdue</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {overdue.length ? (
            overdue.map((a) => <ApptRow a={a} lang={lang} navigate={navigate} key={a.id} />)
          ) : (
            <EmptyState icon="clock" message="Nothing overdue -- every scheduled appointment assigned to you is either upcoming or already completed." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarPlus className="h-4 w-4 text-gold-dark" /> Needs Scheduling</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {needsScheduling.length ? (
            needsScheduling.map((a) => <ApptRow a={a} lang={lang} navigate={navigate} key={a.id} />)
          ) : (
            <EmptyState icon="calendar" message="No client requests are waiting on you to schedule a time." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-success" /> Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {upcoming.length ? (
            upcoming.map((a) => <ApptRow a={a} lang={lang} navigate={navigate} key={a.id} />)
          ) : (
            <EmptyState icon="calendar" message="You have no upcoming appointments." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
