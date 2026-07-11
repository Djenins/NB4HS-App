// card.jsx -- shadcn/ui-style Card primitives. Visually equivalent to the
// existing plain-CSS .card class (var(--card) bg, var(--radius), soft
// shadow, hover elevation) so cards look consistent whether a page uses
// the old .card class or this new component -- just expressed as Tailwind
// utilities pointing at the same CSS variables, for the Dashboard/Shell
// redesign pass.
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-card transition-shadow hover:shadow-card-hover", className)}
      {...props}
    />
  );
});

export const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn("flex flex-col gap-1 p-6", className)} {...props} />;
});

export const CardTitle = forwardRef(function CardTitle({ className, ...props }, ref) {
  return <h3 ref={ref} className={cn("text-base font-bold leading-tight tracking-tight text-card-foreground", className)} {...props} />;
});

export const CardDescription = forwardRef(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn("text-sm text-muted", className)} {...props} />;
});

export const CardContent = forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
});

export const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />;
});
