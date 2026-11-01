// ClientPicker.jsx -- "find the client" inside a Communications form that
// was opened from the module rather than from a client profile. Searches the
// clients already loaded in AppContext by name, NB ID, phone or email
// (searchClients, the same rule SNAP's add-contact search uses), and shows
// the chosen client with a way to change it.
import { useState } from "react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { searchClients } from "../../lib/outreachContacts.js";
import { clientName } from "../../lib/communications.js";
import { BUTTON_RESET, Button } from "../ui/button.jsx";
import { Field } from "../ui/field.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { cn } from "../../lib/cn.js";

export default function ClientPicker({ value, onChange, id = "comm-client" }) {
  const { data } = useApp();
  const t = useT();
  const [q, setQ] = useState("");
  const matches = searchClients(data.clients || [], q, 8);

  if (value) {
    return (
      <Field label={t("commsClientLabel")} htmlFor={id}>
        <div id={id} className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-sunken px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-ui font-semibold text-card-foreground">{clientName(value)}</div>
            <div className="truncate text-meta tabular-nums text-muted">{[value.nbId, value.phone, value.email].filter(Boolean).join(" · ")}</div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>{t("commsChangeClient")}</Button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={t("commsClientLabel")} htmlFor={id} hint={q.trim().length < 2 ? t("commsClientSearchHint") : null} required>
      <div>
        <SearchInput id={id} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")}
          clearLabel={t("clearLabel")} placeholder={t("commsClientSearchPlaceholder")} autoComplete="off" data-autofocus />
        {q.trim().length >= 2 ? (
          matches.length ? (
            <ul className="m-0 mt-2 list-none divide-y divide-line-subtle rounded-control border border-border p-0" aria-label={t("commsClientMatches")}>
              {matches.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { onChange(c); setQ(""); }}
                    className={cn(BUTTON_RESET, "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2")}>
                    <span className="text-ui font-semibold text-card-foreground">{clientName(c)}</span>
                    <span className="text-meta tabular-nums text-muted">{[c.nbId, c.phone, c.email].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="m-0 mt-2 text-meta text-muted">{t("commsNoClientMatch")}</p>
        ) : null}
      </div>
    </Field>
  );
}
