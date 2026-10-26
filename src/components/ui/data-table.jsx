// data-table.jsx -- the list table every module uses.
//
//   <DataTable
//     columns={[{ key, header, cell: (row) => node, sortKey?, className?, hidden? }]}
//     rows getRowId={(row) => row.id}
//     sort={{ key, dir }} onSort={(sortKey) => ...}
//     selection={{ selected: Set, onToggle(id), onToggleAll(), allLabel, rowLabel(row) }}
//     renderCard={(row) => node}     // phones: one stacked row per record instead of the table
//     loading empty caption
//   />
//
// Desktop (lg and up): a table with a sticky, sunken header row and
// subtle row rules. Below lg -- phones, and tablets where the open sidebar
// leaves ~500px -- `renderCard` turns each row into a stacked block,
// because a 6-column table only scrolls sideways at 375px; without it the
// table itself scrolls horizontally. Sortable headers
// are real buttons and expose aria-sort. Numbers render with tabular figures.
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET } from "./button.jsx";
import { Skeleton } from "./skeleton.jsx";

const CHECKBOX = "h-4 w-4 cursor-pointer accent-primary";

function SortButton({ label, active, dir, onClick }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(BUTTON_RESET, "-mx-1 inline-flex items-center gap-1 rounded-badge px-1 py-0.5 font-semibold text-inherit transition-colors duration-fast hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2", active && "text-card-foreground")}
    >
      {label}
      <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} aria-hidden="true" />
    </button>
  );
}

export function DataTable({ columns, rows, getRowId, sort, onSort, selection, renderCard, loading, empty, caption, maxHeight = "65vh", className }) {
  const visible = columns.filter((c) => !c.hidden);
  const allSelected = !!selection && rows.length > 0 && rows.every((r) => selection.selected.has(getRowId(r)));

  if (loading) {
    return (
      <div className={cn("space-y-2", className)} aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }
  if (!rows.length) return empty || null;

  return (
    <div className={className}>
      <div className={cn("overflow-auto rounded-control border border-border", renderCard && "hidden lg:block")} style={{ maxHeight }}>
        <table className="w-full border-collapse text-ui tabular-nums">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {selection ? (
                <th scope="col" className="sticky top-0 z-10 w-10 bg-surface-sunken px-3 py-2.5 shadow-[inset_0_-1px_0_var(--border)]">
                  <input type="checkbox" className={CHECKBOX} checked={allSelected} onChange={selection.onToggleAll} aria-label={selection.allLabel} />
                </th>
              ) : null}
              {visible.map((col) => {
                const active = sort && col.sortKey && sort.key === col.sortKey;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      // normal-case/tracking-normal: main.css uppercases every bare th.
                      "sticky top-0 z-10 whitespace-nowrap bg-surface-sunken px-3 py-2.5 text-left text-meta font-semibold normal-case tracking-normal text-muted shadow-[inset_0_-1px_0_var(--border)]",
                      col.headerClassName
                    )}
                  >
                    {col.sortKey && onSort
                      ? <SortButton label={col.header} active={active} dir={sort.dir} onClick={() => onSort(col.sortKey)} />
                      : col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = getRowId(row);
              const isSelected = selection && selection.selected.has(id);
              return (
                <tr key={id} className={cn("border-t border-line-subtle transition-colors duration-fast first:border-t-0 hover:bg-surface-sunken", isSelected && "bg-tone-info-bg hover:bg-tone-info-bg")}>
                  {selection ? (
                    <td className="px-3 py-3 align-middle">
                      <input type="checkbox" className={CHECKBOX} checked={!!isSelected} onChange={() => selection.onToggle(id)} aria-label={selection.rowLabel(row)} />
                    </td>
                  ) : null}
                  {visible.map((col) => (
                    <td key={col.key} className={cn("px-3 py-3 align-middle text-card-foreground", col.className)}>{col.cell(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {renderCard ? (
        // Divided rows, not cards: the list already sits inside a card, and a
        // card inside a card squeezes the content at phone width.
        <ul className="m-0 list-none divide-y divide-line-subtle p-0 lg:hidden">
          {rows.map((row) => <li key={getRowId(row)} className="py-4 first:pt-1 last:pb-1">{renderCard(row)}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
