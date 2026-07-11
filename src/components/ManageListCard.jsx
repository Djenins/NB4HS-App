// ManageListCard.jsx -- the services/staff list-management card (toggle
// active, delete a custom entry, add a new custom entry). Ported from
// manage.js's manageListCard(). Used twice on the Manage page, once per kind.
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { slugify } from "../lib/utils.js";

export default function ManageListCard({ kind, title, list, disabled, placeholder }) {
  const { data, setData, lang, showToast } = useApp();
  const t = useT();
  const [input, setInput] = useState("");

  const listKey = kind === "service" ? "customServices" : "customStaff";
  const disabledKey = kind === "service" ? "disabledServices" : "disabledStaff";

  function toggle(key, checked) {
    setData((prev) => {
      const arr = prev[disabledKey] || [];
      const idx = arr.indexOf(key);
      let next = arr;
      if (checked && idx !== -1) next = arr.filter((k) => k !== key);
      if (!checked && idx === -1) next = arr.concat([key]);
      return Object.assign({}, prev, { [disabledKey]: next });
    });
  }

  function remove(key) {
    setData((prev) => Object.assign({}, prev, {
      [listKey]: (prev[listKey] || []).filter((i) => i.key !== key)
    }));
  }

  function addNew() {
    const label = input.trim();
    if (!label) return;
    setData((prev) => {
      const existingKeys = list.map((i) => i.key);
      let key = "custom_" + slugify(label);
      let suffix = 1;
      while (existingKeys.indexOf(key) !== -1) { key = "custom_" + slugify(label) + "_" + suffix; suffix++; }
      return Object.assign({}, prev, {
        [listKey]: (prev[listKey] || []).concat([{ key, en: label, ht: label, es: label, fr: label, custom: true }])
      });
    });
    setInput("");
    showToast(t("addNew") + " ✓");
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      {list.map((item) => {
        const isDisabled = disabled.indexOf(item.key) !== -1;
        return (
          <div className="kv" key={item.key}>
            <span>
              {item[lang] || item.en}
              {item.custom && <span className="badge badge-in" style={{ marginLeft: 6 }}>{t("customLabel")}</span>}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, margin: 0 }}>
                <input type="checkbox" checked={!isDisabled} onChange={(e) => toggle(item.key, e.target.checked)} />
                {isDisabled ? t("inactiveLabel") : t("activeLabel")}
              </label>
              {item.custom && (
                <button className="btn-ghost btn-sm btn-outline-danger" onClick={() => remove(item.key)}>{t("deleteLabel")}</button>
              )}
            </span>
          </div>
        );
      })}
      <div className="field" style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <input type="text" placeholder={placeholder} aria-label={placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={addNew}>{t("addNew")}</button>
      </div>
    </div>
  );
}
