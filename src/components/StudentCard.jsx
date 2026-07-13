// StudentCard.jsx -- one drag-and-drop-able roster row on the Students
// Kanban board, in either view mode (a compact clickable-name row + a
// "move to..." select) or edit mode (inline edit form). The name is a
// button -- clicking it fires onViewDetails so Students.jsx can pop the
// full detail (ID, contact info, assessment, outcome) in a modal instead of
// cluttering every card; underlying drag/edit/move/dropout logic is
// otherwise untouched, still native HTML5 drag-and-drop wired through the
// same onMove/onSave/onRemove/onDropout props Students.jsx passes in.
import { useState } from "react";
import { LogOut, Pencil, X } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { initialsOf } from "../lib/utils.js";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

// main.css's global `input, select, textarea{ min-height:52px; ... }` rule
// (element selector) would otherwise floor every field on this compact card
// at 52px tall -- `min-h-0` (a class selector, higher specificity) cancels
// it, same fix Search.jsx's redesigned fields already use.

// Same small pastel-hash approach Search.jsx uses for visitor avatars, so
// student initials on this board read the same way.
const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700"
];
export function avatarColorFor(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const editInputClass = "h-9 min-h-0 w-full rounded-lg border border-border bg-background px-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

export default function StudentCard({ student, classes, editing, onMove, onEditStart, onEditCancel, onSave, onRemove, onDropout, onViewDetails }) {
  const t = useT();
  const [fields, setFields] = useState(() => ({
    firstName: student.firstName || "", lastName: student.lastName || "", phone: student.phone || "",
    email: student.email || "", street: student.street || "", city: student.city || "", zip: student.zip || "",
    pretestReading: student.pretestReading || "", posttestReading: student.posttestReading || ""
  }));

  function setField(name, value) {
    setFields((prev) => Object.assign({}, prev, { [name]: value }));
  }
  function save() {
    onSave(fields);
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-card p-3.5 shadow-card">
        <div className="text-sm font-bold text-card-foreground">{t("editStudentTitle")}</div>
        <input type="text" placeholder={t("firstName")} aria-label={t("firstName")} className={editInputClass} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
        <input type="text" placeholder={t("lastName")} aria-label={t("lastName")} className={editInputClass} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
        <input type="text" placeholder={t("phone")} aria-label={t("phone")} className={editInputClass} value={fields.phone} onChange={(e) => setField("phone", e.target.value)} />
        <input type="text" placeholder={t("email")} aria-label={t("email")} className={editInputClass} value={fields.email} onChange={(e) => setField("email", e.target.value)} />
        <input type="text" placeholder={t("address")} aria-label={t("address")} className={editInputClass} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
        <input type="text" placeholder={t("city")} aria-label={t("city")} className={editInputClass} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
        <input type="text" placeholder={t("zip")} aria-label={t("zip")} className={editInputClass} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder={t("pretestReadingLabel")} aria-label={t("pretestReadingLabel")} className={editInputClass} value={fields.pretestReading} onChange={(e) => setField("pretestReading", e.target.value)} />
          <input type="number" placeholder={t("posttestReadingLabel")} aria-label={t("posttestReadingLabel")} className={editInputClass} value={fields.posttestReading} onChange={(e) => setField("posttestReading", e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={save}>{t("saveLabel")}</Button>
          <Button size="sm" variant="secondary" className="flex-1" onClick={onEditCancel}>{t("cancelLabel")}</Button>
        </div>
      </div>
    );
  }

  const name = student.firstName + " " + student.lastName;

  return (
    <div
      className="cursor-grab rounded-lg border border-border bg-card p-2.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:cursor-grabbing"
      draggable="true"
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", student.id); e.dataTransfer.effectAllowed = "move"; }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onViewDetails}
          className="flex min-h-0 min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left"
        >
          <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
          <span className="truncate text-sm font-bold text-card-foreground hover:text-primary hover:underline">{name}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {student.classKey && (
            <Button variant="ghost" size="icon" title={t("dropoutBtn")} aria-label={t("dropoutBtn")} onClick={onDropout} className="h-7 w-7 text-muted hover:bg-background hover:text-card-foreground">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" title={t("editStudentTitle")} aria-label={t("editStudentTitle")} onClick={onEditStart} className="h-7 w-7 text-muted hover:bg-background hover:text-card-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove} className="h-7 w-7 text-muted hover:bg-tint-danger hover:text-accent">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {student.droppedOut && <div className="ml-10 mt-1"><Badge variant="warn">{t("droppedOutBadge")}</Badge></div>}

      <select
        value={student.classKey || "waiting"}
        onChange={(e) => onMove(e.target.value === "waiting" ? null : e.target.value)}
        className="mt-2.5 h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      >
        <option value="waiting">{t("waitingList")}</option>
        {classes.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select>
    </div>
  );
}
