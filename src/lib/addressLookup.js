// addressLookup.js -- street-address suggestions for every address form
// (components/AddressInput.jsx), from Photon: a free, keyless geocoder over
// OpenStreetMap data (https://photon.komoot.io). Results are biased toward
// Providence and limited to Rhode Island / Massachusetts / Connecticut, where
// NB4HS clients live; anything else can still be typed by hand.
//
// OpenStreetMap knows nearly every street here but few house numbers, so a
// street-level match keeps the number the person typed ("250 Elmwood" ->
// "250 Elmwood Avenue, Cranston, RI 02901"). ZIP comes from the street's own
// record, which can be off on a long street that crosses ZIP codes -- staff
// can always correct it.
//
// Typed address fragments go to Photon's servers; nothing else about the
// client (name, phone) is sent.

var PHOTON_URL = "https://photon.komoot.io/api/";
var BIAS = "&lat=41.82&lon=-71.41&location_bias_scale=0.1&zoom=10"; // Providence, weighted strongly
var BBOX = "&bbox=-73.8,40.9,-69.8,43.0"; // RI, MA, CT
var MIN_QUERY = 3;
var MAX_RESULTS = 5;

var STATE_CODES = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO",
  "connecticut": "CT", "delaware": "DE", "district of columbia": "DC", "florida": "FL", "georgia": "GA",
  "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA",
  "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT",
  "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"
};

export function stateCode(name) {
  if (!name) return "";
  if (name.length === 2) return name.toUpperCase();
  return STATE_CODES[name.toLowerCase()] || "";
}

// The house number at the start of what was typed ("250", "12B", "7-9").
function typedHouseNumber(query) {
  var m = /^\s*(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)\b/.exec(query || "");
  return m ? m[1] : "";
}

// `number` is the house number to show. Results of the street-only search
// always take the typed number (their own, if any, belongs to some other
// building on that street, e.g. a shop).
function toAddress(props, number, useOwnNumber) {
  if (props.countrycode && props.countrycode !== "US") return null;
  // A point of interest (shop, bus stop) carries its street separately; a
  // street result is named for itself. Anything else (parks, neighbourhoods)
  // isn't an address.
  var streetName = props.street || (props.type === "street" ? props.name : "");
  if (!streetName) return null;
  var num = (useOwnNumber && props.housenumber) || number;
  var street = (num ? num + " " : "") + streetName;
  var city = props.city || props.town || props.village || props.district || "";
  var state = stateCode(props.state);
  var zip = props.postcode || "";
  return { street: street, city: city, state: state, zip: zip };
}

export function addressLabel(a) {
  var tail = [a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return tail ? a.street + ", " + tail : a.street;
}

var cache = {};

async function photon(q, signal) {
  var res = await fetch(PHOTON_URL + "?q=" + encodeURIComponent(q) + "&limit=10&lang=en" + BIAS + BBOX, { signal: signal });
  if (!res.ok) return [];
  var json = await res.json();
  return (json.features || []).map(function (f) { return f.properties || {}; });
}

// With a house number typed, Photon only returns buildings whose number
// matches exactly -- rare here, and often in the wrong town. So the street
// name is also searched on its own, and its streets take the typed number.
// Exact matches come first, then streets; Rhode Island before neighbours.
export async function searchAddresses(query, signal) {
  var q = (query || "").trim();
  if (q.length < MIN_QUERY) return [];
  var key = q.toLowerCase();
  if (cache[key]) return cache[key];
  var number = typedHouseNumber(q);
  var rest = number ? q.slice(q.indexOf(number) + number.length).trim() : "";
  var lookups = [photon(q, signal)];
  if (number && rest.length >= MIN_QUERY) lookups.push(photon(rest, signal));
  var results = await Promise.all(lookups);

  var exact = results[0].map(function (p) { return toAddress(p, number, true); });
  var streets = (results[1] || []).map(function (p) { return toAddress(p, number, false); });
  var seen = {};
  var out = [];
  exact.concat(streets).forEach(function (a) {
    if (!a) return;
    var id = addressLabel(a).toLowerCase();
    if (seen[id]) return;
    seen[id] = true;
    out.push(a);
  });
  // Stable sort: Rhode Island first, otherwise keep Photon's order.
  out = out.map(function (a, i) { return { a: a, i: i }; })
    .sort(function (x, y) { return ((x.a.state === "RI" ? 0 : 1) - (y.a.state === "RI" ? 0 : 1)) || (x.i - y.i); })
    .map(function (w) { return w.a; })
    .slice(0, MAX_RESULTS);
  cache[key] = out;
  return out;
}

export var ADDRESS_MIN_QUERY = MIN_QUERY;
