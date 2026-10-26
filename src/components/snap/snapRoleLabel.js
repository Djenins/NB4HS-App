// snapRoleLabel.js -- i18n key for a SNAP program role (program_staff.program_role),
// shared by the module's overview and staff settings.
var KEYS = { worker: "snapRoleWorker", supervisor: "snapRoleSupervisor", program_admin: "snapRoleProgramAdmin" };

export function snapRoleLabelKey(programRole) {
  return KEYS[programRole] || "snapRoleNone";
}
