// avatarTone.js -- the initials-avatar colour for a name, one stable tone per
// string so the same person always gets the same chip. Shared by every
// avatar in the app (it used to be three copies of a stock-Tailwind pastel
// list -- violet-100/700 etc. -- which had no dark variant and lit up as
// pale chips on dark cards). The six tones are --avatar-N-bg / --avatar-N-fg
// in main.css, each tuned for both themes.
// Spelled out in full (not built from a template) so Tailwind's scanner sees
// every class.
const AVATAR_TONES = [
  "bg-[var(--avatar-1-bg)] text-[color:var(--avatar-1-fg)]",
  "bg-[var(--avatar-2-bg)] text-[color:var(--avatar-2-fg)]",
  "bg-[var(--avatar-3-bg)] text-[color:var(--avatar-3-fg)]",
  "bg-[var(--avatar-4-bg)] text-[color:var(--avatar-4-fg)]",
  "bg-[var(--avatar-5-bg)] text-[color:var(--avatar-5-fg)]",
  "bg-[var(--avatar-6-bg)] text-[color:var(--avatar-6-fg)]"
];

export function avatarColorFor(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}
