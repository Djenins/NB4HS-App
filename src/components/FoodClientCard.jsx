// FoodClientCard.jsx -- one row (plus an expandable distribution-history
// row) in the Food Distribution page's household table. Modeled directly on
// CaseClientCard.jsx -- same click-name-to-expand pattern, just showing
// distribution history instead of case notes.
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName, lastDistributionDate } from "../lib/clients.js";
import { formatAddress, fmtDateLong, initialsOf } from "../lib/utils.js";
import FoodDistributionsPanel from "./FoodDistributionsPanel.jsx";
import Icon from "./Icon.jsx";

export default function FoodClientCard({ client, open, onToggle, onRemove, onAddDistribution }) {
  const t = useT();
  const lastDate = lastDistributionDate(client);

  return (
    <>
      <tr>
        <td>
          <button className="case-client-name-btn" onClick={onToggle} title={open ? t("hideDistributionsLabel") : t("viewDistributionsLabel")}>
            <span className="avatar-chip">{initialsOf(client)}</span>
            <span>{clientDisplayName(client)}</span>
            <span className="chevron-hint">{open ? "▾" : "▸"}</span>
          </button>
        </td>
        <td>{client.phone || "—"}</td>
        <td>{client.householdSize || "—"}</td>
        <td>{formatAddress(client) || "—"}</td>
        <td>{lastDate ? fmtDateLong(lastDate) : "—"}</td>
        <td>
          <button className="btn-ghost btn-icon btn-icon-danger" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove}>
            <Icon name="trash" />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            <FoodDistributionsPanel client={client} onAddDistribution={onAddDistribution} />
          </td>
        </tr>
      )}
    </>
  );
}
