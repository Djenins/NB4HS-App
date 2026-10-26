// ReportForm.jsx -- the staff member's own report, while it is a draft or
// has been sent back for revision. Saves on its own a few seconds after
// typing stops (and on "Save draft"), checks required fields the same way
// submit_staff_report() does, and asks for confirmation before submitting.
// "Programs worked on" offers the programs the author can open plus
// organization-wide work (my_report_program_options); at least one is needed.
// The submit button stays disabled while a request is in flight, and the
// database refuses a second submission anyway.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  ORGANIZATION, OUTCOMES_MAX, REPORT_TEXT_MAX, discardDraft, fetchMyProgramOptions, missingFields, reportPermissions, saveDraft, submitReport
} from "../../lib/staffReports.js";
import { fmtTime } from "../../lib/utils.js";
import { Button } from "../ui/button.jsx";
import { REPORT_CONTROL, useProgramLabels } from "./ReportParts.jsx";
import ReportAttachments from "./ReportAttachments.jsx";

const AUTOSAVE_MS = 3000;
const FIELDS = [
  { key: "activities", label: "srFieldActivities", help: "srHelpActivities", required: true },
  { key: "accomplishments", label: "srFieldAccomplishments", help: "srHelpAccomplishments", required: true },
  { key: "challenges", label: "srFieldChallenges", help: "srHelpChallenges", required: true },
  { key: "assistanceNeeded", label: "srFieldAssistance", help: "srHelpAssistance", required: true },
  { key: "nextGoals", label: "srFieldNextGoals", help: "srHelpNextGoals", required: true },
  { key: "comments", label: "srFieldComments", help: null, required: false }
];

const PROGRAMS_FIELD = { key: "programs", label: "srFieldPrograms" };

function pickFields(report) {
  return {
    programs: report.programs || [],
    activities: report.activities, accomplishments: report.accomplishments, challenges: report.challenges,
    assistanceNeeded: report.assistanceNeeded, noAssistanceNeeded: report.noAssistanceNeeded,
    nextGoals: report.nextGoals, comments: report.comments, outcomes: report.outcomes.length ? report.outcomes : []
  };
}

function TextArea({ field, value, onChange, invalid, disabled, t }) {
  const id = "report-" + field.key;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={"text-sm font-semibold text-card-foreground" + (field.required ? " required" : "")}>{t(field.label)}</label>
      {field.help && <p id={id + "-help"} className="!m-0 !text-xs text-muted">{t(field.help)}</p>}
      <textarea
        id={id} rows={4} maxLength={REPORT_TEXT_MAX} value={value} disabled={disabled}
        aria-invalid={invalid || undefined} aria-describedby={field.help ? id + "-help" : undefined}
        className={REPORT_CONTROL + " min-h-[96px] resize-y py-2 leading-relaxed" + (invalid ? " field-invalid" : "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// The programs the author picked earlier but can no longer open stay listed,
// so unticking them is possible; the database refuses adding new ones.
function ProgramsField({ value, options, invalid, disabled, onChange }) {
  const t = useT();
  const { label } = useProgramLabels();
  const shown = options.concat(value.filter((k) => options.indexOf(k) === -1));
  return (
    <fieldset id="report-programs" tabIndex={-1} className="m-0 grid min-w-0 gap-2 border-0 p-0" aria-invalid={invalid || undefined}>
      <legend className="required mb-1 text-sm font-semibold text-card-foreground">{t("srFieldPrograms")}</legend>
      <p className="!m-0 !text-xs text-muted">{t("srHelpPrograms")}</p>
      <div className={"flex flex-wrap gap-2 rounded-lg" + (invalid ? " field-invalid p-2" : "")}>
        {shown.map((k) => {
          const on = value.indexOf(k) !== -1;
          return (
            <label key={k} className={"flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm " + (on ? "border-primary bg-primary-tint text-card-foreground" : "border-border text-card-foreground")}>
              <input type="checkbox" checked={on} disabled={disabled} onChange={() => onChange(on ? value.filter((x) => x !== k) : value.concat([k]))} />
              {k === ORGANIZATION ? t("srOrganizationWide") : label([k])}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ReportForm({ report, periodLabel, dueLabel, revisionComment, onSaved, onSubmitted, onDiscarded, onBack }) {
  const { session, requestConfirm, showToast } = useApp();
  const t = useT();
  const perms = reportPermissions(report, session ? session.id : null, false);
  const [fields, setFields] = useState(() => pickFields(report));
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState({ status: "idle", at: report.updatedAt });
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);
  const [programOptions, setProgramOptions] = useState([ORGANIZATION]);
  useEffect(() => { fetchMyProgramOptions().then(setProgramOptions).catch(() => {}); }, []);

  const missing = missingFields(fields);

  async function persist() {
    setSaveState((s) => ({ status: "saving", at: s.at }));
    try {
      const saved = await saveDraft(report.id, fields);
      setDirty(false);
      setSaveState({ status: "saved", at: saved.updatedAt });
      onSaved(saved);
      return saved;
    } catch (err) {
      console.warn("saveDraft failed", err);
      setSaveState((s) => ({ status: "error", at: s.at }));
      throw err;
    }
  }

  // Autosave a few seconds after the last change.
  useEffect(() => {
    if (!dirty || busy) return undefined;
    pending.current = setTimeout(() => { persist().catch(() => {}); }, AUTOSAVE_MS);
    return () => clearTimeout(pending.current);
  }, [fields, dirty, busy]);

  // Warn before leaving the page with unsaved typing.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set(key, value) {
    setFields((f) => Object.assign({}, f, { [key]: value }));
    setDirty(true);
  }
  function setOutcome(i, key, value) {
    set("outcomes", fields.outcomes.map((o, j) => (j === i ? Object.assign({}, o, { [key]: value }) : o)));
  }

  async function saveNow() {
    clearTimeout(pending.current);
    try { await persist(); showToast(t("srDraftSaved")); } catch (e) { showToast(t("srSaveError")); }
  }

  async function submit() {
    if (missing.length) {
      setShowErrors(true);
      const first = document.getElementById("report-" + missing[0]);
      if (first) first.focus();
      return;
    }
    const ok = await requestConfirm(t("srSubmitConfirmPeriod").replace("{period}", periodLabel));
    if (!ok) return;
    clearTimeout(pending.current);
    setBusy(true);
    try {
      if (dirty) await persist();
      const submitted = await submitReport(report.id);
      onSubmitted(submitted);
    } catch (err) {
      console.warn("submitReport failed", err);
      showToast(t("srSubmitError"));
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    const ok = await requestConfirm(t("srDiscardConfirm"), { danger: true });
    if (!ok) return;
    clearTimeout(pending.current);
    try { await discardDraft(report.id); onDiscarded(); } catch (e) { showToast(t("srSaveError")); }
  }

  const saveText = saveState.status === "saving" ? t("srSaving")
    : saveState.status === "error" ? t("srSaveError")
    : dirty ? t("srUnsavedChanges")
    : saveState.at ? t("srSavedAt").replace("{time}", fmtTime(saveState.at)) : "";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="gap-1.5 px-2 text-muted" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("srBackToMyReports")}</Button>
        <span className={"text-xs " + (saveState.status === "error" ? "font-semibold text-accent" : "text-muted")} role="status" aria-live="polite">{saveText}</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h1 className="m-0 text-xl font-bold text-card-foreground">{t(report.status === "revision_requested" ? "srReviseTitle" : "srReportTitle")}</h1>
        <dl className="m-0 mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2"><dt className="text-muted">{t("srStaffMember")}:</dt><dd className="m-0 font-semibold text-card-foreground">{session ? session.currentUserName || session.currentUserEmail : ""}</dd></div>
          <div className="flex gap-2"><dt className="text-muted">{t("srReportingPeriod")}:</dt><dd className="m-0 font-semibold text-card-foreground">{periodLabel}</dd></div>
          <div className="flex gap-2"><dt className="text-muted">{t("srDue")}:</dt><dd className="m-0 font-semibold text-card-foreground">{dueLabel}</dd></div>
        </dl>

        {revisionComment && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-tint px-4 py-3" role="note">
            <p className="!m-0 !text-xs font-semibold uppercase tracking-wide text-accent">{t("srRevisionRequestedBy")}</p>
            <p className="!mb-0 !mt-1 whitespace-pre-wrap !text-sm text-card-foreground">{revisionComment}</p>
          </div>
        )}

        <div className="info-callout mt-4"><p className="!m-0 !text-xs">{t("srPrivacyNote")}</p></div>

        {showErrors && missing.length > 0 && (
          <div role="alert" className="mt-4 rounded-lg border border-accent-soft bg-accent-tint px-4 py-3 text-sm text-card-foreground">
            <strong className="text-accent">{t("srMissingFields")}</strong> {missing.map((f) => t(FIELDS.concat([PROGRAMS_FIELD]).find((x) => x.key === f).label)).join(", ")}
          </div>
        )}

        <form className="mt-5 grid gap-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <ProgramsField value={fields.programs} options={programOptions} disabled={busy}
            invalid={showErrors && missing.indexOf("programs") !== -1} onChange={(v) => set("programs", v)} />
          {FIELDS.slice(0, 2).map((f) => (
            <TextArea key={f.key} field={f} value={fields[f.key]} onChange={(v) => set(f.key, v)} disabled={!perms.canEdit || busy}
              invalid={showErrors && missing.indexOf(f.key) !== -1} t={t} />
          ))}

          <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-semibold text-card-foreground">{t("srFieldOutcomes")}</legend>
            <p className="!m-0 !text-xs text-muted">{t("srHelpOutcomes")}</p>
            {fields.outcomes.map((o, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end sm:border-0 sm:p-0">
                <div className="grid gap-1">
                  <label htmlFor={"outcome-metric-" + i} className="text-xs font-semibold text-muted">{t("srOutcomeMetric")}</label>
                  <input id={"outcome-metric-" + i} className={REPORT_CONTROL + " h-10"} value={o.metric} maxLength={200}
                    placeholder={t("srOutcomeMetricPlaceholder")} onChange={(e) => setOutcome(i, "metric", e.target.value)} disabled={busy} />
                </div>
                <div className="grid gap-1">
                  <label htmlFor={"outcome-value-" + i} className="text-xs font-semibold text-muted">{t("srOutcomeValue")}</label>
                  <input id={"outcome-value-" + i} className={REPORT_CONTROL + " h-10"} value={o.value} maxLength={60}
                    placeholder="12" onChange={(e) => setOutcome(i, "value", e.target.value)} disabled={busy} />
                </div>
                <div className="grid gap-1">
                  <label htmlFor={"outcome-notes-" + i} className="text-xs font-semibold text-muted">{t("srOutcomeNotes")}</label>
                  <input id={"outcome-notes-" + i} className={REPORT_CONTROL + " h-10"} value={o.notes} maxLength={300}
                    placeholder={t("srOutcomeNotesPlaceholder")} onChange={(e) => setOutcome(i, "notes", e.target.value)} disabled={busy} />
                </div>
                <Button type="button" variant="ghost" className="h-10 w-10 justify-self-end text-muted hover:text-accent" aria-label={t("srRemoveOutcome")}
                  onClick={() => set("outcomes", fields.outcomes.filter((_, j) => j !== i))} disabled={busy}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            {fields.outcomes.length < OUTCOMES_MAX && (
              <Button type="button" variant="secondary" size="sm" className="justify-self-start gap-1.5"
                onClick={() => set("outcomes", fields.outcomes.concat([{ metric: "", value: "", notes: "" }]))} disabled={busy}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("srAddOutcome")}
              </Button>
            )}
          </fieldset>

          {FIELDS.slice(2, 3).map((f) => (
            <TextArea key={f.key} field={f} value={fields[f.key]} onChange={(v) => set(f.key, v)} disabled={busy}
              invalid={showErrors && missing.indexOf(f.key) !== -1} t={t} />
          ))}

          <div className="grid gap-2">
            <TextArea field={FIELDS[3]} value={fields.assistanceNeeded} onChange={(v) => set("assistanceNeeded", v)}
              disabled={busy || (fields.noAssistanceNeeded && !fields.assistanceNeeded)}
              invalid={showErrors && missing.indexOf("assistanceNeeded") !== -1} t={t} />
            <label className="flex items-center gap-2 text-sm text-card-foreground">
              <input type="checkbox" checked={fields.noAssistanceNeeded} disabled={busy} onChange={(e) => set("noAssistanceNeeded", e.target.checked)} />
              {t("srNoAssistanceNeeded")}
            </label>
          </div>

          {FIELDS.slice(4).map((f) => (
            <TextArea key={f.key} field={f} value={fields[f.key]} onChange={(v) => set(f.key, v)} disabled={busy}
              invalid={showErrors && missing.indexOf(f.key) !== -1} t={t} />
          ))}

          <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-semibold text-card-foreground">{t("srAttachments")}</legend>
            <ReportAttachments report={report} editable={!busy} />
          </fieldset>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {perms.canDiscard && (
                <Button type="button" variant="ghost" className="gap-1.5 text-accent hover:bg-tint-danger" onClick={discard} disabled={busy}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("srDiscardDraft")}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={saveNow} disabled={busy || saveState.status === "saving"}>{t("srSaveDraft")}</Button>
              <Button type="submit" className="gap-1.5" disabled={busy}>
                <Send className="h-4 w-4" aria-hidden="true" /> {busy ? t("srSubmitting") : t(report.status === "revision_requested" ? "srResubmit" : "srSubmitReport")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
