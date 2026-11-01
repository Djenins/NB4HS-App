// switch.jsx -- an on/off switch for settings and list rows that save the
// moment they're flipped (no Save button). `label` names what is switched
// (it becomes the accessible name); the visible state word ("Active",
// "Inactive") sits beside the track so the state is never colour alone.
// The button is a 44px-tall hit area on touch screens around a 20px track.
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET } from "./button.jsx";

export function Switch({ checked, onCheckedChange, label, onText, offText, disabled, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        BUTTON_RESET,
        "group inline-flex h-8 items-center gap-2 rounded-control px-1 text-meta font-semibold transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:coarse)]:h-11",
        checked ? "text-tone-success-ink" : "text-muted",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-chip transition-colors duration-fast",
          checked ? "bg-tone-success-solid" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 h-4 w-4 rounded-chip bg-card shadow-card transition-transform duration-fast motion-reduce:transition-none",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
      {onText || offText ? <span className="min-w-[4.5em] text-left">{checked ? onText : offText}</span> : null}
    </button>
  );
}
