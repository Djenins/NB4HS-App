// sidebarStyles.js -- class strings shared by the floating sidebar's parts.
//
// main.css styles the bare `button` tag app-wide (min-height:52px; padding;
// 2px border; font-weight:600) and nudges it on hover via
// :where(button:hover){transform}, because Tailwind's preflight is off. Every
// raw <button> in the sidebar starts with BTN_RESET to cancel both.
export const BTN_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal leading-none transform-none";

// One keyboard focus ring for every sidebar control.
export const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Hover/press colour changes: quick and calm; none at all with reduced motion.
export const EASE = "transition-colors duration-150 ease-out motion-reduce:transition-none";
