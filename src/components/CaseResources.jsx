// CaseResources.jsx -- Case Management > Resources: a searchable directory
// of outside agencies and referral partners (lib/caseResources.js). Add /
// edit happens in one inline form card at the top; each entry is a card
// with its contact details, Edit and Remove.
import { useEffect, useState } from "react";
import { Globe, Mail, MapPin, Pencil, Phone, Plus, Search as SearchIcon, Trash2, User } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  RESOURCE_CATEGORIES, createResource, deleteResource, fetchResources, resourceMatchesSearch, updateResource
} from "../lib/caseResources.js";
import { subscribeClientsTable } from "../lib/clientsData.js";
import { formatPhone } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import EmptyState from "./EmptyState.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.jsx";
import AddressInput from "./AddressInput.jsx";
import { addressLabel } from "../lib/addressLookup.js";

const EMPTY = { name: "", category: "other", contactName: "", phone: "", email: "", website: "", address: "", notes: "" };
const CONTROL = "h-11 min-h-0 w-full rounded-lg border bg-background px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/15";

function categoryLabel(t, key) {
  return t("resourceCat_" + key);
}

function Field({ id, label, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-meta font-semibold text-card-foreground">
        {label}{required ? <span className="text-accent"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function ResourceForm({ initial, onSaved, onCancel }) {
  const { showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState(initial || EMPTY);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const editing = !!(initial && initial.id);

  function set(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function save() {
    if (!fields.name.trim()) { setInvalid(true); showToast(t("fixErrors")); return; }
    setInvalid(false);
    setSaving(true);
    try {
      if (editing) await updateResource(initial.id, fields); else await createResource(fields);
      showToast(t(editing ? "resourceUpdated" : "resourceAdded"));
      onSaved();
    } catch (err) {
      console.warn("save resource failed", err);
      showToast(t("resourceSaveError"));
    } finally {
      setSaving(false);
    }
  }

  const input = (name, extra) => (
    <input
      id={"resource-" + name}
      type="text"
      value={fields[name]}
      onChange={(e) => set(name, name === "phone" ? formatPhone(e.target.value) : e.target.value)}
      className={cn(CONTROL, "border-border focus:border-primary")}
      {...extra}
    />
  );

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>{t(editing ? "editResourceTitle" : "addResourceTitle")}</CardTitle>
        <CardDescription className="mt-0.5">{t("addResourceDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="resource-name" label={t("resourceNameLabel")} required>
            <input
              id="resource-name"
              type="text"
              value={fields.name}
              maxLength={120}
              onChange={(e) => set("name", e.target.value)}
              className={cn(CONTROL, invalid ? "border-accent bg-tint-danger" : "border-border focus:border-primary")}
            />
          </Field>
          <Field id="resource-category" label={t("resourceCategoryLabel")}>
            <select id="resource-category" value={fields.category} onChange={(e) => set("category", e.target.value)} className={cn(CONTROL, "border-border focus:border-primary")}>
              {RESOURCE_CATEGORIES.map((k) => <option key={k} value={k}>{categoryLabel(t, k)}</option>)}
            </select>
          </Field>
          <Field id="resource-contactName" label={t("resourceContactLabel")}>{input("contactName")}</Field>
          <Field id="resource-phone" label={t("phoneLabel")}>{input("phone", { placeholder: "(401) 123-4567" })}</Field>
          <Field id="resource-email" label={t("emailLabel")}>{input("email", { placeholder: "name@example.com" })}</Field>
          <Field id="resource-website" label={t("resourceWebsiteLabel")}>{input("website", { placeholder: "https://" })}</Field>
        </div>
        <Field id="resource-address" label={t("address")}>
          <AddressInput
            id="resource-address"
            type="text"
            value={fields.address}
            onChange={(e) => set("address", e.target.value)}
            onAddressSelect={(a) => set("address", addressLabel(a))}
            className={cn(CONTROL, "border-border focus:border-primary")}
          />
        </Field>
        <Field id="resource-notes" label={t("resourceNotesLabel")}>
          <textarea
            id="resource-notes"
            rows={3}
            value={fields.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={t("resourceNotesPlaceholder")}
            className="min-h-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>{t("resourceCancelBtn")}</Button>
          <Button onClick={save} disabled={saving}>{t(editing ? "resourceSaveBtn" : "addResourceBtn")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function websiteHref(url) {
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

function ResourceCard({ r, onEdit, onRemove }) {
  const t = useT();
  const line = (Icon, content) => (
    <div className="flex items-start gap-2 text-sm text-card-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 break-words">{content}</span>
    </div>
  );
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="m-0 text-base font-bold text-card-foreground">{r.name}</h3>
            <Badge variant="neutral" className="mt-1.5">{categoryLabel(t, r.category)}</Badge>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" aria-label={t("editLabel") + " " + r.name} onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" aria-label={t("deleteLabel") + " " + r.name} className="text-accent hover:bg-tint-danger" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-1.5">
          {r.contactName && line(User, r.contactName)}
          {r.phone && line(Phone, <a href={"tel:" + r.phone.replace(/[^0-9+]/g, "")} className="text-primary">{r.phone}</a>)}
          {r.email && line(Mail, <a href={"mailto:" + r.email} className="text-primary">{r.email}</a>)}
          {r.website && line(Globe, <a href={websiteHref(r.website)} target="_blank" rel="noopener noreferrer" className="text-primary">{r.website}</a>)}
          {r.address && line(MapPin, r.address)}
        </div>
        {r.notes && <p className="m-0 whitespace-pre-line border-t border-border pt-3 text-sm text-muted">{r.notes}</p>}
      </CardContent>
    </Card>
  );
}

export default function CaseResources() {
  const { requestConfirm, showToast } = useApp();
  const t = useT();
  const [resources, setResources] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  // null = form closed, EMPTY = adding, a resource = editing it.
  const [form, setForm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetchResources().then((rows) => { if (!cancelled) setResources(rows); });
    load();
    const unsub = subscribeClientsTable("case_resources", load);
    return () => { cancelled = true; unsub(); };
  }, []);

  async function remove(r) {
    const ok = await requestConfirm(t("removeResourceConfirm").replace("{name}", r.name), { danger: true });
    if (!ok) return;
    try { await deleteResource(r.id); } catch (err) { console.warn("deleteResource failed", err); showToast(t("resourceSaveError")); }
  }

  const term = search.trim().toLowerCase();
  const list = (resources || [])
    .filter((r) => !category || r.category === category)
    .filter((r) => resourceMatchesSearch(r, term, categoryLabel(t, r.category)));

  return (
    <>
      {form ? (
        <ResourceForm key={form.id || "new"} initial={form} onSaved={() => setForm(null)} onCancel={() => setForm(null)} />
      ) : (
        <div className="mb-4 flex justify-end">
          <Button className="gap-2" onClick={() => setForm(EMPTY)}><Plus className="h-4 w-4" /> {t("addResourceBtn")}</Button>
        </div>
      )}

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-2.5 p-5 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("resourceSearchPlaceholder")}
              aria-label={t("resourceSearchPlaceholder")}
              className="h-12 min-h-0 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-base text-card-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label={t("resourceCategoryLabel")}
            className="h-12 min-h-0 rounded-xl border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none sm:w-56"
          >
            <option value="">{t("allCategoriesLabel")}</option>
            {RESOURCE_CATEGORIES.map((k) => <option key={k} value={k}>{categoryLabel(t, k)}</option>)}
          </select>
        </CardContent>
      </Card>

      {resources === null ? null : list.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => <ResourceCard key={r.id} r={r} onEdit={() => setForm(r)} onRemove={() => remove(r)} />)}
        </div>
      ) : (
        <Card><CardContent className="p-5">
          <EmptyState icon="users" message={term || category ? t("noSearchResults") : t("noResourcesYet")} />
        </CardContent></Card>
      )}
    </>
  );
}
