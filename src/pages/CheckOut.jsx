// CheckOut.jsx -- ported from checkin_checkout.js's renderCheckOut()/
// renderCheckoutResults()/wireCheckoutButtons(). The search box's value used
// to live on App.state.searchFilters.checkoutQ (global) -- it's local
// component state here instead, since nothing outside this page ever read it.
// Tailwind/shadcn redesign pass (client-provided "Client Check-Out" mockup),
// same idiom as Search.jsx/Students.jsx -- the filtering/checkout logic
// below is unchanged, only the presentation layer changed.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, GraduationCap, HelpCircle, History, Info, LogOut, Phone, Search as SearchIcon, X
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { serviceDisplay } from "../lib/students.js";
import { fmtDateLong, fmtDuration, fmtTime, formatPhone, initialsOf, minutesBetween, todayStr } from "../lib/utils.js";
import { checkOutVisit } from "../lib/checkinData.js";
import { avatarColorFor } from "../components/StudentCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import KioskPageHeader from "../components/kiosk/KioskPageHeader.jsx";
import GuardedLink from "../components/GuardedLink.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip.jsx";

const RECENT_CHECKOUTS_LIMIT = 3;
// Kiosk-scale buttons, matching the confirmation screens' (KioskResult.jsx).
const PRIMARY_BTN = "flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-[14px] bg-primary px-5 text-base font-bold text-primary-foreground shadow-[0_6px_18px_rgba(37,99,235,.24)] transform-none transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const SECONDARY_BTN = "flex min-h-[48px] items-center gap-2 rounded-[14px] border border-border bg-card px-4 text-base font-bold text-navy transform-none transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[color:var(--text)]";
const KIOSK_SEARCH_THRESHOLD = 6; // kiosk shows its name search past this many open visits

// Short "1h 22m" duration format for the Recent Check-Outs table -- separate
// from lib/utils.js's fmtDuration() (which spells out "1 hour 22 minutes"
// for the checkout toast), same short-form idiom Search.jsx's local
// fmtDurationShort() already uses for its own visit-length column.
function fmtDurationShort(mins) {
  if (mins === null || mins === undefined) return "—";
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h <= 0) return m + "m";
  return h + "h " + m + "m";
}

function dateLabel(dateStr, lang, t) {
  if (!dateStr) return "—";
  const long = fmtDateLong(dateStr, lang);
  return dateStr === todayStr() ? t("todayLabel") + ", " + long : long;
}

export default function CheckOut() {
  const { data, lang, kiosk, session, showToast, refetchVisits } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const openVisits = data.visits.filter((v) => !v.timeOut);
  let list = openVisits;
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter((v) => (v.firstName + " " + v.lastName).toLowerCase().indexOf(ql) !== -1 || (v.phone || "").indexOf(ql) !== -1);
  }
  list = list.slice().sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));

  const recentCheckouts = data.visits
    .filter((v) => v.timeOut)
    .slice()
    .sort((a, b) => new Date(b.timeOut) - new Date(a.timeOut))
    .slice(0, RECENT_CHECKOUTS_LIMIT);

  async function checkOut(id) {
    const visit = data.visits.find((v) => v.id === id);
    if (!visit) return;
    const updated = await checkOutVisit(id);
    await refetchVisits();
    const timeOut = (updated && updated.timeOut) || new Date().toISOString();
    const dur = fmtDuration(minutesBetween(visit.timeIn, timeOut), lang);
    showToast(t("checkedOutAt") + " " + fmtTime(timeOut) + " — " + t("visitLength") + ": " + dur);
  }

  // Self-service kiosk flow: clients tap their own name to check out
  // (instead of staff searching for them), then land on
  // CheckOutScanSuccess.jsx -- named for a scan-a-personal-QR-code checkout
  // flow that was removed for being broken (see d5a3c44) and never rebuilt;
  // this tap-your-name flow is the only thing that navigates there now.
  async function selfCheckOut(id) {
    const visit = data.visits.find((v) => v.id === id);
    if (!visit) return;
    const updated = await checkOutVisit(id);
    await refetchVisits();
    const timeOut = (updated && updated.timeOut) || new Date().toISOString();
    const duration = fmtDuration(minutesBetween(visit.timeIn, timeOut), lang);
    const scanResult = { status: "ok", name: visit.firstName + " " + visit.lastName, duration };
    navigate("/checkout/scan-success", { state: { scanResult } });
  }

  // Signed-out = a client on the kiosk or their phone: never the staff view.
  if (kiosk || !session) {
    const showSearch = q || openVisits.length > KIOSK_SEARCH_THRESHOLD;
    return (
      <div className="flex w-full flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col rounded-[22px] sm:border sm:border-border sm:bg-card sm:p-6 sm:shadow-card">
          <KioskPageHeader icon={LogOut} title={t("checkOutTitle")} description={t("checkOutKioskSubtitle")} />

          {/* A busy day can leave dozens of people checked in; past a handful,
              let them type their name instead of scanning the whole list. */}
          {showSearch && (
            <div className="relative mt-5">
              <SearchIcon size={22} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchNameOrPhone")}
                aria-label={t("searchNameOrPhone")}
                className="block min-h-[56px] w-full rounded-[14px] pl-[52px] text-base sm:text-[1.02rem]"
              />
            </div>
          )}

          {list.length ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((v) => {
                const name = v.firstName + " " + v.lastName;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selfCheckOut(v.id)}
                    className="group flex min-h-[80px] items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left font-normal shadow-card transform-none transition-[box-shadow,border-color] duration-150 ease-out hover:border-primary hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    <Avatar className="h-10 w-10 shrink-0 sm:h-12 sm:w-12"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold text-card-foreground sm:text-lg">{name}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted">
                        <Clock className="h-4 w-4" aria-hidden="true" />{t("timeIn")}: {fmtTime(v.timeIn)}
                      </div>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <LogOut className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-border bg-background">
              <EmptyState icon="search" message={q ? t("noOneFound") : t("checkOutKioskEmpty")} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Staff view (sidebar "Check Out"): the same visual family as the kiosk
  // screens -- one framed page, the shared title block, kiosk-scale search --
  // plus the staff-only extras: phone/service details, Recent Check-Outs and
  // "How it works".
  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 rounded-[22px] sm:border sm:border-border sm:bg-card sm:p-6 sm:shadow-card">
        <KioskPageHeader
          icon={LogOut}
          title={t("checkOutTitle")}
          description={t("checkOutSubtitle")}
          actions={
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className={SECONDARY_BTN}>
                  <HelpCircle size={18} strokeWidth={2} aria-hidden="true" className="text-primary" />
                  {t("howItWorksLabel")}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-[260px] whitespace-normal text-[13px] font-normal leading-snug">
                {t("howItWorksBody")}
              </TooltipContent>
            </Tooltip>
          }
        />

        {/* Filters as you type, so there's no separate Search button. */}
        <div>
          <div className="relative">
            <SearchIcon size={22} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchNameOrPhone")}
              aria-label={t("searchNameOrPhone")}
              className="block min-h-[56px] w-full rounded-[14px] pl-[52px] pr-12 text-base sm:text-[1.02rem]"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label={t("clearLabel")}
                className="absolute inset-y-0 right-3 my-auto flex h-9 min-h-0 w-9 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted transform-none hover:bg-tint-neutral hover:text-card-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          <p className="m-0 mt-2 text-sm text-muted">{t("searchHelperText")}</p>
        </div>

        <section aria-labelledby="checkout-current-title">
          <div className="mb-3 flex items-center gap-2.5">
            <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + (openVisits.length ? "bg-success" : "bg-border")} aria-hidden="true" />
            <h2 id="checkout-current-title" className="m-0 text-[1.0625rem] font-extrabold tracking-tight text-navy dark:text-[color:var(--text)] sm:text-[1.15rem]">{t("currentlyCheckedIn")}</h2>
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-bold text-muted">{list.length}</span>
          </div>
          {list.length ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {list.map((v) => {
                const name = v.firstName + " " + v.lastName;
                return (
                  <div key={v.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
                    <Avatar className="h-10 w-10 shrink-0 sm:h-12 sm:w-12"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold text-card-foreground sm:text-lg">{name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                        <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" aria-hidden="true" />{formatPhone(v.phone) || "—"}</span>
                        <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4" aria-hidden="true" />{serviceDisplay(v, data.customServices, lang)}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden="true" />{t("timeIn")}: {fmtTime(v.timeIn)}</span>
                        <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden="true" />{dateLabel(v.date, lang, t)}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => checkOut(v.id)} className={PRIMARY_BTN} title={t("checkOutHelperText")}>
                      <LogOut size={18} strokeWidth={2.2} aria-hidden="true" />
                      {t("checkOutBtn")}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background">
              <EmptyState icon="search" message={q ? t("noOneFound") : t("checkOutKioskEmpty")} />
            </div>
          )}
        </section>

        <section aria-labelledby="checkout-recent-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 id="checkout-recent-title" className="m-0 text-[1.0625rem] font-extrabold tracking-tight text-navy dark:text-[color:var(--text)] sm:text-[1.15rem]">{t("recentCheckOutsTitle")}</h2>
            </div>
            <GuardedLink to="/search" routeKey="search" className="text-sm font-semibold text-primary hover:underline">{t("viewAllLabel")}</GuardedLink>
          </div>
          {recentCheckouts.length ? (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["clientLabel", "phoneLabel", "service", "timeIn", "timeOut", "visitLength"].map((k) => (
                      <th key={k} className="border-b border-border bg-background px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCheckouts.map((v) => {
                    const name = v.firstName + " " + v.lastName;
                    return (
                      <tr key={v.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                            <span className="font-semibold text-card-foreground">{name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatPhone(v.phone)}</td>
                        <td className="px-4 py-3 text-muted">{serviceDisplay(v, data.customServices, lang)}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{fmtTime(v.timeIn)}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{fmtTime(v.timeOut)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 font-medium tabular-nums text-success"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{fmtDurationShort(minutesBetween(v.timeIn, v.timeOut))}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background">
              <EmptyState icon="search" message={t("noOneFound")} />
            </div>
          )}
        </section>

        {/* Same pale-blue help strip as the bottom of the kiosk forms. */}
        <aside className="flex items-start gap-3 rounded-[18px] bg-[#F1F6FE] p-4 dark:bg-background sm:gap-4 sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-12 sm:w-12">
            <Info size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[1.05rem] font-extrabold text-navy dark:text-[color:var(--text)] sm:text-[1.15rem]">{t("needHelpTitle")}</p>
            <p className="m-0 mt-1 max-w-[70ch] text-[0.95rem] leading-snug text-muted">{t("needHelpBody")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
