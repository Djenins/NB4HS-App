// chunkReload.js -- recover when a page's code can't be loaded after a
// deploy. Every deploy gives the lazily loaded page files (Food
// Distribution, Reports, ...) new hashed names and removes the old ones, so
// a tab opened before the deploy asks for a file that now 404s. Reloading
// fetches the new index.html with the new names. A timestamp in
// sessionStorage keeps this to one reload, so a real outage can't loop.
const KEY = "nb4hs:chunk-reload-at";
const MIN_GAP_MS = 30000;

export function isChunkLoadError(err) {
  const msg = String((err && (err.message || err)) || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(msg);
}

// Reloads (and returns true) unless we already did in the last 30 s.
export function reloadOnceForNewDeploy(storage = window.sessionStorage, now = Date.now(), reload = () => window.location.reload()) {
  let last = 0;
  try { last = Number(storage.getItem(KEY)) || 0; } catch (e) { /* storage blocked */ }
  if (now - last < MIN_GAP_MS) return false;
  try { storage.setItem(KEY, String(now)); } catch (e) { /* storage blocked */ }
  reload();
  return true;
}
