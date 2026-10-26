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
import { ArrowLeft, CheckCircle2, ClipboardPen, FilePlus2, PenLine } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  createDraft, currentPeriodGroup, daysUntilDue, fetchMyExpectations, fetchReportHistory, fetchReports,
  fetchSchedules, fmtDueAt, fmtPeriod, localDateIn, reportPermissions
} from "../lib/staffReports.js";
import EmptyState from "../components/EmptyState.jsx";
import { SectionCard } from "../components/SectionCard.jsx";
import { Button } from "../components/ui/button.jsx";
import ReportForm from "../components/reports/ReportForm.jsx";
import { ReportContent, ReportHistory, ReportStatusBadge, TD, TH, fmtStamp, useProgramLabels } from "../components/reports/ReportParts.jsx";

const DEFAULT_TZ = "America/New_York";

function dueHint(dueAt, timeZone, overdue, t) {
  const days = daysUntilDue(dueAt, timeZone);
  if (overdue) return { text: t("srOverdueHint"), tone: "text-accent" };
  if (days < 0) return { text: t("srPastDeadline"), tone: "text-muted" };
  if (days === 0) return { text: t("srDueToday"), tone: "text-gold-ink" };
  if (days === 1) return { text: t("srDueTomorrow"), tone: "text-gold-ink" };
  return { text: t("srDueInDays").replace("{n}", days), tone: "text-muted" };
}

function ActionFor({ row, onCreate, onOpen, busy, t }) {
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
    <div className="mx-auto grid max-w-xl gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-card" role="status">
      <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
      <h1 className="m-0 text-xl font-bold text-card-foreground">{t("srSubmittedTitle")}</h1>
      <p className="!m-0 !text-sm text-card-foreground">{periodLabel} · {programsText}</p>
      <p className="!m-0 !text-sm text-muted">{t("srSubmittedAt")}: {fmtStamp(report.submittedAt, lang)}</p>
      <p className="!m-0 !text-sm text-muted">{t("srSubmittedNotified")}</p>
      <Button className="justify-self-center" onClick={onBack}>{t("srBackToMyReports")}</Button>
    </div>
  );
}

function ReportReadOnly({ report, history, periodLabel, programsText, onBack }) {
  const { lang } = useApp();
  const t = useT();
  return (
    <div className="grid gap-4">
      <Button variant="ghost" className="justify-self-start gap-1.5 px-2 text-muted" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("srBackToMyReports")}</Button>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-xl font-bold text-card-foreground">{periodLabel}</h1>
          <ReportStatusBadge status={report.status} />
        </div>
        <p className="!mb-0 !mt-1 !text-sm text-muted">{programsText} · {t("srSubmittedAt")}: {fmtStamp(report.submittedAt, lang)}</p>
        <div className="mt-5"><ReportContent content={report} /></div>
      </div>
      <SectionCard title={t("srHistory")}><ReportHistory history={history} /></SectionCard>
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

  if (loadError) return <SectionCard title={t("navMyReports")}><EmptyState icon="inbox" message={t("srLoadError")} /></SectionCard>;
  if (expectations === null) return null;

  // ---------- one report ----------
  if (reportId) {
    const report = reports.find((r) => r.id === reportId);
    if (!report) {
      return (
        <SectionCard title={t("navMyReports")} action={<Button variant="secondary" onClick={back}>{t("srBackToMyReports")}</Button>}>
          <EmptyState icon="inbox" message={t("srReportNotFound")} />
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
            window.scrollTo(0, 0);
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
  const reportRow = (r, actionLabel) => (
    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <div className="min-w-0">
        <div className="font-semibold text-card-foreground">{fmtPeriod(r.periodStart, r.periodEnd, lang)}</div>
        <div className="text-xs text-muted">{r.programs.length ? programsText(r.programs) : t("srNoProgramsYet")}</div>
      </div>
      <Button size="sm" className="gap-1.5" onClick={() => open(r.id)}><PenLine className="h-4 w-4" aria-hidden="true" /> {actionLabel}</Button>
    </li>
  );

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary"><ClipboardPen className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-xl font-bold text-card-foreground">{t("navMyReports")}</h1>
            <p className="!mb-0 !mt-1 !text-sm text-muted">{t("srMyReportsIntro")}</p>
          </div>
        </div>

        {!group ? (
          <div className="info-callout mt-5"><p className="!m-0 !text-sm">{t("srNotAssigned")}</p></div>
        ) : (
          <>
            <dl className="m-0 mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-background px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(notStartedYet ? "srNextPeriod" : "srCurrentPeriod")}</dt>
                <dd className="m-0 mt-1 text-base font-bold text-card-foreground">{fmtPeriod(group.start, group.end, lang)}</dd>
              </div>
              <div className="rounded-lg bg-background px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("srNextDeadline")}</dt>
                <dd className="m-0 mt-1 text-base font-bold text-card-foreground">{fmtDueAt(group.dueAt, tz, lang)}</dd>
              </div>
              <div className="rounded-lg bg-background px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("srStatus")}</dt>
                <dd className="m-0 mt-1 text-base font-bold text-card-foreground">
                  {t("srSubmittedCount").replace("{n}", group.rows.filter((r) => r.submittedAt).length).replace("{total}", group.rows.length)}
                </dd>
              </div>
            </dl>
            {notStartedYet && <p className="!mb-0 !mt-3 !text-sm text-muted">{t("srFirstPeriodStarts").replace("{date}", fmtPeriod(group.start, group.end, lang))}</p>}
            <ul className="m-0 mt-4 grid list-none gap-2 p-0">
              {group.rows.map((row) => {
                const hint = dueHint(row.dueAt, tz, row.overdue, t);
                return (
                  <li key={row.periodId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-card-foreground">{row.programs.length ? programsText(row.programs) : t("srYourReport")}</span>
                        <ReportStatusBadge status={row.status} overdue={row.overdue} />
                      </div>
                      <div className={"mt-0.5 text-xs " + (row.submittedAt ? "text-muted" : hint.tone)}>
                        {row.submittedAt ? t("srSubmittedAt") + ": " + fmtStamp(row.submittedAt, lang) : hint.text}
                      </div>
                    </div>
                    <ActionFor row={row} onCreate={create} onOpen={open} busy={busy} t={t} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {needsRevision.length > 0 && (
        <SectionCard title={t("srNeedsRevision")}>
          <ul className="m-0 grid list-none gap-2 p-0">{needsRevision.map((r) => reportRow(r, t("srReviseReport")))}</ul>
        </SectionCard>
      )}

      {owedEarlier.length > 0 && (
        <SectionCard title={t("srOwedEarlier")}>
          <ul className="m-0 grid list-none gap-2 p-0">
            {owedEarlier.map((row) => (
              <li key={row.periodId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-card-foreground">{fmtPeriod(row.periodStart, row.periodEnd, lang)}</span><ReportStatusBadge status={row.status} overdue /></div>
                  <div className="text-xs text-muted">{t("srDue")} {fmtDueAt(row.dueAt, tz, lang)}</div>
                </div>
                <ActionFor row={row} onCreate={create} onOpen={open} busy={busy} t={t} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {drafts.length > 0 && (
        <SectionCard title={t("srDrafts")}>
          <ul className="m-0 grid list-none gap-2 p-0">{drafts.map((r) => reportRow(r, t("srContinueDraft")))}</ul>
        </SectionCard>
      )}

      <SectionCard title={t("srHistory")}>
        {!submitted.length ? <EmptyState icon="inbox" message={t("srNoSubmittedYet")} /> : (
          <div className="overflow-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr><th className={TH}>{t("srReportingPeriod")}</th><th className={TH}>{t("srPrograms")}</th><th className={TH}>{t("srSubmitted")}</th><th className={TH}>{t("srStatus")}</th><th className={TH}><span className="sr-only">{t("srView")}</span></th></tr>
              </thead>
              <tbody>
                {submitted.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className={TD + " whitespace-nowrap"}>{fmtPeriod(r.periodStart, r.periodEnd, lang)}</td>
                    <td className={TD}>{programsText(r.programs)}</td>
                    <td className={TD + " whitespace-nowrap text-muted"}>{fmtStamp(r.submittedAt, lang)}</td>
                    <td className={TD}><ReportStatusBadge status={r.status} /></td>
                    <td className={TD + " text-right"}><Button size="sm" variant="secondary" onClick={() => open(r.id)}>{t("srView")}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
