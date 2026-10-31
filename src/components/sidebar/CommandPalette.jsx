// CommandPalette.jsx -- the ⌘K / Ctrl+K search, opened from the sidebar's
// search field, the rail's search icon, or the shortcut anywhere in the
// staff app. One field over pages, students, case clients and (for
// administrators) staff; what each person may search is decided in
// lib/commandSearch.js from the same nav items the sidebar shows.
//
// Keyboard: arrows move through results, Enter opens, Escape closes; focus
// is trapped while open and returns to whatever opened it (useModalA11y).
// The input is an ARIA combobox driving a listbox, so screen readers hear
// the highlighted result as it moves.
import { m } from "framer-motion";
import { CornerDownLeft, FileText, GraduationCap, Search, UserRound, UsersRound } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { buildResults } from "../../lib/commandSearch.js";
import { cn } from "../../lib/cn.js";
import { useModalA11y } from "../../lib/useModalA11y.js";

const GROUP_LABEL = { pages: "cmdkGroupPages", students: "cmdkGroupStudents", clients: "cmdkGroupClients", staff: "cmdkGroupStaff" };
const KIND_ICON = { student: GraduationCap, client: UserRound, staff: UsersRound };

function Kbd({ children }) {
  return <kbd className="rounded-badge border border-border bg-background px-1.5 py-0.5 font-sans text-caption font-medium text-muted">{children}</kbd>;
}

export default function CommandPalette({ pages, scopes, placeholder, onClose, t }) {
  const { data } = useApp();
  const navigate = useNavigate();
  const boxRef = useModalA11y(onClose);
  const listRef = useRef(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const groups = useMemo(() => buildResults({ query, scopes, data, pages, lang: "en" }), [query, scopes, data, pages]);
  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups]);
  const active = flat[Math.min(activeIndex, flat.length - 1)];

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    const el = active && listRef.current && listRef.current.querySelector('[data-id="' + active.id + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  function open(result) {
    onClose();
    navigate(result.to, result.state ? { state: result.state } : undefined);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!flat.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (Math.min(i, flat.length - 1) + step + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active) open(active);
    } else if (e.key === "Escape") {
      // Handled here rather than by useModalA11y: it stands back whenever
      // focus sits on an aria-expanded element, which this combobox is.
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-start justify-center bg-surface-overlay px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <m.div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("cmdkDialogLabel")}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="flex max-h-[70vh] w-full max-w-[600px] flex-col overflow-hidden rounded-surface border border-border bg-card text-card-foreground shadow-overlay"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" strokeWidth={2} />
          <input
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-activedescendant={active ? listId + "-" + active.id : undefined}
            aria-autocomplete="list"
            aria-label={placeholder}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="!h-14 !min-h-0 flex-1 !border-none !bg-transparent !p-0 text-body !text-card-foreground !shadow-none placeholder:!text-muted focus:!outline-none focus:!ring-0"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label={t("cmdkDialogLabel")} className="min-h-0 flex-1 overflow-y-auto p-2">
          {!flat.length && <div className="px-3 py-8 text-center text-sm text-muted">{t("cmdkNoResults")}</div>}
          {groups.map((g) => (
            <div key={g.key} role="group" aria-label={t(GROUP_LABEL[g.key])} className="mb-1 last:mb-0">
              <div aria-hidden="true" className="px-3 pb-1 pt-2 text-caption font-semibold uppercase tracking-[0.06em] text-muted">{t(GROUP_LABEL[g.key])}</div>
              {g.results.map((r) => {
                const Icon = r.icon || KIND_ICON[r.kind] || FileText;
                const isActive = active && active.id === r.id;
                return (
                  <div
                    key={r.id}
                    id={listId + "-" + r.id}
                    data-id={r.id}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => { if (!isActive) setActiveIndex(flat.indexOf(r)); }}
                    onClick={() => open(r)}
                    className={cn("flex cursor-pointer items-center gap-3 rounded-control px-3 py-2", isActive ? "bg-primary-tint" : "")}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-control", isActive ? "bg-card text-primary" : "bg-background text-muted")}>
                      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", isActive ? "font-semibold text-primary" : "font-medium")}>{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                    </span>
                    {isActive && <CornerDownLeft aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div aria-hidden="true" className="hidden items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted sm:flex">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> {t("cmdkHintNavigate")}</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> {t("cmdkHintOpen")}</span>
          <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> {t("cmdkHintClose")}</span>
        </div>
      </m.div>
    </div>
  );
}
