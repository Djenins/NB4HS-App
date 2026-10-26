// cn.js -- the standard shadcn/ui class-name helper (clsx + tailwind-merge),
// kept as its own file instead of living in lib/utils.js: this project's
// utils.js already exports a large, unrelated set of app helpers
// (roleLabel, initialsOf, formatAddress, ...), and shadcn-style components
// conventionally import `cn` from a small dedicated module.
//
// tailwind-merge has to be told about the design system's custom scales
// (tailwind.config.js): it only knows Tailwind's stock values, so it reads
// `text-ui` as a text *colour* and drops it whenever a real colour class such
// as `text-muted` shares the cn() call -- and fails to dedupe
// `text-sm text-ui` or `rounded-lg rounded-control`.
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["title", "heading", "section", "body", "ui", "meta", "caption", "kpi"] }],
      shadow: [{ shadow: ["card", "card-hover", "raised", "overlay"] }],
      rounded: [{ rounded: ["control", "surface", "badge", "chip"] }]
    }
  }
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
