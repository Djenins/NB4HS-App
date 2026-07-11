// avatar.jsx -- shadcn/ui-style Avatar wrapping @radix-ui/react-avatar.
// Used for the sidebar's profile footer; the app has no user profile
// photos, so AvatarFallback (initials on a brand-tinted circle) is what
// actually renders everywhere today -- AvatarImage is included for
// completeness/future use.
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

export const Avatar = forwardRef(function Avatar({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
});

export const AvatarImage = forwardRef(function AvatarImage({ className, ...props }, ref) {
  return <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />;
});

export const AvatarFallback = forwardRef(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn("flex h-full w-full items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary", className)}
      {...props}
    />
  );
});
