// CaseClientCard.jsx -- one row (plus an expandable notes row) in Case
// Management's client table. Rebuilt from a standalone stacked "card" onto
// real <tr>s per a reference table design the client shared -- rendered
// straight into CaseManagement.jsx's <tbody>, same click-name-to-expand-
// notes and delete behavior as before, just laid out as table cells.
import { useApp, useT } from "../context/AppContext.jsx";
import { caseServiceLabel, clientDisplayName, immigrationStatusLabel } from "../lib/clients.js";
import { formatAddress, fmtDateLong, initialsOf } from "../lib/utils.js";
import CaseNotesPanel from "./CaseNotesPanel.jsx";
import Icon from "./Icon.jsx";

export default function CaseClientCard({ client, open, onToggle, onRemove, onAddNote }) {
  const { lang } = useApp();
  const t = useT();

  return (
    <>
      <tr>
        <td>
          <button className="case-client-name-btn" onClick={onToggle} title={open ? t("hideNotesLabel") : t("viewNotesLabel")}>
            <span className="avatar-chip">{initialsOf(client)}</span>
            <span>{clientDisplayName(client)}</span>
            <span className="chevron-hint">{open ? "▾" : "▸"}</span>
          </button>
        </td>
        <td>{client.phone || "—"}</td>
        <td>{client.email || "—"}</td>
        <td>{formatAddress(client) || "—"}</td>
        <td>{immigrationStatusLabel(client.immigrationStatus, lang) || "—"}</td>
        <td>{fmtDateLong(client.intakeDate)}</td>
        <td>
          <button className="btn-ghost btn-icon btn-icon-danger" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove}>
            <Icon name="trash" />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7}>
            <div>
              {(client.services || []).map((key) => <span className="badge badge-tag" key={key}>{caseServiceLabel(key, lang)}</span>)}
            </div>
            <CaseNotesPanel client={client} onAddNote={onAddNote} />
          </td>
        </tr>
      )}
    </>
  );
}
