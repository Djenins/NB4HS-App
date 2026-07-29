// CheckInSuccess.jsx -- ported from checkin_checkout.js's renderCheckInSuccess().
// The just-checked-in visit id comes through router navigation state (the
// original stored it on App.state.lastCheckInId; here it's just handed
// along with the navigate() call instead of living in global state).
// Auto-returns to the chooser after 5s.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import Icon from "../components/Icon.jsx";

export default function CheckInSuccess() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const isStudent = location.state && location.state.kind === "student";
  const className = (location.state && location.state.className) || "";

  useEffect(() => {
    const id = setTimeout(() => navigate("/checkin"), 5000);
    return () => clearTimeout(id);
  }, [navigate]);

  const heading = isStudent ? t("checkInSuccessStudent") : t("checkInSuccess");
  const sub = isStudent
    ? (className ? t("checkInSuccessStudentSub").replace("{class}", className) : t("checkInSuccessStudent"))
    : t("checkInSuccessSub");

  return (
    <div className="kiosk-wrap">
      <div className="card success-box">
        <div className="success-icon"><Icon name="check" className="icon-lg" /></div>
        <h1>{heading}</h1>
        <p className="muted">{sub}</p>
        <p className="muted" style={{ marginTop: 10 }}>{t("checkOutReminder")}</p>
        <button className="btn-primary btn-lg" style={{ marginTop: 18 }} onClick={() => navigate("/checkin")}>{t("newCheckIn")}</button>
      </div>
    </div>
  );
}
