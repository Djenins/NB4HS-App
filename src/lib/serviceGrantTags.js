// serviceGrantTags.js -- CRUD over the generic `service_grant_tags` join
// table, which lets any service-producing record (a visit, a case note,
// etc.) be attributed to a grant for funder reporting without adding a
// grant_id column to every program table. UI only ever needs one grant per
// record today, so setRecordGrantTag replaces whatever tag a record has
// rather than accumulating a list.
import { supabase } from "./supabase.js";

export async function fetchGrantTagsForRecords(recordTable, recordIds) {
  if (!recordIds.length) return {};
  const { data, error } = await supabase
    .from("service_grant_tags")
    .select("record_id, grant_id")
    .eq("record_table", recordTable)
    .in("record_id", recordIds);
  if (error) { console.warn("fetchGrantTagsForRecords failed", error); return {}; }
  const map = {};
  data.forEach((row) => { map[row.record_id] = row.grant_id; });
  return map;
}

// Case notes are privacy-restricted (RLS: case_manager/administrator only,
// see case_client_notes) and aren't part of the global AppContext `data`
// blob the way visits are, so reporting needs its own date-range lookup
// here rather than reusing something already in memory.
export async function fetchCaseNoteIdsInRange(from, to) {
  const { data, error } = await supabase.from("case_client_notes").select("id").gte("note_date", from).lte("note_date", to);
  if (error) { console.warn("fetchCaseNoteIdsInRange failed", error); return []; }
  return data.map((r) => r.id);
}

export async function setRecordGrantTag(recordTable, recordId, grantId) {
  const { error: delErr } = await supabase
    .from("service_grant_tags")
    .delete()
    .eq("record_table", recordTable)
    .eq("record_id", recordId);
  if (delErr) throw delErr;
  if (!grantId) return;
  const { error } = await supabase
    .from("service_grant_tags")
    .insert({ record_table: recordTable, record_id: recordId, grant_id: grantId });
  if (error) throw error;
}
