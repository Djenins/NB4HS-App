// icon-button.jsx -- a square, icon-only Button. `label` is required: it
// becomes the accessible name and the hover tooltip (title), because an
// icon alone tells a screen reader -- and many staff -- nothing.
//
// Sizes: sm 32px (dense table rows), md 36px, lg 40px; all grow to 44px on
// touch screens. Variants match Button's, defaulting to the quiet `ghost`.
import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET } from "./button.jsx";

const iconButtonVariants = cva(
  BUTTON_RESET + " inline-flex shrink-0 items-center justify-center rounded-control transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
  {
    variants: {
      variant: {
        ghost: "text-muted hover:bg-surface-sunken hover:text-card-foreground",
        secondary: "border border-border bg-card text-card-foreground hover:border-line-strong hover:bg-surface-sunken",
        primary: "bg-primary text-primary-foreground hover:bg-primary-dark",
        danger: "text-tone-danger-ink hover:bg-tone-danger-bg"
      },
      size: {
        sm: "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
        md: "h-9 w-9 [&_svg]:h-[18px] [&_svg]:w-[18px]",
        lg: "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5"
      }
    },
    defaultVariants: { variant: "ghost", size: "md" }
  }
);

export const IconButton = forwardRef(function IconButton({ label, className, variant, size, type = "button", children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
});
