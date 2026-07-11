// Pagination.jsx -- numbered page buttons + prev/next arrows, modeled on a
// reference design the client shared (replaces the old Prev/"Page X of Y"/
// Next text control). Prop contract unchanged (page/totalPages/onChange
// where onChange receives a *delta*, e.g. -1/+1), so every existing call
// site (Search, Case Management, Job Developer, Users) picks this up with
// no changes of their own -- numbered buttons just compute delta = target
// page minus the current page before calling onChange.
import { useT } from "../context/AppContext.jsx";
import { paginationPageList } from "../lib/pagination.js";
import Icon from "./Icon.jsx";

export default function Pagination({ page, totalPages, onChange }) {
  const t = useT();
  if (totalPages <= 1) return null;
  const pages = paginationPageList(page, totalPages);
  return (
    <div className="pagination-controls">
      <button
        type="button" className="pagination-arrow" disabled={page <= 1}
        onClick={() => onChange(-1)} aria-label={t("prevPage")}
      >
        <Icon name="chevronrt" className="icon-flip-x" />
      </button>
      {pages.map((p, i) => (
        typeof p === "number" ? (
          <button
            type="button" key={p} className={"pagination-page" + (p === page ? " active" : "")}
            onClick={() => onChange(p - page)} aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ) : (
          <span key={"gap-" + i} className="pagination-ellipsis">{p}</span>
        )
      ))}
      <button
        type="button" className="pagination-arrow" disabled={page >= totalPages}
        onClick={() => onChange(1)} aria-label={t("nextPage")}
      >
        <Icon name="chevronrt" />
      </button>
    </div>
  );
}
