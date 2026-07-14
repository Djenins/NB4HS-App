// JobClientCard.jsx -- one row in Job Developer's client table.
// Tailwind/shadcn redesign pass matching CaseClientCard.jsx's row pattern.
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

export default function JobClientCard({ client, onRemove, selected, onToggleSelect }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(client);

  return (
    <tr className="hover:bg-background">
      <td className="px-3 py-3">
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={name} />
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => navigate("/jobdeveloper/" + client.id)}
          className="flex min-h-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left"
        >
          <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
          <span className="text-sm font-bold text-card-foreground hover:text-primary hover:underline">{name}</span>
        </button>
        {client.nbId && <div className="mt-1 pl-[42px]"><NbIdBadge nbId={client.nbId} /></div>}
      </td>
      <td className="px-3 py-3 text-sm text-card-foreground">{formatPhone(client.phone) || "—"}</td>
      <td className="px-3 py-3 text-sm text-card-foreground">{client.email || "—"}</td>
      <td className="px-3 py-3 text-sm text-card-foreground">{formatAddress(client) || "—"}</td>
      <td className="px-3 py-3">
        {client.workPermit ? (
          <Badge>{t("yesOption") + (client.workPermitExpiration ? " (" + fmtDateLong(client.workPermitExpiration) + ")" : "")}</Badge>
        ) : (
          <Badge variant="neutral">{t("noOption")}</Badge>
        )}
      </td>
      <td className="px-3 py-3 text-sm">
        {client.hasResume && client.resumeDataUri ? (
          <a href={client.resumeDataUri} download={client.resumeFileName || "resume"} className="text-sm font-semibold text-primary hover:underline">
            {t("downloadResumeBtn")}
          </a>
        ) : (
          <span className="text-muted">{client.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}</span>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-card-foreground">{fmtDateLong(client.intakeDate)}</td>
      <td className="px-3 py-3">
        <Button variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove} className="h-8 w-8 text-muted hover:bg-tint-danger hover:text-accent">
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
