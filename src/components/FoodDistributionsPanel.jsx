// FoodDistributionsPanel.jsx -- distribution history list + log-a-pickup
// form shown when a household's row is expanded on the Food Distribution
// page. Modeled directly on CaseNotesPanel.jsx, but each entry is a
// structured record (date + items + optional quantity) instead of free text,
// since that's what staff actually need to see at a glance across visits.
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import DatePicker from "./DatePicker.jsx";
import { fmtDateLong, todayStr } from "../lib/utils.js";

export default function FoodDistributionsPanel({ client, onAddDistribution }) {
  const { showToast } = useApp();
  const t = useT();
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState("");
  const [quantity, setQuantity] = useState("");
  const distributions = (client.distributions || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  function add() {
    const trimmed = items.trim();
    if (!date || !trimmed) { showToast(t("distributionFixErrors")); return; }
    onAddDistribution({ date, items: trimmed, quantity: quantity.trim() });
    setItems("");
    setQuantity("");
  }

  return (
    <div className="case-notes-panel">
      {distributions.length ? (
        distributions.map((d) => (
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
