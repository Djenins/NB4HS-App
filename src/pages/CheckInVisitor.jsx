// CheckInVisitor.jsx -- the full visitor check-in form. Ported from
// checkin_checkout.js's renderCheckInVisitor()/attachCheckInHandlers().
// Fields are uncontrolled (read via FormData on submit, exactly like the
// original) except the service/staff selects, which need React state to
// toggle the "other, please specify" inputs. Validation rules (required
// fields, phone/zip regexes) are copied verbatim.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { US_STATES } from "../lib/constants.js";
import { activeServiceList, activeStaffList, fmtTime, todayStr, uid } from "../lib/utils.js";
import { createVisit } from "../lib/checkinData.js";
import FormField from "../components/FormField.jsx";

export default function CheckInVisitor() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [service, setService] = useState("");
  const [staff, setStaff] = useState("");
  const [errors, setErrors] = useState([]);

  const services = activeServiceList(data.customServices, data.disabledServices);
  const staffList = activeStaffList(data.customStaff, data.disabledStaff);

  async function handleSubmit(e) {
    e.preventDefault();
    const form = formRef.current;
    const fd = new FormData(form);
    const v = {};
    fd.forEach((val, key) => { v[key] = (val || "").toString().trim(); });

    const errs = [];
    ["firstName", "lastName", "phone", "address", "city", "zip"].forEach((f) => { if (!v[f]) errs.push(f); });
    if (!v.service) errs.push("service");
    if (v.service === "other" && !v.serviceOther) errs.push("serviceOther");
    if (!v.staff) errs.push("staff");
    if (v.staff === "other" && !v.staffOther) errs.push("staffOther");
    if (v.phone && !/^[0-9()\-\s.+]{7,20}$/.test(v.phone)) errs.push("phone");
    if (v.zip && !/^\d{5}(-\d{4})?$/.test(v.zip)) errs.push("zip");

    if (errs.length) {
      const uniqueErrors = errs.filter((f, i) => errs.indexOf(f) === i);
      setErrors(uniqueErrors);
      showToast(t("fixErrors"));
      const firstEl = form.querySelector('[name="' + uniqueErrors[0] + '"]');
      if (firstEl) firstEl.focus();
      return;
    }
    setErrors([]);

    const now = new Date();
    const record = {
      id: uid(), firstName: v.firstName, lastName: v.lastName, phone: v.phone, email: v.email || "",
      address: v.address, city: v.city, state: v.state || "RI", zip: v.zip,
      service: v.service, serviceOther: v.serviceOther || "",
      staff: v.staff, staffOther: v.staffOther || "",
      notes: v.notes || "", date: todayStr(), timeIn: now.toISOString(), timeOut: null
    };
    const created = await createVisit(record);
    navigate("/checkin/success", { state: { lastCheckInId: created.id } });
  }

  const isInvalid = (name) => errors.indexOf(name) !== -1;
  const invalidCls = (name) => (isInvalid(name) ? "field-invalid" : "");

  return (
    <div className="kiosk-wrap">
      <div className="card">
        <button className="btn-ghost no-print" style={{ marginBottom: 14 }} onClick={() => navigate("/checkin")}>&larr; {t("back")}</button>
        <h1>{t("checkInFormTitle")}</h1>
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-section-head">
              <h3>{t("sectionVisitorInfo")}</h3>
              <p>{t("sectionVisitorInfoDesc")}</p>
            </div>
            <div className="form-section-body">
              <div className="grid grid-2">
                <div className="field"><label>{t("date")}</label><input type="text" value={todayStr()} disabled readOnly /></div>
                <div className="field"><label>{t("timeIn")}</label><input type="text" value={fmtTime(new Date().toISOString())} disabled readOnly /></div>
              </div>
              <div className="grid grid-2">
                <FormField name="firstName" label={t("firstName")} required invalid={isInvalid("firstName")} />
                <FormField name="lastName" label={t("lastName")} required invalid={isInvalid("lastName")} />
              </div>
              <div className="grid grid-2">
                <FormField name="phone" label={t("phone")} type="tel" required invalid={isInvalid("phone")} />
                <FormField name="email" label={t("email")} type="email" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-head">
              <h3>{t("sectionAddress")}</h3>
              <p>{t("sectionAddressDesc")}</p>
            </div>
            <div className="form-section-body">
              <FormField name="address" label={t("address")} required invalid={isInvalid("address")} />
              <div className="grid grid-3">
                <FormField name="city" label={t("city")} required invalid={isInvalid("city")} />
                <div className="field">
                  <label className="required" htmlFor="checkin-field-state">{t("state")}</label>
                  <select name="state" id="checkin-field-state" defaultValue="RI">
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <FormField name="zip" label={t("zip")} required invalid={isInvalid("zip")} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-head">
              <h3>{t("sectionVisitDetails")}</h3>
              <p>{t("sectionVisitDetailsDesc")}</p>
            </div>
            <div className="form-section-body">
              <div className="field">
                <label className="required" htmlFor="service-select">{t("reasonForVisit")}</label>
                <select name="service" id="service-select" className={invalidCls("service")} value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="">{t("pleaseSelect")}</option>
                  {services.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
                </select>
                {service === "other" && (
                  <div style={{ marginTop: 10 }}>
                    <input type="text" name="serviceOther" placeholder={t("otherPleaseSpecify")} aria-label={t("otherPleaseSpecify")} className={invalidCls("serviceOther")} />
                  </div>
                )}
              </div>
              <div className="field">
                <label className="required" htmlFor="staff-select">{t("staffMember")}</label>
                <select name="staff" id="staff-select" className={invalidCls("staff")} value={staff} onChange={(e) => setStaff(e.target.value)}>
                  <option value="">{t("pleaseSelect")}</option>
                  {staffList.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
                </select>
                {staff === "other" && (
                  <div style={{ marginTop: 10 }}>
                    <input type="text" name="staffOther" placeholder={t("otherPleaseSpecify")} aria-label={t("otherPleaseSpecify")} className={invalidCls("staffOther")} />
                  </div>
                )}
              </div>
              <div className="field">
                <label htmlFor="checkin-field-notes">{t("notes")}</label>
                <textarea name="notes" id="checkin-field-notes" />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-lg">{t("submit")}</button>
        </form>
      </div>
    </div>
  );
}
