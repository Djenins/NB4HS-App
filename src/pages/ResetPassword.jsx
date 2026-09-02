// ResetPassword.jsx -- landing page for the link sent by
// StaffLogin.jsx's "Forgot password?" flow (supabaseAuth.js's
// resetPasswordForEmail). Supabase's client auto-detects the recovery
// token in the URL on load (`detectSessionInUrl`, see lib/supabase.js) and
// establishes a session for the linked account -- this page just needs a
// valid session to be present before letting the user set a new password
// via `updateUser`. Signs back out on success so they re-authenticate with
// the new password through the normal StaffLogin flow rather than being
// silently left signed in from the recovery link.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import { getSession, signOut, updatePassword } from "../lib/supabaseAuth.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

export default function ResetPassword() {
  const { showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSession().then((session) => { if (!cancelled) { setValidLink(!!session); setChecking(false); } });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) { showToast(t("passwordTooShortError")); return; }
    if (password !== confirmPassword) { showToast(t("passwordMismatchError")); return; }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    await signOut();
    setSubmitting(false);
    if (error) { showToast(t("resetLinkInvalidError")); return; }
    showToast(t("passwordUpdatedToast"));
    navigate("/staff-login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-[460px]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-tint text-gold">
            <Lock className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <img src={LOGO_DATA_URI} alt={ORG.name} className="h-8 w-8 rounded bg-white/90 object-contain p-1" />
            <span className="text-sm font-bold text-primary">{ORG.name}</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-card-foreground">{t("resetPasswordHeading")}</h1>
          <p className="mt-2 text-sm text-muted">{t("resetPasswordSubtitle")}</p>
        </div>

        <Card className="mx-auto mt-6 w-full rounded-[20px]">
          <CardContent className="p-10">
            {checking ? null : !validLink ? (
              <div className="text-center">
                <p className="text-sm text-muted">{t("resetLinkInvalidError")}</p>
                <Button size="lg" className="mt-5 h-14 w-full text-base" onClick={() => navigate("/staff-login")}>
                  {t("backToSignIn")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-5">
                  <label className="required mb-2 block text-sm font-semibold text-card-foreground" htmlFor="new-password">{t("newPasswordLabel")}</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={2} />
                    <input
                      type={showPw ? "text" : "password"}
                      id="new-password"
                      autoComplete="new-password"
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
                      {showPw ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={2} />}
                    </Button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="required mb-2 block text-sm font-semibold text-card-foreground" htmlFor="confirm-password">{t("confirmPasswordLabel")}</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={2} />
                    <input
                      type={showPw ? "text" : "password"}
                      id="confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-14 w-full rounded-[14px] border border-border bg-background pl-11 pr-4 text-sm text-card-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={!password || !confirmPassword || submitting}
                  className="mt-2 h-14 w-full text-base"
                >
                  {t("updatePasswordBtn")} <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
