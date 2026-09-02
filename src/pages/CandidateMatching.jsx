// CandidateMatching.jsx -- split layout: pick a job opening on the left,
// see ranked matching candidates on the right. Reachable directly from the
// nav, or via JobOpenings.jsx's "Refer Candidate" row action, which passes
// the opening id through router state so it's pre-selected on arrival.
//
// `alreadyReferred` below is a client-side check against in-memory
// data.referrals -- fast, but racy (two staff, or two tabs, could both pass
// it before either referral lands). The real backstop is the DB's
// referrals_job_client_opening_unique index on (job_client_id,
// job_opening_id); a second createReferral() for the same pair fails there
// with a 23505 (unique_violation), which refer()'s catch below turns into
// the same "already referred" toast instead of an unhandled error.
// `referringId` covers the same-tab double-click case even faster.
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { computeMatchScore, isCandidateEligible } from "../lib/candidateMatching.js";
import { createReferral } from "../lib/clientsData.js";
import { statusBadgeVariant, statusLabel } from "../lib/jobOpenings.js";
import { todayStr } from "../lib/utils.js";
import CandidateMatchCard from "../components/CandidateMatchCard.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

export default function CandidateMatching() {
  const { data, session, showToast } = useApp();
  const t = useT();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedId, setSelectedId] = useState(location.state && location.state.openingId ? location.state.openingId : null);
  const [referringId, setReferringId] = useState(null);

  const employers = data.employers || [];
  const employerById = {};
  employers.forEach((e) => { employerById[e.id] = e; });

  const term = search.trim().toLowerCase();
  const openings = (data.jobOpenings || []).filter((o) => {
    if (activeOnly && o.status !== "active") return false;
    if (!term) return true;
    return ((o.title || "") + " " + (o.employerName || "")).toLowerCase().indexOf(term) !== -1;
  });

  const selectedOpening = openings.find((o) => o.id === selectedId) || (data.jobOpenings || []).find((o) => o.id === selectedId);
  const employer = selectedOpening ? employerById[selectedOpening.employerId] : null;

  const ranked = selectedOpening
    ? (data.jobClients || [])
        .filter(isCandidateEligible)
        .map((c) => ({ jobClient: c, score: computeMatchScore(c, selectedOpening) }))
        .sort((a, b) => b.score - a.score)
    : [];

  async function refer(jobClientId) {
    if (referringId) return;
    setReferringId(jobClientId);
    try {
      await createReferral({
        jobClientId, jobOpeningId: selectedOpening.id, employerId: selectedOpening.employerId,
        status: "referred", referralDate: todayStr(), assignedJobDeveloperEmail: session ? session.currentUserEmail : ""
      });
      showToast(t("candidateReferred"));
    } catch (err) {
      if (err && err.code === "23505") {
        showToast(t("alreadyReferredLabel"));
      } else {
        throw err;
      }
    } finally {
      setReferringId(null);
    }
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="mb-1">{t("candidateMatchingTitle")}</h1>
        <p className="m-0 text-sm text-muted">{t("candidateMatchingDesc")}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t("jobOpeningSearchPlaceholder")} aria-label={t("jobOpeningSearchPlaceholder")}
              className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <label className="flex items-center gap-2 text-sm text-card-foreground">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              {t("activeOnlyLabel")}
            </label>
            {openings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t("noActiveJobOpeningsMessage")}</p>
            ) : (
              <div className="max-h-[70vh] space-y-1.5 overflow-y-auto">
                {openings.map((o) => (
                  <button
                    key={o.id} type="button" onClick={() => setSelectedId(o.id)}
                    className={
                      "block w-full min-h-0 rounded-lg border p-2.5 text-left " +
                      (o.id === selectedId ? "border-primary bg-primary-tint" : "border-border bg-background hover:border-[#b7c0d1]")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-card-foreground">{o.title}</span>
                      <Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">{o.employerName}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          {!selectedOpening ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted">{t("selectJobOpeningLabel")}</CardContent></Card>
          ) : ranked.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted">{t("noCandidatesMatchMessage")}</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ranked.map(({ jobClient, score }) => {
                const alreadyReferred = (data.referrals || []).some((r) => r.jobClientId === jobClient.id && r.jobOpeningId === selectedOpening.id);
                return (
                  <CandidateMatchCard
                    key={jobClient.id} jobClient={jobClient} jobOpening={selectedOpening} employer={employer}
                    score={score} alreadyReferred={alreadyReferred} referring={!!referringId} onRefer={() => refer(jobClient.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
