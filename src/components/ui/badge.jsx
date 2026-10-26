// badge.jsx -- a small tinted label. Variants are the design system's tones
// (info, success, warning, danger, neutral, violet); the older names
// (default, accent, warn) stay as aliases so existing call sites and the
// per-module statusBadgeVariant() helpers keep working while pages migrate.
// `dot` adds a solid status dot -- colour is never the only signal, the
// label always carries the meaning.
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

const TONE = {
  info: "bg-tone-info-bg text-tone-info-ink",
  success: "bg-tone-success-bg text-tone-success-ink",
  warning: "bg-tone-warning-bg text-tone-warning-ink",
  danger: "bg-tone-danger-bg text-tone-danger-ink",
  neutral: "bg-tone-neutral-bg text-tone-neutral-ink",
  violet: "bg-tone-violet-bg text-tone-violet-ink"
};

const DOT = {
  info: "bg-tone-info-solid",
  success: "bg-tone-success-solid",
  warning: "bg-tone-warning-solid",
  danger: "bg-tone-danger-solid",
  neutral: "bg-tone-neutral-solid",
  violet: "bg-tone-violet-solid"
};

const ALIASES = { default: "info", accent: "danger", warn: "warning" };

export function toneOf(variant) {
  return ALIASES[variant] || (TONE[variant] ? variant : "info");
}

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-badge px-2 py-0.5 text-caption font-semibold",
  {
    variants: {
      variant: Object.assign({}, TONE, { default: TONE.info, accent: TONE.danger, warn: TONE.warning })
    },
    defaultVariants: { variant: "info" }
  }
);

export function Badge({ className, variant, dot, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-chip", DOT[toneOf(variant)])} /> : null}
      {children}
    </span>
  );
}
