// Manage.jsx -- Administrator's services/staff/classroom management screen.
// Ported from manage.js's renderManage()/renderClassManageCard()/
// attachManageHandlers(). Classroom deletion uses AppContext's promise-based
// requestConfirm() in place of the original's callback-based showConfirmModal().
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { classByKey, meetingDaysLabel, studentsForClass } from "../lib/students.js";
import { fullServiceList, fullStaffList, slugify } from "../lib/utils.js";
import { createClass, deleteClass, updateClass } from "../lib/checkinData.js";
import ManageListCard from "../components/ManageListCard.jsx";

function ClassManageCard({ c }) {
  const { data, lang, requestConfirm } = useApp();
  const t = useT();
  const roster = studentsForClass(data.students, c.key);

  async function toggleActive(checked) {
    await updateClass(c.key, { active: checked });
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
        <h3 style={{ margin: 0 }}>
          {c.name}{" "}
          {c.custom && <span className="badge badge-in">{t("customLabel")}</span>}
        </h3>
        {c.custom && <button className="btn-ghost btn-sm btn-outline-danger" onClick={deleteClassroom}>{t("deleteLabel")}</button>}
      </div>
      <p className="muted" style={{ marginTop: 4 }}>{t("meetsOn")}: {meetingDaysLabel(c.days, lang)}</p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, marginBottom: 12 }}>
        <input type="checkbox" checked={c.active !== false} onChange={(e) => toggleActive(e.target.checked)} />
        {c.active !== false ? t("activeLabel") : t("inactiveLabel")}
      </label>
      <p className="muted">{t("rosterTitle")}: {roster.length}</p>
      <p className="muted" style={{ fontSize: ".85rem" }}>{t("manageRosterHere")}</p>
    </div>
  );
}

export default function Manage() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const [newClassName, setNewClassName] = useState("");
  const [newClassDays, setNewClassDays] = useState([]);

  const dayNames = WEEKDAYS[lang] || WEEKDAYS.en;

  function toggleDay(d) {
    setNewClassDays((prev) => (prev.indexOf(d) !== -1 ? prev.filter((x) => x !== d) : prev.concat([d])));
  }

  async function addClassroom() {
    const name = newClassName.trim();
    if (!name) { showToast(t("fixErrors")); return; }
    const existingKeys = (data.classes || []).map((c) => c.key);
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
      <h1>{t("navManage")}</h1>
      <div className="grid grid-2">
        <ManageListCard
          kind="service"
          title={t("manageServicesTitle")}
          list={fullServiceList(data.customServices)}
          disabled={data.disabledServices || []}
          placeholder={t("newServiceName")}
        />
        <ManageListCard
          kind="staff"
          title={t("manageStaffTitle")}
          list={fullStaffList(data.customStaff)}
          disabled={data.disabledStaff || []}
          placeholder={t("newStaffName")}
        />
      </div>

      <h2>{t("manageClassesTitle")}</h2>
      <div className="grid grid-3">
        {(data.classes || []).map((c) => <ClassManageCard c={c} key={c.key} />)}
      </div>

      <div className="card">
        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("addClassroomTitle")}</h3>
            <p>{t("sectionNewClassroomDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="field">
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
                <label className="pill" style={{ cursor: "pointer" }} key={d}>
                  <input type="checkbox" style={{ marginRight: 6 }} checked={newClassDays.indexOf(d) !== -1} onChange={() => toggleDay(d)} />
                  {dayNames[d]}
                </label>
              ))}
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{t("noDaysMeansOnline")}</p>
            <button className="btn-primary" onClick={addClassroom}>{t("addClassroom")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
