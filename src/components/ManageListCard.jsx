// ManageListCard.jsx -- the services/staff list-management card (toggle
// active, delete a custom entry, add a new custom entry). Ported from
// manage.js's manageListCard(). Used twice on the Manage page, once per kind.
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { slugify } from "../lib/utils.js";
import { createCustomOption, deleteCustomOption, setOptionDisabled } from "../lib/clientsData.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/field.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { SectionCard } from "./ui/section-card.jsx";
import { Switch } from "./ui/switch.jsx";

export default function ManageListCard({ kind, icon, title, description, list, disabled, placeholder }) {
  const { lang, showToast, requestConfirm } = useApp();
  const t = useT();
  const [input, setInput] = useState("");
  // Local overrides so a click flips the pill immediately instead of
  // waiting on the round trip + realtime refetch (which can lag enough to
  // read as "the toggle doesn't do anything").  Cleared once the refetched
  // `disabled` prop agrees; reverted if the write fails.
  const [overrides, setOverrides] = useState({});

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

  async function remove(item) {
    const ok = await requestConfirm(t("deleteLabel") + " “" + (item[lang] || item.en) + "”?", { danger: true });
    if (!ok) return;
    await deleteCustomOption(kind, item.key);
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

  const inputId = "manage-new-" + kind;

  return (
    <SectionCard
      title={<span className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-primary-tint text-primary [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>{title}</span>}
      description={description}
      action={<Badge variant="success" className="tabular-nums">{activeCount} {t("activeCountLabel")}</Badge>}
      footer={
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addNew(); }}>
          <label htmlFor={inputId} className="sr-only">{placeholder}</label>
          <Input id={inputId} placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" disabled={!input.trim()}><Plus className="h-4 w-4" aria-hidden="true" />{t("addNew")}</Button>
        </form>
      }
    >
      <ul className="m-0 list-none divide-y divide-line-subtle p-0">
        {list.map((item) => {
          const isDisabled = isKeyDisabled(item.key);
          const name = item[lang] || item.en;
          return (
            <li key={item.key} className="flex min-h-[44px] items-center justify-between gap-3 py-1.5">
              <span className={"flex min-w-0 flex-wrap items-center gap-2 text-ui " + (isDisabled ? "text-muted" : "text-card-foreground")}>
                {name}
                {item.custom && <Badge variant="neutral">{t("customLabel")}</Badge>}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={!isDisabled}
                  onCheckedChange={(next) => toggle(item.key, next).catch(() => {})}
                  label={name}
                  onText={t("activeLabel")}
                  offText={t("inactiveLabel")}
                />
                {item.custom && (
                  <IconButton label={t("deleteLabel") + " " + name} variant="danger" size="sm" onClick={() => remove(item)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
