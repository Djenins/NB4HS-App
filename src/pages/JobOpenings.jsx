// JobOpenings.jsx -- standalone Job Openings list, Phase 2 of the Employer &
// Job Opportunity Management module. Same Tailwind/shadcn table idiom as
// JobDeveloper.jsx, plus the JobOpeningWizard.jsx create/edit modal and
// JobOpeningDetailModal.jsx read-only view.
import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { createJobOpening, deleteJobOpening, updateJobOpening } from "../lib/clientsData.js";
import {
  EDUCATION_LEVELS, EMPLOYMENT_TYPES, ENGLISH_LEVEL_REQUIREMENTS, JOB_OPENING_STATUSES,
  educationLevelLabel, employmentTypeLabel, englishLevelLabel, formatPayRange, jobOpeningSortKey, statusBadgeVariant, statusLabel
} from "../lib/jobOpenings.js";
import { hasReachedInterview } from "../lib/referrals.js";
import { activeIndustryList, fmtDateLong } from "../lib/utils.js";
import { paginateList } from "../lib/pagination.js";
import EmptyState from "../components/EmptyState.jsx";
import JobOpeningDetailModal from "../components/JobOpeningDetailModal.jsx";
import JobOpeningWizard from "../components/JobOpeningWizard.jsx";
import Pagination from "../components/Pagination.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";

export default function JobOpenings() {
  const { data, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
  const [educationFilter, setEducationFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [englishFilter, setEnglishFilter] = useState("");
  const [transportationFilter, setTransportationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const employers = data.employers || [];
  const openings = data.jobOpenings || [];
  const employerIndustryById = {};
  employers.forEach((e) => { employerIndustryById[e.id] = e.industry; });
  const cities = Array.from(new Set(openings.map((o) => o.employerCity).filter(Boolean))).sort();

  const term = search.trim().toLowerCase();
  const matched = openings.filter((o) => {
    if (cityFilter && o.employerCity !== cityFilter) return false;
    if (industryFilter && employerIndustryById[o.employerId] !== industryFilter) return false;
    if (employmentTypeFilter && o.employmentType !== employmentTypeFilter) return false;
    if (educationFilter && o.education !== educationFilter) return false;
    if (experienceFilter && o.experience !== experienceFilter) return false;
    if (englishFilter && o.englishLevelRequired !== englishFilter) return false;
    if (transportationFilter === "yes" && !o.transportationRequired) return false;
    if (transportationFilter === "no" && o.transportationRequired) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (!term) return true;
    const hay = ((o.title || "") + " " + (o.employerName || "")).toLowerCase();
    return hay.indexOf(term) !== -1;
  });
  const sorted = matched.slice().sort((a, b) => jobOpeningSortKey(a) - jobOpeningSortKey(b) || (b.postedDate || "").localeCompare(a.postedDate || ""));
  const paged = paginateList(sorted, page, pageSize);

  async function createFromWizard(fields, status) {
    await createJobOpening(Object.assign({}, fields, { status }));
    setAdding(false);
    showToast(t("jobOpeningAdded"));
  }
  async function updateFromWizard(fields, status) {
    await updateJobOpening(editing.id, Object.assign({}, fields, { status }));
    setEditing(null);
    showToast(t("jobOpeningUpdated"));
  }
  async function archiveOpening(o) {
    const ok = await requestConfirm(t("archiveJobOpeningConfirm"));
    if (!ok) return;
    await updateJobOpening(o.id, { status: "archived" });
  }
  async function removeOpening(o) {
    const ok = await requestConfirm(t("removeJobOpeningConfirm"), { danger: true });
    if (!ok) return;
    await deleteJobOpening(o.id);
  }

  const selectClass = "h-11 min-h-0 rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("jobOpeningsTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("jobOpeningsDesc")}</p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {t("addJobBtn")}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <input
            type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("jobOpeningSearchPlaceholder")} aria-label={t("jobOpeningSearchPlaceholder")}
            className="h-12 min-h-0 w-full rounded-xl border border-border bg-background px-4 text-base text-card-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />

          <div className="flex flex-wrap gap-3">
            <select aria-label={t("city")} value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allCitiesLabel")}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label={t("industryLabel")} value={industryFilter} onChange={(e) => { setIndustryFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allIndustriesLabel")}</option>
              {activeIndustryList(data.customIndustries, data.disabledIndustries).map((i) => <option key={i.key} value={i.key}>{i.en}</option>)}
            </select>
            <select aria-label={t("employmentTypeLabel")} value={employmentTypeFilter} onChange={(e) => { setEmploymentTypeFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allEmploymentTypesLabel")}</option>
              {EMPLOYMENT_TYPES.map((et) => <option key={et.key} value={et.key}>{et.en}</option>)}
            </select>
            <select aria-label={t("educationLabel")} value={educationFilter} onChange={(e) => { setEducationFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allEducationLevelsLabel")}</option>
              {EDUCATION_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
            </select>
            <select aria-label={t("experienceLabel")} value={experienceFilter} onChange={(e) => { setExperienceFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allExperienceLevelsLabel")}</option>
              {EXPERIENCE_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
            </select>
            <select aria-label={t("englishLevelRequiredLabel")} value={englishFilter} onChange={(e) => { setEnglishFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allEnglishLevelsLabel")}</option>
              {ENGLISH_LEVEL_REQUIREMENTS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
            </select>
            <select aria-label={t("transportationRequiredLabel")} value={transportationFilter} onChange={(e) => { setTransportationFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("anyTransportationLabel")}</option>
              <option value="yes">{t("yesOption")}</option>
              <option value="no">{t("noOption")}</option>
            </select>
            <select aria-label={t("statusLabel")} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">{t("allStatusesLabel")}</option>
              {JOB_OPENING_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
            </select>
          </div>

          {paged.items.length ? (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("positionLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("companyLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("locationLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("payLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("employmentTypeLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("openingsCountLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("referralsLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("totalInterviewsLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("totalHiresLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("statusLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("postedDateLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("actionsLabel")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.items.map((o) => {
                    const openingReferrals = (data.referrals || []).filter((r) => r.jobOpeningId === o.id);
                    const interviews = openingReferrals.filter((r) => hasReachedInterview(r.status)).length;
                    const hires = openingReferrals.filter((r) => r.status === "hired").length;
                    return (
                      <tr key={o.id} className="hover:bg-background">
                        <td className="px-3 py-3 text-sm font-bold text-card-foreground">{o.title}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{o.employerName || "—"}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{o.employerCity || "—"}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{formatPayRange(o) || "—"}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{employmentTypeLabel(o.employmentType) || "—"}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{o.openingsCount}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{openingReferrals.length}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{interviews}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{hires}</td>
                        <td className="px-3 py-3"><Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge></td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{fmtDateLong(o.postedDate)}</td>
                        <td className="px-3 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("actionsLabel")}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setViewing(o)}>{t("viewLabel")}</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setEditing(o)}>{t("editLabel")}</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => navigate("/candidatematching", { state: { openingId: o.id } })}>{t("referCandidateActionLabel")}</DropdownMenuItem>
                              {o.status !== "archived" && <DropdownMenuItem onSelect={() => archiveOpening(o)}>{t("archiveLabel")}</DropdownMenuItem>}
                              <DropdownMenuItem onSelect={() => removeOpening(o)} className="text-accent focus:bg-tint-danger">{t("deleteLabel")}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="jobdeveloper" message={t("noJobOpeningsYet")} />
          )}

          <Pagination
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelClients")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        </CardContent>
      </Card>

      {adding && <JobOpeningWizard employers={employers} onSave={createFromWizard} onCancel={() => setAdding(false)} />}
      {editing && <JobOpeningWizard jobOpening={editing} employers={employers} onSave={updateFromWizard} onCancel={() => setEditing(null)} />}
      {viewing && <JobOpeningDetailModal jobOpening={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
