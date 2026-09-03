// JobOpeningActionsMenu.jsx -- the per-opening "..." menu shared by the Job
// Openings list rows and grid cards. Exactly the same set of actions the
// page's table used to expose (View / Edit / Refer a candidate / Archive /
// Delete), lifted into one component so the two result layouts can't drift.
import { MoreHorizontal } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { Button } from "./ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";

export default function JobOpeningActionsMenu({ opening, onView, onEdit, onRefer, onArchive, onDelete }) {
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted" aria-label={t("actionsLabel")}>
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={function () { onView(opening); }}>{t("viewLabel")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={function () { onEdit(opening); }}>{t("editLabel")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={function () { onRefer(opening); }}>{t("referCandidateActionLabel")}</DropdownMenuItem>
        {opening.status !== "archived" && (
          <DropdownMenuItem onSelect={function () { onArchive(opening); }}>{t("archiveLabel")}</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={function () { onDelete(opening); }} className="text-accent focus:bg-tint-danger">
          {t("deleteLabel")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
