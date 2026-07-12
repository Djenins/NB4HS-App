// CheckIn.jsx -- the kiosk landing page ("Student or Visitor?"). Full-bleed,
// self-service kiosk redesign: owns its own header/hero/footer chrome
// (Shell.jsx skips its default topbar/footer-note for this route -- see
// the `isKioskLanding` check there) instead of sitting inside the plain
// boxed card the rest of the app's screens use.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap, Headset, User } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
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

function RoleCard({ icon, iconBg, iconColor, title, services, buttonLabel, buttonClass, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full max-w-[420px] flex-col items-center rounded-[24px] border border-border bg-card px-8 py-10 text-center shadow-card transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-card-hover focus-visible:-translate-y-1 focus-visible:scale-[1.02] focus-visible:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <span
        className="flex h-24 w-24 items-center justify-center rounded-full"
        style={{ background: iconBg }}
      >
        {icon({ size: 44, color: iconColor, strokeWidth: 2 })}
      </span>
      <h2 className="mt-6 text-3xl font-extrabold text-navy">{title}</h2>
      <p className="mt-3 min-h-[3.5rem] text-base leading-relaxed text-muted">{services}</p>
      <span
        className={
          "mt-8 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-6 text-lg font-bold text-white shadow-md transition-transform duration-150 group-hover:scale-[1.03] group-active:scale-[0.98] " +
          buttonClass
        }
      >
        {buttonLabel}
        <ArrowRight size={22} strokeWidth={2.5} />
      </span>
    </button>
  );
}

export default function CheckIn() {
  const { lang, kiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();

  return (
    <div className="kiosk-landing relative min-h-screen w-full overflow-hidden bg-[#F7F8FC]">
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
        <header className="relative z-10 flex items-center justify-between border-b border-border bg-white/90 px-6 py-4 shadow-sm backdrop-blur sm:px-10">
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
        className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-16 pt-14 sm:pt-20"
      >
        <p className="animate-[fadeIn_.5s_ease-out] text-lg font-bold uppercase tracking-wide text-accent">
          {t("landingWelcomeTo")}
        </p>
        <h1 className="mt-2 max-w-3xl text-center text-4xl font-extrabold leading-tight text-navy sm:text-5xl">
          {ORG.name}
        </h1>
        <p className="mt-4 text-xl text-muted">{t("landingHowCanWeHelp")}</p>
        <span className="mt-5 h-1 w-16 rounded-full bg-accent" />

        <div className="mt-14 flex w-full flex-col items-center gap-8 md:flex-row md:items-stretch md:justify-center">
          <RoleCard
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

        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
            <Headset size={22} strokeWidth={2} />
          </span>
          <h3 className="text-base font-bold text-navy">{t("landingNeedHelp")}</h3>
          <p className="text-sm text-muted">{t("landingAskStaff")}</p>
        </div>
      </main>

      {kiosk && (
        <footer className="relative z-10 flex flex-col items-center gap-3 bg-navy px-6 py-5 text-white sm:flex-row sm:justify-between sm:px-10">
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
