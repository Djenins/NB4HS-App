// cn.js -- the standard shadcn/ui class-name helper (clsx + tailwind-merge),
// kept as its own file instead of living in lib/utils.js: this project's
// utils.js already exports a large, unrelated set of app helpers
// (roleLabel, initialsOf, formatAddress, ...), and shadcn-style components
// conventionally import `cn` from a small dedicated module.
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
