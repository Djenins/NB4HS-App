// CandidateMatchCard.jsx -- one candidate as a card in the Candidate
// Matching page's grid view. Only shows fields job_clients actually has
// (see the Phase 3 plan's scope note) -- no fabricated Program/Availability/
// Certifications/real-distance data, and no Message button (no messaging
// system exists in this app). CandidateMatchListItem.jsx is the same record
// laid out as a full-width row; it imports the pieces exported here so a
// candidate reads the same in either view.
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
import { StatusBadge } from "./ui/status-badge.jsx";

// The score sits inside the tone badge (tabular figures), and the bucket's
// words sit right under it -- the colour always travels with the number and
// a label, never on its own.
export function MatchScore({ score }) {
  const t = useT();
  const bucket = matchBucket(score);
  return (
    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
      <StatusBadge domain="match" status={bucket.key}>
        <span className="tabular-nums">{t("matchScoreLabel").replace("{score}", String(score))}</span>
      </StatusBadge>
      <span className="text-meta font-medium text-muted">{t(bucket.labelKey)}</span>
    </div>
  );
}

export function CandidateIdentity({ jobClient, large }) {
  const name = clientDisplayName(jobClient);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className={large ? "h-11 w-11" : "h-10 w-10"}>
        <AvatarFallback className={avatarColorFor(name)}>{initialsOf(jobClient)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h3 className="m-0 truncate text-section font-semibold text-card-foreground">{name}</h3>
        <p className="m-0 truncate text-meta text-muted">{employmentStatusLabel(jobClient.employmentStatus)}</p>
      </div>
    </div>
  );
}

export function CandidateBadges({ jobClient }) {
  const t = useT();
  const barriers = jobClient.barriers || [];
  return (
    <>
      <StatusBadge domain="candidate" status={jobClient.hasResume ? "resume" : "noResume"}>
        {jobClient.hasResume ? t("resumeOnFileLabel") : t("noResumeOnFileLabel")}
      </StatusBadge>
      {jobClient.workAuthorization && <StatusBadge domain="candidate" status="workAuth">{workAuthLabel(jobClient.workAuthorization)}</StatusBadge>}
      {barriers.indexOf("transportation") !== -1 && <StatusBadge domain="candidate" status="barrier">{t("transportationBarrierLabel")}</StatusBadge>}
      {barriers.indexOf("english") !== -1 && <StatusBadge domain="candidate" status="barrier">{t("englishBarrierLabel")}</StatusBadge>}
    </>
  );
}

export function Proximity({ jobClient, employer, className }) {
  const t = useT();
  const proximity = proximityLabel(jobClient, employer);
  if (!proximity) return null;
  return (
    <span className={"flex items-center gap-1.5 text-meta text-muted" + (className ? " " + className : "")}>
      <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
      {proximity === "sameCity" ? t("sameCityLabel") : t("differentCityLabel") + " (" + jobClient.city + ")"}
    </span>
  );
}

export function SkillBadge({ children }) {
  return (
    <Badge variant="success">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {children}
    </Badge>
  );
}

export function CandidateActions({ jobClient, alreadyReferred, referring, onRefer }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="ghost" className="text-primary hover:bg-primary-tint" onClick={function () { navigate("/jobdeveloper/" + jobClient.id); }}>
        {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      {alreadyReferred ? (
        // Not a disabled primary button: a referral that already exists is a
        // settled fact, not a greyed-out call to action.
        <span className="inline-flex items-center gap-1.5 px-1 text-ui font-semibold text-tone-success-ink">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("alreadyReferredLabel")}
        </span>
      ) : (
        <Button disabled={referring} onClick={onRefer}>{t("referBtn")}</Button>
      )}
    </div>
  );
}

export default function CandidateMatchCard({ jobClient, jobOpening, employer, score, alreadyReferred, referring, onRefer }) {
  const t = useT();
  const matched = matchedSkills(jobClient, jobOpening);

  return (
    <Card interactive className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <CandidateIdentity jobClient={jobClient} />
        <MatchScore score={score} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <CandidateBadges jobClient={jobClient} />
      </div>

      <Proximity jobClient={jobClient} employer={employer} className="mt-3" />

      {matched.length > 0 && (
        <div className="mb-4 mt-3">
          <p className="m-0 mb-1.5 text-meta font-semibold text-muted">{t("matchedSkillsLabel")}</p>
          <div className="flex flex-wrap gap-1.5">
            {matched.map(function (s) { return <SkillBadge key={s}>{s}</SkillBadge>; })}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3">
        <CandidateActions jobClient={jobClient} alreadyReferred={alreadyReferred} referring={referring} onRefer={onRefer} />
      </div>
    </Card>
  );
}
