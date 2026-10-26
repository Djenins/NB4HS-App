// SnapContacts.jsx -- the SNAP Outreach "Contacts" section: every SNAP
// contact (any member can read all of them, by decision), filterable by
// search and "assigned to me", with the find-first add flow and the
// contact detail view. Fetched on demand rather than held in AppContext:
// only this section needs it.
import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { fetchOutreachContacts, filterContacts } from "../../lib/outreachContacts.js";
import { formatPhone } from "../../lib/utils.js";
import EmptyState from "../EmptyState.jsx";
import NbIdBadge from "../NbIdBadge.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { SNAP_CONTROL } from "./SnapField.jsx";
import SnapAddContact from "./SnapAddContact.jsx";
import SnapContactDetail from "./SnapContactDetail.jsx";

const TH = "bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]";
const FOLLOW_VARIANT = { none: "neutral", needed: "warn", scheduled: "default", done: "success" };

export default function SnapContacts() {
  const { data, session } = useApp();
  const t = useT();
  const userId = session ? session.id : null;
  const [contacts, setContacts] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);

  function load() {
    return fetchOutreachContacts("snap")
      .then((rows) => { setContacts(rows); setLoadError(false); return rows; })
      .catch((err) => { console.warn("fetchOutreachContacts failed", err); setLoadError(true); return []; });
  }
  useEffect(() => { load(); }, []);

  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : null; };
  const list = filterContacts(contacts || [], { q, mineOnly, userId });
  const open = (contacts || []).find((c) => c.id === openId) || null;

  return (
    <SectionCard
      title={t("snapSectionContacts")}
      action={
        <Button className="gap-1.5" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> {t("snapAddContact")}
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("searchLabel")} placeholder={t("snapFindPersonPlaceholder")} className={SNAP_CONTROL + " pl-9"} />
        </div>
        <label className="flex items-center gap-2 text-sm text-card-foreground">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          {t("snapMineOnly")}
        </label>
      </div>

      {loadError ? (
        <EmptyState icon="users" message={t("snapContactsLoadError")} />
      ) : contacts === null ? null : !list.length ? (
        <EmptyState icon="users" message={contacts.length ? t("snapNoContactsMatch") : t("snapNoContacts")} />
      ) : (
        <div className="overflow-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={TH}>{t("snapContactCol")}</th>
                <th className={TH}>{t("snapPreferredLanguage")}</th>
                <th className={TH}>{t("snapPreferredMethod")}</th>
                <th className={TH}>{t("snapAssignedTo")}</th>
                <th className={TH}>{t("snapFollowUp")}</th>
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <NbIdBadge nbId={c.nbId} />
                      <span>{[formatPhone(c.phone), c.email].filter(Boolean).join(" · ")}</span>
                      {c.status === "inactive" && <Badge variant="neutral">{t("snapStatus_inactive")}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">{c.preferredLanguage ? t("snapLang_" + c.preferredLanguage) : "—"}</td>
                  <td className="px-4 py-3 align-middle">{c.preferredContactMethod ? t("snapMethod_" + c.preferredContactMethod) : "—"}</td>
                  <td className="px-4 py-3 align-middle">{c.assignedTo ? (nameOf(c.assignedTo) || "—") : t("snapUnassigned")}</td>
                  <td className="px-4 py-3 align-middle"><Badge variant={FOLLOW_VARIANT[c.followUpStatus] || "neutral"}>{t("snapFollow_" + c.followUpStatus)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <SnapAddContact
          contacts={contacts}
          onClose={() => setAdding(false)}
          onOpenContact={(c) => { setAdding(false); setOpenId(c.id); }}
          onCreated={(created) => { setAdding(false); load().then(() => setOpenId(created.id)); }}
        />
      )}
      {open && (
        <SnapContactDetail
          contact={open}
          onClose={() => setOpenId(null)}
          onChanged={(updated) => setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
        />
      )}
    </SectionCard>
  );
}
