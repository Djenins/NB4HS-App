// JobClientCard.jsx -- one row in Job Developer's client table. Rebuilt
// from a standalone stacked "card" onto a real <tr> per a reference table
// design the client shared. No notes-expand behavior here (that's a
// Case Management-only feature), so this is a single plain row.
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { formatAddress, fmtDateLong, initialsOf } from "../lib/utils.js";
import Icon from "./Icon.jsx";

export default function JobClientCard({ client, onRemove }) {
  const t = useT();
  return (
    <tr>
      <td>
        <span className="client-row-name">
          <span className="avatar-chip">{initialsOf(client)}</span>
          <span>{clientDisplayName(client)}</span>
        </span>
      </td>
      <td>{client.phone || "—"}</td>
      <td>{client.email || "—"}</td>
      <td>{formatAddress(client) || "—"}</td>
      <td>
        {client.workPermit ? t("yesOption") + (client.workPermitExpiration ? " (" + fmtDateLong(client.workPermitExpiration) + ")" : "") : t("noOption")}
      </td>
      <td>
        {client.hasResume && client.resumeDataUri ? (
          <a href={client.resumeDataUri} download={client.resumeFileName || "resume"} className="btn-secondary btn-sm" style={{ display: "inline-block", textDecoration: "none" }}>
            {t("downloadResumeBtn")}
          </a>
        ) : (
          <span className="muted">{client.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}</span>
        )}
      </td>
      <td>{fmtDateLong(client.intakeDate)}</td>
      <td>
        <button className="btn-ghost btn-icon btn-icon-danger" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove}>
          <Icon name="trash" />
        </button>
      </td>
    </tr>
  );
}
