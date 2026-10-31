// SnapCaseDetail.jsx -- one assistance case: stage (with closure reason and
// supervisor review when the database requires them), assistance requested
// and provided, NB4HS milestones, the case's follow-ups, case notes and stage
// history. casePermissions()/closureProblem() mirror the database rules, so
// the UI explains a block before the server would refuse it.
//
// A Dialog (xl) with no footer: fields save as they change, and the stage
// change keeps its own Save because closing may need a reason and a review.
import { useEffect, useState } from "react";
import { ExternalLink, ListPlus } from "lucide-react";
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
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { Field, Input, Select, Textarea } from "../ui/field.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import { SnapCheckboxes, SnapSelect } from "./SnapField.jsx";
import { SnapTaskForm, SnapTaskRows } from "./SnapTaskList.jsx";

const H3 = "m-0 text-section font-semibold text-card-foreground";

function CheckGroup({ legend, values, onToggle, disabled }) {
  const { lang } = useApp();
  const { options } = useOutreachProgram();
  return (
    <SnapCheckboxes
      legend={legend}
      items={optionsFor(options, "assistance_type", values).map((o) => ({ key: o.key, label: o.labels[lang] || o.labels.en }))}
      isChecked={(key) => values.indexOf(key) !== -1}
      onToggle={onToggle}
      disabled={disabled}
      wide
    />
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

  const clientName = (caseRow.firstName + " " + caseRow.lastName).trim();
  const refreshTasks = () => fetchTasks({ program, caseId: caseRow.id }).then(setTasks).catch(() => {});

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={caseRow.caseNumber}
      description={clientName}
      closeLabel={t("closeLabel")}
    >
      <div className="grid gap-8">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge domain="outreachCase" status={caseRow.closedAt ? "closed" : "open"}>{stageLabel(stages, caseRow.stageKey, lang)}</StatusBadge>
            {caseRow.closedAt && <Badge variant="neutral">{optionLabel(options, "closure_reason", caseRow.closureReason, lang)}</Badge>}
            <NbIdBadge nbId={caseRow.nbId} />
            <Link to={"/clients/" + caseRow.nbId} className="inline-flex items-center gap-1 rounded-badge text-meta font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {t("snapOpenClientProfile")}
            </Link>
          </div>
          <p className="m-0 text-meta tabular-nums text-muted">
            {t("snapCaseOpened")}: {fmtDateLong(caseRow.openedAt, lang)} · {t("snapAssignedTo")}: {caseRow.assignedTo ? nameOf(caseRow.assignedTo) : t("snapUnassigned")}
          </p>
          {scopeNote && <Alert tone="info">{scopeNote}</Alert>}
          {!perms.canEdit && <Alert tone="info">{t("snapCaseReadOnly")}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("snapCaseStage")} htmlFor="case-stage">
              <Select id="case-stage" value={stageDraft} disabled={!perms.canEdit || busy} onChange={(e) => setStageDraft(e.target.value)}>
                {stages.filter((st) => st.active).map((st) => <option key={st.key} value={st.key}>{st.labels[lang] || st.labels.en}</option>)}
              </Select>
            </Field>
            {draftStage && draftStage.isTerminal && (
              <SnapSelect id="case-closure" t={t} label={t("snapClosureReason")} value={reasonDraft}
                options={optionsFor(options, "closure_reason", [caseRow.closureReason]).map((o) => o.key)}
                labelFor={(key) => optionLabel(options, "closure_reason", key, lang)}
                emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={setReasonDraft} />
            )}
            {perms.canEdit && stageDirty && (
              <div className="flex items-end">
                <Button loading={busy} disabled={!!problem} onClick={() => patch({ stageKey: stageDraft, closureReason: draftStage && draftStage.isTerminal ? reasonDraft : null })}>{t("saveLabel")}</Button>
              </div>
            )}
            {stageDirty && problem && <p role="alert" className="m-0 text-meta text-tone-danger-ink sm:col-span-2 lg:col-span-3">{t(problem)}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("snapFollowUpDate")} htmlFor="case-followup">
              <Input id="case-followup" type="date" value={caseRow.followUpDate || ""} disabled={!perms.canEdit || busy} onChange={(e) => patch({ followUpDate: e.target.value })} />
            </Field>
            {perms.canReassign && (
              <Field label={t("snapAssignedTo")} htmlFor="case-assigned">
                <Select id="case-assigned" value={caseRow.assignedTo || ""} disabled={busy} onChange={(e) => patch({ assignedTo: e.target.value || null })}>
                  <option value="">{t("snapUnassigned")}</option>
                  {(data.profiles || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
                </Select>
              </Field>
            )}
            {(assisted || referred) && (
              <div className="grid content-end gap-1 text-meta text-muted">
                {assisted && <span>{stageLabel(stages, assisted.key, lang)}: <strong className="font-semibold tabular-nums text-card-foreground">{caseRow.applicationAssistedAt ? fmtDateLong(caseRow.applicationAssistedAt, lang) : "—"}</strong></span>}
                {referred && <span>{stageLabel(stages, referred.key, lang)}: <strong className="font-semibold tabular-nums text-card-foreground">{caseRow.referredToDhsAt ? fmtDateLong(caseRow.referredToDhsAt, lang) : "—"}</strong></span>}
              </div>
            )}
          </div>

          <div className="grid gap-5">
            <CheckGroup legend={t("snapAssistanceRequested")} values={caseRow.assistanceRequested} disabled={!perms.canEdit || busy}
              onToggle={(code) => patch({ assistanceRequested: toggle(caseRow.assistanceRequested, code) })} />
            <CheckGroup legend={t("snapAssistanceProvided")} values={caseRow.assistanceProvided} disabled={!perms.canEdit || busy}
              onToggle={(code) => patch({ assistanceProvided: toggle(caseRow.assistanceProvided, code) })} />
          </div>
        </div>

        <section aria-labelledby="case-review">
          <h3 id="case-review" className={H3 + " mb-3"}>{t("snapReview")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge domain="caseReview" status={caseRow.reviewStatus}>{t("snapReview_" + caseRow.reviewStatus)}</StatusBadge>
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

        <section aria-labelledby="case-tasks">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 id="case-tasks" className={H3}>{t("snapCaseTasks")}</h3>
            {perms.canEdit && !addingTask && <Button size="sm" variant="secondary" onClick={() => setAddingTask(true)}><ListPlus className="h-4 w-4" aria-hidden="true" />{t("snapAddTask")}</Button>}
          </div>
          {addingTask && (
            <SnapTaskForm context={{ caseId: caseRow.id, clientId: caseRow.clientId }} onCancel={() => setAddingTask(false)}
              onSaved={() => { setAddingTask(false); refreshTasks(); }} />
          )}
          <SnapTaskRows tasks={tasks} onChanged={refreshTasks} />
        </section>

        <section aria-labelledby="case-notes">
          <h3 id="case-notes" className={H3}>{t("snapCaseNotes")}</h3>
          <p id="case-notes-help" className="m-0 mb-3 mt-1 text-meta text-muted">{t("snapCaseNotesHelp")}</p>
          {perms.canEdit && (
            <form onSubmit={addNote} className="mb-4 grid gap-2">
              <Textarea rows={3} maxLength={NOTE_MAX} value={noteText} aria-label={t("snapAddNote")} aria-describedby="case-notes-help"
                onChange={(e) => setNoteText(e.target.value)} />
              <div className="flex justify-end"><Button type="submit" size="sm" loading={busy} disabled={!noteText.trim()}>{t("snapAddNote")}</Button></div>
            </form>
          )}
          {notes.length ? (
            <ol className="m-0 list-none divide-y divide-line-subtle p-0">
              {notes.map((n) => (
                <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-meta tabular-nums text-muted">{fmtDateLong(n.createdAt.slice(0, 10), lang)} {fmtTime(n.createdAt)} · {nameOf(n.createdBy)}</div>
                  <p className="m-0 mt-1 whitespace-pre-wrap text-ui text-card-foreground">{n.content}</p>
                </li>
              ))}
            </ol>
          ) : <p className="m-0 text-meta text-muted">{t("snapNoNotes")}</p>}
        </section>

        <section aria-labelledby="case-history">
          <h3 id="case-history" className={H3 + " mb-3"}>{t("snapStageHistory")}</h3>
          <ol className="m-0 grid list-none gap-1.5 p-0 text-meta text-muted">
            {history.map((h) => (
              <li key={h.id}>
                <span className="tabular-nums">{fmtDateLong(h.changedAt.slice(0, 10), lang)} {fmtTime(h.changedAt)}</span> · {h.fromStage ? stageLabel(stages, h.fromStage, lang) + " → " : ""}
                <strong className="font-semibold text-card-foreground">{stageLabel(stages, h.toStage, lang)}</strong> · {nameOf(h.changedBy)}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Dialog>
  );
}
