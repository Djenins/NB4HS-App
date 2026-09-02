// KioskSidebar.jsx -- left identity/navigation column of the landscape
// check-in kiosk: who this screen is for, the three step cards, and the
// "ask a staff member" note pinned to the bottom. The Back control lives in
// the kiosk header row above this column (see CheckInVisitor.jsx) so it sits
// in the top-left corner of the kiosk frame.
import { CircleHelp, UserRoundCheck } from "lucide-react";
import KioskStepCard from "./KioskStepCard.jsx";

export default function KioskSidebar({ title, subtitle, steps, activeStep, onStepSelect, helpTitle, helpText }) {
  return (
    <div className="flex min-h-0 flex-col lg:h-full lg:overflow-y-auto">
      <span className="kiosk-sidebar-badge flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary xl:h-14 xl:w-14">
        <UserRoundCheck size={26} strokeWidth={2} aria-hidden="true" />
      </span>
      {/* Split on spaces so a long title wraps between words instead of
          breaking inside "Check-In" at its hyphen on narrower kiosks. */}
      <h1 className="kiosk-sidebar-title mt-2.5 text-[1.75rem] font-extrabold leading-[1.12] tracking-tight text-navy dark:text-[color:var(--text)] xl:text-[2.2rem]">
        {title.split(" ").map((word, i) => (
          <span key={word + i} className="inline-block">{word}{i < title.split(" ").length - 1 ? "\u00a0" : ""}</span>
        ))}
      </h1>
      <p className="mt-2 text-[0.92rem] leading-snug text-muted xl:text-[1rem]">{subtitle}</p>

      <nav aria-label={title} className="kiosk-sidebar-steps mt-4 hidden gap-2 md:flex md:flex-row lg:flex-col xl:mt-5 xl:gap-2.5">
        {steps.map((step) => (
          <KioskStepCard
            key={step.id}
            number={step.number}
            icon={step.icon}
            title={step.title}
            description={step.description}
            active={activeStep === step.id}
            onClick={() => onStepSelect(step.id)}
          />
        ))}
      </nav>

      <div className="kiosk-sidebar-help mt-auto hidden items-start gap-2.5 pt-4 lg:flex">
        <CircleHelp size={20} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
        <div>
          <p className="m-0 text-[0.95rem] font-bold text-navy dark:text-[color:var(--text)]">{helpTitle}</p>
          <p className="m-0 text-[0.9rem] leading-snug text-muted">{helpText}</p>
        </div>
      </div>
    </div>
  );
}
