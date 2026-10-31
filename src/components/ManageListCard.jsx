// ManageListCard.jsx -- the services/staff/industries list-management card
// (toggle active, delete a custom entry, add a new custom entry). Ported
// from manage.js's manageListCard(). Used once per kind on the Manage page.
// On the NB4HS Operate design system: a SectionCard of divided rows, each
// with an ActiveToggle, and the add row in the card's footer.
import { useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { slugify } from "../lib/utils.js";
import { createCustomOption, deleteCustomOption, setOptionDisabled } from "../lib/clientsData.js";
import { Badge } from "./ui/badge.jsx";
import { BUTTON_RESET, Button } from "./ui/button.jsx";
import { Input } from "./ui/field.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { SectionCard } from "./ui/section-card.jsx";

// The Active / Inactive pill that switches a list item, classroom, grant or
// role on and off. A real switch: `name` (what it switches) is its
// accessible name and aria-checked carries the state, while the visible
// label and icon say the state in words, not colour alone. Shared by the
// Manage and Settings pages.
export function ActiveToggle({ name, active, onToggle, className }) {
  const t = useT();
  const Icon = active ? CheckCircle2 : Circle;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={name}
      onClick={onToggle}
      className={cn(
        BUTTON_RESET,
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-chip border px-3 text-meta font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 [@media(pointer:coarse)]:h-11",
        active
          ? "border-tone-success-border bg-tone-success-bg text-tone-success-ink hover:bg-tone-success-chip"
          : "border-tone-neutral-border bg-tone-neutral-bg text-tone-neutral-ink hover:bg-tone-neutral-chip",
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {active ? t("activeLabel") : t("inactiveLabel")}
    </button>
  );
}

export default function ManageListCard({ kind, title, description, list, disabled, placeholder }) {
  const { lang, showToast } = useApp();
  const t = useT();
  const [input, setInput] = useState("");
  // Local overrides so a click flips the pill immediately instead of
  // waiting on the round trip + realtime refetch (which can lag enough to
  // read as "the toggle doesn't do anything").  Cleared once the refetched
  // `disabled` prop agrees; reverted if the write fails.
  const [overrides, setOverrides] = useState({});
  const inputId = "manage-new-" + kind;

  const isKeyDisabled = (key) => (key in overrides ? overrides[key] : disabled.indexOf(key) !== -1);
  const activeCount = list.filter((item) => !isKeyDisabled(item.key)).length;

  async function toggle(key, checked) {
    // `checked` means "active" here -- disabled when unchecked.
    const nextDisabled = !checked;
    setOverrides((prev) => Object.assign({}, prev, { [key]: nextDisabled }));
    try {
      await setOptionDisabled(kind, key, nextDisabled);
      // Leave the override in place (rather than clearing it right away) so
      // the pill doesn't flicker back to the stale prop value while the
      // realtime refetch is still in flight -- it'll agree once it lands.
    } catch (err) {
      setOverrides((prev) => {
        const next = Object.assign({}, prev);
        delete next[key];
        return next;
      });
      showToast(t("manageToggleError"));
      throw err;
    }
  }

  async function remove(key) {
    await deleteCustomOption(kind, key);
  }

  async function addNew() {
    const label = input.trim();
    if (!label) return;
    const existingKeys = list.map((i) => i.key);
    let key = "custom_" + slugify(label);
    let suffix = 1;
    while (existingKeys.indexOf(key) !== -1) { key = "custom_" + slugify(label) + "_" + suffix; suffix++; }
    await createCustomOption(kind, { key, en: label, ht: label, fr: label });
    setInput("");
    showToast(t("addNew") + " ✓");
  }

  return (
    <SectionCard
      title={title}
      description={description}
      action={<Badge variant="success" className="tabular-nums">{activeCount} {t("activeCountLabel")}</Badge>}
      footer={
        // A form, so Enter adds too (it didn't before); the button does
        // the same thing.
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); addNew(); }}>
          <label htmlFor={inputId} className="sr-only">{placeholder}</label>
          <Input id={inputId} placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1" />
          <Button type="submit"><Plus className="h-4 w-4" aria-hidden="true" />{t("addNew")}</Button>
        </form>
      }
    >
      <ul className="m-0 list-none divide-y divide-line-subtle p-0">
        {list.map((item) => {
          const isDisabled = isKeyDisabled(item.key);
          const label = item[lang] || item.en;
          return (
            <li key={item.key} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-ui text-card-foreground">
                <span className="break-words">{label}</span>
                {item.custom ? <Badge variant="neutral">{t("customLabel")}</Badge> : null}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <ActiveToggle name={label} active={!isDisabled} onToggle={() => toggle(item.key, isDisabled)} />
                {item.custom ? (
                  <IconButton size="sm" variant="danger" label={t("deleteLabel") + " " + label} onClick={() => remove(item.key)}>
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
