// CheckIn.jsx -- the kiosk landing page ("Student or Visitor?"). Full-bleed,
// self-service kiosk redesign: owns its own header/hero/footer chrome
// (Shell.jsx skips its default topbar/footer-note for this route -- see
// the `isKioskLanding` check there) instead of sitting inside the plain
// boxed card the rest of the app's screens use.
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck, GraduationCap, Headset, Heart, LogOut, User, UserPlus } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { ORG } from "../lib/constants.js";
import { LOGO_URL } from "../lib/logo.js";
import KioskTopBar from "../components/kiosk/KioskTopBar.jsx";

// On a phone each card is a full-width row matching the Request an
// Appointment card below it: icon beside the title and description, a
// full-width button underneath. From sm up it becomes the centred kiosk card
// (2x2 on a tablet, one row of four on a wide kiosk).
function RoleCard({ icon, iconBg, iconColor, title, services, buttonLabel, buttonClass, onClick, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-wrap items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-4 text-left font-normal shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        "sm:max-w-[420px] sm:flex-col sm:flex-nowrap sm:gap-0 sm:rounded-[24px] sm:py-6 sm:text-center sm:hover:-translate-y-1 sm:hover:scale-[1.02]",
        compact ? "sm:px-6" : "sm:px-8"
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16" style={{ background: iconBg }}>
        {icon({ color: iconColor, strokeWidth: 2, className: "h-6 w-6 sm:h-8 sm:w-8", "aria-hidden": true })}
      </span>
      {/* sm+: flex-1 makes the text absorb the height difference, so every
          card's button lines up along the bottom of the row. */}
      <span className="min-w-0 flex-1 sm:mt-3 sm:flex sm:w-full sm:flex-col sm:items-center">
        <span className="block text-[1.05rem] font-extrabold leading-tight text-navy dark:text-[color:var(--text)] sm:text-xl">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted sm:mt-1.5 sm:flex-1 sm:text-sm">{services}</span>
      </span>
      <span
        className={cn(
          "flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold text-white shadow-md transition-transform duration-150 group-hover:scale-[1.03] group-active:scale-[0.98] sm:mt-4",
          compact ? "sm:px-4" : "sm:px-6",
          buttonClass
        )}
      >
        {buttonLabel}
        <ArrowRight strokeWidth={2.5} aria-hidden="true" className="h-5 w-5 shrink-0" />
      </span>
    </button>
  );
}

export default function CheckIn() {
  const { kiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();

  // Full touchscreen-scale spacing only applies in true kiosk mode (its own
  // fullscreen header/footer, see below); embedded in the staff dashboard
  // (Shell's sidebar layout) this same landing page instead uses a
  // compact scale so the whole hero + both role cards fit within a normal
  // laptop viewport without scrolling.
  const compact = !kiosk;

  return (
    <div className={cn("kiosk-landing relative flex w-full flex-col overflow-hidden bg-background", compact ? "min-h-0" : "h-screen")}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-10%] h-[640px] w-[900px] -translate-x-1/2 rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, rgba(37,99,235,0.14), rgba(37,99,235,0))" }}
        />
        <div
          className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-70"
          style={{ background: "radial-gradient(closest-side, rgba(212,160,23,0.12), rgba(212,160,23,0))" }}
        />
      </div>

      {/* Same top bar as every other kiosk screen (no Back on the home). */}
      {kiosk && <div className="relative z-10"><KioskTopBar /></div>}

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-4 sm:px-6",
          compact ? "pb-8 pt-6" : "py-5"
        )}
      >
        {/* m-auto rather than justify-center on <main>: it centres the content
            when there's room, and lets it start at the top (scrollable) when
            there isn't -- justify-center pushed the heading and first card
            above the scroll area on phones and short kiosk screens. */}
        <div className="my-auto flex w-full flex-col items-center">
        <h1 className={cn("max-w-3xl text-balance text-center font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)]", compact ? "text-[1.375rem] sm:text-3xl" : "text-[1.375rem] sm:text-4xl")}>
          {t("landingWelcomeTo")} {ORG.name}
        </h1>
        <p className={cn("text-center text-base text-muted", compact ? "mt-1.5" : "mt-1.5 sm:mt-2 sm:text-lg")}>{t("landingHowCanWeHelp")}</p>
        <span aria-hidden="true" className={cn("rounded-full bg-gold", compact ? "mt-3 h-1 w-12" : "mt-4 h-1 w-16")} />

        {/* Four role cards: stacked rows on a phone, 2x2 on a tablet, one row on a wide kiosk. */}
        <div className={cn("grid w-full max-w-[1500px] grid-cols-1 justify-items-center gap-3 sm:grid-cols-2 xl:grid-cols-4", compact ? "mt-6 sm:gap-4" : "mt-5 sm:gap-6")}>
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
            iconColor="var(--gold-ink)"
            title={t("iAmVisitor").replace(/\s*\(.*\)$/, "")}
            services={t("landingVisitorServices")}
            buttonLabel={t("checkInLabel")}
            buttonClass="bg-gradient-to-r from-gold to-gold-dark text-gold-foreground hover:brightness-110"
            onClick={() => navigate("/checkin/visitor")}
          />
          {/* New clients sign themselves up for Case Management
              (ClientRegister.jsx); staff complete the full intake afterwards. */}
          <RoleCard
            compact={compact}
            icon={(props) => <UserPlus {...props} />}
            iconBg="var(--tint-success)"
            iconColor="var(--success)"
            title={t("registerKioskTitle")}
            services={t("registerKioskServices")}
            buttonLabel={t("registerSubmitBtn")}
            buttonClass="bg-success hover:brightness-110"
            onClick={() => navigate("/register")}
          />
          <RoleCard
            compact={compact}
            icon={(props) => <LogOut {...props} />}
            iconBg="var(--tint-neutral)"
            iconColor="var(--muted)"
            title={t("iAmDone")}
            services={t("landingCheckOutServices")}
            buttonLabel={t("checkOutBtn")}
            buttonClass="bg-gradient-to-r from-navy to-navy hover:brightness-110"
            onClick={() => navigate("/checkout")}
          />
        </div>

        {/* Appointments live on the kiosk too now that the public landing
            page is gone ("/" is staff sign-in): request one, or check on one
            already requested. */}
        <button
          type="button"
          onClick={() => navigate("/appointments/request")}
          className={cn(
            // Phone: icon + text on one row, a full-width button beneath.
            // sm and up: one row with the button on the right.
            "group flex w-full max-w-[1500px] flex-wrap items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-4 text-left font-normal shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:flex-nowrap sm:gap-4 sm:rounded-[24px]",
            compact ? "mt-3 sm:mt-4 sm:px-5" : "mt-3 sm:mt-6 sm:px-7 sm:py-5"
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14" style={{ background: "var(--ev-appt-bg)" }}>
            <CalendarCheck strokeWidth={2} style={{ color: "var(--ev-appt-fg)" }} aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[1.05rem] font-extrabold leading-tight text-navy dark:text-[color:var(--text)] sm:text-xl">{t("requestApptLandingBtn")}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted sm:text-sm">{t("requestApptCardDesc")}</span>
          </span>
          <span className="flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold text-white shadow-md transition-transform duration-150 group-hover:scale-[1.03] sm:w-auto" style={{ background: "#6B21A8" }}>
            {t("continueLabel")} <ArrowRight size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
        <p className={cn("text-center text-sm text-muted", compact ? "mt-3" : "mt-4")}>
          {t("alreadyRequestedApptLabel")}{" "}
          <button
            type="button"
            onClick={() => navigate("/appointments/lookup")}
            className="-my-3 inline-flex min-h-0 items-center gap-1 border-0 bg-transparent px-0 py-3 font-bold text-primary transform-none hover:underline"
          >
            {t("apptLookupLink")} <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </p>

        {/* In kiosk mode on a phone this moves into the footer below. */}
        <div className={cn("flex-col items-center gap-1.5 text-center", compact ? "mt-6 flex" : "mt-5 hidden sm:flex")}>
          <span className={cn("flex items-center justify-center rounded-full bg-primary-tint text-primary", compact ? "h-9 w-9" : "h-10 w-10")}>
            <Headset size={compact ? 16 : 18} strokeWidth={2} />
          </span>
          <h3 className={cn("font-bold text-navy dark:text-[color:var(--text)]", compact ? "text-sm" : "text-base")}>{t("landingNeedHelp")}</h3>
          <p className="text-sm text-muted">{t("landingAskStaff")}</p>
        </div>
        </div>
      </main>

      {kiosk && (
        <footer className="relative z-10 flex shrink-0 items-center justify-between gap-3 bg-navy px-4 py-2.5 text-white sm:px-10 sm:py-3">
          {/* Phone: the "Need help?" note takes the footer instead of the logo,
              which the top bar already shows. */}
          <div className="flex items-center gap-3 sm:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
              <Headset size={18} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="m-0 text-sm leading-snug">
              <span className="font-bold">{t("landingNeedHelp")}</span>{" "}
              <span className="text-white/85">{t("landingAskStaff")}</span>
            </p>
          </div>
          <div className="hidden items-center gap-2.5 sm:flex">
            <img src={LOGO_URL} alt={ORG.name} className="h-8 w-8 rounded bg-white/90 object-contain p-0.5" />
            <span className="text-sm font-bold">{ORG.shortName}</span>
          </div>
          <div className="hidden items-center gap-2 text-sm font-medium text-white/90 sm:flex">
            <Heart size={16} strokeWidth={2.2} aria-hidden="true" className="fill-gold text-gold" />
            <span>{t("landingBuildingFutures")}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
