// FoodDistributionsPanel.jsx -- distribution history list + log-a-pickup
// form shown when a household's row is expanded on the Food Distribution
// page. Phase 2 Supabase migration: distributions are their own table now
// (food_distributions), fetched per-household on demand instead of living
// inline on the food_clients row -- same pattern as CaseNotesPanel.jsx.
import { useEffect, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import DatePicker from "./DatePicker.jsx";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { createDistribution, fetchDistributions } from "../lib/clientsData.js";

export default function FoodDistributionsPanel({ client }) {
  const { showToast } = useApp();
  const t = useT();
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState("");
  const [quantity, setQuantity] = useState("");
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDistributions(client.id).then((rows) => { if (!cancelled) { setDistributions(rows); setLoading(false); } });
    return () => { cancelled = true; };
  }, [client.id]);

  async function add() {
    const trimmed = items.trim();
    if (!date || !trimmed) { showToast(t("distributionFixErrors")); return; }
    const created = await createDistribution(client.id, { date, items: trimmed, quantity: quantity.trim() });
    setDistributions((prev) => [created].concat(prev));
    setItems("");
    setQuantity("");
  }

  const sorted = distributions.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="case-notes-panel">
      {loading ? (
        <p className="muted">…</p>
      ) : sorted.length ? (
        sorted.map((d) => (
          <div className="case-note-item" key={d.id}>
            <div className="note-date">{fmtDateLong(d.date)}{d.quantity ? " — " + d.quantity : ""}</div>
            <div>{d.items}</div>
          </div>
        ))
      ) : (
        <p className="muted">{t("noDistributionsYet")}</p>
      )}
      <div className="grid grid-3">
        <div className="field"><label htmlFor={"dist-date-" + client.id}>{t("distributionDateLabel")}</label><DatePicker id={"dist-date-" + client.id} value={date} onChange={setDate} /></div>
        <div className="field"><label htmlFor={"dist-items-" + client.id}>{t("itemsLabel")}</label><input type="text" id={"dist-items-" + client.id} placeholder={t("itemsPlaceholder")} value={items} onChange={(e) => setItems(e.target.value)} /></div>
        <div className="field"><label htmlFor={"dist-qty-" + client.id}>{t("quantityLabel")}</label><input type="text" id={"dist-qty-" + client.id} placeholder={t("quantityPlaceholder")} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
      </div>
      <button className="btn-secondary btn-sm" onClick={add}>{t("logDistributionBtn")}</button>
    </div>
  );
}
