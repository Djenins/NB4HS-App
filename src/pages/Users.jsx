// Users.jsx -- Administrator's staff-account management screen. Phase 3 of
// the Supabase migration: reads the real `profiles` table live (via
// AppContext's `data.profiles`, fetched + realtime-subscribed the same way
// as the Phase 2 client lists) instead of a hand-synced local mirror --
// the mirror only ever existed so the Case Management/Job Developer
// "assign to staff member" pickers had something to read before `profiles`
// was wired into AppContext; both now read `data.profiles` directly too
// (see CaseManagement.jsx/JobDeveloper.jsx).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { ROLES } from "../lib/constants.js";
import { paginateList } from "../lib/pagination.js";
import { roleLabel } from "../lib/utils.js";
import { signUpStaff, updateProfile } from "../lib/supabaseAuth.js";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";

export default function Users() {
  const { data, lang, session, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES[0]);

  const paged = paginateList(data.profiles || [], page, pageSize);
  const currentEmail = (session && session.currentUserEmail || "").toLowerCase();

  async function toggleActive(id, checked) {
    await updateProfile(id, { active: checked }).catch(() => {});
  }

  // Deactivates rather than deletes the Supabase Auth account -- actually
  // deleting an auth user needs the Admin API (service-role key), which is
  // out of scope for this client-side app. Deactivating in `profiles` is
  // enough: StaffLogin.jsx refuses to sign in an inactive profile. (There's
  // no local mirror row left to remove -- the realtime subscription on
  // `profiles` picks the change up on its own.)
  async function deleteUser(u) {
    if (u.email.toLowerCase() === currentEmail) { showToast(t("cannotDeleteSelf")); return; }
    await updateProfile(u.id, { active: false }).catch(() => {});
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
      <h1>{t("manageUsersTitle")}</h1>
      <div className="card"><p className="muted">{t("passwordAuthCaution")}</p></div>
      <div className="card">
        {paged.items.length ? (
          paged.items.map((u) => {
            const isSelf = u.email.toLowerCase() === currentEmail;
            return (
              <div className="kv" key={u.id}>
                <span>
                  {u.name && <strong>{u.name} </strong>}
                  {u.email} <span className="badge badge-in">{roleLabel(u.role, lang)}</span>
                  {u.active === false && <span className="badge badge-out">{t("inactiveLabel")}</span>}
                  {isSelf && <span className="muted"> ({t("thisIsYou")})</span>}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {!isSelf && (
                    <>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, margin: 0 }}>
                        <input type="checkbox" checked={u.active !== false} onChange={(e) => toggleActive(u.id, e.target.checked)} />
                        {u.active !== false ? t("activeLabel") : t("inactiveLabel")}
                      </label>
                      <button className="btn-ghost btn-sm btn-outline-danger" onClick={() => deleteUser(u)}>{t("deleteLabel")}</button>
                    </>
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <EmptyState icon="users" message={t("noUsersYet")} />
        )}
        <Pagination
          page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelUsers")}
          onChange={(delta) => setPage(paged.page + delta)}
        />

        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionNewAccount")}</h3>
            <p>{t("sectionNewAccountDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-3">
              <div className="field"><input type="text" placeholder={t("userNamePlaceholder")} aria-label={t("userNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="field"><input type="email" placeholder={t("userEmailPlaceholder")} aria-label={t("userEmailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="field"><input type="text" placeholder={t("userPasswordPlaceholder")} aria-label={t("userPasswordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="field">
                <select aria-label={t("userRoleFieldLabel")} value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
                </select>
              </div>
            </div>
            <button className="btn-primary" onClick={addUser}>{t("addUser")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
