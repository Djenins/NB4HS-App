// TwoStepSignInCard.jsx -- System Settings: whether the database refuses
// staff sessions that haven't passed two-step sign-in (app_settings
// 'require_mfa', s1_mfa_lookup_hardening). The app always asks staff to set
// up an authenticator; this switch is the server-side backstop, so turn it
// on once everyone in the list has set theirs up. Administrators only;
// staff-only, so English.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { saveAppSetting } from "../lib/permissionAdmin.js";
import { supabase } from "../lib/supabase.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { SectionCard } from "./ui/section-card.jsx";

export default function TwoStepSignInCard({ title }) {
  const { orgSettings, refetchOrgSettings, showToast, requestConfirm } = useApp();
  const on = !!(orgSettings && orgSettings.require_mfa === true);
  const [people, setPeople] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    supabase.rpc("admin_mfa_enrollment").then(({ data, error }) => setPeople(error ? [] : data || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const missing = (people || []).filter((p) => !p.enrolled);

  async function toggle() {
    const next = !on;
    if (next && missing.length) {
      const ok = await requestConfirm(
        missing.length + " active staff haven't set up two-step sign-in yet. They will be asked to set it up the next time they sign in, and can't see any data until they do. Turn it on anyway?",
        { confirmLabel: "Turn on" }
      );
      if (!ok) return;
    }
    if (!next) {
      const ok = await requestConfirm("Turn off the server check? Anyone with only a staff password could read client data again.", { confirmLabel: "Turn off", danger: true });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await saveAppSetting("require_mfa", next, null);
      await refetchOrgSettings();
      showToast(next ? "Two-step sign-in is now required." : "Two-step sign-in is no longer enforced by the server.");
    } catch (err) {
      console.warn("save require_mfa failed", err);
      showToast(String((err && err.message) || "").includes("your own account")
        ? "Sign out and back in with your authenticator code first."
        : "Couldn't change the setting. Try again.");
    }
    setSaving(false);
  }

  return (
    <SectionCard
      title={title || <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" />Two-step sign-in</span>}
      description="Staff sign in with their password and a 6-digit code from an authenticator app. When required, the server refuses any session without the code, so a stolen password alone can't open client records."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={on ? "success" : "warning"}>{on ? "Required" : "Not enforced yet"}</Badge>
        <Button variant={on ? "secondary" : "primary"} onClick={toggle} loading={saving} disabled={people === null}>
          {on ? "Turn off" : "Require for all staff"}
        </Button>
      </div>
      {people && people.length ? (
        <ul className="m-0 mt-4 list-none space-y-1.5 p-0">
          {people.map((p) => (
            <li key={p.user_id} className="flex items-center gap-2 text-body">
              {p.enrolled
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                : <CircleDashed className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
              <span className="min-w-0 truncate">{p.name || p.email}</span>
              <span className="text-meta text-muted">{p.enrolled ? "set up" : "not set up yet"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}
