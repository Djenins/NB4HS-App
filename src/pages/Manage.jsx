// Manage.jsx -- Administrator's services/staff/classroom management screen.
// Ported from manage.js's renderManage()/renderClassManageCard()/
// attachManageHandlers(). Classroom deletion uses AppContext's promise-based
// requestConfirm() in place of the original's callback-based showConfirmModal().
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Briefcase, Building2, CheckCircle2, GraduationCap, HelpCircle, Info, MapPin, Plus, Trash2, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { meetingDaysLabel, studentsForClass } from "../lib/students.js";
import { fullIndustryList, fullServiceList, fullStaffList, slugify } from "../lib/utils.js";
import { createClass, deleteClass, subscribeTable, updateClass } from "../lib/checkinData.js";
import { createGrant, deleteGrant, fetchGrants, updateGrant } from "../lib/grants.js";
import ManageListCard from "../components/ManageListCard.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Field, Input } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { Switch } from "../components/ui/switch.jsx";

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
    <SectionCard
      title={<span className="flex flex-wrap items-center gap-2">{c.name}{c.custom && <Badge variant="neutral">{t("customLabel")}</Badge>}</span>}
      description={t("meetsOn") + ": " + meetingDaysLabel(c.days, lang)}
      action={c.custom ? <Button variant="ghost" size="sm" className="text-tone-danger-ink hover:bg-tone-danger-bg" onClick={deleteClassroom}><Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteLabel")}</Button> : null}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-meta text-muted tabular-nums">{t("rosterTitle")}: {roster.length}</span>
          <Button variant="secondary" size="sm" onClick={() => navigate("/students/classrooms")}>
            <Users className="h-4 w-4" aria-hidden="true" />{t("viewStudentsLabel")}
          </Button>
        </div>
      }
    >
      <Field label={<span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted" aria-hidden="true" />{t("classLocationLabel")}</span>} htmlFor={locationId} hint={t("manageRosterHere")}>
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
      <div className="mt-3">
        <Switch checked={isActive} onCheckedChange={() => toggleActive().catch(() => {})} label={c.name} onText={t("activeLabel")} offText={t("inactiveLabel")} />
      </div>
    </SectionCard>
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
    <SectionCard
      title={g.name}
      description={[g.funder, period].filter(Boolean).join(" · ") || null}
      action={<IconButton label={"Delete " + g.name} variant="danger" size="sm" onClick={removeGrant}><Trash2 aria-hidden="true" /></IconButton>}
    >
      <Switch checked={isActive} onCheckedChange={() => toggleActive().catch(() => {})} label={g.name} onText={t("activeLabel")} offText={t("inactiveLabel")} />
    </SectionCard>
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
    <section aria-labelledby="manage-grants-title" className="flex flex-col gap-4">
      <GroupHeading id="manage-grants-title" icon={Award} title="Grants" description="Track funder grants so services can be tagged for reporting." />
      {grants.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {grants.map((g) => <GrantRow g={g} key={g.id} />)}
        </div>
      ) : null}
      <SectionCard title="Add a grant" description="Name it after the funder or program so staff can pick it when tagging a service.">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); addGrant(); }}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Grant name" htmlFor="grant-name" required>
              <Input id="grant-name" placeholder="e.g. RI DOL Workforce Development FY26" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Funder" htmlFor="grant-funder">
              <Input id="grant-funder" placeholder="e.g. RI Department of Labor and Training" value={funder} onChange={(e) => setFunder(e.target.value)} />
            </Field>
            <Field label="Period start" htmlFor="grant-start">
              <Input id="grant-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </Field>
            <Field label="Period end" htmlFor="grant-end">
              <Input id="grant-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </Field>
          </div>
          <div><Button type="submit"><Plus className="h-4 w-4" aria-hidden="true" />Add grant</Button></div>
        </form>
      </SectionCard>
    </section>
  );
}

// A heading for a group of cards on this page (Classrooms, Grants).
function GroupHeading({ id, icon: GroupIcon, title, description }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-primary-tint text-primary">
        <GroupIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="m-0 text-heading font-bold text-card-foreground">{title}</h2>
        <p className="m-0 mt-0.5 text-meta text-muted">{description}</p>
      </div>
    </div>
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

  function toggleDay(d) {
    setNewClassDays((prev) => (prev.indexOf(d) !== -1 ? prev.filter((x) => x !== d) : prev.concat([d])));
  }

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
        actions={<Button variant="secondary" onClick={() => showToast(t("manageHelpToast"))}><HelpCircle className="h-4 w-4" aria-hidden="true" />{t("helpLabel")}</Button>}
      />

      <div className="flex flex-col gap-6">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ManageListCard
            kind="service"
            icon={<Briefcase />}
            title={t("manageServicesTitle")}
            description={t("manageServicesDesc")}
            list={serviceList}
            disabled={disabledServices}
            placeholder={t("newServiceName")}
          />
          <ManageListCard
            kind="staff"
            icon={<Users />}
            title={t("manageStaffTitle")}
            description={t("manageStaffDesc")}
            list={staffList}
            disabled={disabledStaff}
            placeholder={t("newStaffName")}
          />
          <ManageListCard
            kind="industry"
            icon={<Building2 />}
            title={t("manageIndustriesTitle")}
            description={t("manageIndustriesDesc")}
            list={industryList}
            disabled={disabledIndustries}
            placeholder={t("addIndustryPlaceholder")}
          />
        </div>

        <section aria-labelledby="manage-classes-title" className="flex flex-col gap-4">
          <GroupHeading id="manage-classes-title" icon={GraduationCap} title={t("manageClassesTitle")} description={t("manageClassesDesc")} />
          {classes.length ? (
            <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {classes.map((c) => <ClassManageCard c={c} key={c.key} />)}
            </div>
          ) : null}

          <SectionCard title={t("addClassroomTitle")} description={t("sectionNewClassroomDesc")}>
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); addClassroom(); }}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("classroomNameLabel")} htmlFor="new-class-name" required>
                  <Input id="new-class-name" placeholder={t("classroomNamePlaceholder")} value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
                </Field>
                <Field label={t("classLocationOptional")} htmlFor="new-class-location" hint={t("classLocationHint")}>
                  <Input id="new-class-location" maxLength={80} placeholder={t("classLocationPlaceholder")} value={newClassLocation} onChange={(e) => setNewClassLocation(e.target.value)} />
                </Field>
              </div>
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-1.5 p-0 text-meta font-semibold text-card-foreground">{t("meetsOn")}</legend>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const on = newClassDays.indexOf(d) !== -1;
                    return (
                      <label
                        key={d}
                        className={"inline-flex h-9 cursor-pointer items-center gap-2 rounded-chip border px-4 text-meta font-semibold transition-colors duration-fast focus-within:ring-2 [@media(pointer:coarse)]:h-11 " +
                          (on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground hover:border-primary hover:text-primary")}
                      >
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleDay(d)} />
                        {dayNames[d]}
                      </label>
                    );
                  })}
                </div>
                <p className="m-0 mt-2 flex items-start gap-2 text-meta text-muted">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t("noDaysMeansOnline")}
                </p>
              </fieldset>
              <div><Button type="submit"><Plus className="h-4 w-4" aria-hidden="true" />{t("addClassroom")}</Button></div>
            </form>
          </SectionCard>
        </section>

        <GrantsManageCard />

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <SectionCard title={t("summaryTitle")} description={t("summarySubtitle")}>
            <dl className="m-0 grid grid-cols-3 gap-4">
              {[[activeServicesCount, "servicesActiveStat"], [activeStaffCount, "staffActiveStat"], [activeClassesCount, "classroomsActiveStat"]].map(([n, k]) => (
                <div key={k} className="flex min-w-0 flex-col-reverse gap-1">
                  <dt className="text-meta text-muted">{t(k)}</dt>
                  <dd className="m-0 text-kpi font-bold tabular-nums text-card-foreground">{n}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title={t("tipsTitle")} description={t("tipsSubtitle")}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui text-card-foreground">
              {["tipInactiveHidden", "tipChangesImmediate", "tipClearNames"].map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tone-success-ink" aria-hidden="true" />
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
