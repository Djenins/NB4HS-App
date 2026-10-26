// programStaff.js -- program-scoped staff roles (the `program_staff` table,
// stage1_program_staff_and_audit migration) plus the pure access rules the
// Outreach module's UI reads (section rules: outreachPrograms.js). RLS is the real control; these helpers
// only decide what to *show*, and mirror has_program_role()/
// can_manage_program() so the two can't drift apart in intent.
//
// A person's program role sits on top of their system role (profiles.role):
// a case manager can also be a SNAP outreach worker. A system administrator
// manages a program's staff but holds no program role unless granted one --
// so they don't see participant data by default.
import { supabase } from "./supabase.js";

export var PROGRAM_ROLES = ["worker", "supervisor", "program_admin"];

export function canManageProgram(systemRole, programRole) {
  return systemRole === "administrator" || programRole === "program_admin";
}

// ---------- data ----------

// The signed-in user's own active program roles, keyed by program: { snap: "worker" }.
export async function fetchMyProgramRoles(userId) {
  if (!userId) return {};
  const { data, error } = await supabase.from("program_staff").select("program, program_role")
    .eq("user_id", userId).eq("active", true);
  if (error) { console.warn("fetchMyProgramRoles failed", error); return {}; }
  return data.reduce((acc, row) => { acc[row.program] = row.program_role; return acc; }, {});
}

// Every membership row for a program (active or not), keyed by user id.
export async function fetchProgramStaff(program) {
  const { data, error } = await supabase.from("program_staff").select("*").eq("program", program);
  if (error) throw error;
  return data.reduce((acc, row) => {
    acc[row.user_id] = { role: row.program_role, active: row.active, updatedAt: row.updated_at };
    return acc;
  }, {});
}

// Grants (or changes) a role, or revokes it when `role` is null. Revoking
// deactivates the row rather than deleting it, so the audit trail and
// "who used to have access" both survive.
export async function setProgramRole(userId, program, role, grantedBy) {
  if (role === null) {
    const { error } = await supabase.from("program_staff").update({ active: false })
      .eq("user_id", userId).eq("program", program);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("program_staff").upsert(
    { user_id: userId, program, program_role: role, active: true, granted_by: grantedBy || null },
    { onConflict: "user_id,program" }
  );
  if (error) throw error;
}
