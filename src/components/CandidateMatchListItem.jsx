// CandidateMatchListItem.jsx -- one candidate as a full-width row in the
// Candidate Matching page's list view (the default). Same record, same
// badges and the same two actions as CandidateMatchCard.jsx (whose pieces
// it reuses), laid out wide: avatar and name on the left, match score on
// the right, then the badge strip, and a footer holding the matched skills
// alongside View / Refer.
import { matchedSkills } from "../lib/candidateMatching.js";
import { useT } from "../context/AppContext.jsx";
import { CandidateActions, CandidateBadges, CandidateIdentity, MatchScore, Proximity, SkillBadge } from "./CandidateMatchCard.jsx";
import { Card } from "./ui/card.jsx";

export default function CandidateMatchListItem({ jobClient, jobOpening, employer, score, alreadyReferred, referring, onRefer }) {
  const t = useT();
  const matched = matchedSkills(jobClient, jobOpening);

  return (
    <Card interactive className="p-5">
      <div className="flex items-start justify-between gap-3">
        <CandidateIdentity jobClient={jobClient} large />
        <MatchScore score={score} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CandidateBadges jobClient={jobClient} />
        <Proximity jobClient={jobClient} employer={employer} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {matched.length > 0
            ? matched.map(function (s) { return <SkillBadge key={s}>{s}</SkillBadge>; })
            : <span className="text-meta text-muted">{t("noMatchedSkillsLabel")}</span>}
        </div>
        <CandidateActions jobClient={jobClient} alreadyReferred={alreadyReferred} referring={referring} onRefer={onRefer} />
      </div>
    </Card>
  );
}
