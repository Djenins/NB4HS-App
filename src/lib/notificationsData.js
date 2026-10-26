// notificationsData.js -- Supabase CRUD for the `notifications` table.
// Rows are inserted server-side (the notify_appointment_assignment trigger,
// the SNAP reminder job, the staff report RPCs); the client only ever
// reads/marks-read. `link` is an in-app path the row opens, when it has one.
import { supabase } from "./supabase.js";

function notificationFromRow(row) {
  return {
    id: row.id, userId: row.user_id, appointmentId: row.appointment_id,
    type: row.type, title: row.title || "", message: row.message || "", link: row.link || null,
    read: !!row.read, createdAt: row.created_at
  };
}

export async function fetchNotifications(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("notifications").select("*")
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (error) { console.warn("fetchNotifications failed", error); return []; }
  return data.map(notificationFromRow);
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  if (error) throw error;
}

export function subscribeNotifications(userId, onChange) {
  const channel = supabase
    .channel("notifications-" + userId + "-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
