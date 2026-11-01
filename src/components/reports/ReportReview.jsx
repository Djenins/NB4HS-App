// ReportReview.jsx -- one submitted report, for a reviewer. Reads the
// frozen submission (staff_report_versions), never the author's work in
// progress, with a picker for earlier versions after a revision. Opening a
// newly submitted report marks it "Under review". Acknowledge (optional
// comment) and Request revision (comment required) go through the review
// RPCs, which also notify the author in the app. Holders of
// staff_reports.view_all without .review read only.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Printer, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  acknowledgeReport, fetchReport, fetchReportHistory, fetchReports, fetchSchedules, fmtDueAt, fmtPeriod,
  reportPermissions, requestRevision, startReview
} from "../../lib/staffReports.js";
import { Alert } from "../ui/alert.jsx";
import { Button } from "../ui/button.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Select, Textarea } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { ReportContent, ReportFacts, ReportHistory, ReportStatusBadge, fmtStamp, useProgramLabels } from "./ReportParts.jsx";
import ReportAttachments from "./ReportAttachments.jsx";

export default function ReportReview({ reportId }) {
  const { data, lang, session, showToast, can } = useApp();
  const reviews = can("staff_reports.review");
  const t = useT();
  const navigate = useNavigate();
  const userId = session ? session.id : null;
  const [report, setReport] = useState(undefined);
  const [history, setHistory] = useState(null);
  const { label: programsText } = useProgramLabels();
  const [tz, setTz] = useState("America/New_York");
  const [previous, setPrevious] = useState([]);
  const [shownVersion, setShownVersion] = useState(null);
  const [mode, setMode] = useState(null); // "acknowledge" | "revision"
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function load() {
    try {
      const [r, h, s] = await Promise.all([fetchReport(reportId), fetchReportHistory(reportId), fetchSchedules()]);
      setTz((s.find((x) => x.active) || s[0] || {}).timeZone || "America/New_York");
      setHistory(h);
      setReport(r);
      if (r) fetchReports({ staffId: r.staffId, submittedOnly: true }).then((rows) => setPrevious(rows.filter((x) => x.id !== r.id))).catch(() => {});
      return r;
    } catch (err) {
      console.warn("ReportReview load failed", err);
      setReport(null);
      return null;
    }
  }

  useEffect(() => {
    started.current = false;
    setShownVersion(null);
    setMode(null);
    load().then((r) => {
      if (reviews && r && r.status === "submitted" && r.staffId !== userId && !started.current) {
        started.current = true;
        startReview(r.id).then((updated) => { setReport(updated); return fetchReportHistory(r.id).then(setHistory); }).catch(() => {});
      }
    });
  }, [reportId]);

  if (report === undefined) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!report) {
    return (
      <SectionCard>
        <EmptyState title={t("srReportNotFound")} action={<Button variant="secondary" onClick={() => navigate("/staffreports")}>{t("srBackToStaffReports")}</Button>} />
      </SectionCard>
    );
  }

  const perms = reportPermissions(report, userId, reviews);
  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : "—"; };
  const versions = history ? history.versions : [];
  const version = versions.find((v) => v.version === shownVersion) || versions[0] || null;

  async function act() {
    if (mode === "revision" && !comment.trim()) return;
    setBusy(true);
    try {
      const updated = mode === "revision" ? await requestRevision(report.id, comment.trim()) : await acknowledgeReport(report.id, comment.trim());
      setReport(updated);
      setHistory(await fetchReportHistory(report.id));
      showToast(t(mode === "revision" ? "srRevisionSent" : "srAcknowledged"));
      setMode(null);
      setComment("");
    } catch (err) {
      console.warn("review action failed", err);
      showToast(t("srActionError"));
    } finally {
      setBusy(false);
    }
  }

  const programsShown = programsText(version && (version.content.programs || []).length ? version.content.programs : report.programs);

  // Review template: the frozen report on the left, the reviewer's actions
  // and context in a narrower column on the right (stacked below lg).
  return (
    <div className="grid gap-6">
      <PageHeader
        className="mb-0"
        back={{ label: t("srBackToStaffReports"), onClick: () => navigate("/staffreports") }}
        title={nameOf(report.staffId)}
        meta={<ReportStatusBadge status={report.status} />}
        actions={<Button variant="secondary" size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" /> {t("srPrint")}</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard>
          <ReportFacts items={[
            [t("srPrograms"), programsShown],
            version && (version.content.positions || []).length ? [t("srPositions"), version.content.positions.join(", ")] : null,
            [t("srReportingPeriod"), fmtPeriod(report.periodStart, report.periodEnd, lang)],
            [t("srDue"), fmtDueAt(report.dueAt, tz, lang)],
            [t("srSubmitted"), fmtStamp(version ? version.submittedAt : report.submittedAt, lang)]
          ]} />

          {versions.length > 1 && (
            <Field className="mt-4 max-w-xs print:hidden" label={t("srShowingVersion")} htmlFor="report-version">
              <Select id="report-version" value={version ? version.version : ""} onChange={(e) => setShownVersion(Number(e.target.value))}>
                {versions.map((v, i) => (
                  <option key={v.version} value={v.version}>{t("srVersionN").replace("{n}", v.version)}{i === 0 ? " · " + t("srLatest") : ""}</option>
                ))}
              </Select>
            </Field>
          )}
          {report.status === "revision_requested" && <Alert tone="warning" className="mt-4">{t("srAwaitingResubmission")}</Alert>}

          <div className="mt-6 border-t border-line-subtle pt-6">{version ? <ReportContent content={version.content} /> : <EmptyState compact title={t("srNoHistory")} />}</div>
        </SectionCard>

        <div className="grid content-start gap-6 print:hidden">
          {(perms.canAcknowledge || perms.canRequestRevision) && (
            <SectionCard title={t("srReviewAction")}>
              {!mode ? (
                <div className="grid gap-2">
                  <Button className="gap-1.5" onClick={() => setMode("acknowledge")}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("srAcknowledge")}</Button>
                  <Button variant="secondary" className="gap-1.5" onClick={() => setMode("revision")}><RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("srRequestRevision")}</Button>
                </div>
              ) : (
                <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); act(); }}>
                  <Field label={t(mode === "revision" ? "srRevisionComment" : "srAckComment")} htmlFor="review-comment"
                    hint={t("srCommentVisibleToAuthor")} required={mode === "revision"}>
                    <Textarea id="review-comment" rows={5} maxLength={4000} value={comment} onChange={(e) => setComment(e.target.value)}
                      aria-describedby="review-comment-hint" className="resize-y" required={mode === "revision"} autoFocus />
                  </Field>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => { setMode(null); setComment(""); }} disabled={busy}>{t("cancelLabel")}</Button>
                    <Button type="submit" disabled={busy || (mode === "revision" && !comment.trim())}>
                      {t(mode === "revision" ? "srSendBack" : "srAcknowledge")}
                    </Button>
                  </div>
                </form>
              )}
            </SectionCard>
          )}

          <SectionCard title={t("srAttachments")}><ReportAttachments report={report} editable={false} /></SectionCard>

          <SectionCard title={t("srHistory")}><ReportHistory history={history} /></SectionCard>

          <SectionCard title={t("srPreviousReports")} flush={previous.length > 0}>
            {!previous.length ? <p className="m-0 text-ui text-muted">{t("srNoPreviousReports")}</p> : (
              <ul className="m-0 list-none divide-y divide-line-subtle border-t border-line-subtle p-0">
                {previous.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => navigate("/staffreports/" + r.id)}
                      className="flex min-h-0 w-full items-center justify-between gap-2 border-0 bg-transparent px-5 py-3 text-left font-normal transform-none transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-6">
                      <span className="min-w-0">
                        <span className="block text-ui font-semibold tabular-nums text-card-foreground">{fmtPeriod(r.periodStart, r.periodEnd, lang)}</span>
                        <span className="block text-meta text-muted">{programsText(r.programs)}</span>
                      </span>
                      <ReportStatusBadge status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
