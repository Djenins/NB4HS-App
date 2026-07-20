// grants.js -- CRUD for the `grants` table (funder/grant records used to tag
// services for grant reporting). Same "map DB row <-> app shape" idiom as
// checkinData.js's classes helpers.
import { supabase } from "./supabase.js";

function grantFromRow(row) {
  return {
    id: row.id, name: row.name, funder: row.funder || "",
    periodStart: row.period_start || "", periodEnd: row.period_end || "",
    active: row.active !== false, createdAt: row.created_at,
  };
}
function grantToRow(fields) {
  const row = {};
  if (fields.name !== undefined) row.name = fields.name;
  if (fields.funder !== undefined) row.funder = fields.funder;
  if (fields.periodStart !== undefined) row.period_start = fields.periodStart || null;
  if (fields.periodEnd !== undefined) row.period_end = fields.periodEnd || null;
  if (fields.active !== undefined) row.active = fields.active;
  return row;
}

export async function fetchGrants() {
  const { data, error } = await supabase.from("grants").select("*").order("name");
  if (error) { console.warn("fetchGrants failed", error); return []; }
  return data.map(grantFromRow);
}
export async function createGrant(fields) {
  const { data, error } = await supabase.from("grants").insert(grantToRow(fields)).select().single();
  if (error) throw error;
  return grantFromRow(data);
}
export async function updateGrant(id, patch) {
  const { data, error } = await supabase.from("grants").update(grantToRow(patch)).eq("id", id).select().single();
  if (error) throw error;
  return grantFromRow(data);
}
export async function deleteGrant(id) {
  const { error } = await supabase.from("grants").delete().eq("id", id);
  if (error) throw error;
}
