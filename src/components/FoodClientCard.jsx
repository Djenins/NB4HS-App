// FoodClientCard.jsx -- one row (plus an expandable distribution-history
// row) in the Food Distribution page's household table. Modeled directly on
// CaseClientCard.jsx -- same click-name-to-expand pattern, just showing
// distribution history instead of case notes.
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName, lastDistributionDate } from "../lib/clients.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import FoodDistributionsPanel from "./FoodDistributionsPanel.jsx";
import Icon from "./Icon.jsx";
import NbIdBadge from "./NbIdBadge.jsx";

export default function FoodClientCard({ client, open, onToggle, onRemove, selected, onToggleSelect }) {
  const t = useT();
  const lastDate = lastDistributionDate(client);

  return (
    <>
      <tr>
        <td>
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={clientDisplayName(client)} />
        </td>
        <td>
          <button className="case-client-name-btn" onClick={onToggle} title={open ? t("hideDistributionsLabel") : t("viewDistributionsLabel")}>
            <span className="avatar-chip">{initialsOf(client)}</span>
            <span>{clientDisplayName(client)}</span>
            <span className="chevron-hint">{open ? "▾" : "▸"}</span>
          </button>
          {client.nbId && <div style={{ marginTop: 4, marginLeft: 42 }}><NbIdBadge nbId={client.nbId} /></div>}
        </td>
        <td>{formatPhone(client.phone) || "—"}</td>
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
          <td colSpan={7}>
            <FoodDistributionsPanel client={client} />
          </td>
        </tr>
      )}
    </>
  );
}
