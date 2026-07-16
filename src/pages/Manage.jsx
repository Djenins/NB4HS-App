// Manage.jsx -- Administrator's services/staff/classroom management screen.
// Ported from manage.js's renderManage()/renderClassManageCard()/
// attachManageHandlers(). Classroom deletion uses AppContext's promise-based
// requestConfirm() in place of the original's callback-based showConfirmModal().
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle2, Circle, ClipboardCheck, GraduationCap, HelpCircle, Info, Plus, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { meetingDaysLabel, studentsForClass } from "../lib/students.js";
import { fullServiceList, fullStaffList, slugify } from "../lib/utils.js";
import { createClass, deleteClass, updateClass } from "../lib/checkinData.js";
import ManageListCard from "../components/ManageListCard.jsx";

function ClassManageCard({ c }) {
  const { data, lang, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const roster = studentsForClass(data.students, c.key);
  // Local override so the pill flips immediately on click instead of
  // waiting on the round trip + realtime refetch of `classes`.
  const [activeOverride, setActiveOverride] = useState(null);
  const isActive = activeOverride !== null ? activeOverride : c.active !== false;

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

  return (
    <div className="card">
      <div className="flex-between">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="icon-badge"><GraduationCap className="icon" /></div>
          <div>
            <h3 style={{ margin: 0 }}>
              {c.name}{" "}
              {c.custom && <span className="badge badge-in">{t("customLabel")}</span>}
            </h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: ".85rem" }}>
              {t("meetsOn")}: {meetingDaysLabel(c.days, lang)}
            </p>
          </div>
        </div>
        {c.custom && <button className="btn-ghost btn-sm btn-outline-danger" onClick={deleteClassroom}>{t("deleteLabel")}</button>}
      </div>

      <button
        type="button"
        className={"btn-icon status-toggle" + (isActive ? " status-toggle-on" : " status-toggle-off")}
        style={{ marginTop: 12 }}
        onClick={toggleActive}
      >
        {isActive ? <CheckCircle2 className="icon" /> : <Circle className="icon" />}
        {isActive ? t("activeLabel") : t("inactiveLabel")}
      </button>

      <p className="muted" style={{ marginTop: 12, marginBottom: 4 }}>{t("rosterTitle")}: {roster.length}</p>
      <p className="muted" style={{ fontSize: ".85rem" }}>{t("manageRosterHere")}</p>
      <button className="btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => navigate("/students")}>
        <Users className="icon" style={{ marginRight: 6 }} /> {t("viewStudentsLabel")}
      </button>
    </div>
  );
}

export default function Manage() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const [newClassName, setNewClassName] = useState("");
  const [newClassDays, setNewClassDays] = useState([]);

  const dayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const serviceList = fullServiceList(data.customServices);
  const staffList = fullStaffList(data.customStaff);
  const disabledServices = data.disabledServices || [];
  const disabledStaff = data.disabledStaff || [];
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
    await createClass({ key, name, days: newClassDays.slice(), service: "adult_education", staff: "esl_instructor", active: true, custom: true });
    setNewClassName("");
    setNewClassDays([]);
    showToast(t("addClassroom") + " ✓");
  }

  return (
    <>
      <div className="flex-between">
        <div>
          <h1>{t("navManage")}</h1>
          <p className="muted" style={{ marginTop: -8 }}>{t("manageListsSubtitle")}</p>
        </div>
        <button className="btn-secondary" onClick={() => showToast(t("manageHelpToast"))}>
          <HelpCircle className="icon" style={{ marginRight: 6 }} /> {t("helpLabel")}
        </button>
      </div>

      <div className="grid grid-2">
        <ManageListCard
          kind="service"
          icon={<Briefcase className="icon" />}
          title={t("manageServicesTitle")}
          description={t("manageServicesDesc")}
          list={serviceList}
          disabled={disabledServices}
          placeholder={t("newServiceName")}
        />
        <ManageListCard
          kind="staff"
          icon={<Users className="icon" />}
          title={t("manageStaffTitle")}
          description={t("manageStaffDesc")}
          list={staffList}
          disabled={disabledStaff}
          placeholder={t("newStaffName")}
        />
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "28px 0 14px" }}>
        <div className="icon-badge"><GraduationCap className="icon" /></div>
        <div>
          <h2 style={{ margin: 0 }}>{t("manageClassesTitle")}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>{t("manageClassesDesc")}</p>
        </div>
      </div>
      <div className="grid grid-3">
        {classes.map((c) => <ClassManageCard c={c} key={c.key} />)}
      </div>

      <div className="card">
        <div className="form-section">
          <div className="form-section-head-row">
            <div className="icon-badge"><Plus className="icon" /></div>
            <div className="form-section-head">
              <h3>{t("addClassroomTitle")}</h3>
              <p>{t("sectionNewClassroomDesc")}</p>
            </div>
          </div>
          <div className="form-section-body">
            <div className="field">
              <label>{t("classroomNameLabel")}</label>
              <input
                type="text"
                placeholder={t("classroomNamePlaceholder")}
                aria-label={t("classroomNamePlaceholder")}
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
              />
            </div>
            <label>{t("meetsOn")}</label>
            <div className="pill-row">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <label className={"pill" + (newClassDays.indexOf(d) !== -1 ? " active" : "")} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }} key={d}>
                  <input type="checkbox" style={{ marginRight: 6 }} checked={newClassDays.indexOf(d) !== -1} onChange={() => toggleDay(d)} />
                  {dayNames[d]}
                </label>
              ))}
            </div>
            <p className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: ".85rem" }}>
              <Info className="icon" style={{ flex: "0 0 auto", marginTop: 2 }} /> {t("noDaysMeansOnline")}
            </p>
            <button className="btn-primary" onClick={addClassroom}>
              <Plus className="icon" style={{ marginRight: 6 }} /> {t("addClassroom")}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div className="icon-badge"><ClipboardCheck className="icon" /></div>
            <div>
              <h3 style={{ margin: 0 }}>{t("summaryTitle")}</h3>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>{t("summarySubtitle")}</p>
            </div>
          </div>
          <div className="manage-stat-row" style={{ marginTop: 20 }}>
            <div>
              <div className="stat-num">{activeServicesCount}</div>
              <div className="stat-label">{t("servicesActiveStat")}</div>
            </div>
            <div>
              <div className="stat-num">{activeStaffCount}</div>
              <div className="stat-label">{t("staffActiveStat")}</div>
            </div>
            <div>
              <div className="stat-num">{activeClassesCount}</div>
              <div className="stat-label">{t("classroomsActiveStat")}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div className="icon-badge success"><Info className="icon" /></div>
            <div>
              <h3 style={{ margin: 0 }}>{t("tipsTitle")}</h3>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>{t("tipsSubtitle")}</p>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="tip-row"><CheckCircle2 className="icon" /> <span>{t("tipInactiveHidden")}</span></div>
            <div className="tip-row"><CheckCircle2 className="icon" /> <span>{t("tipChangesImmediate")}</span></div>
            <div className="tip-row"><CheckCircle2 className="icon" /> <span>{t("tipClearNames")}</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
