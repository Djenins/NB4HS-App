// KioskPageHeader.jsx -- the title block every kiosk screen opens with: a
// round icon badge beside the page title and one line of instructions.
// Shared by appointment request/lookup, new-client registration and
// check-out so they read as one family (Back, logo and language live in
// KioskTopBar above it). Staff check-out uses it too, with an `actions` slot.

export default function KioskPageHeader({ icon: TitleIcon, title, description, actions }) {
  return (
    <header className="shrink-0">
      <div className="appt-title flex items-start gap-3 sm:gap-5">
        <span className="appt-title-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-[72px] sm:w-[72px]">
          <TitleIcon strokeWidth={2.4} aria-hidden="true" className="h-[22px] w-[22px] sm:h-9 sm:w-9" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="appt-h1 m-0 text-touch-heading font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)] sm:text-touch-hero xl:text-touch-hero">
            {title}
          </h1>
          <p className="appt-lede m-0 mt-1 max-w-[60ch] text-touch-label leading-snug sm:mt-1.5 text-muted sm:text-touch-lead">
            {description}
          </p>
        </div>
        {/* Optional page-level controls (e.g. staff check-out's "How it works"). */}
        {actions && <div className="hidden shrink-0 sm:block">{actions}</div>}
      </div>
    </header>
  );
}
