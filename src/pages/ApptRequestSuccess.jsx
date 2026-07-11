// ApptRequestSuccess.jsx -- ported from checkin_checkout.js's
// renderApptRequestSuccess(). "Back to home" always lands on the public
// login screen and clears kiosk mode, same as the original
// (attachViewHandlers: App.state.kiosk = false; App.state.view = "login").
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import Icon from "../components/Icon.jsx";

export default function ApptRequestSuccess() {
  const { setKiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="kiosk-wrap">
      <div className="card success-box">
        <div className="success-icon"><Icon name="check" className="icon-lg" /></div>
        <h1>{t("apptRequestSuccessTitle")}</h1>
        <p>{t("apptRequestSuccessDesc")}</p>
        <button className="btn-primary btn-lg" style={{ marginTop: 8 }} onClick={() => { setKiosk(false); navigate("/"); }}>
          {t("backToHomeBtn")}
        </button>
      </div>
    </div>
  );
}
