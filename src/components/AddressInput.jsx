// AddressInput.jsx -- drop-in replacement for a street-address <input> that
// suggests full addresses as you type (lib/addressLookup.js) and hands the
// picked one to `onAddressSelect({ street, city, state, zip })` so the form
// can fill its other fields.
//
// It renders a plain <input> (or `as`, e.g. ui/field.jsx's Input) with every
// prop passed through, so each form keeps its own styling, and it works both controlled (value + onChange) and
// uncontrolled (the kiosk forms read values off the DOM at submit; there the
// picked street is written into the input directly). The suggestion list is
// portalled and fixed-positioned under the input, so no form needs a layout
// change to host it.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { ADDRESS_MIN_QUERY, addressLabel, searchAddresses } from "../lib/addressLookup.js";
import { cn } from "../lib/cn.js";

const DEBOUNCE_MS = 250;

export default function AddressInput({ as: Control = "input", onAddressSelect, onChange, onKeyDown, onBlur, value, className, ...rest }) {
  const t = useT();
  const inputRef = useRef(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState(null);
  // Only look up what the person typed -- not values loaded into an edit form.
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || query.trim().length < ADDRESS_MIN_QUERY) { setItems([]); setOpen(false); return undefined; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      searchAddresses(query, ctrl.signal)
        .then((rows) => { setItems(rows); setActive(-1); setOpen(rows.length > 0); })
        .catch(() => { /* offline or aborted: the field still works as plain text */ });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [query]);

  const place = useCallback(() => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  }, []);
  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open, place]);

  function close() { setOpen(false); setActive(-1); }

  function choose(a) {
    typed.current = false;
    if (value === undefined && inputRef.current) inputRef.current.value = a.street;
    close();
    setItems([]);
    if (onAddressSelect) onAddressSelect(a);
  }

  function handleChange(e) {
    typed.current = true;
    setQuery(e.target.value);
    if (onChange) onChange(e);
  }

  function handleKeyDown(e) {
    if (open && items.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % items.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); return; }
      if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); return; }
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
    }
    if (onKeyDown) onKeyDown(e);
  }

  return (
    <>
      <Control
        {...rest}
        ref={inputRef}
        value={value}
        className={className}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={(e) => { close(); if (onBlur) onBlur(e); }}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? listId + "-" + active : undefined}
      />
      {open && rect && createPortal(
        <div
          className="fixed z-[1300] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-card-hover"
          style={{ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 280) }}
        >
          <ul id={listId} role="listbox" aria-label={t("addressSuggestions")} className="m-0 max-h-[50vh] list-none overflow-y-auto p-1.5">
            {items.map((a, i) => (
              <li
                key={addressLabel(a)}
                id={listId + "-" + i}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: fires before the input's blur closes the list.
                onMouseDown={(e) => { e.preventDefault(); choose(a); }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-left",
                  i === active ? "bg-primary-tint" : "hover:bg-background"
                )}
              >
                <MapPin size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-[0.95rem] font-semibold leading-snug">{a.street}</span>
                  <span className="block text-[13px] leading-snug text-muted">{[a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 border-t border-border px-3 py-1.5 text-right text-[13px] text-muted">© OpenStreetMap</p>
        </div>,
        document.body
      )}
    </>
  );
}
