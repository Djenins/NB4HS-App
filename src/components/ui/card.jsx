// card.jsx -- shadcn/ui-style Card primitives on the design system's surface
// recipe: --card fill, hairline border, 16px surface radius, soft resting
// shadow. Cards don't lift on hover by default -- that implied every card
// was clickable. An interactive card opts in with `interactive`.
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

export const Card = forwardRef(function Card({ className, interactive, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-surface border border-border bg-card text-card-foreground shadow-card",
        interactive && "transition-[box-shadow,border-color] duration-base hover:border-line-strong hover:shadow-raised",
        className
      )}
      {...props}
    />
  );
});

export const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn("flex flex-col gap-1 p-6", className)} {...props} />;
});

// m-0 on the heading and description: main.css still gives bare h1-h3/p a
// bottom margin, which would otherwise double the card's own spacing.
export const CardTitle = forwardRef(function CardTitle({ className, ...props }, ref) {
  return <h3 ref={ref} className={cn("m-0 text-section font-semibold text-card-foreground", className)} {...props} />;
});

export const CardDescription = forwardRef(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn("m-0 text-meta text-muted", className)} {...props} />;
});

export const CardContent = forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
});

export const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />;
});
