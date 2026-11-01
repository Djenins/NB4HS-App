// MyReports.jsx -- every staff member's biweekly reports to the Executive
// Director (sidebar "My Reports"; plans/staff-reporting-architecture.md §3).
// /myreports leads with the current period: its deadline and the person's
// one report for it (across every program they worked on), with the one
// action that fits (create, continue, revise, view). Below that: reports
// sent back for revision, drafts, anything still owed from earlier periods,
// and history.
// /myreports/:id opens one report -- the form while it is editable, the
// read-only report and its review trail once it is not.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, FilePlus2, PenLine } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  createDraft, currentPeriodGroup, daysUntilDue, fetchMyExpectations, fetchReportHistory, fetchReports,
  fetchSchedules, fmtDueAt, fmtPeriod, localDateIn, reportPermissions
} from "../lib/staffReports.js";
import { Alert } from "../components/ui/alert.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { Skeleton } from "../components/ui/skeleton.jsx";
import ReportForm from "../components/reports/ReportForm.jsx";
import ReportAttachments from "../components/reports/ReportAttachments.jsx";
import { ReportContent, ReportHistory, ReportStatusBadge, fmtStamp, useProgramLabels } from "../components/reports/ReportParts.jsx";

const DEFAULT_TZ = "America/New_York";

function dueHint(dueAt, timeZone, overdue, t) {
  const days = daysUntilDue(dueAt, timeZone);
  if (overdue) return { text: t("srOverdueHint"), tone: "font-semibold text-tone-danger-ink" };
  if (days < 0) return { text: t("srPastDeadline"), tone: "text-muted" };
  if (days === 0) return { text: t("srDueToday"), tone: "font-semibold text-tone-warning-ink" };
  if (days === 1) return { text: t("srDueTomorrow"), tone: "font-semibold text-tone-warning-ink" };
  return { text: t("srDueInDays").replace("{n}", days), tone: "text-muted" };
}

// `notStarted`: the period lies ahead, and reports can't be started before
// it begins (t4) -- the card already says when it starts.
export function ActionFor({ row, onCreate, onOpen, busy, t, notStarted }) {
  if (!row.reportId && notStarted) return null;
  if (!row.reportId) {
    return <Button size="sm" className="gap-1.5" onClick={() => onCreate(row)} disabled={busy}><FilePlus2 className="h-4 w-4" aria-hidden="true" /> {t("srCreateReport")}</Button>;
  }
  if (row.status === "draft") return <Button size="sm" className="gap-1.5" onClick={() => onOpen(row.reportId)}><PenLine className="h-4 w-4" aria-hidden="true" /> {t("srContinueDraft")}</Button>;
  if (row.status === "revision_requested") return <Button size="sm" className="gap-1.5" onClick={() => onOpen(row.reportId)}><PenLine className="h-4 w-4" aria-hidden="true" /> {t("srReviseReport")}</Button>;
  return <Button size="sm" variant="secondary" onClick={() => onOpen(row.reportId)}>{t("srView")}</Button>;
}

function Submitted({ report, periodLabel, programsText, onBack }) {
  const { lang } = useApp();
  const t = useT();
  return (
    <Card className="mx-auto grid max-w-xl justify-items-center gap-3 p-6 text-center sm:p-8" role="status">
      <span className="flex h-12 w-12 items-center justify-center rounded-chip bg-tone-success-chip text-tone-success-ink">
        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="m-0 text-heading text-card-foreground">{t("srSubmittedTitle")}</h1>
      <p className="m-0 text-body text-card-foreground">{periodLabel} · {programsText}</p>
      <p className="m-0 text-ui tabular-nums text-muted">{t("srSubmittedAt")}: {fmtStamp(report.submittedAt, lang)}</p>
      <p className="m-0 text-ui text-muted">{t("srSubmittedNotified")}</p>
      <Button className="mt-2" onClick={onBack}>{t("srBackToMyReports")}</Button>
    </Card>
  );
}

function ReportReadOnly({ report, history, periodLabel, programsText, onBack }) {
  const { lang } = useApp();
  const t = useT();
  return (
    <div className="grid gap-6">
      <PageHeader
        className="mb-0"
        back={{ label: t("srBackToMyReports"), onClick: onBack }}
        title={periodLabel}
        meta={<><ReportStatusBadge status={report.status} /><span className="text-ui text-muted">{programsText} · {t("srSubmittedAt")}: <span className="tabular-nums">{fmtStamp(report.submittedAt, lang)}</span></span></>}
      />
      <SectionCard><ReportContent content={report} /></SectionCard>
      <SectionCard title={t("srAttachments")}><ReportAttachments report={report} editable={false} /></SectionCard>
      <SectionCard title={t("srHistory")}><ReportHistory history={history} /></SectionCard>
    </div>
  );
}

// Loading: the shape of the overview, not a blank page.
function OverviewSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <Skeleton className="h-16 w-full max-w-md" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function MyReports() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { session, lang, showToast } = useApp();
  const t = useT();
  const userId = session ? session.id : null;
  const [expectations, setExpectations] = useState(null);
  const [reports, setReports] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [history, setHistory] = useState(null);
  const [justSubmitted, setJustSubmitted] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    return Promise.all([fetchMyExpectations(), fetchReports({ staffId: userId }), fetchSchedules()])
      .then(([exp, reps, scheds]) => { setExpectations(exp); setReports(reps); setSchedules(scheds); setLoadError(false); })
      .catch((err) => { console.warn("My Reports load failed", err); setLoadError(true); });
  }
  useEffect(() => { if (userId) load(); }, [userId]);

  useEffect(() => {
    setHistory(null);
    if (reportId) fetchReportHistory(reportId).then(setHistory).catch(() => setHistory({ versions: [], reviews: [] }));
  }, [reportId]);

  const tz = (schedules.find((s) => s.active) || {}).timeZone || DEFAULT_TZ;
  const { label: programsText } = useProgramLabels();
  const open = (id) => { setJustSubmitted(null); navigate("/myreports/" + id); };
  const back = () => { setJustSubmitted(null); navigate("/myreports"); load(); };

  async function create(row) {
    setBusy(true);
    try {
      const draft = await createDraft(row.periodId, userId);
      setReports((prev) => [draft].concat(prev.filter((r) => r.id !== draft.id)));
      navigate("/myreports/" + draft.id);
    } catch (err) {
      console.warn("createDraft failed", err);
      showToast(t("srSaveError"));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <SectionCard><EmptyState variant="error" title={t("srLoadError")} /></SectionCard>;
  if (expectations === null) return <OverviewSkeleton />;

  // ---------- one report ----------
  if (reportId) {
    const report = reports.find((r) => r.id === reportId);
    if (!report) {
      return (
        <SectionCard>
          <EmptyState title={t("srReportNotFound")} action={<Button variant="secondary" onClick={back}>{t("srBackToMyReports")}</Button>} />
        </SectionCard>
      );
    }
    const periodLabel = fmtPeriod(report.periodStart, report.periodEnd, lang);
    if (justSubmitted && justSubmitted.id === report.id) {
      return <Submitted report={justSubmitted} periodLabel={periodLabel} programsText={programsText(justSubmitted.programs)} onBack={back} />;
    }
    if (reportPermissions(report, userId, false).canEdit) {
      if (history === null) return null;
      const lastRevision = history.reviews.filter((r) => r.action === "revision_requested").pop();
      return (
        <ReportForm
          key={report.id}
          report={report}
          periodLabel={periodLabel}
          dueLabel={fmtDueAt(report.dueAt, tz, lang)}
          revisionComment={report.status === "revision_requested" && lastRevision ? lastRevision.comment : ""}
          onSaved={(saved) => setReports((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))}
          onSubmitted={(submitted) => {
            setReports((prev) => prev.map((r) => (r.id === submitted.id ? submitted : r)));
            setJustSubmitted(submitted);
            // The floating content panel (Shell.jsx) scrolls, not the window.
            const panel = document.querySelector(".content-col--floating");
            if (panel) panel.scrollTo(0, 0); else window.scrollTo(0, 0);
          }}
          onDiscarded={() => { showToast(t("srDraftDiscarded")); back(); }}
          onBack={back}
        />
      );
    }
    return <ReportReadOnly report={report} history={history} periodLabel={periodLabel} programsText={programsText(report.programs)} onBack={back} />;
  }

  // ---------- overview ----------
  const today = localDateIn(tz);
  const group = currentPeriodGroup(expectations, today);
  const notStartedYet = group && group.start > today;
  const owedEarlier = expectations.filter((e) => e.overdue && (!group || e.periodId !== group.periodId) && (e.status === "not_started" || e.status === "draft"));
  const needsRevision = reports.filter((r) => r.status === "revision_requested");
  const drafts = reports.filter((r) => r.status === "draft" && !owedEarlier.some((e) => e.reportId === r.id));
  const submitted = reports.filter((r) => r.submittedAt)
    .sort((a, b) => (b.periodStart || "").localeCompare(a.periodStart || "") || (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  // Rows inside a card are divided, not boxed (no card in a card).
  const reportRow = (r, actionLabel) => (
    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-ui font-semibold tabular-nums text-card-foreground">{fmtPeriod(r.periodStart, r.periodEnd, lang)}</div>
        <div className="text-meta text-muted">{r.programs.length ? programsText(r.programs) : t("srNoProgramsYet")}</div>
      </div>
      <Button size="sm" className="gap-1.5" onClick={() => open(r.id)}><PenLine className="h-4 w-4" aria-hidden="true" /> {actionLabel}</Button>
    </li>
  );
  const LIST = "m-0 list-none divide-y divide-line-subtle p-0";

  return (
    <div className="grid gap-6">
      <PageHeader className="mb-0" title={t("navMyReports")} description={t("srMyReportsIntro")} />

      {!group ? (
        <Alert tone="info">{t("srNotAssigned")}</Alert>
      ) : (
        <SectionCard title={t(notStartedYet ? "srNextPeriod" : "srCurrentPeriod")}>
          <dl className="m-0 grid gap-3 sm:grid-cols-3">
            {[
              [t("srReportingPeriod"), fmtPeriod(group.start, group.end, lang)],
              [t("srNextDeadline"), fmtDueAt(group.dueAt, tz, lang)],
              [t("srStatus"), t("srSubmittedCount").replace("{n}", group.rows.filter((r) => r.submittedAt).length).replace("{total}", group.rows.length)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-control bg-surface-sunken px-4 py-3">
                <dt className="text-meta font-semibold text-muted">{label}</dt>
                <dd className="m-0 mt-1 text-section tabular-nums text-card-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {notStartedYet && <p className="m-0 mt-3 text-ui text-muted">{t("srFirstPeriodStarts").replace("{date}", fmtPeriod(group.start, group.end, lang))}</p>}
          <ul className={LIST + " mt-4 border-t border-line-subtle"}>
            {group.rows.map((row) => {
              const hint = dueHint(row.dueAt, tz, row.overdue, t);
              return (
                <li key={row.periodId} className="flex flex-wrap items-center justify-between gap-3 py-3 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-card-foreground">{row.programs.length ? programsText(row.programs) : t("srYourReport")}</span>
                      <ReportStatusBadge status={row.status} overdue={row.overdue} />
                    </div>
                    <div className={"mt-0.5 text-meta tabular-nums " + (row.submittedAt ? "text-muted" : hint.tone)}>
                      {row.submittedAt ? t("srSubmittedAt") + ": " + fmtStamp(row.submittedAt, lang) : hint.text}
                    </div>
                  </div>
                  <ActionFor row={row} onCreate={create} onOpen={open} busy={busy} t={t} notStarted={notStartedYet} />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {needsRevision.length > 0 && (
        <SectionCard title={t("srNeedsRevision")}>
          <ul className={LIST}>{needsRevision.map((r) => reportRow(r, t("srReviseReport")))}</ul>
        </SectionCard>
      )}

      {owedEarlier.length > 0 && (
        <SectionCard title={t("srOwedEarlier")}>
          <ul className={LIST}>
            {owedEarlier.map((row) => (
              <li key={row.periodId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-ui font-semibold tabular-nums text-card-foreground">{fmtPeriod(row.periodStart, row.periodEnd, lang)}</span><ReportStatusBadge status={row.status} overdue /></div>
                  <div className="text-meta tabular-nums text-muted">{t("srDue")} {fmtDueAt(row.dueAt, tz, lang)}</div>
                </div>
                <ActionFor row={row} onCreate={create} onOpen={open} busy={busy} t={t} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {drafts.length > 0 && (
        <SectionCard title={t("srDrafts")}>
          <ul className={LIST}>{drafts.map((r) => reportRow(r, t("srContinueDraft")))}</ul>
        </SectionCard>
      )}

      <SectionCard title={t("srHistory")}>
        <DataTable
          caption={t("srHistory")}
          columns={[
            { key: "period", header: t("srReportingPeriod"), cell: (r) => fmtPeriod(r.periodStart, r.periodEnd, lang), className: "whitespace-nowrap font-semibold" },
            { key: "programs", header: t("srPrograms"), cell: (r) => programsText(r.programs) },
            { key: "submitted", header: t("srSubmitted"), cell: (r) => fmtStamp(r.submittedAt, lang), className: "whitespace-nowrap text-muted" },
            { key: "status", header: t("srStatus"), cell: (r) => <ReportStatusBadge status={r.status} /> },
            { key: "view", header: <span className="sr-only">{t("srView")}</span>, className: "text-right", cell: (r) => <Button size="sm" variant="secondary" onClick={() => open(r.id)}>{t("srView")}</Button> }
          ]}
          rows={submitted}
          getRowId={(r) => r.id}
          renderCard={(r) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-ui font-semibold tabular-nums text-card-foreground">{fmtPeriod(r.periodStart, r.periodEnd, lang)}</div>
                <div className="text-meta text-muted">{programsText(r.programs)}</div>
                <div className="text-meta tabular-nums text-muted">{t("srSubmitted")}: {fmtStamp(r.submittedAt, lang)}</div>
                <div className="mt-1.5"><ReportStatusBadge status={r.status} /></div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => open(r.id)}>{t("srView")}</Button>
            </div>
          )}
          empty={<EmptyState compact title={t("srNoSubmittedYet")} />}
        />
      </SectionCard>
    </div>
  );
}
