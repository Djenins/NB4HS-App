// CheckOut.jsx -- ported from checkin_checkout.js's renderCheckOut()/
// renderCheckoutResults()/wireCheckoutButtons(). The search box's value used
// to live on App.state.searchFilters.checkoutQ (global) -- it's local
// component state here instead, since nothing outside this page ever read it.
// Tailwind/shadcn redesign pass (client-provided "Client Check-Out" mockup),
// same idiom as Search.jsx/Students.jsx -- the filtering/checkout logic
// below is unchanged, only the presentation layer changed.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, CheckCircle2, Clock, GraduationCap, HelpCircle, History, Info, LogOut, Phone, Search as SearchIcon, X
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { serviceDisplay } from "../lib/students.js";
import { fmtDateLong, fmtDuration, fmtTime, formatPhone, initialsOf, minutesBetween, todayStr } from "../lib/utils.js";
import { checkOutVisit } from "../lib/checkinData.js";
import { avatarColorFor } from "../components/StudentCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip.jsx";

const RECENT_CHECKOUTS_LIMIT = 3;

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
  const { data, lang, kiosk, showToast, refetchVisits } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  let list = data.visits.filter((v) => !v.timeOut);
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

  if (kiosk) {
    return (
      <div className="kiosk-wrap">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary">
            <LogOut className="h-7 w-7" />
          </div>
          <h1 className="mb-1">{t("checkOutTitle")}</h1>
          <p className="m-0 text-base text-muted">{t("checkOutKioskSubtitle")}</p>
        </div>

        {list.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((v) => {
              const name = v.firstName + " " + v.lastName;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selfCheckOut(v.id)}
                  className="flex min-h-[76px] items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:-translate-y-0.5 focus-visible:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  <Avatar className="h-12 w-12 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold text-card-foreground">{name}</div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                      <Clock className="h-3.5 w-3.5" />{t("timeIn")}: {fmtTime(v.timeIn)}
                    </div>
                  </div>
                  <LogOut className="h-5 w-5 shrink-0 text-muted" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="card"><EmptyState icon="search" message={t("noOneFound")} /></div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary">
            <LogOut className="h-6 w-6" />
          </div>
          <div>
            <h1 className="mb-1">{t("checkOutTitle")}</h1>
            <p className="m-0 text-sm text-muted">{t("checkOutSubtitle")}</p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" className="gap-2"><HelpCircle className="h-4 w-4" />{t("howItWorksLabel")}</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-[260px] whitespace-normal text-[13px] font-normal leading-snug">
            {t("howItWorksBody")}
          </TooltipContent>
        </Tooltip>
      </div>

      <Card className="mb-5">
        <CardContent className="p-5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchNameOrPhone")}
                aria-label={t("searchNameOrPhone")}
                className="h-12 min-h-0 w-full rounded-xl border border-border bg-background pl-11 pr-11 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label={t("clearLabel")}
                  className="absolute right-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-tint-neutral hover:text-card-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Button type="submit" size="lg" className="gap-2 sm:w-auto"><SearchIcon className="h-4 w-4" />{t("searchLabel")}</Button>
          </form>
          <p className="mt-2 text-sm text-muted">{t("searchHelperText")}</p>
        </CardContent>
      </Card>

      {list.length ? (
        <div className="mb-5 rounded-2xl border border-success-soft bg-tint-success p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
              <div>
                <div className="font-bold leading-tight text-card-foreground">{t("currentlyCheckedIn")}</div>
                <div className="text-sm text-muted">{t(list.length === 1 ? "checkedInCountSingular" : "checkedInCountPlural").replace("{n}", String(list.length))}</div>
              </div>
            </div>
            <Badge variant="success" className="gap-1.5 py-1"><Clock className="h-3.5 w-3.5" />{t("activeLabel")}</Badge>
          </div>

          <div className="space-y-3">
            {list.map((v) => {
              const name = v.firstName + " " + v.lastName;
              return (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-l-4 border-success bg-card p-4 shadow-card">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-card-foreground">
                        <span className="truncate">{name}</span>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(v.phone)}</span>
                        <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{serviceDisplay(v, data.customServices, lang)}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t("timeIn")}: {fmtTime(v.timeIn)}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{dateLabel(v.date, lang, t)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Button onClick={() => checkOut(v.id)} className="gap-2"><LogOut className="h-4 w-4" />{t("checkOutBtn")}</Button>
                    <p className="mt-1.5 max-w-[170px] text-xs leading-snug text-muted">{t("checkOutHelperText")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="mb-5"><CardContent className="p-5"><EmptyState icon="search" message={t("noOneFound")} /></CardContent></Card>
      )}

      <Card className="mb-5">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted" />
            <CardTitle className="m-0">{t("recentCheckOutsTitle")}</CardTitle>
          </div>
          <Link to="/search" className="text-sm font-semibold text-primary hover:underline">{t("viewAllLabel")}</Link>
        </CardHeader>
        <CardContent className="pt-0">
          {recentCheckouts.length ? (
            <div className="table-wrap">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t("clientLabel")}</th>
                    <th className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t("phoneLabel")}</th>
                    <th className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t("service")}</th>
                    <th className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t("timeIn")}</th>
                    <th className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t("timeOut")}</th>
                    <th className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t("visitLength")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCheckouts.map((v) => {
                    const name = v.firstName + " " + v.lastName;
                    return (
                      <tr key={v.id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                            <span className="font-semibold text-card-foreground">{name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted">{formatPhone(v.phone)}</td>
                        <td className="px-3 py-3 text-muted">{serviceDisplay(v, data.customServices, lang)}</td>
                        <td className="px-3 py-3 text-muted">{fmtTime(v.timeIn)}</td>
                        <td className="px-3 py-3 text-muted">{fmtTime(v.timeOut)}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 font-medium text-success"><Clock className="h-3.5 w-3.5" />{fmtDurationShort(minutesBetween(v.timeIn, v.timeOut))}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="search" message={t("noOneFound")} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-2xl border border-primary-soft bg-primary-tint px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Info className="h-4 w-4" />
        </div>
        <div>
          <div className="font-bold text-card-foreground">{t("needHelpTitle")}</div>
          <p className="m-0 text-sm text-muted">{t("needHelpBody")}</p>
        </div>
      </div>
    </>
  );
}
