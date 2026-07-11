// tooltip.jsx -- shadcn/ui-style Tooltip wrapping @radix-ui/react-tooltip.
// Used by the collapsed sidebar rail to show each nav item's label on
// hover (replacing the native `title`-attribute tooltip from the previous
// pass with a real, styled, brand-colored tooltip matching the reference).
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef(function TooltipContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-md bg-sidebar-bg-active px-3 py-1.5 text-xs font-semibold text-white shadow-lg animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
