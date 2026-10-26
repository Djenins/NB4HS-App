// caseResources.js -- Case Management > Resources: the directory of outside
// agencies and referral partners (case_resources table). Same row-mapper
// shape as clientsData.js.
import { supabase } from "./supabase.js";

export var RESOURCE_CATEGORIES = ["housing", "food", "health", "legal", "immigration", "employment", "education", "financial", "other"];

function resourceFromRow(row) {
  return {
    id: row.id, name: row.name, category: row.category || "other", contactName: row.contact_name || "",
    phone: row.phone || "", email: row.email || "", website: row.website || "", address: row.address || "",
    notes: row.notes || ""
  };
}
function resourceToRow(fields) {
  var blank = function (v) { return v && v.trim() ? v.trim() : null; };
  return {
    name: fields.name.trim(), category: fields.category || "other", contact_name: blank(fields.contactName),
    phone: blank(fields.phone), email: blank(fields.email), website: blank(fields.website),
    address: blank(fields.address), notes: blank(fields.notes)
  };
}

export async function fetchResources() {
  const { data, error } = await supabase.from("case_resources").select("*").order("name");
  if (error) { console.warn("fetchResources failed", error); return []; }
  return data.map(resourceFromRow);
}
export async function createResource(fields) {
  const { data: auth } = await supabase.auth.getUser();
  const row = Object.assign(resourceToRow(fields), { created_by: auth.user ? auth.user.id : null });
  const { data, error } = await supabase.from("case_resources").insert(row).select().single();
  if (error) throw error;
  return resourceFromRow(data);
}
export async function updateResource(id, fields) {
  const row = Object.assign(resourceToRow(fields), { updated_at: new Date().toISOString() });
  const { data, error } = await supabase.from("case_resources").update(row).eq("id", id).select().single();
  if (error) throw error;
  return resourceFromRow(data);
}
export async function deleteResource(id) {
  const { error } = await supabase.from("case_resources").delete().eq("id", id);
  if (error) throw error;
}

// Name, contact, phone, email, address, notes and category label all count.
export function resourceMatchesSearch(r, term, categoryLabel) {
  if (!term) return true;
  return [r.name, r.contactName, r.phone, r.email, r.address, r.notes, categoryLabel]
    .some(function (v) { return (v || "").toLowerCase().indexOf(term) !== -1; });
}
