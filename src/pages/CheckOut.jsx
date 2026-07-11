// CheckOut.jsx -- ported from checkin_checkout.js's renderCheckOut()/
// renderCheckoutResults()/wireCheckoutButtons(). The search box's value used
// to live on App.state.searchFilters.checkoutQ (global) -- it's local
// component state here instead, since nothing outside this page ever read it.
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { serviceDisplay } from "../lib/students.js";
import { fmtDuration, fmtTime, minutesBetween } from "../lib/utils.js";
import EmptyState from "../components/EmptyState.jsx";

export default function CheckOut() {
  const { data, lang, setData, showToast } = useApp();
  const t = useT();
  const [q, setQ] = useState("");

  let list = data.visits.filter((v) => !v.timeOut);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter((v) => (v.firstName + " " + v.lastName).toLowerCase().indexOf(ql) !== -1 || (v.phone || "").indexOf(ql) !== -1);
  }
  list = list.slice().sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));

  function checkOut(id) {
    const visit = data.visits.find((v) => v.id === id);
    if (!visit) return;
    const timeOut = new Date().toISOString();
    setData((prev) => Object.assign({}, prev, {
      visits: prev.visits.map((v) => (v.id === id ? Object.assign({}, v, { timeOut }) : v))
    }));
    const dur = fmtDuration(minutesBetween(visit.timeIn, timeOut), lang);
    showToast(t("checkedOutAt") + " " + fmtTime(timeOut) + " — " + t("visitLength") + ": " + dur);
  }

  return (
    <div className="kiosk-wrap">
      <div className="card">
        <h1>{t("checkOutTitle")}</h1>
        <div className="field">
          <input
            type="text"
            placeholder={t("searchNameOrPhone")}
            aria-label={t("searchNameOrPhone")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <h3>{t("currentlyCheckedIn")}</h3>
        <div>
          {!list.length ? (
            <EmptyState icon="search" message={t("noOneFound")} />
          ) : (
            list.map((v) => (
              <div className="card" key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>{v.firstName} {v.lastName}</strong><br />
                  <span className="muted">{v.phone} · {serviceDisplay(v, data.customServices, lang)} · {t("timeIn")} {fmtTime(v.timeIn)}</span>
                </div>
                {/* Routine everyday action (not destructive) -- brand system reserves
                    red/.btn-accent for errors and destructive actions only. */}
                <button className="btn-primary" onClick={() => checkOut(v.id)}>{t("checkOutBtn")}</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
