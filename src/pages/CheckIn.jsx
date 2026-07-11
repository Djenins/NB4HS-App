// CheckIn.jsx -- "Are you a student or a visitor?" chooser. Ported from
// checkin_checkout.js's renderCheckIn()/attachCheckInChooserHandlers().
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";

export default function CheckIn() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="kiosk-wrap">
      <div className="card" style={{ textAlign: "center" }}>
        <h1>{t("studentOrVisitor")}</h1>
        <div className="role-grid">
          <button className="role-btn" style={{ textAlign: "center" }} onClick={() => navigate("/checkin/student")}>
            <h3 style={{ fontSize: "1.3rem" }}>{t("iAmStudent")}</h3>
          </button>
          <button className="role-btn" style={{ textAlign: "center" }} onClick={() => navigate("/checkin/visitor")}>
            <h3 style={{ fontSize: "1.3rem" }}>{t("iAmVisitor")}</h3>
          </button>
        </div>
      </div>
    </div>
  );
}
