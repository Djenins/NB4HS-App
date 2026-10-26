// SnapOverview.jsx -- the SNAP Outreach landing section for program members.
// Until Stage 2 lands there is nothing operational to show, so this says so
// plainly (no sample numbers) and restates the module's scope: NB4HS
// assists with SNAP, it doesn't decide eligibility.
import { HeartHandshake, Info } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Badge } from "../ui/badge.jsx";
import { snapRoleLabelKey } from "./snapRoleLabel.js";

export default function SnapOverview() {
  const { data } = useApp();
  const t = useT();
  const programRole = (data.programRoles || {}).snap || null;

  return (
    <div className="grid gap-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
            <HeartHandshake className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="m-0">{t("navSnapOutreach")}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          {t("snapYourRole")}: <Badge>{t(snapRoleLabelKey(programRole))}</Badge>
        </div>
      </div>

      <SectionCard title={t("snapOverviewTitle")}>
        <p className="m-0 text-sm text-card-foreground">{t("snapOverviewBody")}</p>
        <div className="info-callout mb-0 mt-4">
          <Info className="icon h-5 w-5" aria-hidden="true" />
          <p>{t("snapOverviewScope")}</p>
        </div>
      </SectionCard>
    </div>
  );
}
