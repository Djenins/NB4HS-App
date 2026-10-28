// NotificationBell.jsx -- staff-facing bell in Shell's topbar/sidebar. Lists
// this signed-in user's `notifications` rows (populated by the DB's
// notify_appointment_assignment trigger whenever an appointment is
// assigned/reassigned to them), each linked back to its appointment so the
// staff member can approve, cancel, or reschedule right from the panel.
// Rows with a `link` (staff report submitted / sent back / acknowledged)
// open that page instead.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronRight, X } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useApp, useT } from "../context/AppContext.jsx";
import { updateAppointment, updateAppointmentStatus } from "../lib/clientsData.js";
import { fmtDateLong } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import { Button } from "./ui/button.jsx";

function RescheduleForm({ appt, onDone }) {
  const t = useT();
  const [date, setDate] = useState(appt.date || "");
  const [time, setTime] = useState(appt.time || "");

  async function save(e) {
    e.stopPropagation();
    await updateAppointment(appt.id, { date, time, status: "scheduled" });
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-2" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 min-h-0 w-full rounded-md border border-border bg-card px-2 text-xs" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-8 min-h-0 w-full rounded-md border border-border bg-card px-2 text-xs" />
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" onClick={save}>{t("saveRescheduleBtn")}</Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onDone(); }}>{t("cancelRescheduleBtn")}</Button>
      </div>
    </div>
  );
}

// Server-written notifications store English text; show known types' titles
// in the reader's language.
export const TYPE_TITLE = {
  snap_task_due: "snapNotifTaskDue",
  task_overdue: "taskNotifOverdue",
  staff_report_submitted: "srNotifSubmitted",
  staff_report_revision_requested: "srNotifRevision",
  staff_report_acknowledged: "srNotifAcknowledged",
  staff_report_due: "srNotifDue",
  staff_report_overdue: "srNotifOverdue",
  staff_report_overdue_digest: "srNotifOverdueDigest"
};

function NotificationRow({ n, appt, onApprove, onCancel, onOpen }) {
  const t = useT();
  const { lang } = useApp();
  const [rescheduling, setRescheduling] = useState(false);

  const title = TYPE_TITLE[n.type] ? t(TYPE_TITLE[n.type]) : n.title;
  if (n.link) {
    return (
      <DropdownMenuPrimitive.Item asChild onSelect={() => onOpen(n.link)}>
        <button type="button"
          className={cn("flex min-h-0 w-full items-center gap-2 rounded-none border-0 border-b border-border px-3 py-2.5 text-left font-normal transform-none last:border-0 hover:bg-background focus:bg-background focus:outline-none", n.read ? "bg-transparent" : "bg-primary-tint")}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-card-foreground">{title}</span>
            <span className="mt-0.5 block text-xs text-muted">{n.message}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </button>
      </DropdownMenuPrimitive.Item>
    );
  }

  return (
    <div className={cn("border-b border-border px-3 py-2.5 last:border-0", !n.read && "bg-primary-tint")}>
      <div className="text-sm font-semibold text-card-foreground">{title}</div>
      <div className="mt-0.5 text-xs text-muted">{n.message}</div>
      {appt && (
        <>
          <div className="mt-1 text-xs text-muted">
            {fmtDateLong(appt.date, lang)}{appt.time ? " · " + appt.time : ""}
          </div>
          {!rescheduling && (appt.status === "requested" || appt.status === "scheduled") && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {appt.status === "requested" && (
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onApprove(appt.id); }}>
                  <Check className="h-3.5 w-3.5" /> {t("confirmApptBtn")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setRescheduling(true); }}>
                {t("rescheduleApptBtn")}
              </Button>
              <Button size="sm" variant="ghost" className="text-accent hover:bg-tint-danger" onClick={(e) => { e.stopPropagation(); onCancel(appt.id); }}>
                <X className="h-3.5 w-3.5" /> {t("cancelApptBtn")}
              </Button>
            </div>
          )}
          {rescheduling && <RescheduleForm appt={appt} onDone={() => setRescheduling(false)} />}
        </>
      )}
    </div>
  );
}

// `className` restyles the trigger for its host (the sidebar footer passes
// theme-aware colours); `side` places the panel.
export default function NotificationBell({ className, side = "bottom" }) {
  const { data, notifications, markNotifRead, markAllNotifsRead, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function approve(id) {
    await updateAppointmentStatus(id, "scheduled");
    showToast(t("notificationApptApproved"));
  }
  async function cancel(id) {
    const ok = await requestConfirm(t("apptCancelConfirm"), { danger: true });
    if (ok) await updateAppointmentStatus(id, "cancelled");
  }

  return (
    <DropdownMenuPrimitive.Root onOpenChange={(open) => { if (open) notifications.filter((n) => !n.read).forEach((n) => markNotifRead(n.id)); }}>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={t("notificationsAriaLabel")}
          className={cn("relative flex h-9 min-h-0 w-9 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-inherit hover:bg-white/5", className)}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          sideOffset={8}
          side={side}
          align="end"
          className="z-[1300] max-h-[70vh] w-[340px] overflow-y-auto rounded-lg border border-border bg-card text-card-foreground shadow-card-hover animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-bold">{t("notificationsTitle")}</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllNotifsRead} className="min-h-0 border-0 bg-transparent p-0 text-xs font-semibold text-primary hover:underline">
                {t("notificationsMarkAllRead")}
              </button>
            )}
          </div>
          {notifications.length ? (
            notifications.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                appt={(data.appointments || []).find((a) => a.id === n.appointmentId)}
                onApprove={approve}
                onCancel={cancel}
                onOpen={(link) => navigate(link)}
              />
            ))
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted">{t("notificationsEmpty")}</div>
          )}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
