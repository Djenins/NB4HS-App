// CheckOutScanSuccess.jsx -- shown after a kiosk self-checkout (CheckOut.jsx's
// selfCheckOut() navigates here with the result). Ported from
// checkin_checkout.js's renderCheckOutScanSuccess(). Originally shared with a
// scan-a-personal-QR-code checkout flow (hence "Scan" in the name and the
// name/route's shape), but that flow was removed for being broken -- it
// never persisted to Supabase (see d5a3c44) -- and never rebuilt; the only
// caller now is CheckOut.jsx's selfCheckOut(), which always passes
// status: "ok", so this no longer branches on result.status.
import { useLocation, useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import Icon from "../components/Icon.jsx";

export default function CheckOutScanSuccess() {
  const { kiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state && location.state.scanResult) || {};

  return (
    <div className="kiosk-wrap">
      <div className="card success-box">
        <div className="success-icon"><Icon name="check" className="icon-lg" /></div>
        <h1>{t("checkOutScanSuccessTitle")}</h1>
        <p className="muted">{result.name}<br />{t("visitLength")}: {result.duration}</p>
        <button className="btn-primary btn-lg" style={{ marginTop: 18 }} onClick={() => navigate(kiosk ? "/checkin" : "/dashboard")}>
          {t("done")}
        </button>
      </div>
    </div>
  );
}
