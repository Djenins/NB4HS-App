// Admin.jsx -- the Administration area (plans/unified-access-architecture.md
// §6, Phases 2 and 5): staff accounts, roles and positions, programs and
// modules, and the access audit log, one ModuleNav strip like
// StaffReports.jsx. Unlike the rest of the app it is gated by the new
// permissions (my_permissions()), not by profiles.role -- today's
// administrators hold them through their legacy role, so nothing changes for
// them. /admin/users/:id is one person's account; /admin/roles/:id one role.
//
// The old /users URL redirects here (App.jsx).
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { BriefcaseBusiness, Boxes, ScrollText, ShieldCheck, Users as UsersIcon } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import ModuleNav from "../components/ModuleNav.jsx";
import AdminUsers from "../components/admin/AdminUsers.jsx";
import AdminUserProfile from "../components/admin/AdminUserProfile.jsx";
import AdminRoles from "../components/admin/AdminRoles.jsx";
import AdminRoleDetail from "../components/admin/AdminRoleDetail.jsx";
import AdminPositions from "../components/admin/AdminPositions.jsx";
import AdminPrograms from "../components/admin/AdminPrograms.jsx";
import AdminAudit from "../components/admin/AdminAudit.jsx";

const SECTIONS = {
  users: { label: "adminSectionUsers", icon: UsersIcon, permission: "admin.users.view" },
  roles: { label: "adminSectionRoles", icon: ShieldCheck, permission: "admin.roles.view" },
  positions: { label: "adminSectionPositions", icon: BriefcaseBusiness, permission: "admin.positions.manage" },
  programs: { label: "adminSectionPrograms", icon: Boxes, permission: "admin.programs.manage" },
  audit: { label: "adminSectionAudit", icon: ScrollText, permission: "admin.audit.view" }
};
const ORDER = ["users", "roles", "positions", "programs", "audit"];

// Which sections a permission list opens, in display order.
export function adminSectionsFor(can) {
  return ORDER.filter((key) => can(SECTIONS[key].permission));
}

export default function Admin() {
  const { section, id } = useParams();
  const navigate = useNavigate();
  const { authLoading, permissionsLoaded, can } = useApp();
  const t = useT();

  if (authLoading || !permissionsLoaded) return null;
  const visible = adminSectionsFor(can);
  if (!visible.length) return <Navigate to="/dashboard" replace />;
  if (!section || visible.indexOf(section) === -1) return <Navigate to={"/admin/" + visible[0]} replace />;

  let body;
  if (section === "users") body = id ? <AdminUserProfile userId={id} /> : <AdminUsers />;
  else if (section === "roles") body = id ? <AdminRoleDetail roleId={id} /> : <AdminRoles />;
  else if (section === "programs") body = <AdminPrograms />;
  else if (section === "audit") body = <AdminAudit />;
  else body = <AdminPositions />;

  return (
    <>
      <ModuleNav
        label={t("adminAreaLabel")}
        items={visible.map((key) => ({ key, label: t(SECTIONS[key].label), icon: SECTIONS[key].icon }))}
        value={section}
        onChange={(key) => navigate("/admin/" + key)}
      />
      {body}
    </>
  );
}
