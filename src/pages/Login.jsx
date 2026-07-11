// Login.jsx -- the public landing screen, redesigned to match the client's
// mockup using the exact same Tailwind/shadcn/Radix/Lucide/Framer Motion
// design system already built for Dashboard.jsx/Shell.jsx (same Card/
// Button primitives, same brand color tokens, same spacing/shadow scale --
// not a new visual language for this one page).
//
// Behavior preserved: setKiosk(true) before entering any public kiosk
// flow, and the same three real destinations (Student Check-In, Visitor
// Check-In, Request an Appointment) plus the Staff Login link -- nothing
// was invented. One deliberate streamline: the mockup presents Student vs
// Visitor as the single, immediate choice on this page, so those two cards
// now navigate straight to /checkin/student and /checkin/visitor instead
// of routing through the old intermediate "Are you a Student or a
// Visitor?" page (CheckIn.jsx at /checkin) -- asking the same question
// twice would be redundant. CheckIn.jsx itself is untouched and still
// works fine if reached directly (App.jsx's BootstrapEntry still lands
// ?kiosk=1/#checkin URL entries there).
//
// The three left-panel stats are computed live from real app data (classes
// on file, students currently enrolled, visits on file) rather than
// invented lifetime totals -- there's no founding year or historical
// impact numbers anywhere in this app to source a "since 20XX" claim from.
import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Calendar, FolderKanban, GraduationCap, Globe, Heart, Lock, Monitor, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import { totalEnrolledCount } from "../lib/students.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import LangSelect from "../components/LangSelect.jsx";

function Wordmark() {
  // The "4" is styled gold (a premium brand accent) rather than red -- the
  // NB4HS Design System scopes red to errors/validation/destructive actions
  // only, so a wordmark letter is no longer an appropriate place for it.
  return (
    <>
      <span className="text-primary">NB</span><span className="text-gold">4</span><span className="text-primary">HS</span>
    </>
  );
}

const SERVICES = [
  { icon: Monitor, key: "landingServiceComputerClasses" },
  { icon: FolderKanban, key: "landingServiceCaseManagement" },
  { icon: Globe, key: "landingServiceImmigration" },
  { icon: Briefcase, key: "landingServiceEmployment" },
  { icon: Users, key: "landingServiceCommunity" }
];

export default function Login() {
  const { data, setKiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();

  function goCheckIn(kind) {
    setKiosk(true);
    navigate(kind === "student" ? "/checkin/student" : "/checkin/visitor");
  }
  function requestAppt() {
    setKiosk(true);
    navigate("/appointments/request");
  }

  const stats = [
    { icon: Calendar, num: (data.classes || []).length, label: t("landingClassesOfferedLabel") },
    { icon: GraduationCap, num: totalEnrolledCount(data.students), label: t("landingStudentsEnrolledLabel") },
    { icon: Users, num: (data.visits || []).length, label: t("landingVisitsOnFileLabel") }
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left brand panel -- navy chrome (matches Shell.jsx's sidebar/other
          brand chrome) + soft-circle motif, rebuilt in Tailwind with room
          for the service list + stats. Uses the dedicated --navy tokens
          (not --primary, which is now the interactive blue) so this panel
          stays navy regardless of the brand system's primary-color value. */}
      <div
        className="relative flex flex-col justify-between overflow-hidden px-8 py-8 text-white sm:px-10 sm:py-10 lg:w-[42%] lg:max-w-[520px]"
        style={{ background: "linear-gradient(160deg, var(--navy-dark), var(--navy) 65%)" }}
      >
        <div className="pointer-events-none absolute -right-32 top-1/3 h-72 w-72 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-white/[0.07]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src={LOGO_DATA_URI} alt={ORG.name} className="h-11 w-11 rounded-lg bg-white/90 object-contain p-1" />
            <div>
              <div className="text-xl font-extrabold leading-tight"><Wordmark /></div>
              <div className="text-xs font-medium text-white/70">{ORG.name}</div>
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-9 text-3xl font-extrabold leading-tight sm:text-4xl"
          >
            {t("landingHeroHeading")}
          </motion.h1>
          <div className="mt-3 h-1 w-14 rounded-full bg-gold" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/85">{t("landingHeroSubtitle")}</p>

          <div className="mt-8 space-y-3">
            {SERVICES.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-3 text-sm font-medium text-white/90">
                <Icon className="h-[18px] w-[18px] shrink-0 text-white/70" strokeWidth={2} />
                {t(key)}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-10">
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ icon: Icon, num, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"
              >
                {/* Featured statistics get the gold accent, used sparingly per the brand spec. */}
                <Icon className="mx-auto h-5 w-5 text-gold" strokeWidth={2} />
                <div className="mt-1.5 text-lg font-extrabold text-gold">{num}</div>
                <div className="text-[11px] font-medium leading-tight text-white/70">{label}</div>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-medium text-white/70">
            <Heart className="h-3.5 w-3.5" strokeWidth={2} /> {t("landingCommunityTagline")}
          </div>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex flex-1 flex-col bg-background px-6 py-6 sm:px-10">
        <div className="flex justify-end gap-3">
          <ThemeToggle />
          <LangSelect />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-3xl text-center"
          >
            <h1 className="text-3xl font-extrabold tracking-tight text-card-foreground sm:text-4xl">
              {t("landingWelcomeTo")} <Wordmark />
            </h1>
            <p className="mt-2 text-lg font-semibold text-muted">{t("landingPortalSubtitle")}</p>
            <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-gold" />
            <p className="mt-4 text-sm text-muted">{t("landingChooseOption")}</p>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.15 }}>
                <Card className="h-full text-left">
                  <CardContent className="flex h-full flex-col p-6">
                    <motion.div whileHover={{ scale: 1.08 }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary">
                      <GraduationCap className="h-7 w-7" strokeWidth={2} />
                    </motion.div>
                    <h3 className="mt-4 text-lg font-bold text-primary">{t("studentCheckInTitle")}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted">{t("studentCheckInDesc")}</p>
                    <Button size="lg" className="mt-5 w-full" onClick={() => goCheckIn("student")}>
                      {t("continueLabel")} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.15 }}>
                <Card className="h-full text-left">
                  <CardContent className="flex h-full flex-col p-6">
                    <motion.div whileHover={{ scale: 1.08 }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint-success text-success">
                      <Users className="h-7 w-7" strokeWidth={2} />
                    </motion.div>
                    <h3 className="mt-4 text-lg font-bold text-success">{t("visitorCheckInTitle")}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted">{t("visitorCheckInDesc")}</p>
                    <Button variant="success" size="lg" className="mt-5 w-full" onClick={() => goCheckIn("visitor")}>
                      {t("continueLabel")} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="mt-5">
              <Card className="text-left">
                <CardContent className="flex flex-col items-center gap-4 p-5 sm:flex-row">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6b21a8]/10 text-[#6b21a8]">
                    <Calendar className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-base font-bold text-card-foreground">{t("requestApptLandingBtn")}</h3>
                    <p className="text-sm text-muted">{t("requestApptCardDesc")}</p>
                  </div>
                  <Button variant="secondary" className="w-full sm:w-auto" onClick={requestAppt}>
                    {t("continueLabel")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <div className="mt-8 text-sm text-muted">
              {t("alreadyStaffLabel")}{" "}
              <Button
                variant="ghost"
                className="inline-flex h-auto gap-1 px-1 py-0 text-sm font-semibold text-primary underline-offset-4 hover:bg-transparent hover:underline"
                onClick={() => navigate("/staff-login")}
              >
                {t("staffLoginLink")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" strokeWidth={2} /> {t("secureInfoNote")}
            </div>
            <div className="mt-2 text-xs text-muted">
              © {new Date().getFullYear()} {ORG.name}. {t("allRightsReservedLabel")}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
