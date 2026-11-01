// SnapContactDetail.jsx -- one outreach contact: outreach details (editable by
// the assigned worker or a supervisor -- contactPermissions() mirrors the
// RLS update policy), communication consent (append-only history, newest
// answer per channel/purpose shown), and the activity log.
//
// A Dialog (xl) with no footer: each field saves as it changes, as before.
// Consent is a divided list rather than a table, so the record buttons stay
// on screen at phone width.
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
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
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { Field, Select, Textarea } from "../ui/field.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import { SnapSelect } from "./SnapField.jsx";

const H3 = "m-0 text-section font-semibold text-card-foreground";

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
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={name}
      description={[formatPhone(contact.phone), contact.email].filter(Boolean).join(" · ") || undefined}
      closeLabel={t("closeLabel")}
    >
      <div className="grid gap-8">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <NbIdBadge nbId={contact.nbId} />
            {contact.status === "inactive" && <Badge variant="neutral">{t("snapStatus_inactive")}</Badge>}
            <Link to={"/clients/" + contact.nbId} className="inline-flex items-center gap-1 rounded-badge text-meta font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {t("snapOpenClientProfile")}
            </Link>
          </div>
          {!perms.canEdit && <Alert tone="info">{t("snapContactReadOnly")}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SnapSelect id="snapd-lang" t={t} label={t("snapPreferredLanguage")} value={contact.preferredLanguage} options={CONTACT_LANGUAGES} labelPrefix="snapLang_" emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={(v) => patch({ preferredLanguage: v })} />
            <SnapSelect id="snapd-method" t={t} label={t("snapPreferredMethod")} value={contact.preferredContactMethod} options={CONTACT_METHODS} labelPrefix="snapMethod_" emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={(v) => patch({ preferredContactMethod: v })} />
            <SnapSelect id="snapd-source" t={t} label={t("snapOutreachSource")} value={contact.outreachSource} options={OUTREACH_SOURCES} labelPrefix="snapSource_" emptyLabel={t("snapNotSet")} disabled={!perms.canEdit || busy} onChange={(v) => patch({ outreachSource: v })} />
            <SnapSelect id="snapd-follow" t={t} label={t("snapFollowUp")} value={contact.followUpStatus} options={FOLLOW_UP_STATUSES} labelPrefix="snapFollow_" disabled={!perms.canEdit || busy} onChange={(v) => patch({ followUpStatus: v })} />
            {perms.canReassign ? (
              <Field label={t("snapAssignedTo")} htmlFor="snapd-assigned">
                <Select id="snapd-assigned" value={contact.assignedTo || ""} disabled={busy} onChange={(e) => patch({ assignedTo: e.target.value || null })}>
                  <option value="">{t("snapUnassigned")}</option>
                  {staff.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label={t("snapAssignedTo")} htmlFor="snapd-assigned">
                <div id="snapd-assigned" className="flex h-10 items-center text-ui text-card-foreground">{contact.assignedTo ? nameOf(contact.assignedTo) : t("snapUnassigned")}</div>
              </Field>
            )}
            <SnapSelect id="snapd-status" t={t} label={t("snapContactStatus")} value={contact.status} options={["active", "inactive"]} labelPrefix="snapStatus_" disabled={!perms.canEdit || busy}
              onChange={(v) => patch({ status: v })} />
          </div>
        </div>

        <section aria-labelledby="snapd-consent">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 id="snapd-consent" className={H3}>{t("snapConsentTitle")}</h3>
              <p className="m-0 mt-1 max-w-[60ch] text-meta text-muted">{t("snapConsentHelp")}</p>
            </div>
            <Field label={t("snapConsentMethod")} htmlFor="snapd-consent-method">
              <Select id="snapd-consent-method" className="w-auto min-w-[10rem]" value={consentMethod} onChange={(e) => setConsentMethod(e.target.value)}>
                {CONSENT_METHODS.map((m) => <option key={m} value={m}>{t("snapConsentMethod_" + m)}</option>)}
              </Select>
            </Field>
          </div>
          <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
            {CONSENT_CHANNELS.map((channel) => CONSENT_PURPOSES.map((purpose) => {
              const row = current[channel + ":" + purpose];
              const label = t("snapMethod_" + channel) + " — " + t("snapPurpose_" + purpose);
              const status = row ? row.status : "none";
              return (
                <li key={channel + purpose} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-ui font-semibold text-card-foreground">{label}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted">
                      <StatusBadge domain="consent" status={status}>{t("snapConsent_" + status)}</StatusBadge>
                      {row && <span className="tabular-nums">{fmtWhen(row.capturedAt)} · {t("snapConsentMethod_" + row.method)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="secondary" disabled={busy} aria-label={t("snapConsentRecordYes") + ": " + label} onClick={() => addConsent(channel, purpose, "granted")}>{t("snapConsentRecordYes")}</Button>
                    <Button size="sm" variant="ghost" disabled={busy} aria-label={t("snapConsentRecordNo") + ": " + label} onClick={() => addConsent(channel, purpose, "revoked")}>{t("snapConsentRecordNo")}</Button>
                  </div>
                </li>
              );
            }))}
          </ul>
        </section>

        <section aria-labelledby="snapd-activity">
          <h3 id="snapd-activity" className={H3 + " mb-3"}>{t("snapActivityTitle")}</h3>
          <form onSubmit={addActivity} className="mb-4 grid gap-4 rounded-control border border-border bg-surface-sunken p-4 sm:grid-cols-3">
            <SnapSelect id="snapd-type" t={t} label={t("snapActivityType")} value={entry.type} options={INTERACTION_TYPES} labelPrefix="snapType_" onChange={(v) => setEntry((x) => Object.assign({}, x, { type: v }))} />
            <SnapSelect id="snapd-dir" t={t} label={t("snapDirection")} value={entry.direction} options={INTERACTION_DIRECTIONS} labelPrefix="snapDir_" emptyLabel={t("snapNotSet")} onChange={(v) => setEntry((x) => Object.assign({}, x, { direction: v }))} />
            <SnapSelect id="snapd-outcome" t={t} label={t("snapOutcome")} value={entry.outcome} options={INTERACTION_OUTCOMES} labelPrefix="snapOutcome_" emptyLabel={t("snapNotSet")} onChange={(v) => setEntry((x) => Object.assign({}, x, { outcome: v }))} />
            <Field className="sm:col-span-3" label={t("snapSummary")} htmlFor="snapd-summary" hint={t("snapSummaryHint")}>
              <Textarea
                id="snapd-summary" rows={2} maxLength={SUMMARY_MAX} value={entry.summary}
                aria-describedby="snapd-summary-hint"
                className="min-h-[72px]"
                onChange={(e) => setEntry((x) => Object.assign({}, x, { summary: e.target.value }))}
              />
            </Field>
            <div className="flex justify-end sm:col-span-3">
              <Button type="submit" size="sm" loading={busy}>{t("snapLogActivity")}</Button>
            </div>
          </form>
          {activity.length ? (
            <ol className="m-0 list-none divide-y divide-line-subtle p-0">
              {activity.map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{t("snapType_" + a.type)}</Badge>
                    {a.direction && <span className="text-meta text-muted">{t("snapDir_" + a.direction)}</span>}
                    {a.outcome && <Badge variant="neutral">{t("snapOutcome_" + a.outcome)}</Badge>}
                    <span className="ml-auto text-meta tabular-nums text-muted">{fmtWhen(a.occurredAt)} · {nameOf(a.staffId)}</span>
                  </div>
                  {a.summary && <p className="m-0 mt-1.5 text-ui text-card-foreground">{a.summary}</p>}
                </li>
              ))}
            </ol>
          ) : <p className="m-0 text-meta text-muted">{t("snapNoActivity")}</p>}
        </section>
      </div>
    </Dialog>
  );
}
