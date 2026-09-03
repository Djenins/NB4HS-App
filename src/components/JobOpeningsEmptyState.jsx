// JobOpeningsEmptyState.jsx -- the Job Openings results panel when nothing
// is listed. Two shapes, same card: the true "nothing posted yet" state
// (with the Add Job call to action, wired to the very same wizard the page
// header's button opens) and the "nothing matches your filters" state,
// which offers Clear all instead.
import { Briefcase, Plus, RotateCcw } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export default function JobOpeningsEmptyState({ filtered, onAdd, onClearAll }) {
  const t = useT();

  return (
    <Card className="flex min-h-[300px] flex-col items-center justify-center px-6 py-14 text-center shadow-card hover:shadow-card">
      <span className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-primary-tint text-primary">
        <Briefcase className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="m-0 text-xl font-extrabold tracking-tight text-card-foreground">
        {filtered ? t("noMatchingJobOpeningsTitle") : t("noJobOpeningsTitle")}
      </h2>
      <p className="m-0 mt-2 max-w-[380px] text-[15px] leading-relaxed text-muted">
        {filtered ? t("noMatchingJobOpeningsDesc") : t("noJobOpeningsDesc")}
      </p>
      {filtered ? (
        <Button variant="secondary" onClick={onClearAll} className="mt-6 h-11 gap-2 rounded-[12px] px-5">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("clearAllLabel")}
        </Button>
      ) : (
        <Button onClick={onAdd} className="mt-6 h-11 gap-2 rounded-[12px] px-6 text-[15px]">
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> {t("addJobBtn")}
        </Button>
      )}
    </Card>
  );
}
