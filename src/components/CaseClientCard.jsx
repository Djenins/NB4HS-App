// CaseClientCard.jsx -- one row (plus an expandable notes row) in Case
// Management's client table. Tailwind/shadcn redesign pass -- same
// click-name-to-expand-notes and delete behavior as before, rendered with
// Avatar/Badge primitives to match FoodClientCard.jsx's row pattern.
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { caseServiceLabel, clientDisplayName, immigrationStatusLabel } from "../lib/clients.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import CaseNotesPanel from "./CaseNotesPanel.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

export default function CaseClientCard({ client, open, onToggle, onRemove, selected, onToggleSelect }) {
  const { lang } = useApp();
  const t = useT();
  const name = clientDisplayName(client);

  return (
    <>
      <tr className="hover:bg-background">
        <td className="px-3 py-3">
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} aria-label={name} />
        </td>
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            title={open ? t("hideNotesLabel") : t("viewNotesLabel")}
            className="flex min-h-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left"
          >
            <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
            <span className="text-sm font-bold text-card-foreground hover:text-primary hover:underline">{name}</span>
            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />}
          </button>
          {client.nbId && <div className="mt-1 pl-[42px]"><NbIdBadge nbId={client.nbId} /></div>}
        </td>
        <td className="px-3 py-3 text-sm text-card-foreground">{formatPhone(client.phone) || "—"}</td>
        <td className="px-3 py-3 text-sm text-card-foreground">{client.email || "—"}</td>
        <td className="px-3 py-3 text-sm text-card-foreground">{formatAddress(client) || "—"}</td>
        <td className="px-3 py-3">{client.immigrationStatus ? <Badge>{immigrationStatusLabel(client.immigrationStatus, lang)}</Badge> : "—"}</td>
        <td className="px-3 py-3 text-sm text-card-foreground">{fmtDateLong(client.intakeDate)}</td>
        <td className="px-3 py-3">
          <Button variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove} className="h-8 w-8 text-muted hover:bg-tint-danger hover:text-accent">
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-background px-3 py-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(client.services || []).map((key) => <Badge key={key} variant="neutral">{caseServiceLabel(key, lang)}</Badge>)}
            </div>
            <CaseNotesPanel client={client} />
          </td>
        </tr>
      )}
    </>
  );
}
