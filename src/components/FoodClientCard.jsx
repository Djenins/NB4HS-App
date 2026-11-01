// FoodClientCard.jsx -- how one household renders in Food Distribution's
// household list (NB4HS Operate design system). Modeled directly on
// CaseClientCard.jsx, showing pickup history instead of case notes.
//
//   foodClientColumns({ t, onOpen, onRemove })  DataTable columns (lg+)
//   <FoodClientCard client onOpen onRemove />   stacked row below lg
//   <FoodClientDrawer client onClose />         the household + its pickups
//
// Behaviour matches the old expandable table row: clicking the name opens
// the household's pickup history and the log-a-pickup form (now in a
// Drawer, which works at phone width where an expanding table row
// couldn't), the NB-ID badge goes to the Client Profile, and delete calls
// the page's confirming onRemove.
import { Home, ShoppingBasket, Trash2 } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName, lastDistributionDate } from "../lib/clients.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import { cn } from "../lib/cn.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import FoodDistributionsPanel from "./FoodDistributionsPanel.jsx";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { BUTTON_RESET } from "./ui/button.jsx";
import { DetailRow, Drawer } from "./ui/drawer.jsx";
import { IconButton } from "./ui/icon-button.jsx";

function NameButton({ client, onOpen, t, large }) {
  const name = clientDisplayName(client);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className={large ? "h-10 w-10" : "h-9 w-9"}><AvatarFallback className={avatarColorFor(name)}>{initialsOf(client)}</AvatarFallback></Avatar>
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          title={t("viewDistributionsLabel")}
          className={cn(BUTTON_RESET, "block max-w-full truncate rounded-badge text-left text-ui font-semibold text-card-foreground transition-colors duration-fast hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2")}
        >
          {name}
        </button>
        {client.nbId ? <div className="mt-1"><NbIdBadge nbId={client.nbId} /></div> : null}
      </div>
    </div>
  );
}

function RowActions({ client, onOpen, onRemove, t }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton size="sm" label={t("viewDistributionsLabel") + " " + clientDisplayName(client)} onClick={onOpen}><ShoppingBasket aria-hidden="true" /></IconButton>
      <IconButton size="sm" variant="danger" label={t("deleteLabel") + " " + clientDisplayName(client)} onClick={onRemove}><Trash2 aria-hidden="true" /></IconButton>
    </div>
  );
}

function lastPickup(client) {
  const d = lastDistributionDate(client);
  return d ? fmtDateLong(d) : "—";
}

export function foodClientColumns({ t, onOpen, onRemove }) {
  return [
    { key: "name", header: t("nameLabel"), cell: (c) => <NameButton client={c} onOpen={() => onOpen(c)} t={t} /> },
    { key: "phone", header: t("phoneLabel"), className: "whitespace-nowrap", cell: (c) => formatPhone(c.phone) || "—" },
    { key: "size", header: t("householdSizeLabel"), cell: (c) => c.householdSize || "—" },
    { key: "address", header: t("address"), cell: (c) => formatAddress(c) || "—" },
    { key: "last", header: t("lastDistributionLabel"), className: "whitespace-nowrap", cell: lastPickup },
    {
      key: "actions", header: <span className="sr-only">{t("actionsLabel")}</span>, className: "w-px",
      cell: (c) => <RowActions client={c} onOpen={() => onOpen(c)} onRemove={() => onRemove(c)} t={t} />
    }
  ];
}

export default function FoodClientCard({ client, onOpen, onRemove }) {
  const t = useT();
  const address = formatAddress(client);
  return (
    <div>
      <NameButton client={client} onOpen={onOpen} t={t} large />
      <div className="mt-3 space-y-1 text-meta tabular-nums text-muted">
        <div>{formatPhone(client.phone) || "—"}</div>
        {address ? <div className="break-words">{address}</div> : null}
        <div>{t("householdSizeLabel")}: {client.householdSize || "—"}</div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-meta tabular-nums text-muted">{t("lastDistributionLabel")}: {lastPickup(client)}</span>
        <RowActions client={client} onOpen={onOpen} onRemove={onRemove} t={t} />
      </div>
    </div>
  );
}

export function FoodClientDrawer({ client, onClose }) {
  const t = useT();
  return (
    <Drawer
      open={!!client}
      onClose={onClose}
      title={client ? clientDisplayName(client) : ""}
      subtitle={client && client.nbId ? client.nbId : undefined}
      icon={<Home />}
      closeLabel={t("closeLabel")}
    >
      {client ? (
        <>
          <dl className="m-0">
            <DetailRow label={t("phoneLabel")}>{formatPhone(client.phone) || "—"}</DetailRow>
            <DetailRow label={t("emailLabel")}><span className="break-all">{client.email || "—"}</span></DetailRow>
            <DetailRow label={t("address")}>{formatAddress(client) || "—"}</DetailRow>
            <DetailRow label={t("householdSizeLabel")}>{client.householdSize || "—"}</DetailRow>
            <DetailRow label={t("intakeDateLabel")}>{fmtDateLong(client.intakeDate) || "—"}</DetailRow>
          </dl>
          <div className="mt-6 border-t border-border pt-5">
            {/* key: a fresh panel (and fetch) per household, as the old
                per-row panel was. */}
            <FoodDistributionsPanel key={client.id} client={client} />
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
