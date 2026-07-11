// CheckInSuccess.jsx -- ported from checkin_checkout.js's renderCheckInSuccess().
// The just-checked-in visit id comes through router navigation state (the
// original stored it on App.state.lastCheckInId; here it's just handed
// along with the navigate() call instead of living in global state).
// In kiosk mode, auto-returns to the chooser after 15s, same as the original.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { checkoutUrlFor } from "../lib/checkin.js";
import Icon from "../components/Icon.jsx";

export default function CheckInSuccess() {
  const { kiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const lastCheckInId = location.state && location.state.lastCheckInId;

  useEffect(() => {
    if (!kiosk) return undefined;
    const id = setTimeout(() => navigate("/checkin"), 15000);
    return () => clearTimeout(id);
  }, [kiosk, navigate]);

  let qrBlock = null;
  if (lastCheckInId) {
    const url = checkoutUrlFor(lastCheckInId);
    const qrImg = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(url);
    qrBlock = (
      <div className="qr-box" style={{ marginTop: 10 }}>
        <img src={qrImg} alt="Check-out QR code" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <h3 style={{ marginTop: 14 }}>{t("scanToCheckOut")}</h3>
        <p className="muted" style={{ margin: 0 }}>{t("scanToCheckOutDesc")}</p>
      </div>
    );
  }

  return (
    <div className="kiosk-wrap">
      <div className="card success-box">
        <div className="success-icon"><Icon name="check" className="icon-lg" /></div>
        <h1>{t("checkInSuccess")}</h1>
        <p className="muted">{t("checkInSuccessSub")}</p>
        {qrBlock}
        <button className="btn-primary btn-lg" style={{ marginTop: 18 }} onClick={() => navigate("/checkin")}>{t("newCheckIn")}</button>
      </div>
    </div>
  );
}
