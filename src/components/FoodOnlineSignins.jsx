// FoodOnlineSignins.jsx -- the online half of Food Distribution > Sign-in
// Forms. Staff turn the form set up above it (occasion, date, location,
// language) into a public sign-in link + QR code (pages/FoodSignIn.jsx),
// watch sign-ins arrive, close the link when the distribution ends, and
// download everyone who signed as a filled sign-in sheet -- the same PDF as
// the paper one, with each row's typed answers and drawn signature.
// Staff-only screen: English in every language.
import { useEffect, useState } from "react";
import { ChevronDown, Copy, ExternalLink, FileDown, Globe, Lock, LockOpen, QrCode, Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { formTitle, pdfFileName } from "../lib/foodSignInForm.js";
import {
  createFoodSigninEvent, deleteFoodSignin, deleteFoodSigninEvent, fetchFoodSigninEvents, fetchFoodSignins,
  foodSigninUrl, setFoodSigninEventOpen,
} from "../lib/foodSigninData.js";
import { subscribeClientsTable } from "../lib/clientsData.js";
import { cn } from "../lib/cn.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { ConfirmDialog } from "./ui/confirm-dialog.jsx";
import { EmptyState } from "./ui/empty-state.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { SectionCard } from "./ui/section-card.jsx";
import { Skeleton } from "./ui/skeleton.jsx";

function qrSrc(url) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&data=" + encodeURIComponent(url);
}

function EventRow({ ev, onChanged, onDeleted, buildPdf }) {
  const { showToast } = useApp();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [signins, setSignins] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null); // { kind: "event" } | { kind: "signin", id }
  const url = foodSigninUrl(ev.id);

  // Load the list when it's opened, and keep it current while open.
  useEffect(() => {
    if (!expanded) return undefined;
    let cancelled = false;
    const load = () => fetchFoodSignins(ev.id).then((rows) => { if (!cancelled) setSignins(rows); });
    load();
    const unsub = subscribeClientsTable("food_signins", load);
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
  async function downloadFilled() {
    setBusy("pdf");
    try {
      const rows = signins || await fetchFoodSignins(ev.id);
      const opts = { layout: "sheet", lang: ev.lang, occasion: ev.occasion, customOccasion: ev.customOccasion, date: ev.date, location: ev.location, pages: 1 };
      const doc = buildPdf(Object.assign({}, opts, { entries: rows }));
      if (doc) doc.save(pdfFileName(opts).replace(/\.pdf$/, "-signed.pdf"));
    } finally { setBusy(""); }
  }
  async function confirmDelete() {
    const c = confirm;
    setBusy("delete");
    try {
      if (c.kind === "event") { await deleteFoodSigninEvent(ev.id); onDeleted(ev.id); }
      else {
        await deleteFoodSignin(c.id);
        setSignins((prev) => (prev || []).filter((s) => s.id !== c.id));
        onChanged(Object.assign({}, ev, { count: Math.max(0, ev.count - 1) }));
      }
      setConfirm(null);
    } catch (e) { showToast(t("fsoActionFailed")); }
    finally { setBusy(""); }
  }

  const count = signins ? signins.length : ev.count;
  const meta = [ev.date ? fmtDateLong(ev.date) : "", ev.location].filter(Boolean).join(" · ");

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui font-semibold text-card-foreground">{formTitle(ev.occasion, ev.customOccasion, "en")}</span>
            <Badge variant={ev.isOpen ? "success" : "neutral"} dot>{t(ev.isOpen ? "fsoOpen" : "fsoClosed")}</Badge>
          </div>
          <div className="mt-0.5 text-meta tabular-nums text-muted">
            {meta ? meta + " · " : ""}{t("fsoSignedCount").replace("{n}", count)}
          </div>
          <div className="mt-1 break-all text-meta text-muted">{url}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <IconButton label={t("fsoCopyLink")} variant="secondary" onClick={copyLink}><Copy className="h-4 w-4" aria-hidden="true" /></IconButton>
          <IconButton label={t("fsoOpenLink")} variant="secondary" onClick={() => window.open(url, "_blank", "noopener")}><ExternalLink className="h-4 w-4" aria-hidden="true" /></IconButton>
          <IconButton label={t("fsoShowQr")} variant="secondary" aria-pressed={showQr} onClick={() => setShowQr((v) => !v)}><QrCode className="h-4 w-4" aria-hidden="true" /></IconButton>
          <IconButton label={t(ev.isOpen ? "fsoCloseBtn" : "fsoReopenBtn")} variant="secondary" onClick={toggleOpen} disabled={busy === "open"}>
            {ev.isOpen ? <Lock className="h-4 w-4" aria-hidden="true" /> : <LockOpen className="h-4 w-4" aria-hidden="true" />}
          </IconButton>
          <IconButton label={t("fsoDeleteEvent")} variant="secondary" onClick={() => setConfirm({ kind: "event" })}><Trash2 className="h-4 w-4" aria-hidden="true" /></IconButton>
        </div>
      </div>

      {showQr ? (
        <div className="qr-plate mt-3 inline-flex flex-col items-center gap-2 rounded-surface border border-border bg-white p-4">
          <img src={qrSrc(url)} alt={t("fsoQrAlt")} className="h-[200px] w-[200px]" />
          <span className="max-w-[220px] text-center text-meta text-slate-600">{t("fsoQrHint")}</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          {t(expanded ? "fsoHideList" : "fsoShowList")}
        </Button>
        <Button variant="secondary" size="sm" onClick={downloadFilled} loading={busy === "pdf"} disabled={!count}>
          <FileDown className="h-4 w-4" aria-hidden="true" />{t("fsoDownloadFilled")}
        </Button>
      </div>

      {expanded ? (
        <div className="mt-3 overflow-x-auto rounded-control border border-border">
          {signins === null ? (
            <div className="space-y-2 p-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : signins.length ? (
            <table className="w-full min-w-[640px] border-collapse text-left text-meta">
              <thead className="bg-surface-sunken text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">{t("ffName")}</th>
                  <th className="px-3 py-2 font-semibold">{t("ffAddress")}</th>
                  <th className="px-3 py-2 font-semibold">{t("ffPhone")}</th>
                  <th className="px-3 py-2 font-semibold">{t("ffSignature")}</th>
                  <th className="px-3 py-2 font-semibold">{t("fsoTimeCol")}</th>
                  <th className="px-3 py-2"><span className="sr-only">{t("fsoActionsCol")}</span></th>
                </tr>
              </thead>
              <tbody>
                {signins.map((s, i) => (
                  <tr key={s.id} className="border-t border-line-subtle align-middle text-card-foreground">
                    <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2">{s.address || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{s.phone || "—"}</td>
                    <td className="px-3 py-2"><img src={s.signature} alt={t("fsoSignatureAlt").replace("{name}", s.name)} className="h-8 max-w-[140px] rounded bg-white object-contain" /></td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">{new Date(s.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                    <td className="px-3 py-2 text-right">
                      <IconButton label={t("fsoDeleteSignin").replace("{name}", s.name)} variant="ghost" size="sm" onClick={() => setConfirm({ kind: "signin", id: s.id })}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState compact title={t("fsoNoSignins")} description={t("fsoNoSigninsHint")} className="py-6" />
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirmDelete}
        danger
        loading={busy === "delete"}
        title={t(confirm && confirm.kind === "event" ? "fsoDeleteEventTitle" : "fsoDeleteSigninTitle")}
        description={t(confirm && confirm.kind === "event" ? "fsoDeleteEventDesc" : "fsoDeleteSigninDesc")}
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
    // Sign-in counts tick up as clients sign.
    const unsub = subscribeClientsTable("food_signins", load);
    return () => { cancelled = true; unsub(); };
  }, []);

  async function create() {
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
      description={t("fsoDesc").replace("{title}", formTitle(formOpts.occasion, formOpts.customOccasion, "en"))}
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
