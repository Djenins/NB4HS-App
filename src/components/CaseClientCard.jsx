// CaseClientCard.jsx -- one row (plus an expandable notes row) in Case
// Management's client table. Tailwind/shadcn redesign pass -- same
// click-name-to-expand-notes and delete behavior as before, rendered with
// Avatar/Badge primitives to match FoodClientCard.jsx's row pattern.
import { CheckCircle2, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { caseServiceLabel, clientDisplayName, immigrationStatusLabel } from "../lib/clients.js";
import { updateCaseClient } from "../lib/clientsData.js";
import { LANGS } from "../lib/constants.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import CaseNotesPanel from "./CaseNotesPanel.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

export default function CaseClientCard({ client, open, onToggle, onRemove, selected, onToggleSelect }) {
  const { lang, showToast } = useApp();
  const t = useT();
  const name = clientDisplayName(client);
  const language = LANGS.find((l) => l.code === client.preferredLanguage);

  // Self-registered clients (ClientRegister.jsx) arrive flagged until a case
  // manager has done the full intake with them.
  async function markIntakeDone() {
    try {
      await updateCaseClient(client.id, { needsIntake: false });
      showToast(t("intakeMarkedDone"));
    } catch (err) {
      console.warn("markIntakeDone failed", err);
      showToast(t("manageToggleError"));
    }
  }

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
          {(client.nbId || client.needsIntake || client.source === "self" || language) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[42px]">
              {client.nbId && <NbIdBadge nbId={client.nbId} />}
              {client.source === "self" && <Badge variant="neutral">{t("selfRegisteredBadge")}</Badge>}
              {client.needsIntake && <Badge variant="warn">{t("needsIntakeBadge")}</Badge>}
              {language && <Badge variant="default" title={t("preferredLanguageLabel")}>{language.label}</Badge>}
            </div>
          )}
        </td>
        <td className="px-3 py-3 text-sm text-card-foreground">{formatPhone(client.phone) || "—"}</td>
        <td className="px-3 py-3 text-sm text-card-foreground">{client.email || "—"}</td>
        <td className="px-3 py-3 text-sm text-card-foreground">{formatAddress(client) || "—"}</td>
        <td className="px-3 py-3">{client.immigrationStatus ? <Badge>{immigrationStatusLabel(client.immigrationStatus, lang)}</Badge> : "—"}</td>
        <td className="px-3 py-3 text-sm text-card-foreground">{fmtDateLong(client.intakeDate)}</td>
        <td className="flex items-center gap-1 px-3 py-3">
          {client.needsIntake && (
            <Button variant="ghost" size="icon" title={t("markIntakeDoneLabel")} aria-label={t("markIntakeDoneLabel") + " " + name} onClick={markIntakeDone} className="h-8 w-8 text-muted hover:bg-tint-success hover:text-success">
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
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
