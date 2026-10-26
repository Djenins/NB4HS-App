// ReportReview.jsx -- one submitted report, for a reviewer. Reads the
// frozen submission (staff_report_versions), never the author's work in
// progress, with a picker for earlier versions after a revision. Opening a
// newly submitted report marks it "Under review". Acknowledge (optional
// comment) and Request revision (comment required) go through the review
// RPCs, which also notify the author in the app. Holders of
// staff_reports.view_all without .review read only.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Printer, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  acknowledgeReport, fetchReport, fetchReportHistory, fetchReports, fetchSchedules, fmtDueAt, fmtPeriod,
  reportPermissions, requestRevision, startReview
} from "../../lib/staffReports.js";
import EmptyState from "../EmptyState.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Button } from "../ui/button.jsx";
import { REPORT_CONTROL, ReportContent, ReportHistory, ReportStatusBadge, fmtStamp, useProgramLabels } from "./ReportParts.jsx";
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

  if (report === undefined) return null;
  if (!report) {
    return (
      <SectionCard title={t("navStaffReports")} action={<Button variant="secondary" onClick={() => navigate("/staffreports")}>{t("srBackToStaffReports")}</Button>}>
        <EmptyState icon="inbox" message={t("srReportNotFound")} />
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

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" className="gap-1.5 px-2 text-muted" onClick={() => navigate("/staffreports")}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("srBackToStaffReports")}</Button>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" /> {t("srPrint")}</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-xl font-bold text-card-foreground">{nameOf(report.staffId)}</h1>
            <ReportStatusBadge status={report.status} />
          </div>
          <dl className="m-0 mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-muted">{t("srPrograms")}:</dt><dd className="m-0 font-semibold text-card-foreground">{programsText(version && (version.content.programs || []).length ? version.content.programs : report.programs)}</dd></div>
            {version && (version.content.positions || []).length ? (
              <div className="flex gap-2"><dt className="text-muted">{t("srPositions")}:</dt><dd className="m-0 text-card-foreground">{version.content.positions.join(", ")}</dd></div>
            ) : null}
            <div className="flex gap-2"><dt className="text-muted">{t("srReportingPeriod")}:</dt><dd className="m-0 font-semibold text-card-foreground">{fmtPeriod(report.periodStart, report.periodEnd, lang)}</dd></div>
            <div className="flex gap-2"><dt className="text-muted">{t("srDue")}:</dt><dd className="m-0 text-card-foreground">{fmtDueAt(report.dueAt, tz, lang)}</dd></div>
            <div className="flex gap-2"><dt className="text-muted">{t("srSubmitted")}:</dt><dd className="m-0 text-card-foreground">{fmtStamp(version ? version.submittedAt : report.submittedAt, lang)}</dd></div>
          </dl>

          {versions.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
              <label htmlFor="report-version" className="text-xs font-semibold text-muted">{t("srShowingVersion")}</label>
              <select id="report-version" className={REPORT_CONTROL + " h-9 w-auto"} value={version ? version.version : ""}
                onChange={(e) => setShownVersion(Number(e.target.value))}>
                {versions.map((v, i) => (
                  <option key={v.version} value={v.version}>{t("srVersionN").replace("{n}", v.version)}{i === 0 ? " · " + t("srLatest") : ""}</option>
                ))}
              </select>
            </div>
          )}
          {report.status === "revision_requested" && <p className="!mb-0 !mt-3 !text-sm text-muted">{t("srAwaitingResubmission")}</p>}

          <div className="mt-5">{version ? <ReportContent content={version.content} /> : <EmptyState icon="inbox" message={t("srNoHistory")} />}</div>
        </div>

        <div className="grid content-start gap-4 print:hidden">
          {(perms.canAcknowledge || perms.canRequestRevision) && (
            <SectionCard title={t("srReviewAction")}>
              {!mode ? (
                <div className="grid gap-2">
                  <Button className="gap-1.5" onClick={() => setMode("acknowledge")}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("srAcknowledge")}</Button>
                  <Button variant="secondary" className="gap-1.5" onClick={() => setMode("revision")}><RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("srRequestRevision")}</Button>
                </div>
              ) : (
                <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); act(); }}>
                  <label htmlFor="review-comment" className={"text-sm font-semibold text-card-foreground" + (mode === "revision" ? " required" : "")}>
                    {t(mode === "revision" ? "srRevisionComment" : "srAckComment")}
                  </label>
                  <textarea id="review-comment" rows={5} maxLength={4000} value={comment} onChange={(e) => setComment(e.target.value)}
                    className={REPORT_CONTROL + " resize-y py-2"} required={mode === "revision"} autoFocus />
                  <p className="!m-0 !text-xs text-muted">{t("srCommentVisibleToAuthor")}</p>
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

          <SectionCard title={t("srPreviousReports")}>
            {!previous.length ? <p className="!m-0 !text-sm text-muted">{t("srNoPreviousReports")}</p> : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {previous.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => navigate("/staffreports/" + r.id)}
                      className="flex min-h-0 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-normal transform-none hover:border-primary">
                      <span className="min-w-0">
                        <span className="block font-semibold text-card-foreground">{fmtPeriod(r.periodStart, r.periodEnd, lang)}</span>
                        <span className="block text-xs text-muted">{programsText(r.programs)}</span>
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
