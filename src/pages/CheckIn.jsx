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
function RoleCard({ icon, iconClass, title, services, buttonLabel, buttonClass, onClick, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // The whole card is the button, so it may raise on hover (border and
        // shadow only, never a lift -- DESIGN.md's Still Card Rule).
        "group flex w-full flex-wrap items-center gap-3 rounded-surface border border-border bg-card px-4 py-4 text-left font-normal shadow-card transition-[border-color,box-shadow] duration-fast ease-out hover:border-line-strong hover:shadow-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        "sm:max-w-[420px] sm:flex-col sm:flex-nowrap sm:gap-0 sm:py-6 sm:text-center",
        compact ? "sm:px-6" : "sm:px-8"
      )}
    >
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16", iconClass)}>
        {icon({ strokeWidth: 2, className: "h-6 w-6 sm:h-8 sm:w-8", "aria-hidden": true })}
      </span>
      {/* sm+: flex-1 makes the text absorb the height difference, so every
          card's button lines up along the bottom of the row. */}
      <span className="min-w-0 flex-1 sm:mt-3 sm:flex sm:w-full sm:flex-col sm:items-center">
        <span className="block text-touch-section font-extrabold leading-tight text-navy dark:text-[color:var(--text)] sm:text-touch-heading xl:text-touch-section">{title}</span>
        <span className="mt-0.5 block text-touch-meta text-muted sm:mt-1.5 sm:flex-1">{services}</span>
      </span>
      <span
        className={cn(
          "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-touch px-5 text-touch-body font-bold transition-colors duration-fast sm:mt-4",
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
          style={{ background: "radial-gradient(closest-side, var(--primary-tint), transparent)" }}
        />
        <div
          className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-70"
          style={{ background: "radial-gradient(closest-side, var(--gold-tint), transparent)" }}
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
        <h1 className={cn("max-w-3xl text-balance text-center font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)]", compact ? "text-touch-heading sm:text-touch-title" : "text-touch-heading sm:text-touch-hero")}>
          {t("landingWelcomeTo")} {ORG.name}
        </h1>
        <p className={cn("text-center text-touch-body text-muted", compact ? "mt-1.5" : "mt-1.5 sm:mt-2 sm:text-touch-lead")}>{t("landingHowCanWeHelp")}</p>
        <span aria-hidden="true" className={cn("rounded-full bg-gold", compact ? "mt-3 h-1 w-12" : "mt-4 h-1 w-16")} />

        {/* Four role cards: stacked rows on a phone, 2x2 on a tablet, one row on a wide kiosk. */}
        <div className={cn("grid w-full max-w-[1500px] grid-cols-1 justify-items-center gap-3 sm:grid-cols-2 xl:grid-cols-4", compact ? "mt-6 sm:gap-4" : "mt-5 sm:gap-6")}>
          <RoleCard
            compact={compact}
            icon={(props) => <GraduationCap {...props} />}
            iconClass="bg-tone-info-chip text-tone-info-ink"
            title={t("iAmStudent").replace(/\s*\(.*\)$/, "")}
            services={t("landingStudentServices")}
            buttonLabel={t("checkInLabel")}
            buttonClass="bg-primary text-primary-foreground group-hover:bg-primary-dark"
            onClick={() => navigate("/checkin/student")}
          />
          <RoleCard
            compact={compact}
            icon={(props) => <User {...props} />}
            iconClass="bg-tone-warning-chip text-tone-warning-ink"
            title={t("iAmVisitor").replace(/\s*\(.*\)$/, "")}
            services={t("landingVisitorServices")}
            buttonLabel={t("checkInLabel")}
            buttonClass="bg-tone-warning-solid text-tone-warning-on-solid group-hover:bg-gold-dark"
            onClick={() => navigate("/checkin/visitor")}
          />
          {/* New clients sign themselves up for Case Management
              (ClientRegister.jsx); staff complete the full intake afterwards. */}
          <RoleCard
            compact={compact}
            icon={(props) => <UserPlus {...props} />}
            iconClass="bg-tone-success-chip text-tone-success-ink"
            title={t("registerKioskTitle")}
            services={t("registerKioskServices")}
            buttonLabel={t("registerSubmitBtn")}
            buttonClass="bg-tone-success-solid text-tone-success-on-solid"
            onClick={() => navigate("/register")}
          />
          <RoleCard
            compact={compact}
            icon={(props) => <LogOut {...props} />}
            iconClass="bg-tone-neutral-chip text-tone-neutral-ink"
            title={t("iAmDone")}
            services={t("landingCheckOutServices")}
            buttonLabel={t("checkOutBtn")}
            buttonClass="bg-navy text-navy-foreground group-hover:bg-navy-dark"
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
            "group flex w-full max-w-[1500px] flex-wrap items-center gap-3 rounded-surface border border-border bg-card px-4 py-4 text-left font-normal shadow-card transition-[border-color,box-shadow] duration-fast hover:border-line-strong hover:shadow-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:flex-nowrap sm:gap-4",
            compact ? "mt-3 sm:mt-4 sm:px-5" : "mt-3 sm:mt-6 sm:px-7 sm:py-5"
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tone-violet-chip text-tone-violet-ink sm:h-14 sm:w-14">
            <CalendarCheck strokeWidth={2} aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-touch-section font-extrabold leading-tight text-navy dark:text-[color:var(--text)] sm:text-touch-heading">{t("requestApptLandingBtn")}</span>
            <span className="mt-0.5 block text-touch-meta text-muted">{t("requestApptCardDesc")}</span>
          </span>
          <span className="flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-touch bg-tone-violet-ink px-5 text-touch-body font-bold text-card transition-colors duration-fast sm:w-auto">
            {t("continueLabel")} <ArrowRight size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
        <p className={cn("text-center text-touch-meta text-muted", compact ? "mt-3" : "mt-4")}>
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
            <Headset size={compact ? 16 : 18} strokeWidth={2} aria-hidden="true" />
          </span>
          <h3 className={cn("font-bold text-navy dark:text-[color:var(--text)]", compact ? "text-touch-meta" : "text-touch-body")}>{t("landingNeedHelp")}</h3>
          <p className="text-touch-meta text-muted">{t("landingAskStaff")}</p>
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
            <p className="m-0 text-touch-meta">
              <span className="font-bold">{t("landingNeedHelp")}</span>{" "}
              <span className="text-white/85">{t("landingAskStaff")}</span>
            </p>
          </div>
          <div className="hidden items-center gap-2.5 sm:flex">
            <img src={LOGO_URL} alt={ORG.name} className="h-8 w-8 rounded bg-white/90 object-contain p-0.5" />
            <span className="text-touch-meta font-bold">{ORG.shortName}</span>
          </div>
          <div className="hidden items-center gap-2 text-touch-meta font-medium text-white/90 sm:flex">
            <Heart size={16} strokeWidth={2.2} aria-hidden="true" className="fill-gold text-gold" />
            <span>{t("landingBuildingFutures")}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
