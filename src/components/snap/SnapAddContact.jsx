// SnapAddContact.jsx -- the "find the person first" add flow. Step one
// searches existing NB4HS clients (data.clients) so a known person is added
// from their existing record; only if they aren't listed does step two
// collect a minimal new record (name + one way to reach them). Before that
// is saved, findPossibleDuplicates() runs once more and DuplicateClientWarning
// offers the match -- nothing is ever merged automatically.
//
// Both steps live in one Dialog; the "new person" step is a form the
// footer's submit button targets by id.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { findPossibleDuplicates } from "../../lib/masterClients.js";
import { CONTACT_LANGUAGES, CONTACT_METHODS, OUTREACH_SOURCES, createOutreachContact, searchClients } from "../../lib/outreachContacts.js";
import { formatPhone } from "../../lib/utils.js";
import DuplicateClientWarning from "../DuplicateClientWarning.jsx";
import NbIdBadge from "../NbIdBadge.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { SnapInput, SnapSelect } from "./SnapField.jsx";

const EMPTY = { firstName: "", lastName: "", phone: "", email: "", preferredLanguage: "", preferredContactMethod: "", outreachSource: "" };

export default function SnapAddContact({ contacts, onCreated, onOpenContact, onClose }) {
  const { data, showToast } = useApp();
  const t = useT();
  const { program } = useOutreachProgram();
  const navigate = useNavigate();
  const [step, setStep] = useState("find");
  const [q, setQ] = useState("");
  const [fields, setFields] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [dupMatches, setDupMatches] = useState(null);
  const [saving, setSaving] = useState(false);

  const contactByClient = {};
  (contacts || []).forEach((c) => { contactByClient[c.clientId] = c; });
  const results = searchClients(data.clients || [], q);
  const set = (key) => (value) => setFields((f) => Object.assign({}, f, { [key]: value }));

  async function save(matchedClient) {
    if (matchedClient && contactByClient[matchedClient.id]) {
      showToast(t("snapAlreadyContact"));
      onOpenContact(contactByClient[matchedClient.id]);
      return;
    }
    setSaving(true);
    try {
      const created = await createOutreachContact(program, fields, fields, matchedClient ? matchedClient.id : null);
      showToast(t("snapContactCreated"));
      onCreated(created);
    } catch (err) {
      console.warn("createOutreachContact failed", err);
      showToast(t("snapContactSaveError"));
    } finally {
      setSaving(false);
      setDupMatches(null);
    }
  }

  function submitNew(e) {
    e.preventDefault();
    const next = {};
    if (!fields.firstName.trim() || !fields.lastName.trim()) next.name = t("snapNameRequired");
    if (!fields.phone.trim() && !fields.email.trim()) next.reach = t("snapContactNeedsWay");
    setErrors(next);
    if (Object.keys(next).length) return;
    const matches = findPossibleDuplicates(fields, data.clients || []);
    if (matches.length) { setDupMatches(matches); return; }
    save(null);
  }

  const findStep = step === "find";

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        size="lg"
        title={t(findStep ? "snapFindPersonTitle" : "snapNewContactTitle")}
        description={t(findStep ? "snapFindPersonHelp" : "snapContactPrivacyNote")}
        closeLabel={t("closeLabel")}
        footer={findStep ? (
          <>
            <Button variant="ghost" onClick={onClose}>{t("cancelLabel")}</Button>
            <Button variant="secondary" onClick={() => setStep("new")}>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> {t("snapNewPerson")}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => setStep("find")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("snapFindPersonTitle")}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>{t("cancelLabel")}</Button>
            <Button type="submit" form="snap-add-new" loading={saving}>{t("snapAddContact")}</Button>
          </>
        )}
      >
        {findStep ? (
          <>
            <SearchInput
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")}
              clearLabel={t("clearLabel")}
              aria-label={t("snapFindPersonPlaceholder")} placeholder={t("snapFindPersonPlaceholder")}
            />
            {q.trim().length >= 2 && (
              results.length ? (
                <ul className="m-0 mt-3 list-none divide-y divide-line-subtle p-0">
                  {results.map((client) => {
                    const existing = contactByClient[client.id];
                    return (
                      <li key={client.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-ui font-semibold text-card-foreground">{(client.firstName + " " + client.lastName).trim()}</span>
                            <NbIdBadge nbId={client.nbId} />
                          </div>
                          <div className="mt-0.5 text-meta tabular-nums text-muted">{[formatPhone(client.phone), client.email].filter(Boolean).join(" · ") || "—"}</div>
                        </div>
                        {existing ? (
                          <Button size="sm" variant="ghost" onClick={() => onOpenContact(existing)}>{t("snapAlreadyContact")}</Button>
                        ) : (
                          <Button size="sm" variant="secondary" disabled={saving} onClick={() => save(client)}>{t("snapAddExisting")}</Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState compact variant="no-results" title={t("snapNoClientMatches")} description={t("snapNoClientMatchesHint")} />
              )
            )}
          </>
        ) : (
          <form id="snap-add-new" onSubmit={submitNew} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <SnapInput id="snap-first" label={t("firstName")} value={fields.firstName} onChange={set("firstName")} required invalid={!!errors.name && !fields.firstName.trim()} />
              <SnapInput id="snap-last" label={t("lastName")} value={fields.lastName} onChange={set("lastName")} required invalid={!!errors.name && !fields.lastName.trim()} />
              <SnapInput id="snap-phone" type="tel" label={t("phoneLabel")} value={fields.phone} onChange={(v) => set("phone")(formatPhone(v))} invalid={!!errors.reach} />
              <SnapInput id="snap-email" type="email" label={t("emailLabel")} value={fields.email} onChange={set("email")} invalid={!!errors.reach} />
              <SnapSelect id="snap-lang" t={t} label={t("snapPreferredLanguage")} value={fields.preferredLanguage} options={CONTACT_LANGUAGES} labelPrefix="snapLang_" emptyLabel={t("snapNotSet")} onChange={set("preferredLanguage")} />
              <SnapSelect id="snap-method" t={t} label={t("snapPreferredMethod")} value={fields.preferredContactMethod} options={CONTACT_METHODS} labelPrefix="snapMethod_" emptyLabel={t("snapNotSet")} onChange={set("preferredContactMethod")} />
              <SnapSelect id="snap-source" t={t} label={t("snapOutreachSource")} value={fields.outreachSource} options={OUTREACH_SOURCES} labelPrefix="snapSource_" emptyLabel={t("snapNotSet")} onChange={set("outreachSource")} />
            </div>
            {(errors.name || errors.reach) && (
              <p role="alert" className="m-0 mt-4 text-ui text-tone-danger-ink">{errors.name || errors.reach}</p>
            )}
          </form>
        )}
      </Dialog>

      {dupMatches && (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { onClose(); navigate("/clients/" + nbId); }}
          onEnrollExisting={(client) => save(client)}
          onCreateAnyway={() => save(null)}
          onCancel={() => setDupMatches(null)}
        />
      )}
    </>
  );
}
