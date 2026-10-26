// statusTone.js -- the one place a domain status becomes a colour.
// Every status badge in the app asks this map which tone to use, so
// "completed" is the same green on every screen and red stays reserved for
// errors and overdue work (PRODUCT.md, brand commitments).
//
// Keys are "<domain>:<status>". Domains migrate in as their pages move onto
// the design system; an unknown status falls back to neutral rather than
// guessing a colour.
const STATUS_TONES = {
  // Visitor log (Search, Check-Out)
  "visit:in": "success",
  "visit:out": "neutral"
};

export function statusTone(domain, status) {
  return STATUS_TONES[domain + ":" + status] || "neutral";
}
