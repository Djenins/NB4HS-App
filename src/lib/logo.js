// logo.js -- the NB4HS logo. A file (src/assets/nb4hs-logo.png) rather than
// an embedded data URI, so it isn't inside the main JavaScript bundle and the
// browser caches it on its own.
import logoUrl from "../assets/nb4hs-logo.png";

export var LOGO_URL = logoUrl;
