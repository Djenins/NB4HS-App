// Manage.jsx -- Administrator's services/staff/classroom management screen.
// Ported from manage.js's renderManage()/renderClassManageCard()/
// attachManageHandlers(). Classroom deletion uses AppContext's promise-based
// requestConfirm() in place of the original's callback-based showConfirmModal().
//
// On the NB4HS Operate design system (plans/ui-design-system.md, batch 3e):
// PageHeader, the active counts as a KpiCard row, SectionCards for the lists
// and the add forms, and ActiveToggle switches. Every save, toggle and
// delete calls the same helper as before.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle2, GraduationCap, HelpCircle, MapPin, Plus, Trash2, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { meetingDaysLabel, studentsForClass } from "../lib/students.js";
import { fullIndustryList, fullServiceList, fullStaffList, slugify } from "../lib/utils.js";
import { createClass, deleteClass, subscribeTable, updateClass } from "../lib/checkinData.js";
import { createGrant, deleteGrant, fetchGrants, updateGrant } from "../lib/grants.js";
import ManageListCard, { ActiveToggle } from "../components/ManageListCard.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { Field, Input } from "../components/ui/field.jsx";
import { FilterChips } from "../components/ui/filter-chips.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";

// A titled group of cards on the page (Classrooms, Grants): a section
// heading with its one-line description, then the cards.
function GroupHeading({ title, desc }) {
  return (
    <div className="mb-4 mt-8">
      <h2 className="m-0 text-section font-semibold text-card-foreground">{title}</h2>
      <p className="m-0 mt-0.5 text-meta text-muted">{desc}</p>
    </div>
  );
}

function ClassManageCard({ c }) {
  const { data, lang, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const roster = studentsForClass(data.students, c.key);
  // Local override so the pill flips immediately on click instead of
  // waiting on the round trip + realtime refetch of `classes`.
  const [activeOverride, setActiveOverride] = useState(null);
  const isActive = activeOverride !== null ? activeOverride : c.active !== false;
  // Location saves on blur / Enter rather than behind its own Save button --
  // it's one short line, edited in place. The draft resyncs whenever the
  // stored value changes (realtime refetch, another staff member's edit).
  const [locationDraft, setLocationDraft] = useState(c.location || "");
  useEffect(() => { setLocationDraft(c.location || ""); }, [c.location]);

  async function saveLocation() {
    const next = locationDraft.trim();
    if (next === (c.location || "")) { setLocationDraft(next); return; }
    try {
      await updateClass(c.key, { location: next });
      showToast(t("classLocationSaved"));
    } catch (err) {
      setLocationDraft(c.location || "");
      showToast(t("classLocationSaveError"));
    }
  }

  async function toggleActive() {
    const next = !isActive;
    setActiveOverride(next);
    try {
      await updateClass(c.key, { active: next });
    } catch (err) {
      setActiveOverride(null);
      showToast(t("manageToggleError"));
      throw err;
    }
  }

  // The `students.class_key` foreign key is `on delete set null`, so
  // deleting the class row in Postgres automatically un-places every
  // student who was in it -- no separate client-side sweep needed here
  // (unlike the old localStorage version, which had to do that by hand).
  async function deleteClassroom() {
    const ok = await requestConfirm(t("deleteClassroomConfirm"), { danger: true });
    if (!ok) return;
    await deleteClass(c.key);
  }

  const locationId = "class-location-" + c.key;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 flex flex-wrap items-center gap-2 text-section font-semibold text-card-foreground">
            <span className="break-words">{c.name}</span>
            {c.custom ? <Badge variant="neutral">{t("customLabel")}</Badge> : null}
          </h3>
          <p className="m-0 mt-1 text-meta text-muted">{t("meetsOn")}: {meetingDaysLabel(c.days, lang)}</p>
        </div>
        {c.custom ? (
          <IconButton size="sm" variant="danger" label={t("deleteLabel") + " " + c.name} onClick={deleteClassroom}>
            <Trash2 aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      <Field className="mt-4" label={<span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted" aria-hidden="true" />{t("classLocationLabel")}</span>} htmlFor={locationId}>
        <Input
          id={locationId}
          maxLength={80}
          placeholder={t("classLocationPlaceholder")}
          value={locationDraft}
          onChange={(e) => setLocationDraft(e.target.value)}
          onBlur={saveLocation}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setLocationDraft(c.location || ""); }}
        />
      </Field>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <ActiveToggle name={c.name} active={isActive} onToggle={toggleActive} />
        <span className="text-meta tabular-nums text-muted">{t("rosterTitle")}: {roster.length}</span>
      </div>
      <p className="m-0 mt-3 text-meta text-muted">{t("manageRosterHere")}</p>
      <div className="mt-auto pt-3">
        <Button variant="secondary" size="sm" onClick={() => navigate("/students/classrooms")}>
          <Users className="h-4 w-4" aria-hidden="true" />{t("viewStudentsLabel")}
        </Button>
      </div>
    </Card>
  );
}

function GrantRow({ g }) {
  const { requestConfirm, showToast } = useApp();
  const t = useT();
  const [activeOverride, setActiveOverride] = useState(null);
  const isActive = activeOverride !== null ? activeOverride : g.active !== false;

  async function toggleActive() {
    const next = !isActive;
    setActiveOverride(next);
    try {
      await updateGrant(g.id, { active: next });
    } catch (err) {
      setActiveOverride(null);
      showToast(t("manageToggleError"));
      throw err;
    }
  }

  async function removeGrant() {
    const ok = await requestConfirm("Delete this grant? Any service tags linked to it will also be removed.", { danger: true });
    if (!ok) return;
    await deleteGrant(g.id);
  }

  const period = [g.periodStart, g.periodEnd].filter(Boolean).join(" – ");

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 break-words text-section font-semibold text-card-foreground">{g.name}</h3>
          {g.funder ? <p className="m-0 mt-1 text-meta text-muted">{g.funder}</p> : null}
          {period ? <p className="m-0 mt-0.5 text-meta tabular-nums text-muted">{period}</p> : null}
        </div>
        <IconButton size="sm" variant="danger" label={t("deleteLabel") + " " + g.name} onClick={removeGrant}>
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>
      <div className="mt-auto pt-4">
        <ActiveToggle name={g.name} active={isActive} onToggle={toggleActive} />
      </div>
    </Card>
  );
}

function GrantsManageCard() {
  const { showToast } = useApp();
  const [grants, setGrants] = useState([]);
  const [name, setName] = useState("");
  const [funder, setFunder] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchGrants().then((rows) => { if (!cancelled) setGrants(rows); });
    const unsub = subscribeTable("grants", () => { fetchGrants().then((rows) => { if (!cancelled) setGrants(rows); }); });
    return () => { cancelled = true; unsub(); };
  }, []);

  async function addGrant() {
    const trimmed = name.trim();
    if (!trimmed) { showToast("Enter a grant name."); return; }
    await createGrant({ name: trimmed, funder: funder.trim(), periodStart, periodEnd, active: true });
    setName(""); setFunder(""); setPeriodStart(""); setPeriodEnd("");
    showToast("Grant added ✓");
  }

  return (
    <>
      <GroupHeading title="Grants" desc="Track funder grants so services can be tagged for reporting." />
      {grants.length ? (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {grants.map((g) => <GrantRow g={g} key={g.id} />)}
        </div>
      ) : null}

      <SectionCard title="Add a Grant" description="Name it after the funder/program so staff can pick it when tagging a service.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Grant Name" htmlFor="new-grant-name" required>
            <Input id="new-grant-name" placeholder="e.g. RI DOL Workforce Development FY26" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Funder" htmlFor="new-grant-funder">
            <Input id="new-grant-funder" placeholder="e.g. RI Department of Labor and Training" value={funder} onChange={(e) => setFunder(e.target.value)} />
          </Field>
          <Field label="Period Start" htmlFor="new-grant-start">
            <Input id="new-grant-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period End" htmlFor="new-grant-end">
            <Input id="new-grant-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>
        <Button className="mt-5" onClick={addGrant}><Plus className="h-4 w-4" aria-hidden="true" />Add Grant</Button>
      </SectionCard>
    </>
  );
}

export default function Manage() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const [newClassName, setNewClassName] = useState("");
  const [newClassDays, setNewClassDays] = useState([]);
  const [newClassLocation, setNewClassLocation] = useState("");

  const dayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const serviceList = fullServiceList(data.customServices);
  const staffList = fullStaffList(data.customStaff);
  const industryList = fullIndustryList(data.customIndustries);
  const disabledServices = data.disabledServices || [];
  const disabledStaff = data.disabledStaff || [];
  const disabledIndustries = data.disabledIndustries || [];
  const classes = data.classes || [];
  const activeServicesCount = serviceList.filter((i) => disabledServices.indexOf(i.key) === -1).length;
  const activeStaffCount = staffList.filter((i) => disabledStaff.indexOf(i.key) === -1).length;
  const activeClassesCount = classes.filter((c) => c.active !== false).length;

  async function addClassroom() {
    const name = newClassName.trim();
    if (!name) { showToast(t("fixErrors")); return; }
    const existingKeys = classes.map((c) => c.key);
    let key = "custom_" + slugify(name);
    let suffix = 1;
    while (existingKeys.indexOf(key) !== -1) { key = "custom_" + slugify(name) + "_" + suffix; suffix++; }
    await createClass({ key, name, days: newClassDays.slice(), service: "adult_education", staff: "esl_instructor", location: newClassLocation, active: true, custom: true });
    setNewClassName("");
    setNewClassDays([]);
    setNewClassLocation("");
    showToast(t("addClassroom") + " ✓");
  }

  return (
    <>
      <PageHeader
        title={t("navManage")}
        description={t("manageListsSubtitle")}
        actions={
          <Button variant="secondary" onClick={() => showToast(t("manageHelpToast"))}>
            <HelpCircle className="h-4 w-4" aria-hidden="true" />{t("helpLabel")}
          </Button>
        }
      />

      <section aria-label={t("summaryTitle")} className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label={t("servicesActiveStat")} value={activeServicesCount} icon={Briefcase} tone="info" />
        <KpiCard label={t("staffActiveStat")} value={activeStaffCount} icon={Users} tone="violet" />
        <KpiCard label={t("classroomsActiveStat")} value={activeClassesCount} icon={GraduationCap} tone="success" />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <ManageListCard
          kind="service"
          title={t("manageServicesTitle")}
          description={t("manageServicesDesc")}
          list={serviceList}
          disabled={disabledServices}
          placeholder={t("newServiceName")}
        />
        <ManageListCard
          kind="staff"
          title={t("manageStaffTitle")}
          description={t("manageStaffDesc")}
          list={staffList}
          disabled={disabledStaff}
          placeholder={t("newStaffName")}
        />
        <ManageListCard
          kind="industry"
          title={t("manageIndustriesTitle")}
          description={t("manageIndustriesDesc")}
          list={industryList}
          disabled={disabledIndustries}
          placeholder={t("addIndustryPlaceholder")}
        />
      </div>

      <GroupHeading title={t("manageClassesTitle")} desc={t("manageClassesDesc")} />
      {classes.length ? (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => <ClassManageCard c={c} key={c.key} />)}
        </div>
      ) : null}

      <SectionCard title={t("addClassroomTitle")} description={t("sectionNewClassroomDesc")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("classroomNameLabel")} htmlFor="new-class-name" required>
            <Input id="new-class-name" placeholder={t("classroomNamePlaceholder")} value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
          </Field>
          <Field label={t("classLocationOptional")} htmlFor="new-class-location" hint={t("classLocationHint")}>
            <Input
              id="new-class-location"
              maxLength={80}
              placeholder={t("classLocationPlaceholder")}
              value={newClassLocation}
              onChange={(e) => setNewClassLocation(e.target.value)}
              aria-describedby="new-class-location-hint"
            />
          </Field>
        </div>
        <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
          <legend className="mb-2 p-0 text-meta font-semibold text-card-foreground">{t("meetsOn")}</legend>
          <FilterChips
            label={t("meetsOn")}
            multiple
            value={newClassDays}
            onChange={setNewClassDays}
            options={[0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: d, label: dayNames[d] }))}
          />
          <p className="m-0 mt-2 text-meta text-muted">{t("noDaysMeansOnline")}</p>
        </fieldset>
        <Button className="mt-5" onClick={addClassroom}><Plus className="h-4 w-4" aria-hidden="true" />{t("addClassroom")}</Button>
      </SectionCard>

      <GrantsManageCard />

      <SectionCard className="mt-8" title={t("tipsTitle")} description={t("tipsSubtitle")}>
        <ul className="m-0 list-none space-y-2.5 p-0">
          {["tipInactiveHidden", "tipChangesImmediate", "tipClearNames"].map((k) => (
            <li key={k} className="flex items-start gap-2.5 text-ui text-card-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tone-success-ink" aria-hidden="true" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
