// CheckOutScanSuccess.jsx -- shown after a kiosk self-checkout (CheckOut.jsx's
// selfCheckOut() navigates here with the result). Named for a removed
// scan-a-QR-code flow (see d5a3c44); the tap-your-name checkout is its only
// caller and always passes status "ok". Uses the shared kiosk result frame
// and returns to the start screen by itself on the kiosk.
import { useLocation, useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import KioskResult, { RESULT_PRIMARY_BTN } from "../components/kiosk/KioskResult.jsx";

export default function CheckOutScanSuccess() {
  const { kiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state && location.state.scanResult) || {};
  const home = kiosk ? "/checkin" : "/dashboard";

  return (
    <KioskResult
      title={t("checkOutScanSuccessTitle")}
      returnAfterMs={kiosk ? 8000 : 0}
      actions={
        <button type="button" onClick={() => navigate(home, { replace: true })} className={RESULT_PRIMARY_BTN}>
          {t("done")}
        </button>
      }
    >
      {result.name && <p className="m-0 text-touch-section font-bold text-card-foreground">{result.name}</p>}
      {result.duration && (
        <p className="m-0 inline-flex items-center gap-2 rounded-touch border border-border bg-surface-sunken px-3.5 py-2 text-left text-touch-label font-semibold leading-snug text-card-foreground sm:rounded-full sm:px-4 sm:py-1.5 sm:text-touch-body">
          <Clock size={18} strokeWidth={2} aria-hidden="true" className="shrink-0 text-primary" />
          {t("visitLength")}: {result.duration}
        </p>
      )}
    </KioskResult>
  );
}
