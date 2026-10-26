// loadXlsx.js -- SheetJS, fetched the first time a spreadsheet is read or a
// template is downloaded, instead of a <script defer> in index.html that
// every page (the public kiosk included) downloaded up front for a handful of
// staff-only import/template buttons. Same CDN build as before (SheetJS
// stopped publishing to npm after 0.18.5), so behaviour is unchanged; it just
// arrives on demand. Resolves to window.XLSX, or null if it can't load --
// every caller already has a CSV fallback for exactly that case.
const XLSX_SRC = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
let pending = null;

export function loadXlsx() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!pending) {
    pending = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = XLSX_SRC;
      script.async = true;
      script.onload = () => resolve(window.XLSX || null);
      script.onerror = () => { pending = null; script.remove(); resolve(null); };
      document.head.appendChild(script);
    });
  }
  return pending;
}
