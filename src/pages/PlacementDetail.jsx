// PlacementDetail.jsx -- Placement detail page (a real route, not a modal,
// per the spec -- the timeline + four check-in forms + end-placement flow
// is too much for a modal). SectionCard/FieldRow idiom from
// EmployerProfile.jsx.
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { updatePlacement, updatePlacementCheckin } from "../lib/clientsData.js";
import { CHECKIN_TYPES, placementStatusBadgeVariant, placementStatusLabel } from "../lib/placements.js";
import { fmtDateLong } from "../lib/utils.js";
import { avatarColorFor } from "../components/StudentCard.jsx";
import EndPlacementModal from "../components/EndPlacementModal.jsx";
import PlacementCheckinCard from "../components/PlacementCheckinCard.jsx";
import PlacementTimeline from "../components/PlacementTimeline.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

function SectionCard({ title, action, children }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold text-card-foreground">{title}</h3>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
function FieldRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-card-foreground">{value || "—"}</span>
    </div>
  );
}

const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function EditPlacementModal({ record, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({
    hourlyWage: record.hourlyWage || "", hoursPerWeek: record.hoursPerWeek || "", benefits: record.benefits || "",
    supervisorName: record.supervisorName || "", supervisorContact: record.supervisorContact || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("editLabel")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("hourlyWageLabel")}</label><input type="number" step="0.01" className={inputClass} value={fields.hourlyWage} onChange={(e) => setField("hourlyWage", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("hoursPerWeekLabel")}</label><input className={inputClass} value={fields.hoursPerWeek} onChange={(e) => setField("hoursPerWeek", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("supervisorNameLabel")}</label><input className={inputClass} value={fields.supervisorName} onChange={(e) => setField("supervisorName", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("supervisorContactLabel")}</label><input className={inputClass} value={fields.supervisorContact} onChange={(e) => setField("supervisorContact", e.target.value)} /></div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("benefitsLabel")}</label>
          <textarea rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" value={fields.benefits} onChange={(e) => setField("benefits", e.target.value)} />
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
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

  if (!record) {
    return <Card><CardContent className="p-10 text-center text-sm text-muted">{t("placementNotFoundMessage")}</CardContent></Card>;
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

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 gap-1.5" onClick={() => navigate("/placements")}>
        <ArrowLeft className="h-3.5 w-3.5" /> {t("navPlacements")}
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0"><AvatarFallback className={avatarColorFor(record.participantName || "")}>{(record.participantName || "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-xl">{record.participantName}</h1>
                <Badge variant={placementStatusBadgeVariant(record.currentStatus)}>{placementStatusLabel(record.currentStatus)}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span>{record.positionTitle}</span>
                <span>{record.employerName}</span>
                <span>{t("jobStartDateLabel")}: {fmtDateLong(record.startDate)}</span>
              </div>
              <div className="mt-3"><PlacementTimeline checkins={checkins} /></div>
            </div>
          </div>
          {record.currentStatus === "active" && (
            <Button variant="destructive" size="sm" onClick={() => setEnding(true)}>{t("markEndedBtn")}</Button>
          )}
        </CardContent>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[35fr_65fr]">
        <div className="space-y-5">
          <SectionCard title={t("placementDetailsLabel")} action={<Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={t("editLabel")}><Pencil className="h-3.5 w-3.5" /></Button>}>
            <FieldRow label={t("hourlyWageLabel")} value={record.hourlyWage ? "$" + record.hourlyWage + "/hr" : ""} />
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
          </SectionCard>
        </div>

        <div className="space-y-4">
          {checkins.map((c) => <PlacementCheckinCard key={c.id} checkin={c} onUpdate={(patch) => updateCheckin(c.id, patch)} />)}
        </div>
      </div>

      {editing && <EditPlacementModal record={record} onSave={async (fields) => { await updateRecord(fields); setEditing(false); }} onCancel={() => setEditing(false)} />}
      {ending && <EndPlacementModal onSave={endPlacement} onCancel={() => setEnding(false)} />}
    </>
  );
}
