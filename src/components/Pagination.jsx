// Pagination.jsx -- table footer bar (results summary, rows-per-page
// select, numbered page buttons, next/last jump), modeled on a reference
// design the client shared. Shared by every table across the app (Students
// Assessments, Case Management, Job Developer, Food Distribution, Users) so
// they all read the same way. By design there's no "previous"/"first"
// control -- the numbered buttons (with page 1 always kept visible per
// paginationPageList's ellipsis rule) already cover jumping backward.
// Prop contract: `onChange` receives a *delta* (e.g. +1) -- numbered/next/
// last buttons just compute delta = target page minus the current page
// before calling it. Passing `pageSize`/`onPageSizeChange`/`total`/
// `itemLabel` renders the "Showing X to Y of Z {label}" text and the
// rows-per-page select; omitting them falls back to a bare numbered/next/
// last control with no footer chrome.
import { ChevronLast, ChevronRight } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { paginationPageList } from "../lib/pagination.js";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
// 36px page buttons (44px on touch screens) on the design system's control
// radius; transform-none cancels main.css's legacy hover-lift on <button>.
const navBtnClass = "flex h-9 min-h-0 min-w-9 shrink-0 transform-none items-center justify-center rounded-control border border-solid border-border bg-card px-2 py-0 text-ui font-semibold tabular-nums text-card-foreground transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11";

// `bare` drops the bar's own fill and padding, for a Pagination that sits
// inside a card body that already provides both.
export default function Pagination({ page, totalPages, total, pageSize, onPageSizeChange, itemLabel, onChange, bare }) {
  const t = useT();
  if (totalPages <= 1 && !total) return null;
  const pages = paginationPageList(page, totalPages);
  const showMeta = total !== undefined && pageSize !== undefined;
  const rangeStart = showMeta ? (total === 0 ? 0 : (page - 1) * pageSize + 1) : null;
  const rangeEnd = showMeta ? Math.min(page * pageSize, total) : null;

  return (
    <div className={cn(
      "mt-4 flex flex-col gap-3 overflow-x-auto border-t border-solid border-border sm:flex-row sm:items-center sm:justify-between sm:gap-4",
      bare ? "pt-4" : "rounded-b-surface bg-card px-5 py-4"
    )}>
      {showMeta ? (
        <div className="shrink-0 whitespace-nowrap text-ui tabular-nums text-muted">
          {t("showingRangeLabel")
            .replace("{start}", String(rangeStart))
            .replace("{end}", String(rangeEnd))
            .replace("{total}", String(total))
            .replace("{label}", itemLabel || "")}
        </div>
      ) : <div />}

      <div className="flex shrink-0 items-center gap-4">
        {showMeta && onPageSizeChange ? (
          <div className="flex items-center gap-2.5 text-ui text-muted">
            <span className="whitespace-nowrap">{t("rowsPerPageLabel")}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label={t("rowsPerPageLabel")}
              className="h-9 min-h-0 w-[84px] shrink-0 rounded-control border border-border bg-card py-0 pl-3 pr-8 text-ui font-semibold tabular-nums text-card-foreground focus:border-primary focus:outline-none focus:ring-2 [@media(pointer:coarse)]:h-11"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <div className="flex items-center gap-1.5">
            {pages.map((p, i) => (
              typeof p === "number" ? (
                <button
                  type="button" key={p} onClick={() => onChange(p - page)} aria-current={p === page ? "page" : undefined}
                  className={cn(
                    navBtnClass,
                    p === page
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary-soft hover:bg-primary-tint"
                  )}
                >
                  {p}
                </button>
              ) : (
                <span key={"gap-" + i} className="px-1 text-ui text-muted">{p}</span>
              )
            ))}
            <button
              type="button" disabled={page >= totalPages} onClick={() => onChange(1)}
              aria-label={t("nextPage")}
              className={cn(navBtnClass, "hover:border-primary-soft hover:bg-primary-tint")}
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button" disabled={page >= totalPages} onClick={() => onChange(totalPages - page)}
              aria-label={t("lastPage")}
              className={cn(navBtnClass, "hover:border-primary-soft hover:bg-primary-tint")}
            >
              <ChevronLast className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
