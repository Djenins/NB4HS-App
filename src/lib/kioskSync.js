// kioskSync.js -- how the kiosk copes with refused or failed calls.
// A signed-out kiosk's calls count against its site's hourly limits (the t6
// throttle, hardened in t8), and every kiosk tab and phone on the site's
// Wi-Fi shares them.

// The list fetchers in checkinData.js resolve to null when a call fails.
// Wrap a state setter with this so a failed poll leaves the list on screen.
export function keepOnFailure(setter) {
  return (rows) => { if (rows) setter(rows); };
}

// Checks out the given visits one at a time and stops at the first failure,
// rather than firing them all at once: a day's worth of open visits could
// otherwise use up the site's check-out limit in one sweep. Whatever is left
// is tried again on the next sweep. Resolves to the number checked out.
export async function checkOutInOrder(visits, checkOut) {
  let done = 0;
  for (const v of visits) {
    try { await checkOut(v.id); } catch { break; }
    done += 1;
  }
  return done;
}
