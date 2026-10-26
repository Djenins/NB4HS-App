// skeleton.jsx -- loading placeholders that keep the shape of what's coming,
// instead of a spinner in the middle of the content. The pulse stops under
// prefers-reduced-motion (main.css) and holds as a flat block.
import { cn } from "../../lib/cn.js";

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-tone-neutral-bg", className)} />;
}
