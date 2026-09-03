// AddHouseholdCard.jsx -- the "Add a Household" intake form on the Food
// Distribution page. Lifted out of FoodDistribution.jsx (it had grown past
// what belongs inline next to that page's table/filters/export logic) during
// the redesign pass against the client's reference mockup; the workflow it
// drives is unchanged -- same buildClient("food") shape, same
// findPossibleDuplicates() gate, same createFoodClient() RPC.
//
// What the redesign changed is presentation and validation *feedback*:
//   - a titled/subtitled collapsible header with a chevron instead of the
//     bare one-line <summary>,
//   - red required markers on every field the form actually requires,
//   - per-field inline error text (aria-describedby'd to its input) instead
//     of only a red border plus a "fix the highlighted fields" toast,
//   - a divider'd, right-aligned action row with a submitting state that
//     blocks double submission.
// Layout still leans entirely on the shared .form-section / .field /
// .field-icon-wrap classes in main.css, so it stays in step with the rest of
// the staff forms.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { buildClient } from "../lib/clients.js";
import { createFoodClient } from "../lib/clientsData.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { formatPhone } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import DuplicateClientWarning from "./DuplicateClientWarning.jsx";
import Icon from "./Icon.jsx";

const HOUSEHOLD_SIZES = ["1", "2", "3", "4", "5", "6+"];

export const EMPTY_NEW_CLIENT = {
  firstName: "", lastName: "", phone: "", email: "", householdSize: "", intakeDate: "", street: "", city: "", zip: "",
};

const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Everything the form asks for except Email, which the mockup labels
// "(optional)". These are UI-level requirements only -- the food_clients /
// clients rows themselves still accept blanks, so imported and pre-existing
// households with partial contact info are unaffected.
const REQUIRED_FIELDS = ["firstName", "lastName", "phone", "householdSize", "intakeDate", "street", "city", "zip"];

function validate(fields, t) {
  const errs = {};
  REQUIRED_FIELDS.forEach((name) => {
    if (!String(fields[name] || "").trim()) errs[name] = t("fieldRequired");
  });
  if (!errs.phone && !PHONE_RE.test(fields.phone.trim())) errs.phone = t("invalidPhone");
  if (fields.email.trim() && !EMAIL_RE.test(fields.email.trim())) errs.email = t("invalidEmail");
  return errs;
}

// Field -- label (with the red required marker) + icon-prefixed control +
// inline error, wired together so the error is announced with the input.
// `children` is a render function so each control can take the id/aria
// attributes it needs without this component knowing which control it is.
function Field({ id, label, required, error, icon, children }) {
  const errorId = error ? id + "-error" : undefined;
  const control = children({
    id,
    "aria-required": required ? true : undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": errorId,
  });
  return (
    <div className="field">
      <label htmlFor={id} className={required ? "required" : ""}>{label}</label>
      {icon ? (
        <div className="field-icon-wrap">
          <Icon name={icon} />
          {control}
        </div>
      ) : control}
      {error ? <p className="error-text" id={errorId}>{error}</p> : null}
    </div>
  );
}

export default function AddHouseholdCard({ open, onToggle }) {
  const { data, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingClient, setPendingClient] = useState(null);

  // Editing a field clears just that field's error, so a corrected entry
  // stops shouting before the next submit re-runs the whole check.
  function setField(name, value) {
    setFields((prev) => Object.assign({}, prev, { [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = Object.assign({}, prev);
      delete next[name];
      return next;
    });
  }

  function reset() {
    setFields(EMPTY_NEW_CLIENT);
    setErrors({});
    setDupMatches(null);
    setPendingClient(null);
  }

  async function finalizeCreate(client, matchedClient) {
    setSubmitting(true);
    try {
      await createFoodClient(client, client, matchedClient ? matchedClient.id : null);
      reset();
      showToast(t("foodClientAdded"));
    } catch (err) {
      console.warn("createFoodClient failed", err);
      setDupMatches(null);
      setPendingClient(null);
      showToast(t("foodClientAddError"));
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (submitting) return;
    const errs = validate(fields, t);
    if (Object.keys(errs).length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      return;
    }
    setErrors({});
    const client = buildClient("food", fields);
    if (!client) return;
    const matches = findPossibleDuplicates(fields, data.clients || []);
    if (matches.length) {
      setPendingClient(client);
      setDupMatches(matches);
      return;
    }
    finalizeCreate(client, null);
  }

  // Clear only asks first once there's actually something to lose -- on an
  // untouched form it just resets, same as before the redesign.
  async function clear() {
    const dirty = Object.keys(EMPTY_NEW_CLIENT).some((k) => String(fields[k] || "").trim());
    if (dirty && !(await requestConfirm(t("clearFormConfirm")))) return;
    reset();
  }

  return (
    <details className="card form-card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary className="form-card-summary">
        <span className="form-card-title">
          <span className="icon-badge round"><Icon name="users" /></span>
          <span className="form-card-title-text">
            <strong>{t("addFoodClientTitle")}</strong>
            <span>{t("addFoodClientSubtitle")}</span>
          </span>
        </span>
        <Icon name="chevrondn" className="form-card-chevron" />
      </summary>
      <div className="details-body">
        <div className="form-section">
          <div className="form-section-head-row">
            <div className="icon-badge round"><Icon name="user" /></div>
            <div className="form-section-head">
              <h3>{t("sectionPersonalDetails")}</h3>
              <p>{t("sectionPersonalDetailsDesc")}</p>
            </div>
          </div>
          <div className="form-section-body">
            <div className="grid grid-2">
              <Field id="new-food-client-first-name" label={t("firstName")} required error={errors.firstName} icon="user">
                {(a) => (
                  <input {...a} type="text" placeholder={t("phFirstName")} className={errors.firstName ? "field-invalid" : ""}
                    value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
                )}
              </Field>
              <Field id="new-food-client-last-name" label={t("lastName")} required error={errors.lastName} icon="user">
                {(a) => (
                  <input {...a} type="text" placeholder={t("phLastName")} className={errors.lastName ? "field-invalid" : ""}
                    value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
                )}
              </Field>
              <Field id="new-food-client-phone" label={t("phone")} required error={errors.phone} icon="phone">
                {(a) => (
                  <input {...a} type="tel" placeholder={t("phPhoneRI")} className={errors.phone ? "field-invalid" : ""}
                    value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} />
                )}
              </Field>
              <Field id="new-food-client-email" label={t("emailOptionalLabel")} error={errors.email} icon="mail">
                {(a) => (
                  <input {...a} type="email" placeholder={t("phEmailExample")} className={errors.email ? "field-invalid" : ""}
                    value={fields.email} onChange={(e) => setField("email", e.target.value)} />
                )}
              </Field>
              <Field id="new-food-client-household-size" label={t("householdSizeLabel")} required error={errors.householdSize} icon="users">
                {(a) => (
                  <select {...a} className={errors.householdSize ? "field-invalid" : ""}
                    value={fields.householdSize} onChange={(e) => setField("householdSize", e.target.value)}>
                    <option value="">{t("selectHouseholdSize")}</option>
                    {HOUSEHOLD_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
              </Field>
              <Field id="new-food-client-intake-date" label={t("intakeDateLabel")} required error={errors.intakeDate}>
                {(a) => (
                  <DatePicker id={a.id} required invalid={!!errors.intakeDate} describedBy={a["aria-describedby"]}
                    value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} />
                )}
              </Field>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-head-row">
            <div className="icon-badge round"><Icon name="mappin" /></div>
            <div className="form-section-head">
              <h3>{t("sectionAddress")}</h3>
              <p>{t("sectionAddressDesc")}</p>
            </div>
          </div>
          <div className="form-section-body">
            <div className="grid grid-3">
              <Field id="new-food-client-street" label={t("address")} required error={errors.street} icon="mappin">
                {(a) => (
                  <input {...a} type="text" placeholder={t("streetAddressPlaceholder")} className={errors.street ? "field-invalid" : ""}
                    value={fields.street} onChange={(e) => setField("street", e.target.value)} />
                )}
              </Field>
              <Field id="new-food-client-city" label={t("city")} required error={errors.city} icon="city">
                {(a) => (
                  <input {...a} type="text" placeholder={t("phCityShort")} className={errors.city ? "field-invalid" : ""}
                    value={fields.city} onChange={(e) => setField("city", e.target.value)} />
                )}
              </Field>
              <Field id="new-food-client-zip" label={t("zip")} required error={errors.zip} icon="hash">
                {(a) => (
                  <input {...a} type="text" inputMode="numeric" placeholder={t("phZipShort")} className={errors.zip ? "field-invalid" : ""}
                    value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
                )}
              </Field>
            </div>
            {/* No State field on purpose -- buildClient() stamps state:"RI" on
                every household this form creates (see lib/clients.js). */}
            <p className="form-note">{t("stateAlwaysRI")}</p>
          </div>
        </div>

        <div className="form-card-actions">
          <button type="button" className="btn-secondary" onClick={clear}>{t("clearLabel")}</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? t("addingFoodClientBtn") : <><Icon name="plus" /> {t("addFoodClientBtn")}</>}
          </button>
        </div>
      </div>
      {dupMatches && (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingClient(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingClient, matchedClient)}
          onCreateAnyway={() => finalizeCreate(pendingClient, null)}
          onCancel={() => { setDupMatches(null); setPendingClient(null); }}
        />
      )}
    </details>
  );
}
