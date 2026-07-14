// AppContext.jsx -- replaces the original prototype's global mutable
// singleton (App.state / App.data in state.js). Everything that used to be
// a direct property read/write on that object now lives here as React state,
// reached via the useApp() hook. Components never touch localStorage
// directly; they call the functions this context exposes, same as they used
// to call save()/showToast()/etc. as free functions.
//
// Scope note: this file owns *data*, *config*, *session*, *language*, and
// *toast* state -- the things every view needs regardless of which page is
// showing. It deliberately does NOT own "which view is active" or the
// checkoutId/kiosk query-string handling from the original init() (lines
// 3882-3903 of the prototype) -- that's routing, and belongs to the
// react-router setup being built in the next task (#94), not here. Kiosk
// mode itself (a flag that changes what the header/nav show) is simple
// enough to seed here rather than block on routing.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_NAME,
  DEFAULT_CASE_MANAGER_EMAIL, DEFAULT_CASE_MANAGER_NAME,
  DEFAULT_JOB_DEVELOPER_EMAIL, DEFAULT_JOB_DEVELOPER_NAME
} from "../lib/constants.js";
import { t } from "../lib/i18n.js";
import { applyTheme, getConfig, loadData, saveData, setConfig as persistConfig } from "../lib/storage.js";
import { runUnifiedClientsMigration } from "../lib/masterClients.js";
import { addMonths, todayStr, uid } from "../lib/utils.js";
import { checkOutVisit, fetchClasses, fetchStudents, fetchVisits, subscribeTable } from "../lib/checkinData.js";
import { fetchProfile, onAuthStateChange, profileToSession, signOut as supabaseSignOut } from "../lib/supabaseAuth.js";

const AppContext = createContext(null);

// Defensive backfill for data saved by an older version of this app (the
// original single-file prototype, or the buildless NB4HS-App) -- ported
// verbatim from the field-by-field checks in the prototype's init()
// (lines 3818-3878), just rewritten to return a new object instead of
// mutating App.data in place.
function normalizeData(raw) {
  var d = Object.assign({}, raw);
  d.customServices = d.customServices || [];
  d.customStaff = d.customStaff || [];
  d.disabledServices = d.disabledServices || [];
  d.disabledStaff = d.disabledStaff || [];
  // NOTE: `classes` and `students` are no longer normalized/backfilled here
  // -- as of the Phase 1 Supabase migration they're fetched live from
  // Supabase (see the visits/students/classes state + subscriptions in
  // AppProvider below) and merged onto this object under the same keys, so
  // any `classes`/`students` surviving in an old localStorage blob are
  // simply ignored/overwritten.
  // NOTE: no `password` field -- as of the Phase 1 Supabase migration this
  // is just a mirror (name/email/role/active) kept so the still-local Case
  // Management/Job Developer staff-assignment pickers keep working; real
  // auth lives entirely in Supabase Auth + `profiles` now (see Users.jsx).
  d.nextStudentNumber = d.nextStudentNumber || 1;
  d.users = (d.users && d.users.length) ? d.users.slice() : [
    { id: uid(), name: DEFAULT_ADMIN_NAME, email: DEFAULT_ADMIN_EMAIL, role: "administrator", active: true }
  ];
  if (!d.users.some(function (u) { return u.role === "case_manager"; })) {
    d.users.push({ id: uid(), name: DEFAULT_CASE_MANAGER_NAME, email: DEFAULT_CASE_MANAGER_EMAIL, role: "case_manager", active: true });
  }
  if (!d.users.some(function (u) { return u.role === "job_developer"; })) {
    d.users.push({ id: uid(), name: DEFAULT_JOB_DEVELOPER_NAME, email: DEFAULT_JOB_DEVELOPER_EMAIL, role: "job_developer", active: true });
  }
  d.users = d.users.map(function (u) {
    if (u.name) return u;
    var local = (u.email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
    var name = local ? local.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }) : "";
    return Object.assign({}, u, { name: name });
  });
  d.sessionHistory = d.sessionHistory || [];
  d.pastSessionStudents = (d.pastSessionStudents || []).map(function (r) {
    var r2 = Object.assign({}, r);
    if (r2.address !== undefined && r2.street === undefined) { r2.street = r2.address; delete r2.address; }
    if (r2.street === undefined) r2.street = "";
    if (r2.city === undefined) r2.city = "";
    if (r2.zip === undefined) r2.zip = "";
    r2.state = "RI";
    return r2;
  });
  d.caseClients = (d.caseClients || []).map(function (c) {
    var c2 = Object.assign({}, c);
    c2.services = c2.services || [];
    c2.notes = c2.notes || [];
    if (c2.street === undefined) c2.street = "";
    if (c2.city === undefined) c2.city = "";
    if (c2.zip === undefined) c2.zip = "";
    c2.state = "RI";
    return c2;
  });
  d.appointments = (d.appointments || []).map(function (a) {
    var a2 = Object.assign({}, a);
    if (a2.caseManagerEmail !== undefined && a2.assignedEmail === undefined) { a2.assignedEmail = a2.caseManagerEmail; delete a2.caseManagerEmail; }
    if (a2.assignedEmail === undefined) a2.assignedEmail = "";
    if (a2.meetingWith === undefined) a2.meetingWith = "case_manager";
    return a2;
  });
  // Job Developer client detail page fields -- additive backfill for
  // records created before this feature existed, same defensive pattern
  // as the students/caseClients backfills above.
  d.jobClients = (d.jobClients || []).map(function (c) {
    var c2 = Object.assign({}, c);
    if (c2.employmentStatus === undefined) c2.employmentStatus = "not_started";
    if (c2.pipelineStage === undefined) c2.pipelineStage = "resume";
    if (c2.workAuthorization === undefined) c2.workAuthorization = "";
    if (c2.workAuthorizationExpiration === undefined) c2.workAuthorizationExpiration = "";
    if (c2.transportation === undefined) c2.transportation = "";
    if (c2.preferredLanguage === undefined) c2.preferredLanguage = "";
    if (c2.secondaryLanguage === undefined) c2.secondaryLanguage = "";
    if (c2.barriers === undefined) c2.barriers = [];
    if (c2.servicesProvided === undefined) c2.servicesProvided = [];
    if (c2.skills === undefined) c2.skills = [];
    if (c2.applications === undefined) c2.applications = [];
    return c2;
  });
  d.foodClients = d.foodClients || [];

  // Unified client identity layer (data.clients + data.programEnrollments)
  // on top of caseClients/jobClients/students/foodClients -- see
  // masterClients.js. Runs once, ever, per localStorage blob: guarded by
  // d.migrationsRun.unifiedClientsV2 so reloading the app doesn't
  // re-migrate (and doesn't create duplicate master records) on every load.
  // V2 (not V1) because Phase 3 widened the migration to also cover
  // Students/Food Distribution -- bumping the flag makes it re-run once
  // more even for installs that already completed the V1 (case/job-only)
  // pass, so those two programs get folded in too.
  d.clients = d.clients || [];
  d.programEnrollments = d.programEnrollments || [];
  d.nextClientNumber = d.nextClientNumber || 1;
  // Phase 4: unified (department-agnostic) Notes/Documents/Communications --
  // separate from each program's own inline records (e.g. caseClients[].notes).
  d.clientNotes = d.clientNotes || [];
  d.clientDocuments = d.clientDocuments || [];
  d.communications = d.communications || [];
  d.migrationsRun = d.migrationsRun || {};
  if (!d.migrationsRun.unifiedClientsV2) {
    var migrated = runUnifiedClientsMigration(d);
    d.clients = migrated.clients;
    d.programEnrollments = migrated.programEnrollments;
    d.caseClients = migrated.caseClients;
    d.jobClients = migrated.jobClients;
    d.students = migrated.students;
    d.foodClients = migrated.foodClients;
    d.nextClientNumber = migrated.nextClientNumber;
    d.migrationsRun = Object.assign({}, d.migrationsRun, { unifiedClientsV1: true, unifiedClientsV2: true });
  }

  if (!d.currentSession) {
    var sStart = todayStr();
    d.currentSession = { id: uid(), startDate: sStart, endDate: addMonths(sStart, 3) };
  }
  return d;
}

function initialData() {
  // `visits`/`students`/`classes` no longer come from here (Supabase is the
  // source of truth for those, live-loaded in AppProvider below) -- so there's
  // no more "is this a fresh browser that needs demo data seeded" question
  // for them. Whatever's left in an existing blob (caseClients/jobClients/
  // etc.) just gets normalized as before.
  var loaded = loadData();
  return normalizeData(loaded || {});
}

function initialKiosk() {
  if (typeof window === "undefined") return false;
  var params = new URLSearchParams(window.location.search);
  return params.get("kiosk") === "1" || window.location.hash === "#checkin";
}

export function AppProvider({ children }) {
  const [localData, setDataRaw] = useState(initialData);
  const [config, setConfigState] = useState(getConfig);
  const [lang, setLang] = useState("en"); // not persisted in the original either -- always starts on English.
  const [kiosk, setKiosk] = useState(initialKiosk);
  const [toast, setToast] = useState(null);

  // ---- Phase 1 Supabase migration: auth session (see supabaseAuth.js) ----
  // `session` used to be a plaintext localStorage blob written by login()/
  // read back by StaffLogin.jsx's manual data.users password check. It's now
  // driven entirely by Supabase Auth's own session persistence: this effect
  // fires once immediately with whatever session (if any) Supabase already
  // has, then again on every sign-in/sign-out/token-refresh. `session` keeps
  // the exact `{ role, currentUserEmail, currentUserName }` shape every
  // consumer (Shell.jsx's auth gate, nav role checks) already expects.
  const [session, setSession] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChange(async (authSession) => {
      if (!authSession) { if (!cancelled) setSession(null); return; }
      const profile = await fetchProfile(authSession.user.id);
      if (!cancelled) setSession(profileToSession(profile));
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const logout = useCallback(() => { supabaseSignOut(); }, []);

  // ---- Phase 1 Supabase migration: live visits/students/classes ----
  // These three used to be plain slices of the localStorage `data` blob,
  // mutated via setData(). They're now fetched from Supabase on mount and
  // kept in sync in real time via postgres_changes subscriptions, so a
  // check-in on one device shows up on every other device/tab within
  // seconds -- see checkinData.js for the row<->app-shape mapping and the
  // plan (plans/wobbly-munching-rose.md) for why. Everything else in `data`
  // (caseClients/jobClients/foodClients/appointments/notes/documents/...)
  // is untouched Phase-2 scope, still sourced from the localStorage blob.
  const [visits, setVisits] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchVisits().then((rows) => { if (!cancelled) setVisits(rows); });
    fetchStudents().then((rows) => { if (!cancelled) setStudents(rows); });
    fetchClasses().then((rows) => { if (!cancelled) setClasses(rows); });

    const unsubVisits = subscribeTable("visits", () => { fetchVisits().then((rows) => { if (!cancelled) setVisits(rows); }); });
    const unsubStudents = subscribeTable("students", () => { fetchStudents().then((rows) => { if (!cancelled) setStudents(rows); }); });
    const unsubClasses = subscribeTable("classes", () => { fetchClasses().then((rows) => { if (!cancelled) setClasses(rows); }); });
    return () => { cancelled = true; unsubVisits(); unsubStudents(); unsubClasses(); };
  }, []);

  // The merged view every page actually reads: same key names as before
  // (`data.visits`/`data.students`/`data.classes`), just overlaid onto the
  // still-local rest of `data` -- see the plan's "keep the shape, swap the
  // source" strategy.
  const data = useMemo(
    () => Object.assign({}, localData, { visits, students, classes }),
    [localData, visits, students, classes]
  );

  // Every data mutation persists immediately, same as the original's
  // "mutate App.data, then call save()" pattern -- just funneled through
  // one place instead of repeated at every call site. Only touches the
  // still-local part of `data`; visits/students/classes writes go through
  // checkinData.js's Supabase functions instead (called directly by the
  // pages that mutate them -- see the plan).
  const setData = useCallback((updater) => {
    setDataRaw((prev) => {
      const prevMerged = Object.assign({}, prev, { visits, students, classes });
      const nextMerged = typeof updater === "function" ? updater(prevMerged) : updater;
      // Strip the Supabase-backed keys back out before persisting to
      // localStorage -- they have their own home now.
      const next = Object.assign({}, nextMerged);
      delete next.visits; delete next.students; delete next.classes;
      saveData(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, students, classes]);

  useEffect(() => { applyTheme(config.theme); }, [config.theme]);

  const updateConfig = useCallback((patch) => {
    persistConfig(patch);
    setConfigState((prev) => Object.assign({}, prev, patch));
  }, []);

  const toggleTheme = useCallback(() => {
    setConfigState((prev) => {
      const next = Object.assign({}, prev, { theme: prev.theme === "dark" ? "light" : "dark" });
      persistConfig({ theme: next.theme });
      return next;
    });
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(function () { setToast((cur) => (cur === message ? null : cur)); }, 3000);
  }, []);

  // In-app confirm dialog, replacing the original's showConfirmModal()/
  // window.confirm() calls. Promise-based instead of the original's
  // callback-based API -- same UX (message, Cancel/Confirm, danger styling,
  // Escape/backdrop-click to dismiss), just the idiomatic React shape:
  // `if (await requestConfirm(msg)) { ...do the destructive thing... }`
  // instead of `showConfirmModal(msg, function () { ... })`. ConfirmModal.jsx
  // renders whatever's in confirmState; nothing else needs to touch the DOM
  // directly the way the original's showConfirmModal() did.
  const [confirmState, setConfirmState] = useState(null);
  const requestConfirm = useCallback((message, opts) => {
    return new Promise((resolve) => {
      setConfirmState({ message, opts: opts || {}, resolve });
    });
  }, []);
  const resolveConfirm = useCallback((result) => {
    setConfirmState((cur) => {
      if (cur) cur.resolve(result);
      return null;
    });
  }, []);

  // Auto check-out sweep, ported from checkout_auto.js's runAutoCheckout():
  // any visit still open past the configured closing time gets checked out
  // automatically. Same 60s interval as the original -- now calls the
  // check_out_visit() RPC (via checkinData.js) per stale visit instead of a
  // local setData patch, since `visits` lives in Supabase now. Reads
  // `visits` through a ref so the interval doesn't need to be torn down and
  // recreated every time a realtime update ticks `visits` state.
  const visitsRef = useRef(visits);
  useEffect(() => { visitsRef.current = visits; }, [visits]);

  useEffect(() => {
    function sweep() {
      const cfg = getConfig();
      const closingTime = cfg.closingTime || "17:00";
      const now = new Date();
      const stale = visitsRef.current.filter((v) => {
        if (v.timeOut) return false;
        return now >= new Date(v.date + "T" + closingTime + ":00");
      });
      if (!stale.length) return;
      Promise.all(stale.map((v) => checkOutVisit(v.id).catch(() => null))).then(() => {
        showToast(stale.length + " " + t("autoCheckoutToast", lang));
      });
    }
    sweep();
    const id = setInterval(sweep, 60000);
    return () => clearInterval(id);
  }, [lang, showToast]);

  const value = useMemo(() => ({
    data, setData,
    config, updateConfig, toggleTheme,
    lang, setLang,
    session, logout,
    kiosk, setKiosk,
    toast, showToast,
    confirmState, requestConfirm, resolveConfirm
  }), [data, setData, config, updateConfig, toggleTheme, lang, session, logout, kiosk, toast, showToast, confirmState, requestConfirm, resolveConfirm]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
}

// Binds t(key, lang) to the current language, so components can call t("someKey")
// without threading lang through every call -- same convenience the original
// free function t() had via the global App.state.lang, minus the global.
export function useT() {
  const { lang } = useApp();
  return useCallback((key) => t(key, lang), [lang]);
}
