// ManageListCard.jsx -- the services/staff list-management card (toggle
// active, delete a custom entry, add a new custom entry). Ported from
// manage.js's manageListCard(). Used twice on the Manage page, once per kind.
import { useState } from "react";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { slugify } from "../lib/utils.js";
import { createCustomOption, deleteCustomOption, setOptionDisabled } from "../lib/clientsData.js";

export default function ManageListCard({ kind, icon, title, description, list, disabled, placeholder }) {
  const { lang, showToast } = useApp();
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
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="icon-badge">{icon}</div>
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>{description}</p>
          </div>
        </div>
        <span className="badge badge-in">{activeCount} {t("activeCountLabel")}</span>
      </div>

      <div style={{ marginTop: 10 }}>
        {list.map((item) => {
          const isDisabled = isKeyDisabled(item.key);
          return (
            <div className="kv" key={item.key}>
              <span>
                {item[lang] || item.en}
                {item.custom && <span className="badge badge-in" style={{ marginLeft: 6 }}>{t("customLabel")}</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className={"btn-icon status-toggle" + (isDisabled ? " status-toggle-off" : " status-toggle-on")}
                  onClick={() => toggle(item.key, isDisabled)}
                >
                  {isDisabled ? <Circle className="icon" /> : <CheckCircle2 className="icon" />}
                  {isDisabled ? t("inactiveLabel") : t("activeLabel")}
                </button>
                {item.custom && (
                  <button type="button" className="btn-icon btn-icon-danger" onClick={() => remove(item.key)} aria-label={t("deleteLabel")}>
                    <Trash2 className="icon" />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="field" style={{ marginTop: 14, marginBottom: 0, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <input type="text" placeholder={placeholder} aria-label={placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={addNew}>{t("addNew")}</button>
      </div>
    </div>
  );
}
