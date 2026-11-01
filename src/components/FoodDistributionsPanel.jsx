// FoodDistributionsPanel.jsx -- a household's pickup history plus the
// log-a-pickup form, shown in FoodClientCard's drawer. Phase 2 Supabase
// migration: distributions are their own table now (food_distributions),
// fetched per-household on demand instead of living inline on the
// food_clients row -- same pattern as CaseNotesPanel.jsx. Presentation is
// on the NB4HS Operate design system; the data calls and the "date and
// items" check are unchanged.
import { useEffect, useId, useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import DatePicker from "./DatePicker.jsx";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { createDistribution, fetchDistributions } from "../lib/clientsData.js";
import { Button } from "./ui/button.jsx";
import { EmptyState } from "./ui/empty-state.jsx";
import { Field, Input } from "./ui/field.jsx";
import { Skeleton } from "./ui/skeleton.jsx";

export default function FoodDistributionsPanel({ client }) {
  const { showToast } = useApp();
  const t = useT();
  const idBase = useId();
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState("");
  const [quantity, setQuantity] = useState("");
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDistributions(client.id).then((rows) => { if (!cancelled) { setDistributions(rows); setLoading(false); } });
    return () => { cancelled = true; };
  }, [client.id]);

  async function add() {
    const trimmed = items.trim();
    if (!date || !trimmed) { showToast(t("distributionFixErrors")); return; }
    setSaving(true);
    try {
      const created = await createDistribution(client.id, { date, items: trimmed, quantity: quantity.trim() });
      setDistributions((prev) => [created].concat(prev));
      setItems("");
      setQuantity("");
    } finally {
      setSaving(false);
    }
  }

  const sorted = distributions.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <section aria-labelledby={idBase + "-title"}>
      <h3 id={idBase + "-title"} className="m-0 text-section font-semibold text-card-foreground">{t("foodPickupHistoryHeading")}</h3>

      <div className="mt-3" aria-busy={loading || undefined}>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sorted.length ? (
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            {sorted.map((d) => (
              <li key={d.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta tabular-nums text-muted">
                  <span>{fmtDateLong(d.date)}</span>
                  {d.quantity ? <span>{d.quantity}</span> : null}
                </div>
                <div className="mt-0.5 break-words text-body text-card-foreground">{d.items}</div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={ShoppingBasket} title={t("noDistributionsYet")} description={t("foodPickupHistoryEmptyHint")} className="py-6" />
        )}
      </div>

      <div className="mt-4 space-y-3 border-t border-line-subtle pt-4">
        <Field label={t("distributionDateLabel")} htmlFor={idBase + "-date"} required>
          <div className="ds-control"><DatePicker id={idBase + "-date"} value={date} onChange={setDate} /></div>
        </Field>
        <Field label={t("itemsLabel")} htmlFor={idBase + "-items"} required>
          <Input id={idBase + "-items"} placeholder={t("itemsPlaceholder")} value={items} onChange={(e) => setItems(e.target.value)} />
        </Field>
        <Field label={t("quantityLabel")} htmlFor={idBase + "-qty"}>
          <Input id={idBase + "-qty"} placeholder={t("quantityPlaceholder")} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={add} loading={saving}>{t("logDistributionBtn")}</Button>
      </div>
    </section>
  );
}
