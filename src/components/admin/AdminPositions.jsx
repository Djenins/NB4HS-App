// AdminPositions.jsx -- Administration > Positions: the job titles staff
// hold (Case Manager, Program Director...). A position describes the work
// and grants nothing -- access comes from roles. Add, rename, describe,
// archive and restore; who holds which is set on each person's account.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey, createPosition, fetchPositions, updatePosition } from "../../lib/adminAccounts.js";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Textarea } from "../ui/field.jsx";
import { IconButton } from "../ui/icon-button.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import { countLabel } from "./adminShared.jsx";

function PositionDialog({ open, onClose, position, onSaved }) {
  const { showToast } = useApp();
  const t = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setName(position ? position.name : ""); setDescription(position ? position.description : ""); setError(""); setBusy(false); }
  }, [open, position]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError(t("adminNameRequired")); return; }
    setBusy(true);
    try {
      if (position) await updatePosition(position.id, { name: name.trim(), description: description.trim() });
      else await createPosition(name.trim(), description.trim());
      showToast(t(position ? "adminSaved" : "adminPositionCreated"));
      onSaved();
      onClose();
    } catch (err) { showToast(t(adminErrorKey(err))); }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={position ? t("adminEditPosition") : t("adminNewPosition")}
      description={t("adminPositionDialogDesc")} size="md" closeLabel={t("closeLabel")} as="form" panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={busy}>{position ? t("saveLabel") : t("adminNewPosition")}</Button>
        </>
      }>
      <div className="grid gap-4">
        <Field label={t("adminPositionNameLabel")} htmlFor="position-name" error={error} required>
          <Input id="position-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={80} aria-invalid={!!error} data-autofocus />
        </Field>
        <Field label={t("adminDescriptionLabel")} htmlFor="position-desc">
          <Textarea id="position-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </Field>
      </div>
    </Dialog>
  );
}

export default function AdminPositions() {
  const { showToast, requestConfirm } = useApp();
  const t = useT();
  const [positions, setPositions] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("active");
  const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit

  const load = useCallback(() => {
    setLoadError(false);
    return fetchPositions().then(setPositions).catch((e) => { setLoadError(true); showToast(t(adminErrorKey(e))); });
  }, [showToast, t]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (positions || []).filter((p) => (view === "archived" ? !!p.archivedAt : !p.archivedAt)), [positions, view]);

  async function toggleArchive(p) {
    if (!p.archivedAt && p.peopleCount && !(await requestConfirm(t("adminArchivePositionConfirm").replace("{name}", p.name).replace("{n}", p.peopleCount)))) return;
    try { await updatePosition(p.id, { archived: !p.archivedAt }); showToast(t(p.archivedAt ? "adminPositionRestored" : "adminPositionArchived")); load(); }
    catch (e) { showToast(t(adminErrorKey(e))); }
  }

  const columns = [
    {
      key: "name", header: t("adminPositionNameLabel"),
      cell: (p) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground">{p.name}</div>
          {p.description ? <div className="truncate text-meta text-muted">{p.description}</div> : null}
        </div>
      )
    },
    { key: "people", header: t("adminPeopleCol"), className: "tabular-nums", cell: (p) => p.peopleCount },
    {
      key: "actions", header: <span className="sr-only">{t("actionsCol")}</span>, className: "w-24 text-right",
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <IconButton label={t("adminEditPositionNamed").replace("{name}", p.name)} onClick={() => setEditing(p)}><Pencil aria-hidden="true" /></IconButton>
          <IconButton label={(p.archivedAt ? t("adminRestore") : t("adminArchive")) + " " + p.name} onClick={() => toggleArchive(p)}>
            {p.archivedAt ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title={t("adminPositionsTitle")}
        description={t("adminPositionsSubtitle")}
        actions={<Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" aria-hidden="true" />{t("adminNewPosition")}</Button>}
      />
      <Card className="p-4 sm:p-5">
        <SegmentedControl className="mb-4" label={t("adminPositionsView")} value={view} onChange={setView}
          options={[{ value: "active", label: t("adminInUse") }, { value: "archived", label: t("adminArchived") }]} />
        {loadError ? (
          <EmptyState variant="error" title={t("adminLoadFailed")} description={t("adminLoadFailedHint")} action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(p) => p.id}
            loading={positions === null}
            caption={t("adminPositionsTitle")}
            renderCard={(p) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-card-foreground">{p.name}</div>
                  <div className="text-meta text-muted">{countLabel(t, p.peopleCount, "adminOnePerson", "adminPeopleCount")}</div>
                </div>
                {columns[2].cell(p)}
              </div>
            )}
            empty={<EmptyState compact title={view === "archived" ? t("adminNoArchivedPositions") : t("adminNoPositionsYet")} />}
          />
        )}
      </Card>
      <PositionDialog open={editing !== undefined} onClose={() => setEditing(undefined)} position={editing || null} onSaved={load} />
    </>
  );
}
