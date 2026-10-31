// SnapCaseDetail.jsx -- one assistance case: stage (with closure reason and
// supervisor review when the database requires them), assistance requested
// and provided, NB4HS milestones, the case's follow-ups, case notes and stage
// history. casePermissions()/closureProblem() mirror the database rules, so
// the UI explains a block before the server would refuse it.
import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import {
  NOTE_MAX, addCaseNote, casePermissions, closureProblem, fetchCaseNotes, fetchStageHistory, milestoneStage, stageLabel, updateCase
} from "../../lib/assistanceCases.js";
import { optionLabel, optionsFor, programScopeNote } from "../../lib/outreachPrograms.js";
import { fetchTasks } from "../../lib/snapTasks.js";
import { fmtDateLong, fmtTime } from "../../lib/utils.js";
import NbIdBadge from "../NbIdBadge.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { useModalA11y } from "../../lib/useModalA11y.js";
import { SNAP_CONTROL, SnapSelect } from "./SnapField.jsx";
import { SnapTaskForm, SnapTaskRows } from "./SnapTaskList.jsx";

const H3 = "m-0 mb-3 text-sm font-bold text-card-foreground";
const REVIEW_VARIANT = { not_requested: "neutral", requested: "warn", approved: "success", changes_requested: "accent" };

function CheckGroup({ legend, values, onToggle, disabled }) {
  const { lang } = useApp();
  const { options } = useOutreachProgram();
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 text-meta font-semibold text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {optionsFor(options, "assistance_type", values).map((o) => (
          <label key={o.key} className="flex items-center gap-1.5 text-sm text-card-foreground">
            <input type="checkbox" checked={values.indexOf(o.key) !== -1} disabled={disabled} onChange={() => onToggle(o.key)} />
            {o.labels[lang] || o.labels.en}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function SnapCaseDetail({ caseRow, stages, onChanged, onClose }) {
  const { data, lang, session, showToast } = useApp();
  const t = useT();
  const userId = session ? session.id : null;
  const { program, programRole, options, info } = useOutreachProgram();
  const scopeNote = programScopeNote(info, lang);
  const perms = casePermissions(caseRow, programRole, userId);
  const assisted = milestoneStage(stages, "application_assisted");
  const referred = milestoneStage(stages, "referred_external");
  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : "—"; };

  const [stageDraft, setStageDraft] = useState(caseRow.stageKey);
  const [reasonDraft, setReasonDraft] = useState(caseRow.closureReason || "");
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [history, setHistory] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [addingTask, setAddingTask] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setStageDraft(caseRow.stageKey); setReasonDraft(caseRow.closureReason || ""); }, [caseRow.stageKey, caseRow.closureReason]);

  function loadExtras() {
    fetchCaseNotes(caseRow.id).then(setNotes).catch(() => {});
    fetchStageHistory(caseRow.id).then(setHistory).catch(() => {});
    fetchTasks({ program, caseId: caseRow.id }).then(setTasks).catch(() => {});
  }
  useEffect(loadExtras, [caseRow.id]);

  const boxRef = useModalA11y(onClose);

  async function patch(fields) {
    setBusy(true);
    try {
      const updated = await updateCase(caseRow.id, fields);
      onChanged(updated);
      showToast(t("snapCaseSaved"));
      loadExtras();
    } catch (err) {
      console.warn("updateCase failed", err);
      showToast(t("snapCaseSaveError"));
    } finally {
      setBusy(false);
    }
  }

  const draftStage = stages.find((s) => s.key === stageDraft);
  const problem = closureProblem(stages, stageDraft, reasonDraft, caseRow.reviewStatus);
  const stageDirty = stageDraft !== caseRow.stageKey || (draftStage && draftStage.isTerminal && reasonDraft !== (caseRow.closureReason || ""));
  const toggle = (list, code) => (list.indexOf(code) !== -1 ? list.filter((c) => c !== code) : list.concat([code]));

  async function addNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      await addCaseNote(caseRow.id, noteText, userId);
      setNoteText("");
      setNotes(await fetchCaseNotes(caseRow.id));
      showToast(t("snapNoteSaved"));
    } catch (err) {
      console.warn("addCaseNote failed", err);
      showToast(t("snapNoteSaveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className="modal-box max-h-[90vh] max-w-3xl overflow-auto" role="dialog" aria-modal="true" aria-labelledby="snap-case-title">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="snap-case-title" className="m-0 text-lg font-bold text-card-foreground">{caseRow.caseNumber}</h2>
              <Badge>{stageLabel(stages, caseRow.stageKey, lang)}</Badge>
              {caseRow.closedAt && <Badge variant="neutral">{optionLabel(options, "closure_reason", caseRow.closureReason, lang)}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-card-foreground">
              {(caseRow.firstName + " " + caseRow.lastName).trim()} <NbIdBadge nbId={caseRow.nbId} />
              <Link to={"/clients/" + caseRow.nbId} aria-label={t("nbIdLabel") + " " + caseRow.nbId} className="inline-flex items-center text-primary"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link>
            </div>
            <div className="mt-1 text-meta text-muted">{t("snapCaseOpened")}: {fmtDateLong(caseRow.openedAt, lang)} · {t("snapAssignedTo")}: {caseRow.assignedTo ? nameOf(caseRow.assignedTo) : t("snapUnassigned")}</div>
          </div>
          <button type="button" aria-label={t("closeLabel")} onClick={onClose}
            className="flex h-9 w-9 min-h-0 items-center justify-center rounded-lg border border-border bg-card p-0 text-muted hover:bg-background">
            <X className="h-4 w-4" />
          </button>
        </div>

        {scopeNote && <div className="info-callout mb-4"><p className="!m-0 !text-meta">{scopeNote}</p></div>}
        {!perms.canEdit && <p className="!mb-3 !text-meta text-muted">{t("snapCaseReadOnly")}</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <label htmlFor="case-stage" className="text-meta font-semibold text-muted">{t("snapCaseStage")}</label>
            <select id="case-stage" className={SNAP_CONTROL} value={stageDraft} disabled={!perms.canEdit || busy} onChange={(e) => setStageDraft(e.target.value)}>
              {stages.filter((s) => s.active).map((s) => <option key={s.key} value={s.key}>{s.labels[lang] || s.labels.en}</option>)}
            </select>
          </div>
          {draftStage && draftStage.isTerminal && (
            <SnapSelect id="case-closure" t={t} label={t("snapClosureReason")} value={reasonDraft}
              options={optionsFor(options, "closure_reason", [caseRow.closureReason]).map((o) => o.key)}
              labelFor={(key) => optionLabel(options, "closure_reason", key, lang)}
              emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={setReasonDraft} />
          )}
          <div className="flex items-end">
            {perms.canEdit && stageDirty && (
              <Button size="sm" disabled={busy || !!problem} onClick={() => patch({ stageKey: stageDraft, closureReason: draftStage && draftStage.isTerminal ? reasonDraft : null })}>{t("saveLabel")}</Button>
            )}
          </div>
          {stageDirty && problem && <p role="alert" className="!m-0 !text-meta text-accent sm:col-span-3">{t(problem)}</p>}

          <div className="grid gap-1.5">
            <label htmlFor="case-followup" className="text-meta font-semibold text-muted">{t("snapFollowUpDate")}</label>
            <input id="case-followup" type="date" className={SNAP_CONTROL} value={caseRow.followUpDate || ""} disabled={!perms.canEdit || busy} onChange={(e) => patch({ followUpDate: e.target.value })} />
          </div>
          {perms.canReassign ? (
            <div className="grid gap-1.5">
              <label htmlFor="case-assigned" className="text-meta font-semibold text-muted">{t("snapAssignedTo")}</label>
              <select id="case-assigned" className={SNAP_CONTROL} value={caseRow.assignedTo || ""} disabled={busy} onChange={(e) => patch({ assignedTo: e.target.value || null })}>
                <option value="">{t("snapUnassigned")}</option>
                {(data.profiles || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
              </select>
            </div>
          ) : <div />}
          <div className="grid content-start gap-1 text-meta text-muted">
            {assisted && <span>{stageLabel(stages, assisted.key, lang)}: <strong className="text-card-foreground">{caseRow.applicationAssistedAt ? fmtDateLong(caseRow.applicationAssistedAt, lang) : "—"}</strong></span>}
            {referred && <span>{stageLabel(stages, referred.key, lang)}: <strong className="text-card-foreground">{caseRow.referredToDhsAt ? fmtDateLong(caseRow.referredToDhsAt, lang) : "—"}</strong></span>}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <CheckGroup legend={t("snapAssistanceRequested")} values={caseRow.assistanceRequested} disabled={!perms.canEdit || busy}
            onToggle={(code) => patch({ assistanceRequested: toggle(caseRow.assistanceRequested, code) })} />
          <CheckGroup legend={t("snapAssistanceProvided")} values={caseRow.assistanceProvided} disabled={!perms.canEdit || busy}
            onToggle={(code) => patch({ assistanceProvided: toggle(caseRow.assistanceProvided, code) })} />
        </div>

        <section className="mt-6" aria-labelledby="case-review">
          <h3 id="case-review" className={H3}>{t("snapReview")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={REVIEW_VARIANT[caseRow.reviewStatus]}>{t("snapReview_" + caseRow.reviewStatus)}</Badge>
            {caseRow.reviewedBy && <span className="text-meta text-muted">{nameOf(caseRow.reviewedBy)}</span>}
            {perms.canEdit && caseRow.reviewStatus !== "requested" && caseRow.reviewStatus !== "approved" && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => patch({ reviewStatus: "requested" })}>{t("snapRequestReview")}</Button>
            )}
            {perms.canReview && caseRow.reviewStatus === "requested" && (
              <>
                <Button size="sm" variant="success" disabled={busy} onClick={() => patch({ reviewStatus: "approved" })}>{t("snapApproveReview")}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ reviewStatus: "changes_requested" })}>{t("snapRequestChanges")}</Button>
              </>
            )}
          </div>
        </section>

        <section className="mt-6" aria-labelledby="case-tasks">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 id="case-tasks" className={H3 + " !mb-0"}>{t("snapCaseTasks")}</h3>
            {perms.canEdit && !addingTask && <Button size="sm" variant="secondary" onClick={() => setAddingTask(true)}>{t("snapAddTask")}</Button>}
          </div>
          {addingTask && (
            <SnapTaskForm context={{ caseId: caseRow.id, clientId: caseRow.clientId }} onCancel={() => setAddingTask(false)}
              onSaved={() => { setAddingTask(false); fetchTasks({ program, caseId: caseRow.id }).then(setTasks).catch(() => {}); }} />
          )}
          <SnapTaskRows tasks={tasks} onChanged={() => fetchTasks({ program, caseId: caseRow.id }).then(setTasks).catch(() => {})} />
        </section>

        <section className="mt-6" aria-labelledby="case-notes">
          <h3 id="case-notes" className={H3}>{t("snapCaseNotes")}</h3>
          <p id="case-notes-help" className="!mb-2 !text-meta text-muted">{t("snapCaseNotesHelp")}</p>
          {perms.canEdit && (
            <form onSubmit={addNote} className="mb-3 grid gap-2">
              <textarea rows={3} maxLength={NOTE_MAX} value={noteText} aria-label={t("snapAddNote")} aria-describedby="case-notes-help"
                onChange={(e) => setNoteText(e.target.value)}
                className="min-h-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
              <div className="flex justify-end"><Button type="submit" size="sm" disabled={busy || !noteText.trim()}>{t("snapAddNote")}</Button></div>
            </form>
          )}
          {notes.length ? (
            <ol className="m-0 list-none space-y-2 p-0">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="text-meta text-muted">{fmtDateLong(n.createdAt.slice(0, 10), lang)} {fmtTime(n.createdAt)} · {nameOf(n.createdBy)}</div>
                  <p className="!mb-0 mt-1 whitespace-pre-wrap !text-sm text-card-foreground">{n.content}</p>
                </li>
              ))}
            </ol>
          ) : <p className="!mb-0 py-2 text-center !text-sm text-muted">{t("snapNoNotes")}</p>}
        </section>

        <section className="mt-6" aria-labelledby="case-history">
          <h3 id="case-history" className={H3}>{t("snapStageHistory")}</h3>
          <ol className="m-0 list-none space-y-1 p-0 text-meta text-muted">
            {history.map((h) => (
              <li key={h.id}>
                {fmtDateLong(h.changedAt.slice(0, 10), lang)} {fmtTime(h.changedAt)} · {h.fromStage ? stageLabel(stages, h.fromStage, lang) + " → " : ""}
                <strong className="text-card-foreground">{stageLabel(stages, h.toStage, lang)}</strong> · {nameOf(h.changedBy)}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
