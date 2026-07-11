// button.jsx -- shadcn/ui-style Button, hand-written to match the standard
// shadcn output (class-variance-authority variants + Radix Slot for
// `asChild`) since this project has no network access to the shadcn CLI's
// component registry. Colors point at the NB4HS brand tokens via
// tailwind.config.js (bg-primary => var(--primary), etc.), not new hex
// values. Only used by the Tailwind-redesigned Dashboard/Shell -- the rest
// of the app keeps its existing .btn-primary/.btn-secondary CSS classes.
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

// Base starts by canceling main.css's global `button, .btn{ min-height:52px;
// padding:12px 20px; border:2px solid transparent; font-weight:600; }` rule
// (still in effect for the rest of the app's plain-CSS pages, since
// Tailwind's preflight reset is deliberately off -- see tailwind.config.js).
// Without this, every size/variant below gets inflated/misshaped by that
// legacy rule bleeding through. The size/variant classes generated after
// this in the cva string always win the conflicting slots (height vs
// min-height don't conflict at all; padding/border/font-weight are
// resolved by cn()'s tailwind-merge, which keeps whichever conflicting
// utility comes later).
const buttonVariants = cva(
  "min-h-0 border-0 bg-transparent p-0 font-normal leading-none inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-dark",
        // Secondary button text is brand navy (not the interactive blue) and
        // uses a dedicated slate border, per the NB4HS Design System spec.
        secondary: "bg-card text-navy border border-[#CBD5E1] hover:bg-primary-tint",
        outline: "border border-border bg-transparent hover:bg-background",
        ghost: "hover:bg-background",
        destructive: "bg-accent text-accent-foreground hover:bg-accent-dark",
        // No --success-dark token exists (only primary/accent have a dark
        // variant), so this uses a brightness filter for the hover-darken
        // instead of a second named color.
        success: "bg-success text-white hover:brightness-90"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export const Button = forwardRef(function Button({ className, variant, size, asChild, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
});
