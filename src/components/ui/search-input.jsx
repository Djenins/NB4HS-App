// search-input.jsx -- the text search box at the head of every list page:
// a leading magnifier, the input, and a clear button once there's a query.
import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { CONTROL } from "./field.jsx";
import { IconButton } from "./icon-button.jsx";

export const SearchInput = forwardRef(function SearchInput({ value, onChange, onClear, clearLabel, className, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={onChange}
        className={cn(CONTROL, "h-10 pl-10 pr-10 [@media(pointer:coarse)]:h-11 [&::-webkit-search-cancel-button]:appearance-none")}
        {...props}
      />
      {/* Centred by a flex wrapper, not translate: IconButton cancels the
          legacy hover-lift with transform-none, which would also cancel a
          -translate-y-1/2 on the button itself. */}
      {value ? (
        <span className="absolute inset-y-0 right-1 flex items-center [@media(pointer:coarse)]:right-0">
          <IconButton label={clearLabel} size="sm" onClick={onClear}>
            <X aria-hidden="true" />
          </IconButton>
        </span>
      ) : null}
    </div>
  );
});
