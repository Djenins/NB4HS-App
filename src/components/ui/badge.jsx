// badge.jsx -- shadcn/ui-style Badge (program/status pills, e.g. "Case
// Management" tags on the Dashboard's Recent Check-Ins / Upcoming
// Appointments rows). Tint variants reuse the same tint tokens the rest of
// the app already uses for badges (var(--primary-tint), var(--tint-success), etc.).
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary-tint text-primary",
        accent: "bg-accent-tint text-accent",
        success: "bg-tint-success text-success",
        warn: "bg-tint-warn text-warn",
        neutral: "bg-tint-neutral text-muted"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
