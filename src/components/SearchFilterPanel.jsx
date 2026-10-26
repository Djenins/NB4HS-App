// SearchFilterPanel.jsx -- the Workforce list pages' search + filter panel,
// now a thin adapter over the design system's FilterBar: the search box on
// its own row, filters in a responsive grid underneath (collapsed behind
// "Filters (n)" on phones), and Clear all. Shared by Job Developer,
// Employers, Job Openings, Candidate Matching, Referrals and Placements.
//
// It owns no filter state of its own -- the page keeps every value and hands
// them down as a `filters` array of
// { key, icon, label, value, options, onChange } descriptors (`icon` is
// accepted and ignored: a visible label carries each filter now).
import { useId } from "react";
import { useT } from "../context/AppContext.jsx";
import { Select } from "./ui/field.jsx";
import { FilterBar, FilterField } from "./ui/filter-bar.jsx";
import { SearchInput } from "./ui/search-input.jsx";

export default function SearchFilterPanel({ search, onSearchChange, searchPlaceholder, filters, activeCount, onClearAll, className }) {
  const t = useT();
  const idBase = useId();
  return (
    <FilterBar
      className={className}
      search={
        <SearchInput
          value={search}
          onChange={function (e) { onSearchChange(e.target.value); }}
          onClear={function () { onSearchChange(""); }}
          clearLabel={t("clearAllLabel")}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      }
      activeCount={activeCount || 0}
      canClear={Boolean(activeCount) || Boolean(search)}
      onClear={onClearAll}
      clearLabel={t("clearAllLabel")}
      filtersLabel={t("filtersLabel")}
      gridClassName={filters.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}
    >
      {filters.map(function (f) {
        const id = idBase + "-" + f.key;
        return (
          <FilterField key={f.key} label={f.label} htmlFor={id}>
            <Select id={id} value={f.value} onChange={function (e) { f.onChange(e.target.value); }}>
              {f.options.map(function (o) { return <option key={o.value || "__all"} value={o.value}>{o.label}</option>; })}
            </Select>
          </FilterField>
        );
      })}
    </FilterBar>
  );
}
