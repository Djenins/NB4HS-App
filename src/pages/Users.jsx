// Users.jsx -- Administrator's staff-account management screen. Ported
// from users_settings.js's renderUsers()/attachUsersHandlers().
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { ROLES } from "../lib/constants.js";
import { paginateList } from "../lib/pagination.js";
import { roleLabel, uid } from "../lib/utils.js";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";

export default function Users() {
  const { data, lang, session, setData, showToast } = useApp();
  const t = useT();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES[0]);

  const paged = paginateList(data.users || [], page, pageSize);
  const currentEmail = (session && session.currentUserEmail || "").toLowerCase();

  function toggleActive(id, checked) {
    setData((prev) => Object.assign({}, prev, {
      users: prev.users.map((u) => (u.id === id ? Object.assign({}, u, { active: checked }) : u))
    }));
  }

  function deleteUser(u) {
    if (u.email.toLowerCase() === currentEmail) { showToast(t("cannotDeleteSelf")); return; }
    setData((prev) => Object.assign({}, prev, { users: prev.users.filter((x) => x.id !== u.id) }));
  }

  function addUser() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { showToast(t("invalidEmail")); return; }
    if (!password) { showToast(t("fixErrors")); return; }
    const exists = (data.users || []).some((u) => u.email.toLowerCase() === trimmedEmail);
    if (exists) { showToast(t("duplicateEmail")); return; }
    setData((prev) => Object.assign({}, prev, {
      users: (prev.users || []).concat([{ id: uid(), name: trimmedName, email: trimmedEmail, password, role, active: true }])
    }));
    setName(""); setEmail(""); setPassword(""); setRole(ROLES[0]);
    showToast(t("addUser") + " ✓");
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
