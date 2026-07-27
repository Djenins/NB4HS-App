// Employers.jsx -- Employer Directory, Phase 1 of the Employer & Job
// Opportunity Management module. Same Tailwind/shadcn idiom as
// JobDeveloper.jsx (collapsible "Add a Client"-style add card, search bar,
// pagination), but the results render as a card grid (EmployerCard) rather
// than a table, per the Employer Directory spec.
import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, UserPlus } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { createEmployer, deleteEmployer } from "../lib/clientsData.js";
import { EMPLOYER_PARTNERSHIP_STAGES, partnershipStageLabel } from "../lib/employerProfile.js";
import { paginateList } from "../lib/pagination.js";
import { activeIndustryList } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import EmployerCard from "../components/EmployerCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";

const EMPTY_NEW_EMPLOYER = {
  businessName: "", industry: "", website: "", street: "", city: "", zip: "",
  contactName: "", contactPhone: "", contactEmail: "", hrContactName: "", hrContactPhone: "", hrContactEmail: "",
  preferredCommunication: "", preferredHiringMethod: "", partnershipStage: "prospect", assignedJobDeveloperEmail: "", notes: ""
};

function SectionCardHeader({ icon: Icon, title, collapsed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex min-h-0 w-full items-center gap-3 border-0 bg-transparent p-0 text-left"
    >
      {collapsed ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronUp className="h-4 w-4 shrink-0 text-muted" />}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <CardTitle className="m-0">{title}</CardTitle>
    </button>
  );
}

function FormSection({ title, desc, children }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-border pb-6 last:border-b-0 last:pb-0 md:grid-cols-[220px_1fr]">
      <div>
        <h3 className="m-0 text-sm font-bold text-card-foreground">{title}</h3>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextField({ id, label, required, invalid, value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">
        {label}{required ? <span className="text-accent"> *</span> : null}
      </label>
      <input
        id={id} type="text" value={value} onChange={onChange} placeholder={placeholder}
        className={cn(
          "h-11 min-h-0 w-full rounded-lg border bg-background px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/15",
          invalid ? "border-accent bg-tint-danger" : "border-border focus:border-primary"
        )}
      />
    </div>
  );
}

function SelectField({ id, label, value, onChange, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">{label}</label>
      <select
        id={id} value={value} onChange={onChange}
        className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      >
        {children}
      </select>
    </div>
  );
}

function AddEmployerCard({ collapsed, onToggle, forwardRef }) {
  const { data, showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState(EMPTY_NEW_EMPLOYER);
  const [errors, setErrors] = useState([]);
  const industries = activeIndustryList(data.customIndustries, data.disabledIndustries);
  const jobDevelopers = activeJobDevelopers(data.profiles);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function submit() {
    if (!fields.businessName.trim()) {
      setErrors(["businessName"]);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    await createEmployer(fields);
    setFields(EMPTY_NEW_EMPLOYER);
    showToast(t("employerAdded"));
  }

  return (
    <Card ref={forwardRef} className="mb-5">
      <CardHeader className="space-y-0">
        <SectionCardHeader icon={UserPlus} title={t("addEmployerTitle")} collapsed={collapsed} onToggle={onToggle} />
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-6 pt-0">
          <FormSection title={t("companyInformationLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="new-employer-business-name" label={t("businessNameLabel")} required invalid={errors.indexOf("businessName") !== -1} value={fields.businessName} onChange={(e) => setField("businessName", e.target.value)} />
              <SelectField id="new-employer-industry" label={t("industryLabel")} value={fields.industry} onChange={(e) => setField("industry", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {industries.map((i) => <option key={i.key} value={i.key}>{i.en}</option>)}
              </SelectField>
              <TextField id="new-employer-website" label={t("websiteLabel")} value={fields.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://" />
            </div>
          </FormSection>

          <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-employer-street" label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
              <TextField id="new-employer-city" label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
              <TextField id="new-employer-zip" label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
            </div>
            <p className="text-xs text-muted">{t("stateAlwaysRI")}</p>
          </FormSection>

          <FormSection title={t("primaryContactSectionLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-employer-contact-name" label={t("contactNameLabel")} value={fields.contactName} onChange={(e) => setField("contactName", e.target.value)} />
              <TextField id="new-employer-contact-phone" label={t("contactPhoneLabel")} value={fields.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} />
              <TextField id="new-employer-contact-email" label={t("contactEmailLabel")} value={fields.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} />
            </div>
          </FormSection>

          <FormSection title={t("hrContactSectionLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-employer-hr-name" label={t("hrContactNameLabel")} value={fields.hrContactName} onChange={(e) => setField("hrContactName", e.target.value)} />
              <TextField id="new-employer-hr-phone" label={t("hrContactPhoneLabel")} value={fields.hrContactPhone} onChange={(e) => setField("hrContactPhone", e.target.value)} />
              <TextField id="new-employer-hr-email" label={t("hrContactEmailLabel")} value={fields.hrContactEmail} onChange={(e) => setField("hrContactEmail", e.target.value)} />
            </div>
          </FormSection>

          <FormSection title={t("partnershipInformationLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField id="new-employer-stage" label={t("partnershipStageLabel")} value={fields.partnershipStage} onChange={(e) => setField("partnershipStage", e.target.value)}>
                {EMPLOYER_PARTNERSHIP_STAGES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
              </SelectField>
              <SelectField id="new-employer-job-developer" label={t("assignedJobDeveloperLabel")} value={fields.assignedJobDeveloperEmail} onChange={(e) => setField("assignedJobDeveloperEmail", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {jobDevelopers.map((u) => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
              </SelectField>
            </div>
            <div>
              <label htmlFor="new-employer-notes" className="mb-1 block text-xs font-semibold text-card-foreground">{t("companyNotesLabel")}</label>
              <textarea
                id="new-employer-notes" rows={2} value={fields.notes} onChange={(e) => setField("notes", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </FormSection>

          <Button onClick={submit}>{t("addEmployerBtn")}</Button>
        </CardContent>
      )}
    </Card>
  );
}

export default function Employers() {
  const { data, requestConfirm } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addEmployer: true });
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const addEmployerRef = useRef(null);

  const employers = data.employers || [];
  const cities = Array.from(new Set(employers.map((e) => e.city).filter(Boolean))).sort();

  const term = search.trim().toLowerCase();
  const matched = employers.filter((e) => {
    if (industryFilter && e.industry !== industryFilter) return false;
    if (cityFilter && e.city !== cityFilter) return false;
    if (stageFilter && e.partnershipStage !== stageFilter) return false;
    if (!term) return true;
    const hay = (e.businessName + " " + (e.contactName || "") + " " + (e.city || "") + " " + (e.contactEmail || "")).toLowerCase();
    return hay.indexOf(term) !== -1;
  });
  const sorted = matched.slice().sort((a, b) => (a.businessName || "").localeCompare(b.businessName || ""));
  const paged = paginateList(sorted, page, pageSize);

  function setOpen(key, val) { setOpens((prev) => Object.assign({}, prev, { [key]: val })); }

  function scrollToAddEmployer() {
    setOpen("addEmployer", true);
    addEmployerRef.current && addEmployerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeEmployer(id) {
    const ok = await requestConfirm(t("removeEmployerConfirm"), { danger: true });
    if (!ok) return;
    await deleteEmployer(id);
  }

  const selectClass = "h-11 min-h-0 rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("employersTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("employersDesc")}</p>
        </div>
        <Button size="lg" className="gap-2" onClick={scrollToAddEmployer}>
          <Plus className="h-4 w-4" /> {t("addEmployerBtn")}
        </Button>
      </div>

      <AddEmployerCard forwardRef={addEmployerRef} collapsed={!opens.addEmployer} onToggle={() => setOpen("addEmployer", !opens.addEmployer)} />

      <Card className="mt-5">
        <CardContent className="space-y-4 p-5">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("employerSearchPlaceholder")}
            aria-label={t("employerSearchPlaceholder")}
            className="h-12 min-h-0 w-full rounded-xl border border-border bg-background px-4 text-base text-card-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />

          <div className="flex flex-wrap gap-3">
            <select aria-label={t("industryLabel")} value={industryFilter} onChange={(e) => { setIndustryFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allIndustriesLabel")}</option>
              {activeIndustryList(data.customIndustries, data.disabledIndustries).map((i) => <option key={i.key} value={i.key}>{i.en}</option>)}
            </select>
            <select aria-label={t("city")} value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allCitiesLabel")}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label={t("partnershipStageLabel")} value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allStagesLabel")}</option>
              {EMPLOYER_PARTNERSHIP_STAGES.map((s) => <option key={s.key} value={s.key}>{partnershipStageLabel(s.key)}</option>)}
            </select>
          </div>

          {paged.items.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paged.items.map((e) => <EmployerCard key={e.id} employer={e} onRemove={() => removeEmployer(e.id)} />)}
            </div>
          ) : (
            <EmptyState icon="jobdeveloper" message={t("noEmployersYet")} />
          )}

          <Pagination
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelClients")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        </CardContent>
      </Card>
    </>
  );
}
