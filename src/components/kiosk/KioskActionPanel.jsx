// KioskActionPanel.jsx -- right column of the landscape kiosk: a reassurance
// panel (thank-you note + community illustration) with an action anchored at
// the bottom. Defaults to the visitor form's Submit Check-In button; the
// student roster passes its own footer instead, since there tapping a name
// *is* the submit. The post-submit confirmation is a separate route
// (CheckInSuccess.jsx), so this panel is purely the pre-submit state.
//
// On a phone the reassurance panel would sit between the last field and the
// button, so it's dropped there: Submit instead stays pinned to the bottom of
// the screen while the client scrolls the form (the student footer just sits
// at the end of the roster).
import { CircleCheck } from "lucide-react";
import communityIllustration from "../../assets/nb4hs-community.svg";
import { cn } from "../../lib/cn.js";
import SubmitCheckInButton from "./SubmitCheckInButton.jsx";

export default function KioskActionPanel({ title, description, submitLabel, busy, icon: PanelIcon = CircleCheck, footer }) {
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col text-center lg:h-full lg:overflow-y-auto lg:rounded-surface lg:border lg:border-border lg:bg-tone-info-bg lg:p-5 xl:p-6",
        !footer && "sticky bottom-0 z-10 -mx-3 border-t border-border bg-background px-3 pb-3 pt-3 lg:static lg:mx-0 lg:border-t"
      )}
    >
      <div className="hidden lg:block">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tone-success-chip text-tone-success-ink">
          <PanelIcon size={32} strokeWidth={2} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-touch-heading font-extrabold tracking-tight text-navy dark:text-[color:var(--text)]">{title}</h2>
        <p className="mt-2 text-touch-body leading-snug text-muted">{description}</p>
      </div>

      <img
        src={communityIllustration}
        alt=""
        aria-hidden="true"
        className="mx-auto mt-5 hidden w-full max-w-[240px] min-h-0 flex-1 object-contain lg:block"
      />

      {footer || <SubmitCheckInButton label={submitLabel} busy={busy} className="min-h-[60px] lg:mt-6 lg:min-h-[72px]" />}
    </aside>
  );
}
