// CheckOutScanSuccess.jsx -- shown after someone scans their personal
// check-out QR code (App.jsx's bootstrap effect processes the ?checkoutId=
// query param and navigates here with the result). Ported from
// checkin_checkout.js's renderCheckOutScanSuccess().
import { useLocation, useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import Icon from "../components/Icon.jsx";

export default function CheckOutScanSuccess() {
  const { kiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state && location.state.scanResult) || {};

  let body;
  if (result.status === "ok") {
    body = <p className="muted">{result.name}<br />{t("visitLength")}: {result.duration}</p>;
  } else if (result.status === "already") {
    body = <p className="muted">{t("alreadyCheckedOut")}</p>;
  } else {
    body = <p className="muted">{t("visitNotFound")}</p>;
  }

  return (
    <div className="kiosk-wrap">
      <div className="card success-box">
        <div className="success-icon"><Icon name="check" className="icon-lg" /></div>
        <h1>{t("checkOutScanSuccessTitle")}</h1>
        {body}
        <button className="btn-primary btn-lg" style={{ marginTop: 18 }} onClick={() => navigate(kiosk ? "/checkin" : "/dashboard")}>
          {t("done")}
        </button>
      </div>
    </div>
  );
}
