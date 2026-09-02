// Referrals.jsx -- the 8-column Referrals kanban. Native HTML5 drag-and-drop
// copied near-verbatim from Students.jsx's kanban board (see
// src/pages/Students.jsx:404,424-429,456-466) -- no new dependency, same
// dropHover-keyed-by-column-key + onDragOver/onDragLeave/onDrop wiring and
// the same border-primary/ring-2/ring-primary/30 drop-target highlight.
// Unlike every other mutation on this page, handleDrop() awaits its update
// and surfaces a toast on failure -- a dropped card that silently failed to
// save would otherwise look successful (it visually snaps back next
// re-render, but with no explanation) until the user noticed the count was
// wrong.
import { useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { isCandidateEligible } from "../lib/candidateMatching.js";
import { createReferral, deleteReferral, updateReferral } from "../lib/clientsData.js";
import { REFERRAL_STAGES } from "../lib/referrals.js";
import { cn } from "../lib/cn.js";
import ReferralCard from "../components/ReferralCard.jsx";
import ReferralFormModal from "../components/ReferralFormModal.jsx";
import { Button } from "../components/ui/button.jsx";

export default function Referrals() {
  const { data, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [dropHover, setDropHover] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const referrals = data.referrals || [];
  const eligibleJobClients = (data.jobClients || []).filter(isCandidateEligible);
  const openJobOpenings = (data.jobOpenings || []).filter((o) => o.status !== "archived");
  const jobDevelopers = activeJobDevelopers(data.profiles);

  async function handleDrop(e, stageKey) {
    e.preventDefault();
    setDropHover(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    try {
      await updateReferral(id, { status: stageKey });
    } catch (err) {
      console.warn("updateReferral failed", err);
      showToast(t("userActionError"));
    }
  }

  async function createFromModal(fields) {
    await createReferral(fields);
    setAdding(false);
    showToast(t("referralAdded"));
  }
  async function updateFromModal(fields) {
    await updateReferral(editing.id, fields);
    setEditing(null);
    showToast(t("referralUpdated"));
  }
  async function removeReferral() {
    const ok = await requestConfirm(t("removeReferralConfirm"), { danger: true });
    if (!ok) return;
    await deleteReferral(editing.id);
    setEditing(null);
  }
  function handOffToPlacement() {
    const r = editing;
    setEditing(null);
    navigate("/placements", {
      state: { prefill: { jobClientId: r.jobClientId, employerId: r.employerId, jobOpeningId: r.jobOpeningId, referralId: r.id, positionTitle: r.positionTitle } }
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("referralsTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("referralsDesc")}</p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {t("addReferralBtn")}
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {REFERRAL_STAGES.map((stage) => {
          const stageReferrals = referrals.filter((r) => r.status === stage.key);
          return (
            <div
              key={stage.key}
              className={cn(
                "flex w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow",
                dropHover === stage.key ? "border-primary ring-2 ring-primary/30" : "border-border"
              )}
              onDragOver={(e) => { e.preventDefault(); setDropHover(stage.key); }}
              onDragLeave={() => setDropHover((cur) => (cur === stage.key ? null : cur))}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              <div className="flex items-center justify-between border-b border-border bg-background px-3 py-2.5">
                <span className="text-sm font-bold text-card-foreground">{stage.en}</span>
                <span className="rounded-full bg-tint-neutral px-2 py-0.5 text-xs font-semibold text-muted">{stageReferrals.length}</span>
              </div>
              <div className="min-h-[120px] space-y-2 p-2.5">
                {stageReferrals.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted">{t("noReferralsYetLabel")}</p>
                ) : (
                  stageReferrals.map((r) => <ReferralCard key={r.id} referral={r} onClick={() => setEditing(r)} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <ReferralFormModal
          jobClients={eligibleJobClients} jobOpenings={openJobOpenings} jobDevelopers={jobDevelopers}
          onSave={createFromModal} onCancel={() => setAdding(false)}
        />
      )}
      {editing && (
        <ReferralFormModal
          referral={editing} jobClients={eligibleJobClients} jobOpenings={openJobOpenings} jobDevelopers={jobDevelopers}
          placements={data.placements || []} onCreatePlacement={handOffToPlacement}
          onSave={updateFromModal} onCancel={() => setEditing(null)} onDelete={removeReferral}
        />
      )}
    </>
  );
}
