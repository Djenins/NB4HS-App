// Mileage.jsx -- My Mileage (/mileage): every staff member's log of the
// trips they drive in their own car for work -- Outreach workers most of all,
// often from a phone in the field -- and the monthly mileage sheet they print,
// sign and hand in for reimbursement (lib/mileageSheet.js).
//
// One month at a time: the month's trips, its miles and what they come to at
// the organization's rate (System Settings), a "Log a trip" form, and the
// printable sheet. Administrators can open anyone's log, and a program's
// supervisors their team's, to check it or print the sheet; only the owner
// edits their own trips (RLS: m1_mileage_log).
// Staff-only, so English (like My Availability).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Car, ChevronLeft, ChevronRight, Copy, Download, FileText, Gauge, Pencil, Plus, Printer, Receipt, Route, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { LOGO_URL } from "../lib/logo.js";
import {
  deleteTrip, emptyTripForm, fetchMileageTeam, fetchRecentTrips, fetchTrips, fmtMiles, fmtMoney, frequentPlaces,
  monthKey, monthLabel, monthRange, odometerMiles, orgMileageRate, reimbursement, saveTrip, shiftMonth,
  totalMiles, tripDateLabel, tripMiles, tripToForm, validateTrip
} from "../lib/mileage.js";
import { buildMileagePdf, mileagePdfName } from "../lib/mileageSheet.js";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { Dialog } from "../components/ui/dialog.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";

const DEPT_KEY = "nb4hs.mileage.department";

function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// The logo as a PNG data URL for jsPDF; a failure just means no logo.
async function loadLogo() {
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = LOGO_URL;
    });
    const width = Math.min(600, img.naturalWidth);
    const height = Math.round(img.naturalHeight * (width / img.naturalWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } catch (e) {
    return null;
  }
}

function TripDialog({ open, editing, initial, places, saving, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [showOdometer, setShowOdometer] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setErrors({});
    setShowOdometer(initial.odometerStart !== "" || initial.odometerEnd !== "");
  }, [open, initial]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = Object.assign({}, f, { [key]: value });
      // Both odometer readings fill in the miles (still editable).
      if ((key === "odometerStart" || key === "odometerEnd")) {
        const fromOdo = odometerMiles(next.odometerStart, next.odometerEnd);
        if (fromOdo !== null && fromOdo > 0) next.miles = String(fromOdo);
      }
      return next;
    });
  };

  function submit(e) {
    e.preventDefault();
    const found = validateTrip(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSave(form);
  }

  const miles = Number(form.miles);
  const counted = Number.isFinite(miles) && miles > 0 ? tripMiles({ miles, roundTrip: form.roundTrip }) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit trip" : "Log a trip"}
      description="One trip in your own car for NB4HS work. Don't include your commute to and from the office."
      size="lg"
      closeLabel="Close"
      as="form"
      panelProps={{ onSubmit: submit, noValidate: true }}
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? "Save trip" : "Log trip"}</Button>
        </>
      )}
    >
      <datalist id="mileage-places">
        {places.map((p) => <option key={p} value={p} />)}
      </datalist>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="ml-date" required error={errors.tripDate} className="sm:col-span-2 sm:max-w-[14rem]">
          <Input id="ml-date" type="date" value={form.tripDate} max={todayIso()} onChange={set("tripDate")} aria-invalid={!!errors.tripDate} />
        </Field>
        <Field label="From" htmlFor="ml-from" required error={errors.startLocation} hint="An address or a place, like “NB4HS office”.">
          <Input id="ml-from" list="mileage-places" autoComplete="off" maxLength={200} value={form.startLocation} onChange={set("startLocation")} aria-invalid={!!errors.startLocation} />
        </Field>
        <Field label="To" htmlFor="ml-to" required error={errors.destination}>
          <Input id="ml-to" list="mileage-places" autoComplete="off" maxLength={200} value={form.destination} onChange={set("destination")} aria-invalid={!!errors.destination} />
        </Field>
        <Field label="Purpose" htmlFor="ml-purpose" required error={errors.purpose} hint="What the trip was for: a client visit, an outreach event, a delivery, a meeting." className="sm:col-span-2">
          <Input id="ml-purpose" maxLength={300} value={form.purpose} onChange={set("purpose")} aria-invalid={!!errors.purpose} />
        </Field>
        <Field label="Miles, one way" htmlFor="ml-miles" required error={errors.miles}
          hint={counted !== null ? "Counts as " + fmtMiles(counted) + " miles" + (form.roundTrip ? " (there and back)." : ".") : "From your odometer or a map app."}>
          <Input id="ml-miles" type="number" inputMode="decimal" step="0.1" min="0.1" max="1000" className="tabular-nums"
            value={form.miles} onChange={set("miles")} aria-invalid={!!errors.miles} />
        </Field>
        {/* Same shape as a Field (label row, then the control) so the
            checkbox lines up with the Miles input beside it. */}
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="hidden text-meta font-semibold sm:block">&nbsp;</span>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-ui font-semibold text-card-foreground sm:min-h-0 sm:h-10 [@media(pointer:coarse)]:sm:h-11">
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={form.roundTrip} onChange={set("roundTrip")} />
            Round trip (there and back)
          </label>
        </div>
        {showOdometer ? (
          <>
            <Field label="Odometer at start" htmlFor="ml-odo-start" error={errors.odometerStart}>
              <Input id="ml-odo-start" type="number" inputMode="numeric" step="1" min="0" className="tabular-nums"
                value={form.odometerStart} onChange={set("odometerStart")} aria-invalid={!!errors.odometerStart} />
            </Field>
            <Field label="Odometer at end" htmlFor="ml-odo-end" error={errors.odometerEnd}>
              <Input id="ml-odo-end" type="number" inputMode="numeric" step="1" min="0" className="tabular-nums"
                value={form.odometerEnd} onChange={set("odometerEnd")} aria-invalid={!!errors.odometerEnd} />
            </Field>
          </>
        ) : (
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowOdometer(true)}>
              <Gauge className="h-4 w-4" aria-hidden="true" />Add odometer readings
            </Button>
          </div>
        )}
        <Field label="Notes (optional)" htmlFor="ml-notes" className="sm:col-span-2">
          <Textarea id="ml-notes" maxLength={500} rows={2} value={form.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Dialog>
  );
}

export default function Mileage() {
  const { session, orgSettings, data, showToast, requestConfirm } = useApp();
  const [personId, setPersonId] = useState(session ? session.id : null);
  const [people, setPeople] = useState([]);
  const [month, setMonth] = useState(() => monthKey());
  const [trips, setTrips] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [recent, setRecent] = useState([]);
  const [dialog, setDialog] = useState(null); // { id, initial }
  const [saving, setSaving] = useState(false);
  const [department, setDepartment] = useState(() => {
    try {
      const saved = window.localStorage.getItem(DEPT_KEY);
      if (saved !== null) return saved;
    } catch (e) { /* private mode */ }
    return data.programRoles && data.programRoles.snap ? "SNAP Outreach" : "";
  });
  const pdf = useRef({ JsPDF: null, logo: null });
  const [pdfReady, setPdfReady] = useState(false);

  const own = personId === (session && session.id);
  const rate = orgMileageRate(orgSettings);
  const today = todayIso();
  const thisMonth = monthKey();

  // Administrators and program supervisors get a picker; everyone else has
  // only their own log.
  useEffect(() => {
    if (!session) return;
    fetchMileageTeam().then(setPeople).catch((err) => { console.warn("fetchMileageTeam failed", err); setPeople([]); });
  }, [session]);

  useEffect(() => {
    if (!personId) return undefined;
    let cancelled = false;
    setTrips(null);
    setLoadError(false);
    const { from, to } = monthRange(month);
    fetchTrips(personId, from, to)
      .then((rows) => { if (!cancelled) setTrips(rows); })
      .catch((err) => { console.warn("fetchTrips failed", err); if (!cancelled) { setTrips([]); setLoadError(true); } });
    return () => { cancelled = true; };
  }, [personId, month, reloadKey]);

  useEffect(() => {
    if (!own || !personId) return;
    fetchRecentTrips(personId).then(setRecent).catch(() => setRecent([]));
  }, [own, personId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("jspdf"), loadLogo()]).then(([mod, logo]) => {
      if (cancelled) return;
      pdf.current = { JsPDF: mod.default, logo };
      setPdfReady(true);
    }).catch((err) => console.warn("jspdf failed to load", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(DEPT_KEY, department); } catch (e) { /* private mode */ }
  }, [department]);

  const places = useMemo(() => frequentPlaces(recent, 10), [recent]);
  const person = own ? { name: session.currentUserName, email: session.currentUserEmail } : (people.find((p) => p.id === personId) || {});
  const personName = person.name || person.email || "Staff member";
  const miles = trips ? totalMiles(trips) : 0;
  const amount = reimbursement(miles, rate);

  function openNew() {
    // A new trip starts from the month on screen: today in the current
    // month, the 1st of a past one.
    const date = month < thisMonth ? monthRange(month).from : today;
    setDialog({ id: null, initial: emptyTripForm(date) });
  }

  function openCopy(trip) {
    setDialog({ id: null, initial: Object.assign(tripToForm(trip), { tripDate: today, odometerStart: "", odometerEnd: "", notes: "" }) });
  }

  async function save(form) {
    setSaving(true);
    try {
      await saveTrip(dialog.id, form);
      setDialog(null);
      showToast(dialog.id ? "Trip saved." : "Trip logged.");
      const tripMonth = form.tripDate.slice(0, 7);
      if (tripMonth !== month) setMonth(tripMonth);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.warn("saveTrip failed", err);
      showToast("Couldn't save the trip. Check your connection and try again.");
    }
    setSaving(false);
  }

  async function remove(trip) {
    const ok = await requestConfirm("Delete the trip on " + tripDateLabel(trip.tripDate, true) + " to " + trip.destination + "?", { danger: true });
    if (!ok) return;
    try {
      await deleteTrip(trip.id);
      showToast("Trip deleted.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.warn("deleteTrip failed", err);
      showToast("Couldn't delete the trip. Try again.");
    }
  }

  // Synchronous once jsPDF is loaded, so Print opens its window inside the
  // click (pop-up blockers allow that).
  function sheetOpts(blank) {
    return { trips: trips || [], month, staffName: personName, department: department.trim(), rate, logo: pdf.current.logo, blank };
  }
  function printSheet(blank) {
    if (!pdfReady) return;
    const doc = buildMileagePdf(pdf.current.JsPDF, sheetOpts(blank));
    doc.autoPrint();
    const win = window.open(doc.output("bloburl").toString(), "_blank");
    if (!win) showToast("Your browser blocked the print window. Allow pop-ups for this site, or use Download PDF.");
  }
  function downloadSheet() {
    if (!pdfReady) return;
    const opts = sheetOpts(false);
    buildMileagePdf(pdf.current.JsPDF, opts).save(mileagePdfName(opts));
  }

  const columns = [
    { key: "date", header: "Date", cell: (trip) => <span className="whitespace-nowrap">{tripDateLabel(trip.tripDate)}</span> },
    {
      key: "route", header: "Trip", cell: (trip) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-card-foreground">
            <span>{trip.startLocation}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="to" />
            <span>{trip.destination}</span>
          </div>
          <div className="text-meta text-muted">{trip.purpose}</div>
        </div>
      )
    },
    {
      key: "miles", header: "Miles", className: "text-right", cell: (trip) => (
        <div className="text-right tabular-nums">
          <span className="font-semibold text-card-foreground">{fmtMiles(tripMiles(trip))}</span>
          {trip.roundTrip ? <div><Badge variant="neutral">Round trip</Badge></div> : null}
        </div>
      )
    },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, hidden: !own, cell: (trip) => tripActions(trip)
    }
  ];

  function tripActions(trip) {
    return (
      <div className="flex justify-end gap-1">
        <IconButton size="sm" label="Log this trip again" onClick={() => openCopy(trip)}><Copy aria-hidden="true" /></IconButton>
        <IconButton size="sm" label="Edit trip" onClick={() => setDialog({ id: trip.id, initial: tripToForm(trip) })}><Pencil aria-hidden="true" /></IconButton>
        <IconButton size="sm" label="Delete trip" onClick={() => remove(trip)}><Trash2 aria-hidden="true" /></IconButton>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={own ? "My Mileage" : personName + "'s Mileage"}
        description={own
          ? "Log the trips you drive in your own car for NB4HS work, then print the month's sheet to sign and hand in."
          : "Trips " + personName + " logged in their own car for NB4HS work. You can check them and print the month's sheet."}
        actions={own ? (
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />Log a trip
          </Button>
        ) : null}
      />

      {/* The month stepper, and -- for administrators and program
          supervisors -- whose log is open. Phones: the picker on top, the
          stepper across the full width with its arrows at the edges. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {people.length > 0 ? (
          <Field label="Mileage for" htmlFor="ml-person" className="sm:order-2 sm:w-72">
            <Select id="ml-person" value={personId || ""} onChange={(e) => setPersonId(e.target.value)}>
              <option value={session.id}>{(session.currentUserName || session.currentUserEmail) + " (me)"}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
            </Select>
          </Field>
        ) : null}
        <div className="flex items-center gap-2 rounded-surface border border-border bg-card p-1.5 sm:order-1 sm:border-0 sm:bg-transparent sm:p-0">
          <IconButton variant="ghost" label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}><ChevronLeft aria-hidden="true" /></IconButton>
          <div className="min-w-0 flex-1 text-center sm:min-w-[11rem] sm:flex-none">
            <h2 className="m-0 text-heading font-bold text-card-foreground" aria-live="polite">{monthLabel(month)}</h2>
            {month !== thisMonth ? (
              <button type="button" onClick={() => setMonth(thisMonth)}
                className="m-0 min-h-0 border-0 bg-transparent p-0 text-meta font-semibold text-primary underline-offset-2 hover:underline">
                Back to this month
              </button>
            ) : null}
          </div>
          <IconButton variant="ghost" label="Next month" disabled={month >= thisMonth} onClick={() => setMonth((m) => shiftMonth(m, 1))}><ChevronRight aria-hidden="true" /></IconButton>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-tone-danger-border bg-tone-danger-bg px-4 py-3 text-ui font-semibold text-tone-danger-ink">
          Couldn't load these trips. Check your connection.
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Trips" value={trips ? trips.length : "–"} icon={Car} tone="info" hint={monthLabel(month)} />
        <KpiCard label="Miles" value={trips ? fmtMiles(miles) : "–"} icon={Route} tone="info" hint="Round trips count both ways" />
        <KpiCard
          label="Reimbursement"
          value={trips && amount !== null ? fmtMoney(amount) : "–"}
          icon={Receipt}
          tone="success"
          className="col-span-2 lg:col-span-1"
          hint={rate !== null ? "At " + fmtMoney(rate) + " a mile" : "No rate set yet (System Settings)"}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,30%)]">
        <Card className="min-w-0 p-4 sm:p-5">
          <DataTable
            columns={columns}
            rows={trips || []}
            loading={trips === null}
            getRowId={(trip) => trip.id}
            caption={"Trips in " + monthLabel(month)}
            maxHeight="none"
            renderCard={(trip) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-meta font-semibold text-muted">{tripDateLabel(trip.tripDate)}</div>
                  <div className="font-semibold text-card-foreground">{trip.startLocation} → {trip.destination}</div>
                  <div className="text-meta text-muted">{trip.purpose}</div>
                  {own ? <div className="mt-1">{tripActions(trip)}</div> : null}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <div className="text-body font-bold text-card-foreground">{fmtMiles(tripMiles(trip))}</div>
                  <div className="text-meta text-muted">{trip.roundTrip ? "mi · round trip" : "mi"}</div>
                </div>
              </div>
            )}
            empty={(
              <EmptyState
                icon={Car}
                title={"No trips in " + monthLabel(month)}
                description={own ? "Log each work trip as you go. It takes a few seconds on your phone." : "Nothing logged for this month."}
                action={own ? <Button onClick={openNew}><Plus className="h-4 w-4" aria-hidden="true" />Log a trip</Button> : null}
              />
            )}
          />
          {trips && trips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-ui">
              <span className="font-semibold text-card-foreground">Total for {monthLabel(month)}</span>
              <span className="tabular-nums font-bold text-card-foreground">{fmtMiles(miles)} miles{amount !== null ? " · " + fmtMoney(amount) : ""}</span>
            </div>
          ) : null}
        </Card>

        <SectionCard
          title={<span className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" aria-hidden="true" />Mileage sheet</span>}
          description="A printable sheet with this month's trips, totals and lines for your signature and your supervisor's."
        >
          <div className="grid gap-4">
            <Field label="Program or department" htmlFor="ml-dept" hint="Printed at the top of the sheet.">
              <Input id="ml-dept" maxLength={80} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. SNAP Outreach" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => printSheet(false)} disabled={!pdfReady || !trips || !trips.length}>
                <Printer className="h-4 w-4" aria-hidden="true" />Print {monthLabel(month).split(" ")[0]} sheet
              </Button>
              <Button variant="secondary" onClick={downloadSheet} disabled={!pdfReady || !trips || !trips.length}>
                <Download className="h-4 w-4" aria-hidden="true" />Download PDF
              </Button>
            </div>
            <div className="border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={() => printSheet(true)} disabled={!pdfReady}>
                <Printer className="h-4 w-4" aria-hidden="true" />Print a blank sheet
              </Button>
              <p className="m-0 mt-2 text-meta text-muted">For the car, to fill in by hand when you can't log trips on your phone.</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {dialog ? (
        <TripDialog
          open
          editing={!!dialog.id}
          initial={dialog.initial}
          places={places}
          saving={saving}
          onClose={() => !saving && setDialog(null)}
          onSave={save}
        />
      ) : null}
    </>
  );
}
