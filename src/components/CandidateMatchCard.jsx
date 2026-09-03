// CandidateMatchCard.jsx -- one candidate as a card in the Candidate
// Matching page's grid view. Only shows fields job_clients actually has
// (see the Phase 3 plan's scope note) -- no fabricated Program/Availability/
// Certifications/real-distance data, and no Message button (no messaging
// system exists in this app). CandidateMatchListItem.jsx is the same record
// laid out as a full-width row; the two share this component's vocabulary of
// badges so a candidate reads the same in either view.
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { matchBucket, matchedSkills, proximityLabel } from "../lib/candidateMatching.js";
import { employmentStatusLabel, workAuthLabel } from "../lib/jobProfile.js";
import { initialsOf } from "../lib/utils.js";
import { avatarColorFor } from "./StudentCard.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export default function CandidateMatchCard({ jobClient, jobOpening, employer, score, alreadyReferred, referring, onRefer }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(jobClient);
  const bucket = matchBucket(score);
  const matched = matchedSkills(jobClient, jobOpening);
  const barriers = jobClient.barriers || [];
  const proximity = proximityLabel(jobClient, employer);

  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(jobClient)}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-card-foreground">{name}</div>
            <div className="text-xs text-muted">{employmentStatusLabel(jobClient.employmentStatus)}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Badge variant={bucket.tone}>{t(bucket.labelKey)}</Badge>
          <div className="mt-1 text-xs text-muted">{t("matchScoreLabel").replace("{score}", String(score))}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant={jobClient.hasResume ? "success" : "neutral"}>
          {jobClient.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}
        </Badge>
        {jobClient.workAuthorization && <Badge variant="neutral">{workAuthLabel(jobClient.workAuthorization)}</Badge>}
        {barriers.indexOf("transportation") !== -1 && <Badge variant="warn">{t("transportationBarrierLabel")}</Badge>}
        {barriers.indexOf("english") !== -1 && <Badge variant="warn">{t("englishBarrierLabel")}</Badge>}
      </div>

      {proximity && (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {proximity === "sameCity" ? t("sameCityLabel") : t("differentCityLabel") + " (" + jobClient.city + ")"}
        </div>
      )}

      {matched.length > 0 && (
        <div className="mb-4 mt-3">
          <p className="m-0 mb-1.5 text-xs font-semibold text-muted">{t("matchedSkillsLabel")}</p>
          <div className="flex flex-wrap gap-1.5">
            {matched.map(function (s) {
              return (
                <span key={s} className="flex items-center gap-1 rounded-full bg-tint-success px-2.5 py-0.5 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {s}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          onClick={function () { navigate("/jobdeveloper/" + jobClient.id); }}
          className="h-9 gap-1.5 px-2 text-sm font-semibold text-primary hover:bg-primary-tint"
        >
          {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        {alreadyReferred ? (
          // Not a disabled primary button: a referral that already exists is a
          // settled fact, not a greyed-out call to action.
          <span className="flex items-center gap-1.5 rounded-[10px] bg-tint-success px-3 py-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("alreadyReferredLabel")}
          </span>
        ) : (
          <Button disabled={referring} onClick={onRefer} className="h-9 gap-1.5 rounded-[10px] px-4 text-sm">
            {t("referBtn")}
          </Button>
        )}
      </div>
    </Card>
  );
}
