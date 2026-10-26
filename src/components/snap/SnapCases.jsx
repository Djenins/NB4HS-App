// SnapCases.jsx -- an outreach program's "Cases" section. Lists the cases the
// caller may see (RLS: workers their own, supervisors/program admins all),
// opens new cases for an existing program contact, and opens SnapCaseDetail.
// `intent` ("new") comes from the dashboard's quick actions.
import { useEffect, useState } from "react";
import { FolderPlus, Search } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { createCase, fetchCaseStages, fetchCases, filterCases, stageLabel } from "../../lib/assistanceCases.js";
import { optionsFor } from "../../lib/outreachPrograms.js";
import { fetchOutreachContacts } from "../../lib/outreachContacts.js";
import { fmtDateLong, todayStr } from "../../lib/utils.js";
import EmptyState from "../EmptyState.jsx";
import NbIdBadge from "../NbIdBadge.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { SNAP_CONTROL } from "./SnapField.jsx";
import SnapCaseDetail from "./SnapCaseDetail.jsx";
import { useModalA11y } from "../../lib/useModalA11y.js";

const TH = "bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]";

function NewCase({ onCreated, onClose }) {
  const boxRef = useModalA11y(onClose);
  const { data, lang, session, showToast } = useApp();
  const t = useT();
  const { program, programRole, options } = useOutreachProgram();
  const userId = session ? session.id : null;
  const lead = programRole === "supervisor" || programRole === "program_admin";
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState("");
  const [requested, setRequested] = useState([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [assignedTo, setAssignedTo] = useState(userId);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchOutreachContacts(program).then((rows) => setContacts(rows.filter((c) => c.status === "active"))).catch(() => {}); }, [program]);

  async function submit(e) {
    e.preventDefault();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    setBusy(true);
    try {
      const created = await createCase(program, contact, { assistanceRequested: requested, followUpDate, assignedTo: lead ? assignedTo : userId }, userId);
      showToast(t("snapCaseCreated"));
      onCreated(created);
    } catch (err) {
      console.warn("createCase failed", err);
      showToast(t("snapCaseSaveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form ref={boxRef} className="modal-box max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="snap-newcase-title" onSubmit={submit}>
        <h2 id="snap-newcase-title" className="m-0 mb-1 text-lg font-bold text-card-foreground">{t("snapNewCaseTitle")}</h2>
        <p className="!mb-4 !text-sm text-muted">{t("snapChooseContactHelp")}</p>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="newcase-contact" className="text-xs font-semibold text-muted required">{t("snapChooseContact")}</label>
            <select id="newcase-contact" className={SNAP_CONTROL} value={contactId} onChange={(e) => setContactId(e.target.value)} required>
              <option value="">{t("snapChooseContactPrompt")}</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{(c.firstName + " " + c.lastName).trim()} · {c.nbId}</option>)}
            </select>
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 text-xs font-semibold text-muted">{t("snapAssistanceRequested")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {optionsFor(options, "assistance_type").map((o) => (
                <label key={o.key} className="flex items-center gap-1.5 text-sm text-card-foreground">
                  <input type="checkbox" checked={requested.indexOf(o.key) !== -1}
                    onChange={() => setRequested((r) => (r.indexOf(o.key) !== -1 ? r.filter((x) => x !== o.key) : r.concat([o.key])))} />
                  {o.labels[lang] || o.labels.en}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="newcase-followup" className="text-xs font-semibold text-muted">{t("snapFollowUpDate")}</label>
              <input id="newcase-followup" type="date" min={todayStr()} className={SNAP_CONTROL} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>
            {lead && (
              <div className="grid gap-1.5">
                <label htmlFor="newcase-assigned" className="text-xs font-semibold text-muted">{t("snapAssignedTo")}</label>
                <select id="newcase-assigned" className={SNAP_CONTROL} value={assignedTo || ""} onChange={(e) => setAssignedTo(e.target.value)}>
                  {(data.profiles || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t("cancelLabel")}</Button>
          <Button type="submit" disabled={busy || !contactId}>{t("snapOpenCase")}</Button>
        </div>
      </form>
    </div>
  );
}

export default function SnapCases({ intent }) {
  const { data, lang, session } = useApp();
  const t = useT();
  const { program } = useOutreachProgram();
  const userId = session ? session.id : null;
  const [cases, setCases] = useState(null);
  const [stages, setStages] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);
  const [creating, setCreating] = useState(intent === "new");
  const [openId, setOpenId] = useState(null);

  function load() {
    return Promise.all([fetchCases(program), fetchCaseStages(program)])
      .then(([rows, st]) => { setCases(rows); setStages(st); setLoadError(false); })
      .catch((err) => { console.warn("fetchCases failed", err); setLoadError(true); });
  }
  useEffect(() => { load(); }, []);

  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : null; };
  const list = filterCases(cases || [], { q, openOnly, mineOnly, userId });
  const open = (cases || []).find((c) => c.id === openId) || null;
  const today = todayStr();

  return (
    <SectionCard
      title={t("snapSectionCases")}
      action={<Button className="gap-1.5" onClick={() => setCreating(true)}><FolderPlus className="h-4 w-4" aria-hidden="true" /> {t("snapOpenCase")}</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("searchLabel")} placeholder={t("searchLabel")} className={SNAP_CONTROL + " pl-9"} />
        </div>
        <label className="flex items-center gap-2 text-sm text-card-foreground"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />{t("snapOpenOnly")}</label>
        <label className="flex items-center gap-2 text-sm text-card-foreground"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />{t("snapMineOnly")}</label>
      </div>

      {loadError ? <EmptyState icon="inbox" message={t("snapCasesLoadError")} />
        : cases === null ? null
        : !list.length ? <EmptyState icon="inbox" message={cases.length ? t("snapNoCasesMatch") : t("snapNoCases")} />
        : (
          <div className="overflow-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={TH}>{t("snapCaseNumber")}</th>
                  <th className={TH}>{t("snapCaseStage")}</th>
                  <th className={TH}>{t("snapAssignedTo")}</th>
                  <th className={TH}>{t("snapFollowUpDate")}</th>
                  <th className={TH}>{t("snapReview")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-t border-border transition-colors hover:bg-background" onClick={() => setOpenId(c.id)}>
                    <td className="px-4 py-3 align-middle">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setOpenId(c.id); }}
                        className="min-h-0 border-0 bg-transparent p-0 text-left font-semibold text-card-foreground transform-none hover:text-primary">
                        {(c.firstName + " " + c.lastName).trim()}
                      </button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">{c.caseNumber} <NbIdBadge nbId={c.nbId} /></div>
                    </td>
                    <td className="px-4 py-3 align-middle"><Badge variant={c.closedAt ? "neutral" : "default"}>{stageLabel(stages, c.stageKey, lang)}</Badge></td>
                    <td className="px-4 py-3 align-middle">{c.assignedTo ? (nameOf(c.assignedTo) || "—") : t("snapUnassigned")}</td>
                    <td className={"px-4 py-3 align-middle " + (!c.closedAt && c.followUpDate && c.followUpDate < today ? "font-semibold text-accent" : "")}>
                      {c.followUpDate ? fmtDateLong(c.followUpDate, lang) : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle">{c.reviewStatus !== "not_requested" ? <Badge variant={c.reviewStatus === "approved" ? "success" : "warn"}>{t("snapReview_" + c.reviewStatus)}</Badge> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {creating && <NewCase onClose={() => setCreating(false)} onCreated={(created) => { setCreating(false); load().then(() => setOpenId(created.id)); }} />}
      {open && (
        <SnapCaseDetail caseRow={open} stages={stages} onClose={() => setOpenId(null)}
          onChanged={(updated) => setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))} />
      )}
    </SectionCard>
  );
}
