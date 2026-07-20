// AppointmentLookup.jsx -- public "check my appointment status" page (no
// login required, reached from the Login page or after submitting a
// request). Clients aren't Supabase Auth users anywhere in this app, so
// this is a narrow two-factor lookup (last name + email or phone) against
// a SECURITY DEFINER RPC (lookup_client_appointments) rather than a real
// account -- see that migration for the accepted trade-off. Same
// kiosk-wrap/FormField idiom as ApptRequest.jsx.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { lookupClientAppointments } from "../lib/clientsData.js";
import { fmtDateLong } from "../lib/utils.js";
import FormField from "../components/FormField.jsx";
import Icon from "../components/Icon.jsx";

export default function AppointmentLookup() {
  const { setKiosk, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const lastName = val("lastName"), email = val("email"), phone = val("phone");

    const errs = [];
    if (!lastName) errs.push("lastName");
    if (!email && !phone) { errs.push("email"); errs.push("phone"); }
    if (errs.length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    setLoading(true);
    const rows = await lookupClientAppointments(lastName, email, phone);
    setResults(rows);
    setSearched(true);
    setLoading(false);
  }

  const isInvalid = (name) => errors.indexOf(name) !== -1;

  return (
    <div className="kiosk-wrap">
      <div className="card">
        <button className="btn-ghost" style={{ marginBottom: 14 }} onClick={() => { setKiosk(false); navigate("/"); }}>
          &larr; {t("back")}
        </button>
        <div className="page-header">
          <div className="icon-badge"><Icon name="search" className="icon-lg" /></div>
          <div>
            <h1>{t("apptLookupTitle")}</h1>
            <p className="muted">{t("apptLookupDesc")}</p>
          </div>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-section-body">
              <FormField name="lastName" label={t("lastName")} icon="user" required invalid={isInvalid("lastName")} />
              <p className="muted" style={{ fontSize: ".82rem", margin: "0 0 6px" }}>{t("apptLookupContactHint")}</p>
              <div className="grid grid-2">
                <FormField name="email" label={t("email")} type="email" icon="mail" invalid={isInvalid("email")} />
                <FormField name="phone" label={t("phone")} type="tel" icon="phone" invalid={isInvalid("phone")} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            <Icon name="search" /> {loading ? t("apptLookupSearching") : t("apptLookupBtn")}
          </button>
        </form>

        {searched && (
          <div style={{ marginTop: 24 }}>
            {results.length ? (
              <div className="space-y-2">
                {results.map((a, i) => (
                  <div key={i} className="card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700 }}>
                      {fmtDateLong(a.date, lang)}{a.time ? " · " + a.time : ""}
                    </div>
                    <div className="muted" style={{ fontSize: ".85rem", marginTop: 2 }}>
                      {meetingWithLabel(a.meetingWith, lang)} · {apptStatusLabel(a.status, lang)}
                    </div>
                    {a.reason && <div style={{ marginTop: 6, fontSize: ".9rem" }}>{a.reason}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ textAlign: "center" }}>{t("apptLookupNoResults")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
