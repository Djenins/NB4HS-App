// outreachPrograms.js -- the Outreach Management module's program registry
// (`programs`), per-program option lists (`program_option_sets`) and the
// pure rules for which programs and sections someone sees
// (outreach_o1_programs_and_options migration). SNAP is the first program;
// another one is rows in those tables, not new code paths.
//
// RLS is the real control; these helpers only decide what to *show*.
import { supabase } from "./supabase.js";
import { PROGRAM_ROLES, canManageProgram } from "./programStaff.js";

// Module sections, in display order. `members` = shown to anyone holding a
// role in the program; `managers` = shown to whoever can grant its roles;
// `feature` = shown only when the program has that workflow switched on
// (programs.features). Later phases add sections here as they're built.
export var OUTREACH_SECTIONS = [
  { key: "dashboard", members: true },
  { key: "contacts", members: true, feature: "contacts" },
  { key: "cases", members: true, feature: "cases" },
  { key: "tasks", members: true, feature: "tasks" },
  { key: "staff", managers: true }
];

// Which sections of one program this person sees. Empty means no access.
export function outreachSectionsFor(systemRole, programRole, features) {
  var member = PROGRAM_ROLES.indexOf(programRole) !== -1;
  var manager = canManageProgram(systemRole, programRole);
  return OUTREACH_SECTIONS
    .filter(function (s) { return !s.feature || (features || []).indexOf(s.feature) !== -1; })
    .filter(function (s) { return (s.members && member) || (s.managers && manager); })
    .map(function (s) { return s.key; });
}

// Whether the sidebar shows Outreach at all: administrators (they manage
// program staff) and anyone holding a role in any program.
// program_staff also carries roles for programs outside Outreach (Staff
// Reports' reviewers); those don't open the Outreach module.
export var NON_OUTREACH_PROGRAMS = ["staff_reports"];

export function hasOutreachAccess(systemRole, programRoles) {
  return systemRole === "administrator" || Object.keys(programRoles || {}).some(function (k) {
    return !!programRoles[k] && NON_OUTREACH_PROGRAMS.indexOf(k) === -1;
  });
}

// The active programs this person can open: all of them for administrators,
// otherwise the ones they hold a role in. Registry order is kept.
export function programsVisibleTo(programs, systemRole, programRoles) {
  return (programs || []).filter(function (p) {
    return p.active && (systemRole === "administrator" || !!(programRoles || {})[p.key]);
  });
}

export function programName(program, lang) {
  if (!program) return "";
  return program.names[lang] || program.names.en;
}

// The program's own "what we do / don't do" note, or "" when it has none.
export function programScopeNote(program, lang) {
  if (!program || !program.scopeNotes) return "";
  return program.scopeNotes[lang] || program.scopeNotes.en || "";
}

// One option list (e.g. "assistance_type") in display order: the active
// options, plus any retired ones in `keepKeys` so a record that already
// uses one still shows it.
export function optionsFor(options, setKey, keepKeys) {
  var keep = keepKeys || [];
  return (options || [])
    .filter(function (o) { return o.setKey === setKey && (o.active || keep.indexOf(o.key) !== -1); })
    .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
}

export function optionLabel(options, setKey, key, lang) {
  var o = (options || []).find(function (x) { return x.setKey === setKey && x.key === key; });
  return o ? (o.labels[lang] || o.labels.en) : key;
}

// ---------- data ----------

function programFromRow(row) {
  return {
    key: row.key, module: row.module, names: { en: row.name_en, ht: row.name_ht, fr: row.name_fr },
    caseNumberPrefix: row.case_number_prefix, features: row.features || [], active: row.active,
    scopeNotes: { en: row.scope_note_en || "", ht: row.scope_note_ht || "", fr: row.scope_note_fr || "" }
  };
}

function optionFromRow(row) {
  return {
    id: row.id, setKey: row.set_key, key: row.key, labels: { en: row.label_en, ht: row.label_ht, fr: row.label_fr },
    sortOrder: row.sort_order, active: row.active
  };
}

export async function fetchOutreachPrograms() {
  const { data, error } = await supabase.from("programs").select("*").eq("module", "outreach").order("created_at");
  if (error) throw error;
  return data.map(programFromRow);
}

export async function fetchProgramOptions(program) {
  const { data, error } = await supabase.from("program_option_sets").select("*").eq("program", program).order("sort_order");
  if (error) throw error;
  return data.map(optionFromRow);
}
