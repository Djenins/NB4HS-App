// KioskActionPanel.jsx -- right column of the landscape kiosk: a reassurance
// panel (thank-you note + community illustration) with an action anchored at
// the bottom. Defaults to the visitor form's Submit Check-In button; the
// student roster passes its own footer instead, since there tapping a name
// *is* the submit. The post-submit confirmation is a separate route
// (CheckInSuccess.jsx) and is left exactly as it was, so this panel is
// purely the pre-submit state.
import { CircleCheck } from "lucide-react";
import communityIllustration from "../../assets/nb4hs-community.svg";
import SubmitCheckInButton from "./SubmitCheckInButton.jsx";

export default function KioskActionPanel({ title, description, submitLabel, busy, icon: PanelIcon = CircleCheck, footer }) {
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto rounded-[18px] lg:h-full border border-border bg-[#F5F8FE] p-5 text-center dark:bg-background xl:p-6">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tint-success text-success">
        <PanelIcon size={32} strokeWidth={2} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-[1.5rem] font-extrabold tracking-tight text-navy dark:text-[color:var(--text)]">{title}</h2>
      <p className="mt-2 text-[0.98rem] leading-snug text-muted">{description}</p>

      <img
        src={communityIllustration}
        alt=""
        aria-hidden="true"
        className="mx-auto mt-5 hidden w-full max-w-[240px] min-h-0 flex-1 object-contain lg:block"
      />

      {footer || <SubmitCheckInButton label={submitLabel} busy={busy} className="mt-6" />}
    </aside>
  );
}
