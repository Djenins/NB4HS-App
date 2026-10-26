// PlacementDetail.jsx -- Placement detail page (a real route, not a modal,
// per the spec -- the timeline + four check-in forms + end-placement flow
// is too much for a modal). Record-page anatomy from ClientProfile.jsx /
// ClientHeader.jsx: back link, an identity header (avatar, name as the h1,
// status badge, position/employer/start date) with at most two actions,
// then ui SectionCards -- details and the retention timeline as divided
// rows on the left, one SectionCard per check-in form on the right. Every
// modal is a ui Dialog.
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Building2, CalendarDays, CircleStop, Pencil } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { updatePlacement, updatePlacementCheckin } from "../lib/clientsData.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import { CHECKIN_TYPES, placementStatusLabel } from "../lib/placements.js";
import { fmtDateLong } from "../lib/utils.js";
import EndPlacementModal from "../components/EndPlacementModal.jsx";
import PlacementCheckinCard from "../components/PlacementCheckinCard.jsx";
import PlacementTimeline from "../components/PlacementTimeline.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { Dialog } from "../components/ui/dialog.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Textarea } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";

// One label/value pair in the details card's divided list.
function FieldRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-right text-ui font-semibold tabular-nums text-card-foreground">{value || "—"}</dd>
    </div>
  );
}

// Header meta line item: icon + a visually hidden label for screen readers.
function MetaItem({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

function EditPlacementModal({ record, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({
    hourlyWage: record.hourlyWage || "", hoursPerWeek: record.hoursPerWeek || "", benefits: record.benefits || "",
    supervisorName: record.supervisorName || "", supervisorContact: record.supervisorContact || ""
  });
  const [saving, setSaving] = useState(false);
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("editLabel")}
      description={record.participantName}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving}>{t("saveLabel")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("hourlyWageLabel")} htmlFor="edit-placement-wage">
            <Input id="edit-placement-wage" type="number" step="0.01" inputMode="decimal" className="tabular-nums" value={fields.hourlyWage} onChange={(e) => setField("hourlyWage", e.target.value)} placeholder={t("phHourlyWage")} />
          </Field>
          <Field label={t("hoursPerWeekLabel")} htmlFor="edit-placement-hours">
            <Input id="edit-placement-hours" className="tabular-nums" value={fields.hoursPerWeek} onChange={(e) => setField("hoursPerWeek", e.target.value)} placeholder={t("phHoursPerWeek")} />
          </Field>
          <Field label={t("supervisorNameLabel")} htmlFor="edit-placement-supervisor">
            <Input id="edit-placement-supervisor" value={fields.supervisorName} onChange={(e) => setField("supervisorName", e.target.value)} placeholder={t("phSupervisorName")} />
          </Field>
          <Field label={t("supervisorContactLabel")} htmlFor="edit-placement-supervisor-contact">
            <Input id="edit-placement-supervisor-contact" value={fields.supervisorContact} onChange={(e) => setField("supervisorContact", e.target.value)} placeholder={t("phSupervisorContact")} />
          </Field>
        </div>
        <Field label={t("benefitsLabel")} htmlFor="edit-placement-benefits">
          <Textarea id="edit-placement-benefits" rows={2} value={fields.benefits} onChange={(e) => setField("benefits", e.target.value)} placeholder={t("phBenefits")} />
        </Field>
      </div>
    </Dialog>
  );
}

export default function PlacementDetail() {
  const { placementId } = useParams();
  const { data, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [ending, setEnding] = useState(false);

  const record = (data.placements || []).find((p) => p.id === placementId);
  const checkins = (data.placementCheckins || [])
    .filter((c) => c.placementId === placementId)
    .sort((a, b) => CHECKIN_TYPES.findIndex((c) => c.key === a.checkinType) - CHECKIN_TYPES.findIndex((c) => c.key === b.checkinType));

  function goBack() { navigate("/placements"); }

  if (!record) {
    return (
      <Card>
        <EmptyState
          variant="error"
          title={t("placementNotFoundMessage")}
          action={
            <Button variant="secondary" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("navPlacements")}
            </Button>
          }
        />
      </Card>
    );
  }

  async function updateRecord(patch) {
    await updatePlacement(placementId, patch);
  }
  async function updateCheckin(id, patch) {
    await updatePlacementCheckin(id, patch);
    showToast(t("placementUpdated"));
  }
  async function endPlacement(fields) {
    await updateRecord(Object.assign({ currentStatus: "ended" }, fields));
    setEnding(false);
    showToast(t("placementEnded"));
  }

  const name = record.participantName || "";

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("navPlacements")}
          </Button>
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0" aria-hidden="true">
              <AvatarFallback className={avatarColorFor(name) + " text-section"}>{(name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {/* m-0 and explicit weight: main.css still styles bare h1 at 2rem/800. */}
              <h1 className="m-0 text-heading font-bold text-card-foreground [text-wrap:balance]">{name || "—"}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge domain="placement" status={record.currentStatus}>{placementStatusLabel(record.currentStatus)}</StatusBadge>
              </div>
              <dl className="m-0 mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-muted">
                <MetaItem icon={Briefcase} label={t("positionLabel")}>{record.positionTitle || "—"}</MetaItem>
                <MetaItem icon={Building2} label={t("employerLabel")}>{record.employerName || "—"}</MetaItem>
                <MetaItem icon={CalendarDays} label={t("jobStartDateLabel")}>
                  <span>{t("jobStartDateLabel")}: <span className="tabular-nums">{fmtDateLong(record.startDate)}</span></span>
                </MetaItem>
              </dl>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editLabel")}
          </Button>
          {/* Ending is consequential, so it opens a confirm-with-reason
              dialog whose submit is the danger button. */}
          {record.currentStatus === "active" && (
            <Button variant="secondary" onClick={() => setEnding(true)}>
              <CircleStop className="h-4 w-4" aria-hidden="true" /> {t("markEndedBtn")}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard
            title={t("placementDetailsLabel")}
            action={
              <IconButton label={t("editLabel")} onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
              </IconButton>
            }
          >
            <dl className="m-0 divide-y divide-line-subtle">
              <FieldRow label={t("hourlyWageLabel")} value={record.hourlyWage ? record.hourlyWage + t("perHourSuffix") : ""} />
              <FieldRow label={t("hoursPerWeekLabel")} value={record.hoursPerWeek} />
              <FieldRow label={t("benefitsLabel")} value={record.benefits} />
              <FieldRow label={t("supervisorNameLabel")} value={record.supervisorName} />
              <FieldRow label={t("supervisorContactLabel")} value={record.supervisorContact} />
              {record.currentStatus === "ended" && (
                <>
                  <FieldRow label={t("endDateLabel")} value={fmtDateLong(record.endDate)} />
                  <FieldRow label={t("reasonForLeavingLabel")} value={record.reasonForLeaving} />
                </>
              )}
            </dl>
          </SectionCard>

          <SectionCard title={t("checkinsLabel")} flush>
            <PlacementTimeline checkins={checkins} startDate={record.startDate} />
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {checkins.map((c) => <PlacementCheckinCard key={c.id} checkin={c} onUpdate={(patch) => updateCheckin(c.id, patch)} />)}
        </div>
      </div>

      {editing && <EditPlacementModal record={record} onSave={async (fields) => { await updateRecord(fields); setEditing(false); }} onCancel={() => setEditing(false)} />}
      {ending && <EndPlacementModal onSave={endPlacement} onCancel={() => setEnding(false)} />}
    </>
  );
}
