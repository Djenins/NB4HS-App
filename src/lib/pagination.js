// pagination.js -- ported from ui_widgets.js's paginateList(). The
// pagination *controls* (prev/next buttons) are now a real component
// (components/Pagination.jsx) instead of an HTML-string builder.
import { PAGE_SIZE } from "./constants.js";

export function paginateList(list, page) {
  var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  var safePage = Math.min(Math.max(1, page || 1), totalPages);
  var start = (safePage - 1) * PAGE_SIZE;
  return { items: list.slice(start, start + PAGE_SIZE), page: safePage, totalPages: totalPages, total: list.length };
}

// Builds the list of page-number buttons (plus "…" gap markers) for
// Pagination.jsx's numbered pagination, modeled on a reference design the
// client shared: always show page 1 and the last page, a small window
// around the current page, and collapse everything else into an ellipsis.
// Short page counts (<=7) just show every page, no ellipsis needed.
export function paginationPageList(page, totalPages) {
  if (totalPages <= 7) {
    var all = [];
    for (var i = 1; i <= totalPages; i++) all.push(i);
    return all;
  }
  var keep = {};
  keep[1] = true;
  keep[totalPages] = true;
  keep[page] = true;
  if (page - 1 >= 1) keep[page - 1] = true;
  if (page + 1 <= totalPages) keep[page + 1] = true;
  var sorted = Object.keys(keep).map(Number).sort(function (a, b) { return a - b; });
  var out = [];
  for (var j = 0; j < sorted.length; j++) {
    if (j > 0 && sorted[j] - sorted[j - 1] > 1) out.push("…");
    out.push(sorted[j]);
  }
  return out;
}
