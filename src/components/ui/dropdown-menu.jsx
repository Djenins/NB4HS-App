// dropdown-menu.jsx -- shadcn/ui-style DropdownMenu wrapping
// @radix-ui/react-dropdown-menu. Used for the sidebar's profile-footer
// "..." menu (Sign out today; a real menu component instead of a bare
// button, ready for more items later without redesigning anything).
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = forwardRef(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          // z-[1300] (not the default z-50) so this still renders above
          // .modal-overlay (z-index:1200, main.css) when a trigger like
          // Students.jsx's ClassroomPicker lives inside a modal -- otherwise
          // the menu opens in the DOM but is visually hidden behind the
          // modal backdrop and every item click silently hits the overlay.
          "z-[1300] min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-card-foreground shadow-card-hover animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuItem = forwardRef(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium outline-none transition-colors focus:bg-background data-[highlighted]:bg-background",
        className
      )}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = forwardRef(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownMenuPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-border", className)} {...props} />;
});

export const DropdownMenuLabel = forwardRef(function DropdownMenuLabel({ className, ...props }, ref) {
  return <DropdownMenuPrimitive.Label ref={ref} className={cn("px-2.5 py-1.5 text-xs font-semibold text-muted", className)} {...props} />;
});
