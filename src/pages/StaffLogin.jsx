// StaffLogin.jsx -- email/password sign-in via Supabase Auth (Phase 1 of
// the Supabase migration, see plans/wobbly-munching-rose.md). Used to be a
// manual lookup + exact-match password compare against data.users in
// localStorage; handleSubmit now calls supabase.auth.signInWithPassword and
// reads the matching `profiles` row for role/active. AppContext's own
// onAuthStateChange listener is what actually sets `session` -- this page
// just needs the fresh profile synchronously to pick a landing page and
// surface the pending-appointments toast.
//
// One deliberate omission from the reference mockup:
//  - "Remember me": Supabase Auth sessions already persist across
//    refreshes by default, so there's nothing for this checkbox to toggle.
//  - The mockup's "Your information is encrypted and protected" line was
//    replaced with the app's existing disclaimer (passwordAuthCaution).
//
// "Forgot Password?" toggles this same card into a second, simpler form
// (just an email field) that calls Supabase Auth's `resetPasswordForEmail`
// -- the email links back to /reset-password, which prompts for a new
// password via `updateUser`. The confirmation toast is worded the same way
// regardless of whether the email matches an account, so this can't be used
// to enumerate staff emails.
//
// The demo-accounts credentials panel (a click-to-copy "email / password"
// list) has been removed as of the Phase 1 Supabase migration: the 3 seed
// accounts now belong to real staff (see plans/wobbly-munching-rose.md), so
// displaying their passwords in the app's own UI -- even production-gated --
// would mean leaking real credentials, not demo ones.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BarChart3, Calendar, Eye, EyeOff, GraduationCap, Heart, Lock, Mail, Scale, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { ORG } from "../lib/constants.js";
import { pendingApptCount } from "../lib/appointments.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import { navItemsForRole, navPath } from "../lib/nav.js";
import { totalEnrolledCount } from "../lib/students.js";
import { fetchProfile, resetPasswordForEmail, signIn, signOut } from "../lib/supabaseAuth.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import LangSelect from "../components/LangSelect.jsx";

const FEATURES = [
  { icon: ShieldCheck, key: "staffFeatureSecureAuth" },
  { icon: Users, key: "staffFeatureClientMgmt" },
  { icon: Calendar, key: "staffFeatureAppointments" },
  { icon: BarChart3, key: "staffFeatureReports" },
  { icon: GraduationCap, key: "staffFeatureStudentPrograms" },
  { icon: Scale, key: "staffFeatureImmigration" }
];

function Wordmark() {
  // Gold accent letter, not red -- matches Login.jsx's wordmark treatment
  // now that red is scoped to errors/validation/destructive actions only.
  return (
    <>
      <span className="text-primary">NB</span><span className="text-gold">4</span><span className="text-primary">HS</span>
    </>
  );
}

export default function StaffLogin() {
  const { data, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("login");
  const [resetEmail, setResetEmail] = useState("");

  // Phase 1 Supabase migration: real auth (supabase.auth.signInWithPassword)
  // instead of the old plaintext data.users lookup -- see supabaseAuth.js.
  // AppContext's onAuthStateChange listener picks up the resulting session
  // on its own; this just needs the fresh profile to decide where to
  // navigate and whether there are pending appointment requests to flag.
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const { data: authData, error } = await signIn(email.trim(), password);
    if (error || !authData.user) {
      setSubmitting(false);
      showToast(t("loginError"));
      return;
    }
    const profile = await fetchProfile(authData.user.id);
    if (!profile || profile.active === false) {
      await signOut();
      setSubmitting(false);
      showToast(t("loginError"));
      return;
    }
    const items = navItemsForRole(profile.role);
    let pending = 0;
    if (profile.role === "case_manager" || profile.role === "administrator") pending += pendingApptCount(data.appointments, "case_manager");
    if (profile.role === "job_developer" || profile.role === "administrator") pending += pendingApptCount(data.appointments, "job_developer");
    navigate(navPath(items[0] || "dashboard"));
    if (pending > 0) showToast(t("pendingRequestsToast").replace("{n}", pending));
  }

  // Same generic toast whether or not the email matches an account -- avoids
  // leaking which work emails have staff accounts.
  async function handleForgotSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    await resetPasswordForEmail(resetEmail.trim());
    setSubmitting(false);
    showToast(t("resetLinkSentToast"));
    setMode("login");
    setResetEmail("");
  }

  const stats = [
    { icon: Calendar, num: (data.classes || []).length, label: t("landingClassesOfferedLabel") },
    { icon: GraduationCap, num: totalEnrolledCount(data.students), label: t("landingStudentsEnrolledLabel") },
    { icon: Users, num: (data.visits || []).length, label: t("landingVisitsOnFileLabel") }
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left brand panel -- same treatment as Login.jsx's landing page for
          visual consistency between the two public/unauthenticated screens.
          Uses --navy (chrome), not --primary (now the interactive blue). */}
      <div
        className="relative flex flex-col justify-between overflow-hidden px-8 py-8 text-white sm:px-10 sm:py-10 lg:w-[40%] lg:max-w-[500px]"
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
            {t("staffPortalHeroHeading")}
          </motion.h1>
          <div className="mt-3 h-1 w-14 rounded-full bg-gold" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/85">{t("staffPortalHeroSubtitle")}</p>

          <div className="mt-8 space-y-2.5">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-3 text-sm font-medium text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4 text-white/80" strokeWidth={2} />
                </span>
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
                <Icon className="mx-auto h-5 w-5 text-white/80" strokeWidth={2} />
                <div className="mt-1.5 text-lg font-extrabold">{num}</div>
                <div className="text-[11px] font-medium leading-tight text-white/70">{label}</div>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-medium text-white/70">
            <Heart className="h-3.5 w-3.5" strokeWidth={2} /> {t("landingCommunityTagline")}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col bg-background px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="inline-flex h-auto gap-1.5 px-1 py-0 text-sm font-semibold text-muted hover:bg-transparent hover:text-card-foreground"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" /> {t("backToHomeLabel")}
          </Button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LangSelect />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[480px]"
          >
            <div className="text-center">
              {/* Gold security icon per the brand spec -- a deliberate,
                  sparing "premium" touch on this one badge, not a wholesale
                  recolor of every icon in the app. */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-tint text-gold">
                <Lock className="h-6 w-6" strokeWidth={2} />
              </div>
              <div className="mt-3 text-sm font-bold text-primary">{t("staffLoginTitle")}</div>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-card-foreground">
                {mode === "login" ? t("welcomeBackHeading") : t("forgotPasswordHeading")}
              </h1>
              <p className="mt-2 text-sm text-muted">{mode === "login" ? t("staffLoginSubtitle") : t("forgotPasswordSubtitle")}</p>
            </div>

            <Card className="mx-auto mt-6 w-full max-w-[460px] rounded-[20px]">
              <CardContent className="p-10">
                {mode === "login" ? (
                  <form onSubmit={handleSubmit} noValidate>
                    <div className="mb-5">
                      <label className="required mb-2 block text-sm font-semibold text-card-foreground" htmlFor="login-email">{t("loginEmail")}</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={2} />
                        <input
                          type="email"
                          id="login-email"
                          autoComplete="username"
                          placeholder={t("workEmailPlaceholder")}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-14 w-full rounded-[14px] border border-border bg-background pl-11 pr-4 text-sm text-card-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <label className="required block text-sm font-semibold text-card-foreground" htmlFor="login-password">{t("loginPassword")}</label>
                        <button
                          type="button"
                          className="text-sm font-semibold text-primary hover:underline"
                          onClick={() => setMode("forgot")}
                        >
                          {t("forgotPasswordLink")}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={2} />
                        <input
                          type={showPw ? "text" : "password"}
                          id="login-password"
                          autoComplete="current-password"
                          placeholder={t("passwordFieldPlaceholder")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-14 w-full rounded-[14px] border border-border bg-background pl-11 pr-12 text-sm text-card-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-muted hover:bg-background hover:text-card-foreground"
                          onClick={() => setShowPw((v) => !v)}
                          aria-label={showPw ? t("hidePassword") : t("showPassword")}
                          title={showPw ? t("hidePassword") : t("showPassword")}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={showPw ? "hide" : "show"}
                              initial={{ rotate: -90, opacity: 0 }}
                              animate={{ rotate: 0, opacity: 1 }}
                              exit={{ rotate: 90, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="flex"
                            >
                              {showPw ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={2} />}
                            </motion.span>
                          </AnimatePresence>
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={!email.trim() || !password || submitting}
                      className="mt-2 h-14 w-full text-base"
                    >
                      {t("loginBtn")} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleForgotSubmit} noValidate>
                    <div className="mb-5">
                      <label className="required mb-2 block text-sm font-semibold text-card-foreground" htmlFor="reset-email">{t("loginEmail")}</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={2} />
                        <input
                          type="email"
                          id="reset-email"
                          autoComplete="username"
                          placeholder={t("workEmailPlaceholder")}
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="h-14 w-full rounded-[14px] border border-border bg-background pl-11 pr-4 text-sm text-card-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={!resetEmail.trim() || submitting}
                      className="mt-2 h-14 w-full text-base"
                    >
                      {t("sendResetLinkBtn")} <ArrowRight className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-3 h-auto w-full text-sm font-semibold text-muted hover:bg-transparent hover:text-card-foreground"
                      onClick={() => setMode("login")}
                    >
                      {t("backToSignIn")}
                    </Button>
                  </form>
                )}

                {mode === "login" && <p className="mt-4 text-center text-xs leading-relaxed text-muted">{t("passwordAuthCaution")}</p>}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
