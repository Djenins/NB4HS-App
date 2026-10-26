// JobOpeningActionsMenu.jsx -- the per-opening "..." menu shared by the Job
// Openings list rows and grid cards. Exactly the same set of actions the
// page's table used to expose (View / Edit / Refer a candidate / Archive /
// Delete), lifted into one component so the two result layouts can't drift.
// Archive and Delete still confirm through the page's requestConfirm().
import { Archive, Eye, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";

export default function JobOpeningActionsMenu({ opening, onView, onEdit, onRefer, onArchive, onDelete }) {
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t("actionsLabel")} size="sm">
          <MoreHorizontal aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={function () { onView(opening); }}>
          <Eye className="h-4 w-4 text-muted" aria-hidden="true" />{t("viewLabel")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={function () { onEdit(opening); }}>
          <Pencil className="h-4 w-4 text-muted" aria-hidden="true" />{t("editLabel")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={function () { onRefer(opening); }}>
          <Send className="h-4 w-4 text-muted" aria-hidden="true" />{t("referCandidateActionLabel")}
        </DropdownMenuItem>
        {opening.status !== "archived" && (
          <DropdownMenuItem onSelect={function () { onArchive(opening); }}>
            <Archive className="h-4 w-4 text-muted" aria-hidden="true" />{t("archiveLabel")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={function () { onDelete(opening); }} className="text-tone-danger-ink focus:bg-tone-danger-bg data-[highlighted]:bg-tone-danger-bg">
          <Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteLabel")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
