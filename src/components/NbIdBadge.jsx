// NbIdBadge.jsx -- the "NB-#####" client ID that appears anywhere a unified
// client is shown (client list rows, the duplicate warning modal, the
// profile header itself), always linking to that person's Client Profile.
// A quiet secondary line rather than a tinted pill: the name is what staff
// scan for, the ID is there to read off or click when needed. Muted at
// rest, it turns into the blue link on hover and focus.
import { Link } from "react-router-dom";

export default function NbIdBadge({ nbId, onClick }) {
  if (!nbId) return null;

  return (
    <Link
      to={"/clients/" + nbId}
      // Rows and cards are often clickable themselves; the ID link wins.
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
      className="inline-flex rounded-badge text-meta font-medium tabular-nums tracking-wide text-muted no-underline transition-colors duration-fast hover:text-primary hover:underline focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2"
    >
      {nbId}
    </Link>
  );
}
