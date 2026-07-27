// Placements.jsx -- Placements list, Phase 4 of the Employer & Job
// Opportunity Management module. Same Tailwind/shadcn table idiom as
// JobOpenings.jsx. Reads router `state` (set by ReferralFormModal.jsx's
// "Create Placement" hand-off, same pattern JobOpenings.jsx uses to hand
// off to CandidateMatching.jsx) to auto-open the Add Placement form
// pre-filled from a hired referral.
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { createPlacement } from "../lib/clientsData.js";
import { CHECKIN_TYPES, checkinState, placementStatusBadgeVariant, placementStatusLabel } from "../lib/placements.js";
import { fmtDateLong } from "../lib/utils.js";
import EmptyState from "../components/EmptyState.jsx";
import PlacementFormModal from "../components/PlacementFormModal.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

const DOT_COLOR = { completed: "bg-success", due: "bg-warn", upcoming: "bg-tint-neutral" };

function CheckinDot({ checkin, label }) {
  const state = checkin ? checkinState(checkin) : "upcoming";
  return <span title={label} className={"inline-block h-2.5 w-2.5 rounded-full " + (DOT_COLOR[state] || "bg-tint-neutral")} />;
}

export default function Placements() {
  const { data, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(!!(location.state && location.state.prefill));

  const jobClients = (data.jobClients || []).filter((c) => c.active !== false);
  const employers = data.employers || [];
  const jobOpenings = data.jobOpenings || [];
  const placements = data.placements || [];
  const checkinsByPlacement = {};
  (data.placementCheckins || []).forEach((c) => {
    if (!checkinsByPlacement[c.placementId]) checkinsByPlacement[c.placementId] = {};
    checkinsByPlacement[c.placementId][c.checkinType] = c;
  });

  async function createFromModal(fields) {
    await createPlacement(fields);
    setAdding(false);
    showToast(t("placementAdded"));
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("placementsTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("placementsDesc")}</p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {t("addPlacementBtn")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          {placements.length ? (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("participantLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("companyLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("positionLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("jobStartDateLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("hourlyWageLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("hoursPerWeekLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("supervisorNameLabel")}</th>
                    {CHECKIN_TYPES.map((c) => <th key={c.key} className="bg-card px-3 py-3 text-center text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{c.en}</th>)}
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("currentStatusLabel")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {placements.map((p) => {
                    const checkins = checkinsByPlacement[p.id] || {};
                    return (
                      <tr key={p.id} className="cursor-pointer hover:bg-background" onClick={() => navigate("/placements/" + p.id)}>
                        <td className="px-3 py-3 text-sm font-bold text-card-foreground">{p.participantName}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{p.employerName}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{p.positionTitle}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{fmtDateLong(p.startDate)}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{p.hourlyWage ? "$" + p.hourlyWage + "/hr" : "—"}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{p.hoursPerWeek || "—"}</td>
                        <td className="px-3 py-3 text-sm text-card-foreground">{p.supervisorName || "—"}</td>
                        {CHECKIN_TYPES.map((c) => (
                          <td key={c.key} className="px-3 py-3 text-center"><CheckinDot checkin={checkins[c.key]} label={c.en} /></td>
                        ))}
                        <td className="px-3 py-3"><Badge variant={placementStatusBadgeVariant(p.currentStatus)}>{placementStatusLabel(p.currentStatus)}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="jobdeveloper" message={t("noPlacementsYet")} />
          )}
        </CardContent>
      </Card>

      {adding && (
        <PlacementFormModal
          prefill={location.state && location.state.prefill}
          jobClients={jobClients} employers={employers} jobOpenings={jobOpenings}
          onSave={createFromModal} onCancel={() => setAdding(false)}
        />
      )}
    </>
  );
}
