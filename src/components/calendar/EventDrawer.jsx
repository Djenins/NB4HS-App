// EventDrawer.jsx -- slide-out panel (not a modal) shown when an event is
// clicked. View mode shows the fields calendar_events actually stores, and
// edit mode reuses the same set.
//
// An earlier pass also rendered "No related case linked" / "No documents
// attached" placeholders here, standing in for two fields from the original
// design brief that the table has no columns for. They were removed as
// noise: a permanently empty box teaches nothing the second time it is read.
// If those fields ever get real columns, they belong in the field grid above
// like any other -- not as dashed placeholders.
//
// It is the shared Drawer (header, scrolling body, footer; focus trap and
// Escape from useModalA11y), with the event kind's tone on its icon disc.
// What it shows is unchanged: only the fields fetchCalendarEvents() returns.
// A colleague's event arrives from calendar_events_between() without its
// person or notes (t7), so those rows read "—" / "No notes" here.
import { Copy, MapPin, Pencil, Trash2, Users } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { fmtTimeRange } from "./calendarLayout.js";
import { blockStyle } from "./kindStyle.js";
import { Button } from "../ui/button.jsx";
import { Drawer } from "../ui/drawer.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { cn } from "../../lib/cn.js";

// An uppercase overline label over its value -- the drawer's read-only
// field. The overline tracking is the calendar's one value, 0.06em.
function DetailField({ label, value }) {
  return (
    <div>
      <p className="m-0 text-caption font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className="m-0 mt-0.5 text-ui tabular-nums text-card-foreground">{value || "—"}</p>
    </div>
  );
}

export default function EventDrawer({ block, t, openInEditMode, onClose, onSave, onDelete, onDuplicate }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(null);
  const idBase = useId();

  const open = !!block;
  const style = open ? blockStyle(block) : null;
  const Icon = style?.icon;
  const rights = block?.rights || {};

  function startEdit() {
    setFields({
      type: block.kind,
      title: block.title,
      personName: block.event?.personName || "",
      notes: block.event?.notes || "",
      location: block.event?.location || "",
      date: block.event?.date || "",
      startTime: block.startTime,
      endTime: block.endTime || "",
      availability: block.event?.availability || "busy"
    });
    setEditing(true);
  }
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  const canSave = editing && fields.title.trim() && fields.date && fields.startTime;

  // The pencil icon on an EventCard opens the drawer straight into edit
  // mode (openInEditMode); clicking the card body opens it read-only. Runs
  // per block so switching to a different event while the drawer is
  // already open resets edit state instead of leaking the previous one.
  useEffect(() => {
    if (!block) { setEditing(false); return; }
    if (openInEditMode && rights.edit) startEdit();
    else setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.key, openInEditMode]);

  const id = (name) => idBase + "-" + name;

  let footer = null;
  if (block && editing) {
    footer = (
      <>
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>{t("calendarCancel")}</Button>
        <Button size="sm" disabled={!canSave} onClick={() => { onSave(block.event.id, fields); setEditing(false); }}>{t("calendarSave")}</Button>
      </>
    );
  } else if (block && block.event) {
    footer = (rights.edit || rights.duplicate || rights.remove) ? (
      <>
        {rights.edit && <Button type="button" variant="outline" size="sm" onClick={startEdit}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t("calendarEdit")}</Button>}
        {rights.duplicate && <Button type="button" variant="outline" size="sm" onClick={() => onDuplicate(block)}><Copy className="h-3.5 w-3.5" aria-hidden="true" />{t("calendarDuplicate")}</Button>}
        {rights.remove && <Button type="button" variant="danger" size="sm" onClick={() => onDelete(block)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t("calendarDelete")}</Button>}
      </>
    ) : null;
  } else if (block) {
    footer = <p className="m-0 mr-auto text-meta text-muted">Recurring class schedule — edited from Manage.</p>;
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("calendarEventDetails")}
      icon={Icon ? <Icon aria-hidden="true" /> : null}
      iconClassName={style ? cn(style.chipBg, style.chipFg) : undefined}
      closeLabel={t("closeLabel")}
      footer={footer}
    >
      {block && !editing && (
        <div className="flex flex-col gap-4">
          <div className={cn("rounded-control border border-l-[3px] px-4 py-3", style.cardBg, style.cardBorder, style.accent)}>
            <p className={cn("m-0 flex items-center gap-1.5 text-caption font-bold uppercase tracking-[0.06em]", style.chipFg)}>
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}{t(style.label)}
            </p>
            <p className="m-0 mt-1 text-heading leading-tight text-card-foreground">{block.title}</p>
            {block.subtitle && <p className="m-0 mt-0.5 text-ui font-medium text-on-tint">{block.subtitle}</p>}
            <p className="m-0 mt-0.5 text-ui font-medium tabular-nums text-on-tint">{fmtTimeRange(block.startTime, block.endTime)}</p>
            {block.location && (
              <p className="m-0 mt-1 flex items-center gap-1.5 text-ui font-medium text-on-tint">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{block.location}
              </p>
            )}
            {/* Live enrolled-student count for the classes in this
                block -- see Calendar.jsx. Absent, not zero, for kinds
                that have no roster. */}
            {block.count > 0 && (
              <p className="m-0 mt-1.5 flex items-center gap-1.5 text-ui font-semibold tabular-nums text-card-foreground">
                <Users className="h-4 w-4 shrink-0 text-on-tint" aria-hidden="true" />
                {block.count} <span className="font-medium text-on-tint">{t("calendarEnrolled")}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailField label={t("calendarPersonName")} value={block.event?.personName} />
              <DetailField label={t("calendarStaffMember")} value={block.event?.createdByName} />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line-subtle pt-3">
              <DetailField label={t("calendarCategory")} value={t(style.label)} />
              <DetailField label={t("calendarStatus")} value={t("calendarConfirmed")} />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line-subtle pt-3">
              <DetailField label={t("calendarDate")} value={block.event?.date} />
              <DetailField label={t("calendarStartTime")} value={fmtTimeRange(block.startTime, block.endTime)} />
            </div>
          </div>

          <div className="border-t border-line-subtle pt-3">
            <DetailField label={t("calendarNotes")} value={block.event?.notes || t("calendarNoNotes")} />
          </div>
        </div>
      )}

      {block && editing && (
        <div className="flex flex-col gap-4">
          <Field label={t("calendarEventTitle")} required htmlFor={id("title")}>
            <Input id={id("title")} value={fields.title} onChange={(e) => setField("title", e.target.value)} placeholder={t("phEventTitle")} />
          </Field>
          <Field label={t("calendarPersonName")} htmlFor={id("person")}>
            <Input id={id("person")} value={fields.personName} onChange={(e) => setField("personName", e.target.value)} placeholder={t("phPersonName")} />
          </Field>
          <Field label={t("calendarDate")} required htmlFor={id("date")}>
            <Input id={id("date")} type="date" value={fields.date} onChange={(e) => setField("date", e.target.value)} />
          </Field>
          {fields.type === "appointment" && (
            <Field label={t("calendarAvailability")} htmlFor={id("availability")}>
              <Select id={id("availability")} value={fields.availability} onChange={(e) => setField("availability", e.target.value)}>
                <option value="busy">{t("calendarBusy")}</option>
                <option value="available">{t("calendarAvailable")}</option>
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("calendarStartTime")} required htmlFor={id("start")}>
              <Input id={id("start")} type="time" value={fields.startTime} onChange={(e) => setField("startTime", e.target.value)} />
            </Field>
            <Field label={t("calendarEndTime")} htmlFor={id("end")}>
              <Input id={id("end")} type="time" value={fields.endTime} onChange={(e) => setField("endTime", e.target.value)} />
            </Field>
          </div>
          <Field label={t("classLocationLabel")} htmlFor={id("location")}>
            <Input id={id("location")} maxLength={80} value={fields.location} onChange={(e) => setField("location", e.target.value)} placeholder={t("phEventLocation")} />
          </Field>
          <Field label={t("calendarNotes")} htmlFor={id("notes")}>
            <Input id={id("notes")} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t("phEventNotes")} />
          </Field>
        </div>
      )}
    </Drawer>
  );
}
