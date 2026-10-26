// PlacementCheckinDots.jsx -- the 30/60/90/180-day retention check-in
// schedule as four small status chips, shared by PlacementListItem.jsx and
// PlacementGridCard.jsx (it was previously a local helper inside the
// Placements table). Each chip's tone comes from statusTone("checkin",
// state) -- completed, due (past its date and still open) or upcoming --
// the same three states checkinState() feeds the detail page's timeline, so
// a placement reads identically in either place.
//
// Colour is never the only signal: every chip shows its period (30, 60...),
// completed and overdue chips carry an icon, a visible "n of 4 done" count
// sits beside them, and each chip states its period and state in words for
// screen readers.
import { AlertCircle, Check } from "lucide-react";
import { checkinState, CHECKIN_TYPES } from "../lib/placements.js";
import { useT } from "../context/AppContext.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

const STATE_ICON = { completed: Check, due: AlertCircle };

export default function PlacementCheckinDots({ checkins }) {
  const t = useT();
  const items = CHECKIN_TYPES.map(function (c) {
    const checkin = checkins ? checkins[c.key] : null;
    return { type: c, state: checkin ? checkinState(checkin) : "upcoming" };
  });
  const doneCount = items.filter(function (i) { return i.state === "completed"; }).length;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="text-meta font-semibold text-muted">{t("checkinsLabel")}</span>
      <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
        {items.map(function (item) {
          const Icon = STATE_ICON[item.state];
          const label = item.type.en + " — " + t("checkinState_" + item.state);
          return (
            <li key={item.type.key} title={label}>
              <StatusBadge domain="checkin" status={item.state} className="tabular-nums">
                {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
                <span aria-hidden="true">{item.type.days}</span>
                <span className="sr-only">{label}</span>
              </StatusBadge>
            </li>
          );
        })}
      </ul>
      <span className="text-meta tabular-nums text-muted">
        {t("checkinsDoneCount").replace("{n}", String(doneCount)).replace("{total}", String(items.length))}
      </span>
    </div>
  );
}
