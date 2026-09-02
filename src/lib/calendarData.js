// calendarData.js -- Supabase-backed CRUD for the shared calendar's
// "office visit" and "appointment" entries (see migration
// add_calendar_events). Class-schedule blocks are NOT stored here -- they
// come from `data.classes` (already fetched by checkinData.js's
// fetchClasses()) combined with the fixed 9:30-12:30 time window, via
// lib/calendar.js's classBlocksForWeek().
import { supabase } from "./supabase.js";

function calendarEventFromRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title || "",
    personName: row.person_name || "",
    notes: row.notes || "",
    date: row.event_date,
    startTime: row.start_time ? row.start_time.slice(0, 5) : "",
    endTime: row.end_time ? row.end_time.slice(0, 5) : "",
    availability: row.availability || "",
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || ""
  };
}

// Throws on failure rather than returning [] -- the calendar page has to be
// able to tell "this range is empty" apart from "the fetch failed", so it can
// show its error state with a retry instead of a convincingly empty week.
export async function fetchCalendarEvents(startDate, endDate) {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date")
    .order("start_time");
  if (error) throw error;
  return data.map(calendarEventFromRow);
}

export async function createCalendarEvent(fields) {
  const { data: userData } = await supabase.auth.getUser();
  const row = {
    type: fields.type,
    title: fields.title,
    person_name: fields.personName || null,
    notes: fields.notes || null,
    event_date: fields.date,
    start_time: fields.startTime,
    end_time: fields.endTime || null,
    availability: fields.type === "appointment" ? (fields.availability || "busy") : null,
    created_by: userData?.user?.id || null,
    created_by_name: fields.createdByName || null
  };
  const { data, error } = await supabase.from("calendar_events").insert(row).select().single();
  if (error) throw error;
  return calendarEventFromRow(data);
}

export async function deleteCalendarEvent(id) {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCalendarEvent(id, fields) {
  const row = {
    title: fields.title,
    person_name: fields.personName || null,
    notes: fields.notes || null,
    event_date: fields.date,
    start_time: fields.startTime,
    end_time: fields.endTime || null,
    availability: fields.type === "appointment" ? (fields.availability || "busy") : null
  };
  const { data, error } = await supabase.from("calendar_events").update(row).eq("id", id).select().single();
  if (error) throw error;
  return calendarEventFromRow(data);
}

export async function duplicateCalendarEvent(event) {
  return createCalendarEvent({
    type: event.type,
    title: event.title,
    personName: event.personName,
    notes: event.notes,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    availability: event.availability,
    createdByName: event.createdByName
  });
}

export function subscribeCalendarEvents(onChange) {
  const channel = supabase
    .channel("calendar_events-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
