// Users.jsx -- Administrator's staff-account management screen, redesigned
// as a Tailwind/shadcn CRM-style table (same idiom as the Search.jsx/
// Dashboard.jsx redesign pass) on top of the Phase 3 Supabase-backed data:
// reads the real `profiles` table live (via AppContext's `data.profiles`)
// instead of a hand-synced local mirror.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronDown, Filter, Lock, Mail, Pencil, Shield, ShieldCheck, Trash2, User, UserPlus, Users as UsersIcon, XCircle } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { ROLES } from "../lib/constants.js";
import { paginateList } from "../lib/pagination.js";
import { roleLabel } from "../lib/utils.js";
import { signUpStaff, updateProfile } from "../lib/supabaseAuth.js";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700"
];
function avatarColorFor(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initialsOfName(name, email) {
  const src = (name || "").trim() || email || "";
  const parts = src.split(/\s+/).filter(Boolean);
  if (!name) return src.slice(0, 2).toUpperCase();
  return ((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "");
}

export default function Users() {
  const { data, lang, session, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES[0]);

  const currentEmail = (session && session.currentUserEmail || "").toLowerCase();

  let list = (data.profiles || []).slice();
  if (statusFilter === "active") list = list.filter((u) => u.active !== false);
  if (statusFilter === "inactive") list = list.filter((u) => u.active === false);

  const paged = paginateList(list, page, pageSize);
  const totalCount = (data.profiles || []).length;

  async function toggleActive(u) {
    await updateProfile(u.id, { active: u.active === false }).catch(() => { showToast(t("userActionError")); });
  }

  // Deactivates rather than deletes the Supabase Auth account -- actually
  // deleting an auth user needs the Admin API (service-role key), which is
  // out of scope for this client-side app. Deactivating in `profiles` is
  // enough: StaffLogin.jsx refuses to sign in an inactive profile. (There's
  // no local mirror row left to remove -- the realtime subscription on
  // `profiles` picks the change up on its own.)
  async function deleteUser(u) {
    if (u.email.toLowerCase() === currentEmail) { showToast(t("cannotDeleteSelf")); return; }
    await updateProfile(u.id, { active: false }).catch(() => { showToast(t("userActionError")); });
  }

  // Self-service supabase.auth.signUp() doesn't need admin/service-role
  // privileges, but it does mean this browser session switches to the new
  // account once it succeeds -- there's no way to create another user's
  // login from an authenticated session without that API. So this hands the
  // temp password to the admin, then sends them back to sign back in as
  // themselves once they're done sharing it.
  async function addUser() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { showToast(t("invalidEmail")); return; }
    if (!password) { showToast(t("fixErrors")); return; }
    const exists = (data.profiles || []).some((u) => u.email.toLowerCase() === trimmedEmail);
    if (exists) { showToast(t("duplicateEmail")); return; }
    const { error } = await signUpStaff(trimmedEmail, password, trimmedName, role);
    if (error) { showToast(error.message || t("fixErrors")); return; }
    setName(""); setEmail(""); setPassword(""); setRole(ROLES[0]);
    showToast(t("newUserCreatedSignInAgain"));
    navigate("/staff-login");
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="mb-1">{t("manageUsersTitle")}</h1>
        <p className="m-0 text-sm text-muted">{t("manageUsersSubtitle")}</p>
      </div>

      <div className="info-callout mb-5">
        <ShieldCheck className="icon h-5 w-5" />
        <p>{t("passwordAuthCaution")}</p>
      </div>

      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
                <UsersIcon className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-base font-bold text-card-foreground">{t("staffMembersCardTitle")}</h3>
                <Badge>{totalCount} {t("totalSuffixLabel")}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  aria-label={t("statusLabel")}
                  className="h-10 min-h-0 appearance-none rounded-lg border border-border bg-card py-2 pl-9 pr-8 text-sm font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">{t("allStatuses")}</option>
                  <option value="active">{t("activeLabel")}</option>
                  <option value="inactive">{t("inactiveLabel")}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
              <Button
                size="lg" className="gap-2"
                onClick={() => {
                  const el = document.getElementById("add-staff-name");
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  el?.focus();
                }}
              >
                <UserPlus className="h-4 w-4" /> {t("sectionNewAccount")}
              </Button>
            </div>
          </div>

          {!paged.items.length ? (
            <EmptyState icon="users" message={t("noUsersYet")} />
          ) : (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]">{t("staffMember")}</th>
                    <th className="bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]">{t("emailAddressCol")}</th>
                    <th className="bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]">{t("roleColLabel")}</th>
                    <th className="bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]">{t("statusLabel")}</th>
                    <th className="bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]">{t("actionsCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((u) => {
                    const isSelf = u.email.toLowerCase() === currentEmail;
                    const isActive = u.active !== false;
                    return (
                      <tr key={u.id} className="border-t border-border transition-colors hover:bg-background">
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className={avatarColorFor(u.name || u.email)}>{initialsOfName(u.name, u.email)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-card-foreground">{u.name || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-middle text-card-foreground">{u.email}</td>
                        <td className="px-4 py-3.5 align-middle">
                          <Badge variant="success">{roleLabel(u.role, lang)}</Badge>
                          {isSelf && <Badge variant="default" className="ml-1.5">{t("thisIsYou")}</Badge>}
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          {isActive
                            ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />{t("activeLabel")}</Badge>
                            : <Badge variant="neutral" className="gap-1"><XCircle className="h-3 w-3" />{t("inactiveLabel")}</Badge>}
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button" title={t("toggleStatusLabel")} disabled={isSelf}
                              onClick={() => toggleActive(u)}
                              className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border border-border bg-card p-0 text-muted transition-colors hover:bg-background hover:text-card-foreground disabled:pointer-events-none disabled:opacity-40"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button" title={t("deleteLabel")} disabled={isSelf}
                              onClick={() => deleteUser(u)}
                              className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border border-border bg-card p-0 text-accent transition-colors hover:bg-tint-danger disabled:pointer-events-none disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelUsers")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="m-0 text-base font-bold text-card-foreground">{t("sectionNewAccount")}</h3>
              <p className="m-0 text-sm text-muted">{t("sectionNewAccountDesc")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="add-staff-name" type="text" placeholder={t("userNamePlaceholder")} aria-label={t("userNamePlaceholder")}
                value={name} onChange={(e) => setName(e.target.value)}
                className="h-11 min-h-0 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="email" placeholder={t("userEmailPlaceholder")} aria-label={t("userEmailPlaceholder")}
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 min-h-0 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text" placeholder={t("userPasswordPlaceholder")} aria-label={t("userPasswordPlaceholder")}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-11 min-h-0 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div className="relative">
              <Shield className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <select
                aria-label={t("userRoleFieldLabel")} value={role} onChange={(e) => setRole(e.target.value)}
                className="h-11 min-h-0 w-full appearance-none rounded-lg border border-border bg-background pl-10 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </div>
          <Button size="lg" className="mt-4 gap-2" onClick={addUser}>
            <UserPlus className="h-4 w-4" /> {t("addUser")}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
