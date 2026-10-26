// CaseClientCard.jsx -- how one case-management client renders in Case
// Management's client list (NB4HS Operate design system).
//
//   caseClientColumns({ t, lang, onOpen, onRemove })  DataTable columns (lg+)
//   <CaseClientCard client onOpen onRemove />         stacked row below lg
//   <CaseClientDrawer client onClose />               the record + its notes
//
// Behaviour matches the old expandable table row: clicking the name opens
// the client's services and notes (now in a Drawer, which works at phone
// width where an expanding table row couldn't), the NB-ID badge goes to the
// Client Profile, and delete calls the page's confirming onRemove.
import { NotebookPen, Trash2, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { caseServiceLabel, clientDisplayName, immigrationStatusLabel } from "../lib/clients.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import { cn } from "../lib/cn.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import CaseNotesPanel from "./CaseNotesPanel.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { BUTTON_RESET } from "./ui/button.jsx";
import { DetailRow, Drawer } from "./ui/drawer.jsx";
import { IconButton } from "./ui/icon-button.jsx";

// Immigration status is a fact about the person, not a workflow state, so
// it stays a neutral label rather than a toned status badge.
function ImmigrationBadge({ status, lang }) {
  return status ? <Badge variant="neutral">{immigrationStatusLabel(status, lang)}</Badge> : <span className="text-muted">—</span>;
}

function NameButton({ client, onOpen, t, large }) {
  const name = clientDisplayName(client);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className={large ? "h-10 w-10" : "h-9 w-9"}><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          title={t("viewNotesLabel")}
          className={cn(BUTTON_RESET, "block max-w-full truncate rounded-badge text-left text-ui font-semibold text-card-foreground transition-colors duration-fast hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2")}
        >
          {name}
        </button>
        {client.nbId ? <div className="mt-1"><NbIdBadge nbId={client.nbId} /></div> : null}
      </div>
    </div>
  );
}

function RowActions({ onOpen, onRemove, t }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton size="sm" label={t("viewNotesLabel")} onClick={onOpen}><NotebookPen aria-hidden="true" /></IconButton>
      <IconButton size="sm" variant="danger" label={t("deleteLabel")} onClick={onRemove}><Trash2 aria-hidden="true" /></IconButton>
    </div>
  );
}

export function caseClientColumns({ t, lang, onOpen, onRemove }) {
  return [
    { key: "name", header: t("nameLabel"), cell: (c) => <NameButton client={c} onOpen={() => onOpen(c)} t={t} /> },
    { key: "phone", header: t("phoneLabel"), className: "whitespace-nowrap", cell: (c) => formatPhone(c.phone) || "—" },
    { key: "email", header: t("emailLabel"), className: "break-all", cell: (c) => c.email || "—" },
    { key: "address", header: t("address"), cell: (c) => formatAddress(c) || "—" },
    { key: "immigration", header: t("immigrationStatusLabel"), cell: (c) => <ImmigrationBadge status={c.immigrationStatus} lang={lang} /> },
    { key: "intake", header: t("intakeDateLabel"), className: "whitespace-nowrap", cell: (c) => fmtDateLong(c.intakeDate) || "—" },
    {
      key: "actions", header: <span className="sr-only">{t("actionsLabel")}</span>, className: "w-px",
      cell: (c) => <RowActions onOpen={() => onOpen(c)} onRemove={() => onRemove(c)} t={t} />
    }
  ];
}

export default function CaseClientCard({ client, onOpen, onRemove }) {
  const { lang } = useApp();
  const t = useT();
  const contact = [formatPhone(client.phone), client.email].filter(Boolean).join(" · ");
  const address = formatAddress(client);
  return (
    <div>
      <NameButton client={client} onOpen={onOpen} t={t} large />
      <div className="mt-3 space-y-1 text-meta tabular-nums text-muted">
        <div className="break-words">{contact || "—"}</div>
        {address ? <div className="break-words">{address}</div> : null}
        <div>{t("intakeDateLabel")}: {fmtDateLong(client.intakeDate) || "—"}</div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <ImmigrationBadge status={client.immigrationStatus} lang={lang} />
        <RowActions onOpen={onOpen} onRemove={onRemove} t={t} />
      </div>
    </div>
  );
}

export function CaseClientDrawer({ client, onClose }) {
  const { lang } = useApp();
  const t = useT();
  return (
    <Drawer
      open={!!client}
      onClose={onClose}
      title={client ? clientDisplayName(client) : ""}
      subtitle={client && client.nbId ? client.nbId : undefined}
      icon={<UserRound />}
      closeLabel={t("closeLabel")}
    >
      {client ? (
        <>
          <dl className="m-0">
            <DetailRow label={t("phoneLabel")}>{formatPhone(client.phone) || "—"}</DetailRow>
            <DetailRow label={t("emailLabel")}><span className="break-all">{client.email || "—"}</span></DetailRow>
            <DetailRow label={t("address")}>{formatAddress(client) || "—"}</DetailRow>
            <DetailRow label={t("immigrationStatusLabel")}>{client.immigrationStatus ? immigrationStatusLabel(client.immigrationStatus, lang) : "—"}</DetailRow>
            <DetailRow label={t("intakeDateLabel")}>{fmtDateLong(client.intakeDate) || "—"}</DetailRow>
          </dl>
          {(client.services || []).length ? (
            <div className="mt-4">
              <div className="text-meta font-semibold text-muted">{t("clientServicesLabel")}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {client.services.map((key) => <Badge key={key} variant="neutral">{caseServiceLabel(key, lang)}</Badge>)}
              </div>
            </div>
          ) : null}
          <div className="mt-6 border-t border-border pt-5">
            {/* key: a fresh panel (and notes fetch) per client, as the old
                per-row panel was. */}
            <CaseNotesPanel key={client.id} client={client} />
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
