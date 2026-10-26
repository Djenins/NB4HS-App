// StudentCard.jsx -- one drag-and-drop-able roster card on the Students
// Kanban board, in either view mode (a clickable name, row actions and a
// "Classroom" select to move the student) or edit mode (inline edit form).
// The name is a button -- clicking it fires onViewDetails so Students.jsx can
// open the full detail (ID, contact info, assessment, outcome) in a drawer
// instead of cluttering every card. Native HTML5 drag-and-drop, wired through
// the same onMove/onSave/onRemove/onDropout props Students.jsx passes in.
//
// Design-system pass: a Card on the shared tokens, IconButton row actions,
// labelled Field/Input/Select controls and a StatusBadge for "dropped out".
// Props and exports are unchanged.
import { useId, useState } from "react";
import { LogOut, Pencil, X } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { formatPhone, initialsOf } from "../lib/utils.js";
import NbIdBadge from "./NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { BUTTON_RESET, Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { Field, Input, Select } from "./ui/field.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";
import { cn } from "../lib/cn.js";
import { avatarColorFor } from "../lib/avatarTone.js";

// Re-exported for the cards that already import it from here.
export { avatarColorFor };

export default function StudentCard({ student, classes, editing, onMove, onEditStart, onEditCancel, onSave, onRemove, onDropout, onViewDetails }) {
  const t = useT();
  const uid = useId();
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
    const fid = (k) => uid + "-" + k;
    return (
      <Card className="space-y-3 p-3.5">
        <div className="text-ui font-semibold text-card-foreground">{t("editStudentTitle")}</div>
        <Field label={t("firstName")} htmlFor={fid("firstName")}>
          <Input id={fid("firstName")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
        </Field>
        <Field label={t("lastName")} htmlFor={fid("lastName")}>
          <Input id={fid("lastName")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
        </Field>
        <Field label={t("phone")} htmlFor={fid("phone")}>
          <Input id={fid("phone")} type="tel" value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} />
        </Field>
        <Field label={t("email")} htmlFor={fid("email")}>
          <Input id={fid("email")} type="email" value={fields.email} onChange={(e) => setField("email", e.target.value)} />
        </Field>
        <Field label={t("address")} htmlFor={fid("street")}>
          <Input id={fid("street")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
        </Field>
        <Field label={t("city")} htmlFor={fid("city")}>
          <Input id={fid("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
        </Field>
        <Field label={t("zip")} htmlFor={fid("zip")}>
          <Input id={fid("zip")} inputMode="numeric" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("pretestReadingLabel")} htmlFor={fid("pre")}>
            <Input id={fid("pre")} type="number" className="tabular-nums" value={fields.pretestReading} onChange={(e) => setField("pretestReading", e.target.value)} />
          </Field>
          <Field label={t("posttestReadingLabel")} htmlFor={fid("post")}>
            <Input id={fid("post")} type="number" className="tabular-nums" value={fields.posttestReading} onChange={(e) => setField("posttestReading", e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={save}>{t("saveLabel")}</Button>
          <Button size="sm" variant="secondary" className="flex-1" onClick={onEditCancel}>{t("cancelLabel")}</Button>
        </div>
      </Card>
    );
  }

  const name = student.firstName + " " + student.lastName;
  const moveId = uid + "-move";

  return (
    <Card
      interactive
      className="cursor-grab p-3 active:cursor-grabbing"
      draggable="true"
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", student.id); e.dataTransfer.effectAllowed = "move"; }}
    >
      <button
        type="button"
        onClick={onViewDetails}
        className={cn(BUTTON_RESET, "group flex w-full items-center gap-2.5 rounded-control text-left focus-visible:outline-none focus-visible:ring-2")}
      >
        <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1 truncate text-ui font-semibold text-card-foreground group-hover:text-primary group-hover:underline">{name}</span>
      </button>

      {student.nbId || student.droppedOut ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {student.nbId ? <NbIdBadge nbId={student.nbId} /> : null}
          {student.droppedOut ? <StatusBadge domain="enrollment" status="droppedOut">{t("droppedOutBadge")}</StatusBadge> : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-0.5">
        {student.classKey ? (
          <IconButton size="sm" label={t("dropoutBtn")} onClick={onDropout}><LogOut aria-hidden="true" /></IconButton>
        ) : null}
        <IconButton size="sm" label={t("editStudentTitle")} onClick={onEditStart}><Pencil aria-hidden="true" /></IconButton>
        <IconButton size="sm" variant="danger" label={t("deleteLabel")} onClick={onRemove}><X aria-hidden="true" /></IconButton>
      </div>

      <Field label={t("classroomColumn")} htmlFor={moveId} className="mt-2">
        <Select
          id={moveId}
          value={student.classKey || "waiting"}
          onChange={(e) => onMove(e.target.value === "waiting" ? null : e.target.value)}
        >
          <option value="waiting">{t("waitingList")}</option>
          {classes.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </Select>
      </Field>
    </Card>
  );
}
