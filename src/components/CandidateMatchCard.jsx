// CandidateMatchCard.jsx -- one candidate card on the Candidate Matching
// page's right-hand ranked list. Only shows fields job_clients actually has
// (see the Phase 3 plan's scope note) -- no fabricated Program/Availability/
// Certifications/real-distance data, and no Message button (no messaging
// system exists in this app).
import { CheckCircle2, MapPin, XCircle } from "lucide-react";
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
import { Card, CardContent } from "./ui/card.jsx";

export default function CandidateMatchCard({ jobClient, jobOpening, employer, score, alreadyReferred, referring, onRefer }) {
  const t = useT();
  const navigate = useNavigate();
  const name = clientDisplayName(jobClient);
  const bucket = matchBucket(score);
  const matched = matchedSkills(jobClient, jobOpening);
  const barriers = jobClient.barriers || [];
  const proximity = proximityLabel(jobClient, employer);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(jobClient)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-card-foreground">{name}</div>
              <div className="text-xs text-muted">{employmentStatusLabel(jobClient.employmentStatus)}</div>
            </div>
          </div>
          <Badge variant={bucket.tone}>{t(bucket.labelKey)}</Badge>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant={jobClient.hasResume ? "success" : "neutral"}>
            {jobClient.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}
          </Badge>
          {jobClient.workAuthorization && <Badge variant="neutral">{workAuthLabel(jobClient.workAuthorization)}</Badge>}
          {barriers.indexOf("transportation") !== -1 && <Badge variant="warn">{t("transportationBarrierLabel")}</Badge>}
          {barriers.indexOf("english") !== -1 && <Badge variant="warn">{t("englishBarrierLabel")}</Badge>}
        </div>

        {proximity && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {proximity === "sameCity" ? t("sameCityLabel") : t("differentCityLabel") + " (" + jobClient.city + ")"}
          </div>
        )}

        {matched.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">{t("matchedSkillsLabel")}</p>
            <div className="flex flex-wrap gap-1.5">
              {matched.map((s) => (
                <span key={s} className="flex items-center gap-1 rounded-full bg-tint-success px-2.5 py-0.5 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-3 w-3" /> {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button size="sm" variant="secondary" onClick={() => navigate("/jobdeveloper/" + jobClient.id)}>{t("viewLabel")}</Button>
          <Button size="sm" disabled={alreadyReferred || referring} onClick={onRefer} className="gap-1.5">
            {alreadyReferred ? <><XCircle className="h-3.5 w-3.5" /> {t("alreadyReferredLabel")}</> : t("referBtn")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
