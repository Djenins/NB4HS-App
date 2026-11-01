// Unsubscribe.jsx -- where a newsletter's unsubscribe link lands
// (/unsubscribe?t=<token>&l=<lang>), opened by a client from their own
// email, signed out. Client-facing, so it's in the client's language
// (`l` is the newsletter's), with the usual picker to change it.
//
// It asks before acting: mail scanners follow every link in an email, so
// unsubscribing on page load would opt people out who never clicked.
// unsubscribe_newsletter() records the opt-out as a "revoked" consent for
// program updates by email, so neither newsletters nor other program-update
// emails reach them again. Kept outside Shell, like the password reset page,
// so a home browser isn't switched into kiosk mode.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, MailX } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { unsubscribeNewsletter } from "../lib/communications.js";
import { ORG } from "../lib/constants.js";
import { LOGO_URL } from "../lib/logo.js";
import LangSelect from "../components/LangSelect.jsx";
import { Alert } from "../components/ui/alert.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";

const TOKEN = /^[0-9a-f]{64}$/;

export default function Unsubscribe() {
  const { setLang } = useApp();
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [state, setState] = useState(TOKEN.test(token) ? "ask" : "invalid"); // ask | working | done | invalid | error

  useEffect(() => {
    const l = params.get("l");
    if (l === "en" || l === "ht" || l === "fr") setLang(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm() {
    setState("working");
    try {
      const lang = await unsubscribeNewsletter(token);
      setState(lang ? "done" : "invalid");
    } catch (err) {
      console.warn("unsubscribeNewsletter failed", err);
      setState("error");
    }
  }

  const done = state === "done";
  return (
    <main className="flex min-h-screen flex-col bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <img src={LOGO_URL} alt="" className="h-9 w-9 shrink-0 rounded bg-white/90 object-contain p-1" />
          <span className="truncate text-sm font-bold text-primary">{ORG.name}</span>
        </div>
        <LangSelect />
      </div>
      <div className="flex flex-1 items-center justify-center py-8">
        <Card className="w-full max-w-[520px] p-6 text-center sm:p-10">
          <div className={"mx-auto flex h-14 w-14 items-center justify-center rounded-full " + (done ? "bg-tone-success-bg text-tone-success-ink" : "bg-primary-tint text-primary")}>
            {done ? <CheckCircle2 className="h-7 w-7" aria-hidden="true" /> : <MailX className="h-7 w-7" aria-hidden="true" />}
          </div>
          <h1 className="m-0 mt-4 text-2xl font-extrabold tracking-tight text-card-foreground [text-wrap:balance]">
            {t(done ? "unsubDoneTitle" : state === "invalid" ? "unsubInvalidTitle" : "unsubTitle")}
          </h1>
          <p className="m-0 mt-3 text-base text-muted" aria-live="polite">
            {t(done ? "unsubDoneBody" : state === "invalid" ? "unsubInvalidBody" : "unsubBody")}
          </p>
          {state === "error" ? <Alert tone="danger" className="mt-5 text-left">{t("unsubError")}</Alert> : null}
          {state === "ask" || state === "working" || state === "error" ? (
            <Button size="lg" className="mt-6 h-14 w-full text-base" loading={state === "working"} onClick={confirm}>
              {t("unsubConfirmBtn")}
            </Button>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
