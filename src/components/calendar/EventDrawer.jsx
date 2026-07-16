// EventDrawer.jsx -- slide-out panel (not a modal) shown when an event is
// clicked. View mode shows every field from the design brief; fields with
// no real backing data (Related Case, Documents) are shown as honest empty
// states rather than fabricated content. Edit mode reuses the same fields
// calendar_events actually stores.
import { AnimatePresence, motion } from "framer-motion";
import { Copy, FileText, Link2, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { KIND_STYLE } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { Button } from "../ui/button.jsx";
import { cn } from "../../lib/cn.js";

const inputClass = "h-10 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-card-foreground">{value || "—"}</p>
    </div>
  );
}

export default function EventDrawer({ block, t, onClose, onSave, onDelete, onDuplicate }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(null);

  const open = !!block;
  const style = open ? KIND_STYLE[block.kind] : null;
  const Icon = style?.icon;
  const editable = !!block?.event;

  function startEdit() {
    setFields({
      title: block.title,
      personName: block.event?.personName || "",
      notes: block.event?.notes || "",
      date: block.event?.date || "",
      startTime: block.startTime,
      endTime: block.endTime || "",
      availability: block.event?.availability || "busy"
    });
    setEditing(true);
  }
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <AnimatePresence onExitComplete={() => setEditing(false)}>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-lg"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.2 }}
            role="dialog" aria-modal="true" aria-label={t("calendarEventDetails")}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                {Icon && <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", style.chipBg, style.chipFg)}><Icon className="h-4 w-4" /></span>}
                <p className="text-sm font-bold text-card-foreground">{t("calendarEventDetails")}</p>
              </div>
              <button type="button" onClick={onClose} className={cn(BTN_RESET, "rounded-lg p-1.5 text-muted hover:bg-background hover:text-card-foreground")} aria-label={t("calendarCancel")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {block && !editing && (
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
                <div>
                  <p className={cn("text-xs font-bold uppercase tracking-wide", style.chipFg)}>{t(style.label)}</p>
                  <p className="mt-0.5 text-lg font-bold text-card-foreground">{block.title}</p>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("calendarPersonName")} value={block.event?.personName} />
                    <Field label={t("calendarStaffMember")} value={block.event?.createdByName} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <Field label={t("calendarCategory")} value={t(style.label)} />
                    <Field label={t("calendarStatus")} value={t("calendarConfirmed")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <Field label={t("calendarDate")} value={block.event?.date} />
                    <Field label={t("calendarStartTime")} value={block.startTime + (block.endTime ? " – " + block.endTime : "")} />
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("calendarNotes")}</p>
                  <p className="mt-0.5 text-sm text-card-foreground">{block.event?.notes || t("calendarNoNotes")}</p>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted">
                    <Link2 className="h-3.5 w-3.5 shrink-0" /> No related case linked
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted">
                    <FileText className="h-3.5 w-3.5 shrink-0" /> No documents attached
                  </div>
                </div>
              </div>
            )}

            {block && editing && (
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarEventTitle")}</label><input className={inputClass} value={fields.title} onChange={(e) => setField("title", e.target.value)} /></div>
                <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarPersonName")}</label><input className={inputClass} value={fields.personName} onChange={(e) => setField("personName", e.target.value)} /></div>
                <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarDate")}</label><input type="date" className={inputClass} value={fields.date} onChange={(e) => setField("date", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarStartTime")}</label><input type="time" className={inputClass} value={fields.startTime} onChange={(e) => setField("startTime", e.target.value)} /></div>
                  <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarEndTime")}</label><input type="time" className={inputClass} value={fields.endTime} onChange={(e) => setField("endTime", e.target.value)} /></div>
                </div>
                <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("calendarNotes")}</label><input className={inputClass} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} /></div>
              </div>
            )}

            {block && (
              <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                {editing ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>{t("calendarCancel")}</Button>
                    <Button size="sm" onClick={() => { onSave(block.event.id, fields); setEditing(false); }}>{t("calendarSave")}</Button>
                  </>
                ) : editable ? (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={startEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />{t("calendarEdit")}</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onDuplicate(block)}><Copy className="mr-1.5 h-3.5 w-3.5" />{t("calendarDuplicate")}</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(block)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{t("calendarDelete")}</Button>
                  </>
                ) : (
                  <p className="text-xs text-muted">Recurring class schedule — edited from Manage.</p>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
