// PlacementTimeline.jsx -- 5-node Hired -> 30 -> 60 -> 90 -> 180 visual on
// PlacementDetail.jsx. Unlike JobPipelineTracker.jsx/EmployerPipelineTracker.jsx
// this isn't click-to-select-a-stage -- each node's color is driven by
// checkinState() (upcoming/due/completed), and clicking a check-in node
// scrolls to its PlacementCheckinCard instead of changing any state.
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { CHECKIN_TYPES, checkinState } from "../lib/placements.js";

export default function PlacementTimeline({ checkins }) {
  const t = useT();
  const nodes = [{ key: "hired", label: t("hiredLabel"), state: "completed", clickable: false }].concat(
    CHECKIN_TYPES.map((c) => {
      const checkin = (checkins || []).find((ci) => ci.checkinType === c.key);
      return { key: c.key, label: c.en, state: checkin ? checkinState(checkin) : "upcoming", clickable: true };
    })
  );

  function scrollToCheckin(key) {
    const el = document.getElementById("placement-checkin-" + key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-wrap items-center">
      {nodes.map((n, i) => {
        const color = n.state === "completed" ? "bg-primary text-white" : n.state === "due" ? "bg-tint-warn text-warn" : "bg-tint-neutral text-muted";
        const Icon = n.state === "completed" ? CheckCircle2 : n.state === "due" ? Clock : Circle;
        return (
          <div key={n.key} className="flex items-center">
            <button
              type="button"
              onClick={() => n.clickable && scrollToCheckin(n.key)}
              className="flex flex-col items-center gap-1 border-0 bg-transparent p-0"
            >
              <span className={"flex h-9 w-9 items-center justify-center rounded-full " + color}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-semibold text-muted">{n.label}</span>
            </button>
            {i < nodes.length - 1 && <span className="mx-1.5 mb-4 h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
