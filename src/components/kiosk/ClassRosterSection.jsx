// ClassRosterSection.jsx -- one class meeting today on the student kiosk,
// with its roster as a grid of tappable names. Same card shell as the
// visitor form's sections so the two check-in screens read as one design.
import { GraduationCap } from "lucide-react";
import KioskSection from "./KioskSection.jsx";
import StudentNameButton from "./StudentNameButton.jsx";

export default function ClassRosterSection({
  id, sectionRef, classItem, roster, meetsLabel, emptyLabel, submittingId, onSelect
}) {
  return (
    <KioskSection
      id={id}
      sectionRef={sectionRef}
      icon={GraduationCap}
      tone="primary"
      title={classItem.name}
      subtitle={meetsLabel}
    >
      {roster.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {roster.map((s) => (
            <StudentNameButton
              key={s.id}
              student={s}
              busy={submittingId === s.id}
              disabled={!!submittingId}
              onClick={() => onSelect(s)}
            />
          ))}
        </div>
      ) : (
        <p className="m-0 text-[0.98rem] text-muted">{emptyLabel}</p>
      )}
    </KioskSection>
  );
}
