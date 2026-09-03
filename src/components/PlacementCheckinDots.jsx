// PlacementCheckinDots.jsx -- the 30/60/90/180-day retention check-in
// schedule as four state dots, shared by PlacementListItem.jsx and
// PlacementGridCard.jsx (it was previously a local helper inside the
// Placements table). Green = completed, amber = past its due date and still
// open, grey = not due yet -- the same three states checkinState() feeds the
// detail page's timeline, so a placement reads identically in either place.
import { checkinState, CHECKIN_TYPES } from "../lib/placements.js";
import { useT } from "../context/AppContext.jsx";

const DOT_COLOR = { completed: "bg-success", due: "bg-warn", upcoming: "bg-tint-neutral" };

export default function PlacementCheckinDots({ checkins }) {
  const t = useT();

  return (
    <span className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted">{t("checkinsLabel")}</span>
      <span className="flex items-center gap-1.5">
        {CHECKIN_TYPES.map(function (c) {
          const checkin = checkins ? checkins[c.key] : null;
          const state = checkin ? checkinState(checkin) : "upcoming";
          // The dot alone can't carry meaning for a screen reader, so each
          // one states its own period and state rather than relying on title.
          const label = c.en + " — " + t("checkinState_" + state);
          return (
            <span
              key={c.key}
              title={label}
              aria-label={label}
              role="img"
              className={"inline-block h-2.5 w-2.5 rounded-full " + (DOT_COLOR[state] || "bg-tint-neutral")}
            />
          );
        })}
      </span>
    </span>
  );
}
