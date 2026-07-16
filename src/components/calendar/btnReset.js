// btnReset.js -- main.css defines a global `button, .btn { min-height:52px;
// padding:12px 20px; border:2px solid transparent; font-weight:600; }` rule
// for the app's legacy plain-CSS pages (preflight is off, see
// tailwind.config.js). Any hand-rolled <button> in the Tailwind-based
// calendar components needs this cancelled first, same as ui/button.jsx
// already does, or Tailwind's own size/border/background utilities get
// stacked on top of that oversized default instead of replacing it.
export var BTN_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal leading-none";
