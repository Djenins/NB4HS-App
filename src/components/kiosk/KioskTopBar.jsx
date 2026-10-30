// KioskTopBar.jsx -- the one top bar every client-facing kiosk screen uses:
// Back (on every screen except the kiosk home), the NB4HS logo, then a live
// clock and the language picker. Before this, each screen had its own
// version (Shell's staff topbar on check-in/out, a Back + clock row on the
// check-in forms, a Back / logo / language row inside the appointment and
// registration cards), so moving between kiosk screens looked inconsistent.
//
// Shell.jsx renders it above every client-facing page; the kiosk home
// (CheckIn.jsx) renders it inside its own full-screen frame without Back.
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { ORG } from "../../lib/constants.js";
import { LOGO_URL } from "../../lib/logo.js";
import { fmtDateLong, fmtTime, todayStr } from "../../lib/utils.js";
import LangSelect from "../LangSelect.jsx";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function KioskTopBar({ onBack }) {
  const { lang } = useApp();
  const t = useT();
  const now = useNow();

  return (
    <header className="sticky top-0 z-[15] flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2.5 shadow-sm sm:gap-3 sm:px-8 sm:py-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[1rem] font-bold text-navy transform-none transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[color:var(--text)] sm:px-5"
        >
          <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" className="text-primary" />
          {t("back")}
        </button>
      )}
      <img src={LOGO_URL} alt={ORG.name} className="h-8 w-auto min-w-0 shrink object-contain sm:h-11" />

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-3 rounded-2xl border border-border bg-background px-4 py-2 text-[0.95rem] font-semibold text-navy dark:text-[color:var(--text)] md:flex">
          <span className="flex items-center gap-2">
            <Clock size={18} strokeWidth={2} aria-hidden="true" className="text-primary" />
            {fmtTime(now.toISOString())}
          </span>
          <span aria-hidden="true" className="h-5 w-px bg-border" />
          <span className="flex items-center gap-2">
            <Calendar size={18} strokeWidth={2} aria-hidden="true" className="text-primary" />
            {fmtDateLong(todayStr(), lang)}
          </span>
        </div>
        <LangSelect />
      </div>
    </header>
  );
}
