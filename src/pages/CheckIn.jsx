// CheckIn.jsx -- the kiosk landing page ("Student or Visitor?"). Full-bleed,
// self-service kiosk redesign: owns its own header/hero/footer chrome
// (Shell.jsx skips its default topbar/footer-note for this route -- see
// the `isKioskLanding` check there) instead of sitting inside the plain
// boxed card the rest of the app's screens use.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap, Headset, User } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import LangSelect from "../components/LangSelect.jsx";

function LiveClock({ lang }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const locale = lang === "ht" ? "fr" : lang;
  return (
    <div className="flex items-center gap-4 text-sm font-medium text-white/90">
      <span>{now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span>
      <span className="hidden sm:inline">
        {now.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}
      </span>
    </div>
  );
}

function RoleCard({ icon, iconBg, iconColor, title, services, buttonLabel, buttonClass, onClick, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full max-w-[420px] flex-col items-center rounded-[24px] border border-border bg-card text-center shadow-card transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-card-hover focus-visible:-translate-y-1 focus-visible:scale-[1.02] focus-visible:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        compact ? "px-6 py-6" : "px-8 py-6"
      )}
    >
      <span
        className={cn("flex items-center justify-center rounded-full", compact ? "h-16 w-16" : "h-16 w-16")}
        style={{ background: iconBg }}
      >
        {icon({ size: compact ? 30 : 32, color: iconColor, strokeWidth: 2 })}
      </span>
      <h2 className={cn("font-extrabold text-navy", compact ? "mt-3 text-xl" : "mt-3 text-xl")}>{title}</h2>
      <p className={cn("text-muted", compact ? "mt-1.5 text-sm leading-snug" : "mt-1.5 min-h-[2.5rem] text-sm leading-snug")}>{services}</p>
      <span
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl font-bold text-white shadow-md transition-transform duration-150 group-hover:scale-[1.03] group-active:scale-[0.98]",
          compact ? "mt-4 min-h-[44px] px-4 text-base" : "mt-4 min-h-[44px] px-6 text-base",
          buttonClass
        )}
      >
        {buttonLabel}
        <ArrowRight size={compact ? 18 : 22} strokeWidth={2.5} />
      </span>
    </button>
  );
}

export default function CheckIn() {
  const { lang, kiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();

  // Full touchscreen-scale spacing only applies in true kiosk mode (its own
  // fullscreen header/footer, see below); embedded in the staff dashboard
  // (Shell's sidebar layout) this same landing page instead uses a
  // compact scale so the whole hero + both role cards fit within a normal
  // laptop viewport without scrolling.
  const compact = !kiosk;

  return (
    <div className={cn("kiosk-landing relative flex w-full flex-col overflow-hidden bg-[#F7F8FC]", compact ? "min-h-0" : "h-screen")}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-10%] h-[640px] w-[900px] -translate-x-1/2 rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, rgba(37,99,235,0.14), rgba(37,99,235,0))" }}
        />
        <div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-70"
          style={{ background: "radial-gradient(closest-side, rgba(212,32,39,0.08), rgba(212,32,39,0))" }}
        />
        <div
          className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-70"
          style={{ background: "radial-gradient(closest-side, rgba(212,160,23,0.12), rgba(212,160,23,0))" }}
        />
      </div>

      {kiosk && (
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-border bg-white/90 px-6 py-3 shadow-sm backdrop-blur sm:px-10">
          <div className="flex items-center gap-3">
            <img src={LOGO_DATA_URI} alt={ORG.name} className="h-11 w-auto" />
          </div>
          <div className="transition-transform duration-150 hover:scale-[1.03]">
            <LangSelect />
          </div>
        </header>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center overflow-y-auto px-6",
          compact ? "pb-8 pt-6" : "py-4"
        )}
      >
        <p className={cn("animate-[fadeIn_.5s_ease-out] font-bold uppercase tracking-wide text-accent", compact ? "text-sm" : "text-base")}>
          {t("landingWelcomeTo")}
        </p>
        <h1 className={cn("max-w-3xl text-center font-extrabold leading-tight text-navy", compact ? "mt-1 text-2xl sm:text-3xl" : "mt-1 text-3xl sm:text-4xl")}>
          {ORG.name}
        </h1>
        <p className={cn("text-muted", compact ? "mt-1.5 text-base" : "mt-2 text-lg")}>{t("landingHowCanWeHelp")}</p>
        <span className={cn("rounded-full bg-accent", compact ? "mt-2.5 h-1 w-12" : "mt-3 h-1 w-16")} />

        <div className={cn("flex w-full flex-col items-center md:flex-row md:items-stretch md:justify-center", compact ? "mt-6 gap-4" : "mt-5 gap-6")}>
          <RoleCard
            compact={compact}
            icon={(props) => <GraduationCap {...props} />}
            iconBg="var(--primary-tint)"
            iconColor="var(--primary)"
            title={t("iAmStudent").replace(/\s*\(.*\)$/, "")}
            services={t("landingStudentServices")}
            buttonLabel={t("checkInLabel")}
            buttonClass="bg-gradient-to-r from-primary to-navy hover:brightness-110"
            onClick={() => navigate("/checkin/student")}
          />
          <RoleCard
            compact={compact}
            icon={(props) => <User {...props} />}
            iconBg="var(--gold-tint)"
            iconColor="var(--gold-dark)"
            title={t("iAmVisitor").replace(/\s*\(.*\)$/, "")}
            services={t("landingVisitorServices")}
            buttonLabel={t("checkInLabel")}
            buttonClass="bg-gradient-to-r from-gold to-gold-dark hover:brightness-110"
            onClick={() => navigate("/checkin/visitor")}
          />
        </div>

        <div className={cn("flex flex-col items-center gap-1.5 text-center", compact ? "mt-6" : "mt-5 gap-1.5")}>
          <span className={cn("flex items-center justify-center rounded-full bg-primary-tint text-primary", compact ? "h-9 w-9" : "h-10 w-10")}>
            <Headset size={compact ? 16 : 18} strokeWidth={2} />
          </span>
          <h3 className={cn("font-bold text-navy", compact ? "text-sm" : "text-base")}>{t("landingNeedHelp")}</h3>
          <p className={cn("text-muted", compact ? "text-xs" : "text-sm")}>{t("landingAskStaff")}</p>
        </div>
      </main>

      {kiosk && (
        <footer className="relative z-10 flex shrink-0 flex-col items-center gap-3 bg-navy px-6 py-3 text-white sm:flex-row sm:justify-between sm:px-10">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_DATA_URI} alt={ORG.name} className="h-8 w-8 rounded bg-white/90 object-contain p-0.5" />
            <span className="text-sm font-bold">{ORG.shortName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-white/90">
            <span aria-hidden="true">❤️</span>
            <span>{t("landingBuildingFutures")}</span>
          </div>
          <LiveClock lang={lang} />
        </footer>
      )}
    </div>
  );
}
