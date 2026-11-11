// drivingDistance.js -- driving miles between two looked-up places, for My
// Mileage's "suggest the miles" (pages/Mileage.jsx). Places come from the
// address lookup (lib/addressLookup.js), which carries each one's map point;
// the route comes from the OpenStreetMap car router run by FOSSGIS
// (routing.openstreetmap.de, OSRM), free and keyless under fair use.
//
// Only map points are sent to the router, never names or addresses. The
// miles are a suggestion: staff can always type their odometer's number.

var ROUTER_URL = "https://routing.openstreetmap.de/routed-car/route/v1/driving/";
var METERS_PER_MILE = 1609.344;

export function hasPoint(p) {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

// Miles rounded to a tenth, as the form takes them; at least 0.1.
export function metersToMiles(meters) {
  if (!Number.isFinite(meters) || meters < 0) return null;
  return Math.max(0.1, Math.round((meters / METERS_PER_MILE) * 10) / 10);
}

export function routeUrl(from, to) {
  var pt = function (p) { return p.lon.toFixed(6) + "," + p.lat.toFixed(6); };
  return ROUTER_URL + pt(from) + ";" + pt(to) + "?overview=false&alternatives=false&steps=false";
}

var cache = {};

// One-way driving miles from `from` to `to` ({ lat, lon } each), or null
// when either has no point or no route was found. Throws only on abort.
export async function drivingMiles(from, to, signal) {
  if (!hasPoint(from) || !hasPoint(to)) return null;
  var url = routeUrl(from, to);
  if (cache[url] !== undefined) return cache[url];
  var res;
  try {
    res = await fetch(url, { signal: signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    return null;
  }
  if (!res.ok) return null;
  var json = await res.json().catch(function () { return null; });
  var route = json && json.code === "Ok" && json.routes && json.routes[0];
  var miles = route ? metersToMiles(route.distance) : null;
  cache[url] = miles;
  return miles;
}
