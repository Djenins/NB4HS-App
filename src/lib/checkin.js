// checkin.js -- the one tiny piece of checkin_checkout.js that's pure data,
// not markup: the URL a personal check-out QR code encodes. Ported from
// checkoutUrlFor().
export function checkoutUrlFor(id) {
  var base = window.location.origin + window.location.pathname;
  return base + "?checkoutId=" + encodeURIComponent(id);
}
