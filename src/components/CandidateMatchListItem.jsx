// CandidateMatchListItem.jsx -- one candidate as a full-width row in the
// Candidate Matching page's list view (the default). Same record, same
// badges and the same two actions as CandidateMatchCard.jsx, laid out wide:
// avatar and name on the left, match verdict on the right, then the badge
// strip, and a footer holding the matched skills alongside View / Refer.
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

export default function CandidateMatchListItem({ jobClient, jobOpening, employer, score, alreadyReferred, referring, onRefer }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(jobClient);
  const bucket = matchBucket(score);
  const matched = matchedSkills(jobClient, jobOpening);
  const barriers = jobClient.barriers || [];
  const proximity = proximityLabel(jobClient, employer);

  return (
    <Card className="p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(jobClient)}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-base font-bold leading-tight text-card-foreground">{name}</h3>
            <p className="m-0 mt-1 truncate text-sm text-muted">{employmentStatusLabel(jobClient.employmentStatus)}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Badge variant={bucket.tone}>{t(bucket.labelKey)}</Badge>
          <div className="mt-1 text-xs text-muted">{t("matchScoreLabel").replace("{score}", String(score))}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={jobClient.hasResume ? "success" : "neutral"}>
          {jobClient.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}
        </Badge>
        {jobClient.workAuthorization && <Badge variant="neutral">{workAuthLabel(jobClient.workAuthorization)}</Badge>}
        {barriers.indexOf("transportation") !== -1 && <Badge variant="warn">{t("transportationBarrierLabel")}</Badge>}
        {barriers.indexOf("english") !== -1 && <Badge variant="warn">{t("englishBarrierLabel")}</Badge>}
        {proximity && (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            {proximity === "sameCity" ? t("sameCityLabel") : t("differentCityLabel") + " (" + jobClient.city + ")"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {matched.length > 0
            ? matched.map(function (s) {
                return (
                  <span key={s} className="flex items-center gap-1 rounded-full bg-tint-success px-2.5 py-0.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {s}
                  </span>
                );
              })
            : <span className="text-sm text-muted">{t("noMatchedSkillsLabel")}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            onClick={function () { navigate("/jobdeveloper/" + jobClient.id); }}
            className="h-9 gap-1.5 px-2 text-sm font-semibold text-primary hover:bg-primary-tint"
          >
            {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          {alreadyReferred ? (
            // Not a disabled primary button: a referral that already exists is
            // a settled fact, not a greyed-out call to action.
            <span className="flex items-center gap-1.5 rounded-[10px] bg-tint-success px-3 py-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("alreadyReferredLabel")}
            </span>
          ) : (
            <Button disabled={referring} onClick={onRefer} className="h-9 gap-1.5 rounded-[10px] px-4 text-sm">
              {t("referBtn")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
