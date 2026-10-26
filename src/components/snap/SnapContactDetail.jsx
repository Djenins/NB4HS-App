// SnapContactDetail.jsx -- one outreach contact: outreach details (editable by
// the assigned worker or a supervisor -- contactPermissions() mirrors the
// RLS update policy), communication consent (append-only history, newest
// answer per channel/purpose shown), and the activity log.
import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import {
  CONSENT_CHANNELS, CONSENT_METHODS, CONSENT_PURPOSES, CONTACT_LANGUAGES, CONTACT_METHODS, FOLLOW_UP_STATUSES,
  INTERACTION_DIRECTIONS, INTERACTION_OUTCOMES, INTERACTION_TYPES, OUTREACH_SOURCES, SUMMARY_MAX,
  contactPermissions, currentConsents, fetchConsents, fetchInteractions, logInteraction, recordConsent, updateOutreachContact
} from "../../lib/outreachContacts.js";
import { fmtTime, formatPhone } from "../../lib/utils.js";
import NbIdBadge from "../NbIdBadge.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { SNAP_CONTROL, SnapSelect } from "./SnapField.jsx";

const H3 = "m-0 mb-3 text-sm font-bold text-card-foreground";

function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + fmtTime(iso);
}

export default function SnapContactDetail({ contact, onChanged, onClose }) {
  const { data, session, showToast } = useApp();
  const t = useT();
  const { program, programRole } = useOutreachProgram();
  const userId = session ? session.id : null;
  const perms = contactPermissions(contact, programRole, userId);
  const staff = (data.profiles || []).filter((p) => p.active !== false);
  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : "—"; };

  const [consents, setConsents] = useState([]);
  const [consentMethod, setConsentMethod] = useState("verbal");
  const [activity, setActivity] = useState([]);
  const [entry, setEntry] = useState({ type: "call", direction: "outbound", outcome: "", summary: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchConsents(contact.clientId).then((rows) => { if (!cancelled) setConsents(rows); }).catch(() => {});
    fetchInteractions(contact.clientId).then((rows) => { if (!cancelled) setActivity(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [contact.clientId]);

  useEffect(() => {
    function onKeydown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [onClose]);

  async function patch(fields) {
    setBusy(true);
    try {
      const updated = await updateOutreachContact(contact.id, fields);
      onChanged(updated);
      showToast(t("snapContactSaved"));
    } catch (err) {
      console.warn("updateOutreachContact failed", err);
      showToast(t("snapContactSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function addConsent(channel, purpose, status) {
    setBusy(true);
    try {
      await recordConsent(contact.clientId, { channel, purpose, status, method: consentMethod });
      setConsents(await fetchConsents(contact.clientId));
      showToast(t("snapConsentSaved"));
    } catch (err) {
      console.warn("recordConsent failed", err);
      showToast(t("snapConsentSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function addActivity(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await logInteraction(program, contact.clientId, entry);
      setActivity(await fetchInteractions(contact.clientId));
      setEntry({ type: entry.type, direction: entry.direction, outcome: "", summary: "" });
      showToast(t("snapActivityLogged"));
    } catch (err) {
      console.warn("logInteraction failed", err);
      showToast(t("snapActivitySaveError"));
    } finally {
      setBusy(false);
    }
  }

  const current = currentConsents(consents);
  const name = (contact.firstName + " " + contact.lastName).trim();

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-h-[90vh] max-w-3xl overflow-auto" role="dialog" aria-modal="true" aria-labelledby="snap-contact-title">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="snap-contact-title" className="m-0 text-lg font-bold text-card-foreground">{name}</h2>
              <NbIdBadge nbId={contact.nbId} />
              {contact.status === "inactive" && <Badge variant="neutral">{t("snapStatus_inactive")}</Badge>}
            </div>
            <div className="mt-1 text-sm text-muted">{[formatPhone(contact.phone), contact.email].filter(Boolean).join(" · ") || "—"}</div>
            <Link to={"/clients/" + contact.nbId} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <ExternalLink className="h-3 w-3" aria-hidden="true" /> {t("nbIdLabel")} {contact.nbId}
            </Link>
          </div>
          <button type="button" aria-label={t("closeLabel")} onClick={onClose}
            className="flex h-9 w-9 min-h-0 items-center justify-center rounded-lg border border-border bg-card p-0 text-muted hover:bg-background">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!perms.canEdit && <p className="!mb-3 !text-xs text-muted">{t("snapContactReadOnly")}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <SnapSelect id="snapd-lang" t={t} label={t("snapPreferredLanguage")} value={contact.preferredLanguage} options={CONTACT_LANGUAGES} labelPrefix="snapLang_" emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={(v) => patch({ preferredLanguage: v })} />
          <SnapSelect id="snapd-method" t={t} label={t("snapPreferredMethod")} value={contact.preferredContactMethod} options={CONTACT_METHODS} labelPrefix="snapMethod_" emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={(v) => patch({ preferredContactMethod: v })} />
          <SnapSelect id="snapd-source" t={t} label={t("snapOutreachSource")} value={contact.outreachSource} options={OUTREACH_SOURCES} labelPrefix="snapSource_" emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={(v) => patch({ outreachSource: v })} />
          <SnapSelect id="snapd-follow" t={t} label={t("snapFollowUp")} value={contact.followUpStatus} options={FOLLOW_UP_STATUSES} labelPrefix="snapFollow_" disabled={!perms.canEdit || busy} onChange={(v) => patch({ followUpStatus: v })} />
          <div className="grid gap-1.5">
            <label htmlFor="snapd-assigned" className="text-xs font-semibold text-muted">{t("snapAssignedTo")}</label>
            {perms.canReassign ? (
              <select id="snapd-assigned" className={SNAP_CONTROL} value={contact.assignedTo || ""} disabled={busy} onChange={(e) => patch({ assignedTo: e.target.value || null })}>
                <option value="">{t("snapUnassigned")}</option>
                {staff.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
              </select>
            ) : (
              <div id="snapd-assigned" className="flex h-10 items-center text-sm text-card-foreground">{contact.assignedTo ? nameOf(contact.assignedTo) : t("snapUnassigned")}</div>
            )}
          </div>
          <SnapSelect id="snapd-status" t={t} label={t("snapContactStatus")} value={contact.status} options={["active", "inactive"]} labelPrefix="snapStatus_" disabled={!perms.canEdit || busy}
            onChange={(v) => patch({ status: v })} />
        </div>

        <section className="mt-6" aria-labelledby="snapd-consent">
          <h3 id="snapd-consent" className={H3}>{t("snapConsentTitle")}</h3>
          <p className="!mb-3 !text-xs text-muted">{t("snapConsentHelp")}</p>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <label htmlFor="snapd-consent-method" className="text-xs font-semibold text-muted">{t("snapConsentMethod")}</label>
            <select id="snapd-consent-method" className={SNAP_CONTROL + " !w-auto"} value={consentMethod} onChange={(e) => setConsentMethod(e.target.value)}>
              {CONSENT_METHODS.map((m) => <option key={m} value={m}>{t("snapConsentMethod_" + m)}</option>)}
            </select>
          </div>
          <div className="overflow-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">{t("snapConsentChannel")}</th>
                  <th className="px-3 py-2">{t("snapConsentPurpose")}</th>
                  <th className="px-3 py-2">{t("snapConsentCurrent")}</th>
                  <th className="px-3 py-2"><span className="sr-only">{t("actionsCol")}</span></th>
                </tr>
              </thead>
              <tbody>
                {CONSENT_CHANNELS.map((channel) => CONSENT_PURPOSES.map((purpose) => {
                  const row = current[channel + ":" + purpose];
                  const label = t("snapMethod_" + channel) + " — " + t("snapPurpose_" + purpose);
                  return (
                    <tr key={channel + purpose} className="border-t border-border">
                      <td className="px-3 py-2">{t("snapMethod_" + channel)}</td>
                      <td className="px-3 py-2">{t("snapPurpose_" + purpose)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row ? (row.status === "granted" ? "success" : "warn") : "neutral"}>
                          {t("snapConsent_" + (row ? row.status : "none"))}
                        </Badge>
                        {row && <span className="ml-2 text-xs text-muted">{fmtWhen(row.capturedAt)} · {t("snapConsentMethod_" + row.method)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" disabled={busy} aria-label={t("snapConsentRecordYes") + ": " + label} onClick={() => addConsent(channel, purpose, "granted")}>{t("snapConsentRecordYes")}</Button>
                        <Button size="sm" variant="ghost" disabled={busy} aria-label={t("snapConsentRecordNo") + ": " + label} onClick={() => addConsent(channel, purpose, "revoked")}>{t("snapConsentRecordNo")}</Button>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6" aria-labelledby="snapd-activity">
          <h3 id="snapd-activity" className={H3}>{t("snapActivityTitle")}</h3>
          <form onSubmit={addActivity} className="mb-4 grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
            <SnapSelect id="snapd-type" t={t} label={t("snapActivityType")} value={entry.type} options={INTERACTION_TYPES} labelPrefix="snapType_" onChange={(v) => setEntry((x) => Object.assign({}, x, { type: v }))} />
            <SnapSelect id="snapd-dir" t={t} label={t("snapDirection")} value={entry.direction} options={INTERACTION_DIRECTIONS} labelPrefix="snapDir_" emptyLabel={t("snapNotSet")} onChange={(v) => setEntry((x) => Object.assign({}, x, { direction: v }))} />
            <SnapSelect id="snapd-outcome" t={t} label={t("snapOutcome")} value={entry.outcome} options={INTERACTION_OUTCOMES} labelPrefix="snapOutcome_" emptyLabel={t("snapNotSet")} onChange={(v) => setEntry((x) => Object.assign({}, x, { outcome: v }))} />
            <div className="grid gap-1.5 sm:col-span-3">
              <label htmlFor="snapd-summary" className="text-xs font-semibold text-muted">{t("snapSummary")}</label>
              <textarea
                id="snapd-summary" rows={2} maxLength={SUMMARY_MAX} value={entry.summary}
                aria-describedby="snapd-summary-hint"
                onChange={(e) => setEntry((x) => Object.assign({}, x, { summary: e.target.value }))}
                className="min-h-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
              <p id="snapd-summary-hint" className="!m-0 !text-xs text-muted">{t("snapSummaryHint")}</p>
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" size="sm" disabled={busy}>{t("snapLogActivity")}</Button>
            </div>
          </form>
          {activity.length ? (
            <ol className="m-0 list-none space-y-2 p-0">
              {activity.map((a) => (
                <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{t("snapType_" + a.type)}</Badge>
                    {a.direction && <span className="text-xs text-muted">{t("snapDir_" + a.direction)}</span>}
                    {a.outcome && <Badge variant="neutral">{t("snapOutcome_" + a.outcome)}</Badge>}
                    <span className="ml-auto text-xs text-muted">{fmtWhen(a.occurredAt)} · {nameOf(a.staffId)}</span>
                  </div>
                  {a.summary && <p className="!mb-0 mt-1.5 !text-sm text-card-foreground">{a.summary}</p>}
                </li>
              ))}
            </ol>
          ) : <p className="!mb-0 py-3 text-center !text-sm text-muted">{t("snapNoActivity")}</p>}
        </section>
      </div>
    </div>
  );
}
