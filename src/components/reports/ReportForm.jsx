// ReportForm.jsx -- the staff member's own report, while it is a draft or
// has been sent back for revision. Saves on its own a few seconds after
// typing stops (and on "Save draft"), checks required fields the same way
// submit_staff_report() does, and asks for confirmation before submitting.
// "Programs worked on" offers the programs the author can open plus
// organization-wide work (my_report_program_options); at least one is needed.
// The submit button stays disabled while a request is in flight, and the
// database refuses a second submission anyway.
import { useEffect, useRef, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  ORGANIZATION, OUTCOMES_MAX, REPORT_TEXT_MAX, discardDraft, fetchMyProgramOptions, missingFields, reportPermissions, saveDraft, submitReport
} from "../../lib/staffReports.js";
import { fmtTime } from "../../lib/utils.js";
import { cn } from "../../lib/cn.js";
import { Alert } from "../ui/alert.jsx";
import { Button } from "../ui/button.jsx";
import { Field, Input, Textarea } from "../ui/field.jsx";
import { IconButton } from "../ui/icon-button.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { ReportFacts, useProgramLabels } from "./ReportParts.jsx";
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
    <Field label={t(field.label)} htmlFor={id} hint={field.help ? t(field.help) : null} required={field.required}>
      <Textarea
        id={id} rows={4} maxLength={REPORT_TEXT_MAX} value={value} disabled={disabled}
        aria-invalid={invalid || undefined} aria-describedby={field.help ? id + "-hint" : undefined}
        className="resize-y text-body"
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

// The programs the author picked earlier but can no longer open stay listed,
// so unticking them is possible; the database refuses adding new ones.
function ProgramsField({ value, options, invalid, disabled, onChange }) {
  const t = useT();
  const { label } = useProgramLabels();
  const shown = options.concat(value.filter((k) => options.indexOf(k) === -1));
  return (
    <fieldset id="report-programs" tabIndex={-1} className="m-0 grid min-w-0 gap-1.5 border-0 p-0" aria-invalid={invalid || undefined} aria-describedby="report-programs-hint">
      <legend className="mb-1.5 p-0 text-meta font-semibold text-card-foreground">
        {t("srFieldPrograms")}<span className="ml-0.5 text-tone-danger-ink" aria-hidden="true">*</span>
      </legend>
      <p id="report-programs-hint" className="m-0 text-meta text-muted">{t("srHelpPrograms")}</p>
      <div className={cn("mt-1 flex flex-wrap gap-2 rounded-control", invalid && "border border-tone-danger-border bg-tone-danger-bg p-2")}>
        {shown.map((k) => {
          const on = value.indexOf(k) !== -1;
          return (
            <label
              key={k}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-ui text-card-foreground transition-colors duration-fast [@media(pointer:coarse)]:min-h-11",
                on ? "border-primary bg-tone-info-bg" : "border-border bg-card hover:border-line-strong"
              )}
            >
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={on} disabled={disabled} onChange={() => onChange(on ? value.filter((x) => x !== k) : value.concat([k]))} />
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

  const textField = (f, extraDisabled) => (
    <TextArea key={f.key} field={f} value={fields[f.key]} onChange={(v) => set(f.key, v)} disabled={busy || extraDisabled}
      invalid={showErrors && missing.indexOf(f.key) !== -1} t={t} />
  );

  // Form-page template: PageHeader, SectionCards of Fields, then a footer
  // that stays in view while the long form scrolls (from sm; on a phone it
  // would cover a quarter of the screen, so it sits at the end).
  return (
    <form className="grid gap-6" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <PageHeader
        className="mb-0"
        back={{ label: t("srBackToMyReports"), onClick: onBack }}
        title={t(report.status === "revision_requested" ? "srReviseTitle" : "srReportTitle")}
        meta={
          <ReportFacts items={[
            [t("srStaffMember"), session ? session.currentUserName || session.currentUserEmail : ""],
            [t("srReportingPeriod"), periodLabel],
            [t("srDue"), dueLabel]
          ]} />
        }
      />

      {revisionComment && (
        <div role="note">
          <Alert tone="warning" title={t("srRevisionRequestedBy")}><span className="whitespace-pre-wrap">{revisionComment}</span></Alert>
        </div>
      )}
      <Alert tone="info">{t("srPrivacyNote")}</Alert>
      {showErrors && missing.length > 0 && (
        <Alert tone="danger" title={t("srMissingFields")}>
          {missing.map((f) => t(FIELDS.concat([PROGRAMS_FIELD]).find((x) => x.key === f).label)).join(", ")}
        </Alert>
      )}

      <SectionCard>
        <ProgramsField value={fields.programs} options={programOptions} disabled={busy}
          invalid={showErrors && missing.indexOf("programs") !== -1} onChange={(v) => set("programs", v)} />
      </SectionCard>

      <SectionCard>
        <div className="grid gap-6">
          {FIELDS.slice(0, 2).map((f) => textField(f, !perms.canEdit))}

          <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0" aria-describedby="report-outcomes-hint">
            <legend className="mb-1.5 p-0 text-meta font-semibold text-card-foreground">{t("srFieldOutcomes")}</legend>
            <p id="report-outcomes-hint" className="m-0 -mt-1.5 text-meta text-muted">{t("srHelpOutcomes")}</p>
            {fields.outcomes.length > 0 && (
              <ul className="m-0 list-none divide-y divide-line-subtle p-0 sm:divide-y-0">
                {fields.outcomes.map((o, i) => (
                  <li key={i} className="grid gap-3 py-3 first:pt-0 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end sm:py-1.5">
                    <Field label={t("srOutcomeMetric")} htmlFor={"outcome-metric-" + i}>
                      <Input id={"outcome-metric-" + i} value={o.metric} maxLength={200}
                        placeholder={t("srOutcomeMetricPlaceholder")} onChange={(e) => setOutcome(i, "metric", e.target.value)} disabled={busy} />
                    </Field>
                    <Field label={t("srOutcomeValue")} htmlFor={"outcome-value-" + i}>
                      <Input id={"outcome-value-" + i} className="tabular-nums" value={o.value} maxLength={60}
                        placeholder="12" onChange={(e) => setOutcome(i, "value", e.target.value)} disabled={busy} />
                    </Field>
                    <Field label={t("srOutcomeNotes")} htmlFor={"outcome-notes-" + i}>
                      <Input id={"outcome-notes-" + i} value={o.notes} maxLength={300}
                        placeholder={t("srOutcomeNotesPlaceholder")} onChange={(e) => setOutcome(i, "notes", e.target.value)} disabled={busy} />
                    </Field>
                    <IconButton type="button" variant="danger" size="lg" label={t("srRemoveOutcome")} className="justify-self-end"
                      onClick={() => set("outcomes", fields.outcomes.filter((_, j) => j !== i))} disabled={busy}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            {fields.outcomes.length < OUTCOMES_MAX && (
              <Button type="button" variant="secondary" size="sm" className="justify-self-start gap-1.5"
                onClick={() => set("outcomes", fields.outcomes.concat([{ metric: "", value: "", notes: "" }]))} disabled={busy}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("srAddOutcome")}
              </Button>
            )}
          </fieldset>

          {FIELDS.slice(2, 3).map((f) => textField(f))}

          <div className="grid gap-2.5">
            {textField(FIELDS[3], fields.noAssistanceNeeded && !fields.assistanceNeeded)}
            <label className="flex min-h-10 items-center gap-2 text-ui text-card-foreground">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={fields.noAssistanceNeeded} disabled={busy} onChange={(e) => set("noAssistanceNeeded", e.target.checked)} />
              {t("srNoAssistanceNeeded")}
            </label>
          </div>

          {FIELDS.slice(4).map((f) => textField(f))}
        </div>
      </SectionCard>

      <SectionCard title={t("srAttachments")}>
        <ReportAttachments report={report} editable={!busy} />
      </SectionCard>

      <div className="z-10 -mx-1 flex flex-col-reverse gap-3 rounded-surface border border-border bg-card px-4 py-3 shadow-raised sm:sticky sm:bottom-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {perms.canDiscard && (
            <Button type="button" variant="ghost" className="gap-1.5 text-tone-danger-ink hover:bg-tone-danger-bg" onClick={discard} disabled={busy}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("srDiscardDraft")}
            </Button>
          )}
          <span className={cn("text-meta tabular-nums", saveState.status === "error" ? "font-semibold text-tone-danger-ink" : "text-muted")} role="status" aria-live="polite">{saveText}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={saveNow} disabled={busy || saveState.status === "saving"}>{t("srSaveDraft")}</Button>
          <Button type="submit" className="gap-1.5" disabled={busy}>
            <Send className="h-4 w-4" aria-hidden="true" /> {busy ? t("srSubmitting") : t(report.status === "revision_requested" ? "srResubmit" : "srSubmitReport")}
          </Button>
        </div>
      </div>
    </form>
  );
}
