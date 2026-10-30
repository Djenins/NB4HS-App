// button.jsx -- the design system's Button (plans/ui-design-system.md §2.4),
// shadcn-style: class-variance-authority variants + Radix Slot for
// `asChild`. Colours point at main.css tokens through tailwind.config.js,
// never at new hex values.
//
// Variants: primary (alias default), secondary, outline, ghost, danger
// (alias destructive), success. Sizes: sm 32px, md 40px (alias default),
// lg 48px, icon 36px square. Every size grows to 44px on touch screens.
// `loading` swaps the leading icon for a spinner, disables the button and
// sets aria-busy, so a double-submit can't happen while a save is running.
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

// Base starts by cancelling main.css's global `button, .btn{ min-height:52px;
// padding:12px 20px; border:2px solid transparent; font-weight:600; }` rule
// and its hover-lift/press-scale transforms (Tailwind's preflight is off, so
// those legacy tag rules still reach every <button>). `transform-none` beats
// the lift's zero-specificity :where() rule; product buttons don't jump.
// It also beats Tailwind's translate-* utilities, so a Button can't be
// centred with `top-1/2 -translate-y-1/2`: use `inset-y-0 my-auto` instead.
export const BUTTON_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal leading-none transform-none";

const buttonVariants = cva(
  BUTTON_RESET + " inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-ui font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-dark",
        default: "bg-primary text-primary-foreground hover:bg-primary-dark",
        // Secondary text is brand navy (not the interactive blue), per the
        // NB4HS brand spec; dark mode takes the theme ink, since navy on a
        // dark card is 1.4:1.
        secondary: "border border-secondary-border bg-card text-navy hover:bg-primary-tint dark:text-[color:var(--text)]",
        outline: "border border-border bg-transparent text-card-foreground hover:bg-surface-sunken",
        // Needs an explicit colour: with preflight off a <button> falls back
        // to the UA's black `buttontext`, invisible on a dark card.
        ghost: "text-card-foreground hover:bg-surface-sunken",
        danger: "bg-tone-danger-solid text-tone-danger-on-solid hover:bg-accent-dark",
        destructive: "bg-tone-danger-solid text-tone-danger-on-solid hover:bg-accent-dark",
        success: "bg-tone-success-solid text-tone-success-on-solid hover:brightness-90"
      },
      size: {
        sm: "h-8 px-3 text-meta [@media(pointer:coarse)]:h-11",
        md: "h-10 px-4 [@media(pointer:coarse)]:h-11",
        default: "h-10 px-4 [@media(pointer:coarse)]:h-11",
        lg: "h-12 px-6 text-body",
        icon: "h-9 w-9 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export const Button = forwardRef(function Button({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  if (asChild) {
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>{children}</Comp>;
  }
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Comp>
  );
});

export { buttonVariants };
