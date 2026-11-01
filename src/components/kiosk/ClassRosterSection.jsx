// ClassRosterSection.jsx -- one class meeting today on the student kiosk,
// with its roster as a grid of tappable names. Same card shell as the
// visitor form's sections so the two check-in screens read as one design.
import { GraduationCap } from "lucide-react";
import KioskSection from "./KioskSection.jsx";
import StudentNameButton from "./StudentNameButton.jsx";

export default function ClassRosterSection({
  id, sectionRef, classItem, roster, meetsLabel, emptyLabel, submittingId, onSelect, index = 0
}) {
  // Classes rise in order, then each roster's names follow, capped so a long
  // class doesn't keep the last names waiting.
  const enterAt = 0.2 + Math.min(index, 3) * 0.08;
  return (
    <KioskSection
      id={id}
      sectionRef={sectionRef}
      icon={GraduationCap}
      tone="primary"
      title={classItem.name}
      subtitle={meetsLabel}
      enterAt={enterAt}
    >
      {roster.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {roster.map((s, i) => (
            <StudentNameButton
              key={s.id}
              enterAt={enterAt + 0.1 + Math.min(i, 12) * 0.025}
              student={s}
              busy={submittingId === s.id}
              disabled={!!submittingId}
              onClick={() => onSelect(s)}
            />
          ))}
        </div>
      ) : (
        <p className="m-0 text-touch-body text-muted">{emptyLabel}</p>
      )}
    </KioskSection>
  );
}
