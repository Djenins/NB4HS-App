// Profile.jsx -- the signed-in person's own settings (plans/unified-access-
// architecture.md §7.3, Home "Profile: own name, language, password"):
// name, language, the workspace they land in, and their password. Anyone
// signed in can open it; the database lets people change only their own
// name and workspace here (role, status and email stay with admins --
// prevent_self_role_escalation).
import { useState } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { updatePassword, updateProfile } from "../lib/supabaseAuth.js";
import { useNavItems } from "../lib/useNavItems.js";
import { visibleWorkspaces } from "../lib/workspaces.js";
import { LANGS } from "../lib/constants.js";
import { roleLabel } from "../lib/utils.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Field, Input, Select } from "../components/ui/field.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";

const MIN_PASSWORD = 8;

export default function Profile() {
  const { session, lang, setLang, showToast } = useApp();
  const t = useT();
  const { items } = useNavItems();
  const workspaces = visibleWorkspaces(items);
  const [name, setName] = useState(session ? session.currentUserName || "" : "");
  const [workspace, setWorkspace] = useState(session && session.primaryWorkspace ? session.primaryWorkspace : "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  if (!session) return null;

  async function saveProfile(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      // Home is the default, stored as "none chosen".
      await updateProfile(session.id, { name: name.trim(), primary_workspace: workspace && workspace !== "home" ? workspace : null });
      showToast(t("profileSaved"));
    } catch (err) {
      showToast(t("userActionError"));
    }
    setSavingProfile(false);
  }

  async function savePassword(e) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) { setPwError(t("profilePasswordShort").replace("{n}", MIN_PASSWORD)); return; }
    if (password !== confirm) { setPwError(t("passwordMismatchError")); return; }
    setPwError("");
    setSavingPw(true);
    const { error } = await updatePassword(password);
    setSavingPw(false);
    if (error) { setPwError(error.message || t("userActionError")); return; }
    setPassword(""); setConfirm("");
    showToast(t("passwordUpdatedToast"));
  }

  return (
    <>
      <PageHeader title={t("profileTitle")} description={t("profileSubtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" aria-hidden="true" />{t("profileDetails")}</CardTitle>
            <CardDescription>{session.currentUserEmail} · {roleLabel(session.role, lang)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={saveProfile} noValidate>
              <Field label={t("fullNameLabel")} htmlFor="profile-own-name" required>
                <Input id="profile-own-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
              </Field>
              <Field label={t("profileLanguage")} htmlFor="profile-lang" hint={t("profileLanguageHint")}>
                <Select id="profile-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </Select>
              </Field>
              {workspaces.length > 1 ? (
                <Field label={t("profileWorkspace")} htmlFor="profile-workspace" hint={t("profileWorkspaceHint")}>
                  <Select id="profile-workspace" value={workspace || "home"} onChange={(e) => setWorkspace(e.target.value)}>
                    {workspaces.map((w) => <option key={w.key} value={w.key}>{t(w.label)}</option>)}
                  </Select>
                </Field>
              ) : null}
              <div><Button type="submit" loading={savingProfile} disabled={!name.trim()}>{t("saveLabel")}</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" aria-hidden="true" />{t("profilePassword")}</CardTitle>
            <CardDescription>{t("profilePasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={savePassword} noValidate>
              <Field label={t("newPasswordLabel")} htmlFor="profile-new-password" error={pwError}>
                <Input id="profile-new-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setPwError(""); }}
                  autoComplete="new-password" aria-invalid={!!pwError} />
              </Field>
              <Field label={t("confirmPasswordLabel")} htmlFor="profile-confirm-password">
                <Input id="profile-confirm-password" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setPwError(""); }}
                  autoComplete="new-password" />
              </Field>
              <div><Button type="submit" variant="secondary" loading={savingPw} disabled={!password}>{t("profileChangePassword")}</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
