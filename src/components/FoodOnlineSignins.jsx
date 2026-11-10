// FoodOnlineSignins.jsx -- sign-up and day-of sign-in for a distribution,
// under the form builder in Food Distribution > Sign-in Forms.
//
//  * Staff turn the form set up above (occasion, date, location, language)
//    into a public sign-up link + QR code (pages/FoodSignUp.jsx). Clients
//    sign up ahead of the day; one sign-up per address.
//  * On the day, staff open the list, find the client by name or phone,
//    confirm it's them, and the client signs on the tablet. That marks the
//    pickup and logs it in the household's pickup history.
//  * The signed sheet PDF is the paper sign-in sheet with every sign-up
//    filled in and the signatures of those who picked up.
// Staff-only screen: English in every language.
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, ChevronDown, Copy, ExternalLink, FileDown, Globe, Lock, LockOpen, PenLine, QrCode, Trash2, Undo2, Users,
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { PROGRAM_LABEL, formTitle, pdfFileName, programAsksSnap } from "../lib/foodSignInForm.js";
import {
  createFoodSigninEvent, deleteFoodSigninEvent, deleteFoodSignup, fetchFoodSigninEvents, fetchFoodSignups,
  foodSignupUrl, parseSignupLimit, pickUpFoodSignup, setFoodSigninEventLimit, setFoodSigninEventOpen, signupAddress, signupMatches, signupName, undoFoodSignupPickup,
} from "../lib/foodSigninData.js";
import { subscribeClientsTable } from "../lib/clientsData.js";
import { cn } from "../lib/cn.js";
import SignaturePad from "./SignaturePad.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { ConfirmDialog } from "./ui/confirm-dialog.jsx";
import { Dialog } from "./ui/dialog.jsx";
import { EmptyState } from "./ui/empty-state.jsx";
import { Field, Input } from "./ui/field.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { SearchInput } from "./ui/search-input.jsx";
import { SectionCard } from "./ui/section-card.jsx";
import { SegmentedControl } from "./ui/segmented-control.jsx";
import { Skeleton } from "./ui/skeleton.jsx";

function qrSrc(url) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&data=" + encodeURIComponent(url);
}
// "Thanksgiving Food Distribution" (+ " – CDBG"): the event's name in staff
// lists and what goes in the household's pickup log.
function eventName(ev) {
  return formTitle(ev.occasion, ev.customOccasion, "en").replace(/ Form$/, "") + (ev.program === "cdbg" ? " – CDBG" : "");
}

function SnapBadge({ s }) {
  const t = useT();
  if (s.wantsSnapHelp === "yes") return <Badge variant="info">{t("fsoSnapSent")}</Badge>;
  if (s.hasSnap === "yes") return <Badge variant="neutral">{t("fsoSnapHas")}</Badge>;
  if (s.hasSnap === "no") return <Badge variant="neutral">{t("fsoSnapNo")}</Badge>;
  return null;
}

// Change (or clear) an event's sign-up limit.
function LimitDialog({ ev, onClose, onSaved }) {
  const { showToast } = useApp();
  const t = useT();
  const [value, setValue] = useState(ev.signupLimit ? String(ev.signupLimit) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const limit = parseSignupLimit(value);
    if (limit === undefined) { setError(t("fsoLimitInvalid")); return; }
    setSaving(true);
    try {
      await setFoodSigninEventLimit(ev.id, limit);
      showToast(t("fsoLimitSaved"));
      onSaved(limit);
    } catch (err) {
      console.warn("setFoodSigninEventLimit failed", err);
      setError(t("fsoActionFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("fsoLimitTitle")}
      description={t("fsoLimitDesc")}
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit, noValidate: true }}
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onClose}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving}>{t("saveLabel")}</Button>
        </>
      )}
    >
      <Field label={t("fsoLimitLabel")} htmlFor={"limit-" + ev.id} error={error || undefined}>
        <Input id={"limit-" + ev.id} inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value); setError(""); }} maxLength={6} className="max-w-[10rem]" autoFocus />
      </Field>
    </Dialog>
  );
}

const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// The day-of check: staff read back the name and address, the client signs.
function PickupDialog({ signup, items, onClose, onDone }) {
  const { showToast } = useApp();
  const t = useT();
  const padRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) { setError(t("fsoSignFirst")); return; }
    setSaving(true);
    try {
      const updated = await pickUpFoodSignup(signup.id, pad.toDataURL(), items);
      showToast(t("fsoPickedUpToast").replace("{name}", signupName(signup)));
      onDone(updated);
    } catch (err) {
      console.warn("pickUpFoodSignup failed", err);
      setError(t(err && err.code === "23505" ? "fsoAlreadyPickedUp" : "fsoActionFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("fsoPickupTitle")}
      description={t("fsoPickupDesc")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit, noValidate: true }}
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onClose}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t("fsoConfirmPickup")}</Button>
        </>
      )}
    >
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
        <dt className="text-muted">{t("ffName")}</dt><dd className="m-0 text-section font-semibold">{signupName(signup)}</dd>
        <dt className="text-muted">{t("ffAddress")}</dt><dd className="m-0">{signupAddress(signup)}</dd>
        <dt className="text-muted">{t("ffPhone")}</dt><dd className="m-0 tabular-nums">{signup.phone}</dd>
        {signup.householdSize ? (<><dt className="text-muted">{t("householdSizeLabel")}</dt><dd className="m-0">{signup.householdSize}</dd></>) : null}
      </dl>
      <div className="mt-4">
        <SignaturePad
          ref={padRef}
          label={t("fsoSignPadLabel")}
          placeholder={t("fsoSignPadPlaceholder")}
          onChange={(inked) => { setHasInk(inked); if (inked) setError(""); }}
        />
        <div className="mt-2 flex items-start justify-between gap-3">
          {error ? <p role="alert" className="m-0 text-meta font-semibold text-tone-danger-ink">{error}</p> : <span />}
          {hasInk ? <Button type="button" variant="ghost" size="sm" onClick={() => padRef.current.clear()}>{t("fsoClearSignature")}</Button> : null}
        </div>
      </div>
    </Dialog>
  );
}

function SignupList({ ev, signups, setSignups, onCounts }) {
  const { showToast } = useApp();
  const t = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("waiting");
  const [picking, setPicking] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "undo" | "remove", signup }
  const [busy, setBusy] = useState(false);
  // What the household's pickup log shows: "Thanksgiving Food Distribution".
  const items = eventName(ev);
  const asksSnap = programAsksSnap(ev.program);

  const replaceRow = (row) => setSignups((prev) => prev.map((s) => (s.id === row.id ? row : s)));
  const shown = (signups || [])
    .filter((s) => filter === "all" || (filter === "waiting" ? !s.pickedUpAt : !!s.pickedUpAt))
    .filter((s) => signupMatches(s, query));

  useEffect(() => {
    if (signups) onCounts(signups.length, signups.filter((s) => s.pickedUpAt).length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signups]);

  async function runConfirm() {
    const { kind, signup } = confirm;
    setBusy(true);
    try {
      if (kind === "undo") replaceRow(await undoFoodSignupPickup(signup.id));
      else { await deleteFoodSignup(signup.id); setSignups((prev) => prev.filter((s) => s.id !== signup.id)); }
      setConfirm(null);
    } catch (e) { showToast(t("fsoActionFailed")); }
    finally { setBusy(false); }
  }

  if (signups === null) return <div className="mt-3 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="min-w-0 flex-1 basis-64"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          clearLabel={t("fsoClearSearch")}
          placeholder={t("fsoSearchPlaceholder")}
          aria-label={t("fsoSearchPlaceholder")}
        />
        <SegmentedControl
          label={t("fsoFilterLabel")}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[{ value: "waiting", label: t("fsoFilterWaiting") }, { value: "picked", label: t("fsoFilterPicked") }, { value: "all", label: t("fsoFilterAll") }]}
        />
      </div>

      {shown.length ? (
        <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
          {shown.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <div className="min-w-0 flex-1 basis-60">
                <div className="font-semibold text-card-foreground">{signupName(s)}</div>
                <div className="text-meta text-muted">
                  {signupAddress(s)} · <span className="tabular-nums">{s.phone}</span>
                  {s.householdSize ? " · " + t("fsoHouseholdOf").replace("{n}", s.householdSize) : ""}
                </div>
                {asksSnap && s.hasSnap ? <div className="mt-1"><SnapBadge s={s} /></div> : null}
              </div>
              {s.pickedUpAt ? (
                <div className="flex items-center gap-3">
                  {s.signature ? <img src={s.signature} alt={t("fsoSignatureAlt").replace("{name}", signupName(s))} className="h-8 max-w-[120px] rounded bg-white object-contain" /> : null}
                  <Badge variant="success" dot>{t("fsoPickedUpAt").replace("{time}", timeOf(s.pickedUpAt))}</Badge>
                  <IconButton label={t("fsoUndoPickup").replace("{name}", signupName(s))} size="sm" onClick={() => setConfirm({ kind: "undo", signup: s })}>
                    <Undo2 aria-hidden="true" />
                  </IconButton>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={() => setPicking(s)}><PenLine className="h-4 w-4" aria-hidden="true" />{t("fsoSignInBtn")}</Button>
                  <IconButton label={t("fsoRemoveSignup").replace("{name}", signupName(s))} size="sm" onClick={() => setConfirm({ kind: "remove", signup: s })}>
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          title={t(!signups.length ? "fsoNoSignups" : query ? "fsoNoMatches" : filter === "waiting" ? "fsoAllPickedUp" : "fsoNonePickedUp")}
          description={t(!signups.length ? "fsoNoSignupsHint" : query ? "fsoNoMatchesHint" : filter === "waiting" ? "fsoAllPickedUpHint" : "fsoNonePickedUpHint")}
          className="rounded-control border border-border py-6"
        />
      )}

      {picking ? (
        <PickupDialog
          signup={picking}
          items={items}
          onClose={() => setPicking(null)}
          onDone={(row) => { replaceRow(row); setPicking(null); setQuery(""); }}
        />
      ) : null}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        danger={confirm && confirm.kind === "remove"}
        loading={busy}
        title={t(confirm && confirm.kind === "undo" ? "fsoUndoTitle" : "fsoRemoveTitle")}
        description={t(confirm && confirm.kind === "undo" ? "fsoUndoDesc" : "fsoRemoveDesc")}
        confirmLabel={t(confirm && confirm.kind === "undo" ? "fsoUndoConfirm" : "deleteLabel")}
      />
    </div>
  );
}

function EventRow({ ev, onChanged, onDeleted, buildPdf }) {
  const { showToast } = useApp();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [signups, setSignups] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editLimit, setEditLimit] = useState(false);
  const url = foodSignupUrl(ev);
  const full = !!ev.signupLimit && ev.count >= ev.signupLimit;

  // Load the list when it's opened, and keep it current while open.
  useEffect(() => {
    if (!expanded) return undefined;
    let cancelled = false;
    const load = () => fetchFoodSignups(ev.id).then((rows) => { if (!cancelled) setSignups(rows); });
    load();
    const unsub = subscribeClientsTable("food_signups", load);
    return () => { cancelled = true; unsub(); };
  }, [expanded, ev.id]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(url); showToast(t("fsoLinkCopied")); }
    catch (e) { showToast(url); }
  }
  async function toggleOpen() {
    setBusy("open");
    try { await setFoodSigninEventOpen(ev.id, !ev.isOpen); onChanged(Object.assign({}, ev, { isOpen: !ev.isOpen })); }
    catch (e) { showToast(t("fsoActionFailed")); }
    finally { setBusy(""); }
  }
  async function downloadSheet() {
    setBusy("pdf");
    try {
      const rows = signups || await fetchFoodSignups(ev.id);
      const entries = rows.map((s) => ({
        name: signupName(s), address: signupAddress(s), phone: s.phone, hasSnap: s.hasSnap, wantsSnapHelp: s.wantsSnapHelp, signature: s.signature,
      }));
      const opts = { layout: "sheet", program: ev.program, lang: ev.lang, occasion: ev.occasion, customOccasion: ev.customOccasion, date: ev.date, location: ev.location, pages: 1 };
      const doc = buildPdf(Object.assign({}, opts, { entries }));
      if (doc) doc.save(pdfFileName(opts).replace(/\.pdf$/, "-signed.pdf"));
    } finally { setBusy(""); }
  }
  async function removeEvent() {
    setBusy("delete");
    try { await deleteFoodSigninEvent(ev.id); onDeleted(ev.id); }
    catch (e) { showToast(t("fsoActionFailed")); setBusy(""); }
  }

  const meta = [ev.date ? fmtDateLong(ev.date) : "", ev.location].filter(Boolean).join(" · ");

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui font-semibold text-card-foreground">{formTitle(ev.occasion, ev.customOccasion, "en")}</span>
            <Badge variant="info">{PROGRAM_LABEL[ev.program] || ev.program}</Badge>
            <Badge variant={ev.isOpen && !full ? "success" : "neutral"} dot>{t(!ev.isOpen ? "fsoSignupClosed" : full ? "fsoFull" : "fsoSignupOpen")}</Badge>
          </div>
          <div className="mt-0.5 text-meta tabular-nums text-muted">
            {meta ? meta + " · " : ""}
            {ev.signupLimit
              ? t("fsoCountsLimit").replace("{n}", ev.count).replace("{limit}", ev.signupLimit).replace("{m}", ev.pickedUp)
              : t("fsoCounts").replace("{n}", ev.count).replace("{m}", ev.pickedUp)}
          </div>
          <div className="mt-1 break-all text-meta text-muted">{url}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <IconButton label={t("fsoCopyLink")} variant="secondary" onClick={copyLink}><Copy className="h-4 w-4" aria-hidden="true" /></IconButton>
          <IconButton label={t("fsoOpenLink")} variant="secondary" onClick={() => window.open(url, "_blank", "noopener")}><ExternalLink className="h-4 w-4" aria-hidden="true" /></IconButton>
          <IconButton label={t("fsoShowQr")} variant="secondary" aria-pressed={showQr} onClick={() => setShowQr((v) => !v)}><QrCode className="h-4 w-4" aria-hidden="true" /></IconButton>
          <IconButton label={t("fsoChangeLimit")} variant="secondary" onClick={() => setEditLimit(true)}><Users className="h-4 w-4" aria-hidden="true" /></IconButton>
          <IconButton label={t(ev.isOpen ? "fsoCloseBtn" : "fsoReopenBtn")} variant="secondary" onClick={toggleOpen} disabled={busy === "open"}>
            {ev.isOpen ? <Lock className="h-4 w-4" aria-hidden="true" /> : <LockOpen className="h-4 w-4" aria-hidden="true" />}
          </IconButton>
          <IconButton label={t("fsoDeleteEvent")} variant="secondary" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /></IconButton>
        </div>
      </div>

      {showQr ? (
        <div className="qr-plate mt-3 inline-flex flex-col items-center gap-2 rounded-surface border border-border bg-white p-4">
          <img src={qrSrc(url)} alt={t("fsoQrAlt")} className="h-[200px] w-[200px]" />
          <span className="max-w-[220px] text-center text-meta text-slate-600">{t("fsoQrHint")}</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={expanded ? "secondary" : "primary"} size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          {t(expanded ? "fsoHideList" : "fsoShowList")}
        </Button>
        <Button variant="secondary" size="sm" onClick={downloadSheet} loading={busy === "pdf"} disabled={!ev.count}>
          <FileDown className="h-4 w-4" aria-hidden="true" />{t("fsoDownloadFilled")}
        </Button>
      </div>

      {expanded ? (
        <SignupList
          ev={ev}
          signups={signups}
          setSignups={setSignups}
          onCounts={(count, pickedUp) => { if (count !== ev.count || pickedUp !== ev.pickedUp) onChanged(Object.assign({}, ev, { count, pickedUp })); }}
        />
      ) : null}

      {editLimit ? (
        <LimitDialog
          ev={ev}
          onClose={() => setEditLimit(false)}
          onSaved={(limit) => { setEditLimit(false); onChanged(Object.assign({}, ev, { signupLimit: limit })); }}
        />
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeEvent}
        danger
        loading={busy === "delete"}
        title={t("fsoDeleteEventTitle")}
        description={t("fsoDeleteEventDesc")}
        confirmLabel={t("deleteLabel")}
      />
    </li>
  );
}

export default function FoodOnlineSignins({ formOpts, buildPdf }) {
  const { showToast } = useApp();
  const t = useT();
  const [events, setEvents] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetchFoodSigninEvents().then((rows) => { if (!cancelled) setEvents(rows); });
    load();
    // Counts tick up as clients sign up and pick up.
    const unsub = subscribeClientsTable("food_signups", load);
    return () => { cancelled = true; unsub(); };
  }, []);

  async function create() {
    if (formOpts.signupLimit === undefined) { showToast(t("fsoLimitInvalid")); return; }
    setCreating(true);
    try {
      const ev = await createFoodSigninEvent(formOpts);
      setEvents((prev) => [ev].concat(prev || []));
      showToast(t("fsoCreated"));
    } catch (e) {
      console.warn("createFoodSigninEvent failed", e);
      showToast(t("fsoActionFailed"));
    } finally {
      setCreating(false);
    }
  }

  const replace = (ev) => setEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
  const remove = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));

  return (
    <SectionCard
      title={t("fsoTitle")}
      description={t("fsoDesc").replace("{title}", eventName(formOpts))}
      action={<Button onClick={create} loading={creating}><Globe className="h-4 w-4" aria-hidden="true" />{t("fsoCreateBtn")}</Button>}
    >
      {events === null ? (
        <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : events.length ? (
        <ul className="m-0 list-none divide-y divide-line-subtle p-0">
          {events.map((ev) => <EventRow key={ev.id} ev={ev} onChanged={replace} onDeleted={remove} buildPdf={buildPdf} />)}
        </ul>
      ) : (
        <EmptyState compact icon={Globe} title={t("fsoEmptyTitle")} description={t("fsoEmptyHint")} className="py-6" />
      )}
    </SectionCard>
  );
}
