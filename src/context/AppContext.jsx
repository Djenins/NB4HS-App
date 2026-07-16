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
import { t } from "../lib/i18n.js";
import { applyTheme, getConfig, loadData, saveData, setConfig as persistConfig } from "../lib/storage.js";
import { checkOutVisit, fetchClasses, fetchStudents, fetchVisits, subscribeTable } from "../lib/checkinData.js";
import {
  fetchAppointments, fetchCaseClients, fetchClients, fetchCustomOptions, fetchDisabledOptionKeys,
  fetchFoodClients, fetchJobClients, subscribeClientsTable
} from "../lib/clientsData.js";
import { fetchCurrentSession, fetchPastSessionStudents, fetchSessionHistory } from "../lib/sessionsData.js";
import { fetchAllProfiles, fetchProfile, onAuthStateChange, profileToSession, signOut as supabaseSignOut } from "../lib/supabaseAuth.js";

const AppContext = createContext(null);

// Defensive backfill for data saved by an older version of this app (the
// original single-file prototype, or the buildless NB4HS-App) -- ported
// verbatim from the field-by-field checks in the prototype's init()
// (lines 3818-3878), just rewritten to return a new object instead of
// mutating App.data in place.
function normalizeData(raw) {
  var d = Object.assign({}, raw);
  // NOTE: `classes`/`students` (Phase 1), `clients`/`caseClients`/
  // `jobClients`/`foodClients`/`appointments`/`clientNotes`/
  // `clientDocuments`/`communications`/`customServices`/`customStaff`/
  // `disabledServices`/`disabledStaff` (Phase 2), and `users`/
  // `currentSession`/`sessionHistory`/`pastSessionStudents`/
  // `nextStudentNumber` (Phase 3) are no longer normalized/backfilled here --
  // they're all fetched live from Supabase now (see the state + subscriptions
  // in AppProvider below) and merged onto this object under the same keys,
  // so anything surviving in an old localStorage blob under those keys is
  // simply ignored/overwritten.
  return d;
}

function initialData() {
  // `visits`/`students`/`classes`/`clients`/`caseClients`/`jobClients`/
  // `foodClients`/`appointments`/`users`/`currentSession`/`sessionHistory`/
  // `pastSessionStudents` no longer come from here (Supabase is the source of
  // truth for all of them, live-loaded in AppProvider below) -- there's no
  // "is this a fresh browser that needs demo data seeded" question left for
  // the local blob at all; whatever's left in an existing one just gets
  // normalized as before.
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
  // Distinguishes "haven't checked Supabase for a restored session yet" from
  // "checked, and there isn't one" -- without this, Shell.jsx's auth gate
  // would see session===null on first render (before onAuthStateChange's
  // async callback resolves) and redirect to the kiosk home even when a
  // valid session is about to be restored from localStorage.
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChange(async (authSession) => {
      if (!authSession) { if (!cancelled) { setSession(null); setAuthLoading(false); } return; }
      const profile = await fetchProfile(authSession.user.id);
      if (!cancelled) { setSession(profileToSession(profile)); setAuthLoading(false); }
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
  // ---- Phase 2 Supabase migration: clients/caseClients/jobClients/
  // foodClients/appointments/customServices/customStaff/disabledServices/
  // disabledStaff ----
  // Same fetch-on-mount + postgres_changes-subscription pattern as Phase 1's
  // visits/students/classes above. Per-client detail data (case client
  // notes, job applications, food distributions, the unified client notes/
  // documents/communications) is deliberately NOT held here -- those are
  // fetched on demand by the profile pages that show them (see
  // clientsData.js), since eagerly loading every client's entire history
  // into global context doesn't scale the way a handful of list-level
  // tables does.
  const [clients, setClients] = useState([]);
  const [caseClients, setCaseClients] = useState([]);
  const [jobClients, setJobClients] = useState([]);
  const [foodClients, setFoodClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [customServices, setCustomServices] = useState([]);
  const [customStaff, setCustomStaff] = useState([]);
  const [disabledServices, setDisabledServices] = useState([]);
  const [disabledStaff, setDisabledStaff] = useState([]);

  // ---- Phase 3 Supabase migration: sessions/pastSessionStudents/profiles ----
  // Same authenticated-only fetch-on-mount + subscription pattern as Phase 2
  // above (the Students page and Users page are both staff-only, unreachable
  // by the kiosk's anon session -- see src/lib/nav.js). `profiles` replaces
  // the old `data.users` local mirror entirely: Users.jsx/CaseManagement.jsx/
  // JobDeveloper.jsx now read real Supabase Auth profiles directly instead of
  // a hand-synced copy.
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [pastSessionStudents, setPastSessionStudents] = useState([]);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    // These tables are authenticated-only (no anon RLS policy) -- fetching
    // on plain mount (like Phase 1's visits/students/classes, which do have
    // anon policies for kiosk mode) would race Supabase's async session
    // restore: the initial REST calls fire before the auth token is
    // attached, silently come back empty (fetchCaseClients etc. swallow
    // errors and resolve to []), and nothing here ever retries once the
    // session actually loads -- staff would only ever see this data via a
    // live DB change, never on login. Depending on `session` re-runs the
    // fetch once sign-in actually completes.
    if (!session) return undefined;
    let cancelled = false;
    const refetchers = [
      [fetchClients, setClients],
      [fetchCaseClients, setCaseClients],
      [fetchJobClients, setJobClients],
      [fetchFoodClients, setFoodClients],
      [fetchAppointments, setAppointments],
      [() => fetchCustomOptions("service"), setCustomServices],
      [() => fetchCustomOptions("staff"), setCustomStaff],
      [() => fetchDisabledOptionKeys("service"), setDisabledServices],
      [() => fetchDisabledOptionKeys("staff"), setDisabledStaff],
      [fetchCurrentSession, setCurrentSession],
      [fetchSessionHistory, setSessionHistory],
      [fetchPastSessionStudents, setPastSessionStudents],
      [fetchAllProfiles, setProfiles]
    ];
    refetchers.forEach(([fetcher, setter]) => { fetcher().then((rows) => { if (!cancelled) setter(rows); }); });

    const tables = [
      "clients", "case_clients", "job_clients", "food_clients", "appointments", "custom_options", "disabled_options",
      "sessions", "past_session_students", "profiles"
    ];
    const unsubs = tables.map((table) => subscribeClientsTable(table, () => {
      refetchers.forEach(([fetcher, setter]) => { fetcher().then((rows) => { if (!cancelled) setter(rows); }); });
    }));
    return () => { cancelled = true; unsubs.forEach((u) => u()); };
  }, [session]);

  const data = useMemo(
    () => Object.assign({}, localData, {
      visits, students, classes,
      clients, caseClients, jobClients, foodClients, appointments,
      customServices, customStaff, disabledServices, disabledStaff,
      currentSession, sessionHistory, pastSessionStudents, profiles
    }),
    [
      localData, visits, students, classes, clients, caseClients, jobClients, foodClients, appointments,
      customServices, customStaff, disabledServices, disabledStaff,
      currentSession, sessionHistory, pastSessionStudents, profiles
    ]
  );

  // Every data mutation persists immediately, same as the original's
  // "mutate App.data, then call save()" pattern -- just funneled through
  // one place instead of repeated at every call site. Only touches the
  // still-local part of `data`; everything Supabase-backed (Phase 1's
  // visits/students/classes, Phase 2's clients/caseClients/jobClients/
  // foodClients/appointments/customServices/customStaff/disabledServices/
  // disabledStaff, Phase 3's currentSession/sessionHistory/
  // pastSessionStudents/profiles) writes through checkinData.js/
  // clientsData.js/sessionsData.js/supabaseAuth.js functions instead (called
  // directly by the pages that mutate them).
  const setData = useCallback((updater) => {
    setDataRaw((prev) => {
      const prevMerged = Object.assign({}, prev, {
        visits, students, classes,
        clients, caseClients, jobClients, foodClients, appointments,
        customServices, customStaff, disabledServices, disabledStaff,
        currentSession, sessionHistory, pastSessionStudents, profiles
      });
      const nextMerged = typeof updater === "function" ? updater(prevMerged) : updater;
      // Strip the Supabase-backed keys back out before persisting to
      // localStorage -- they have their own home now.
      const next = Object.assign({}, nextMerged);
      [
        "visits", "students", "classes",
        "clients", "caseClients", "jobClients", "foodClients", "appointments",
        "customServices", "customStaff", "disabledServices", "disabledStaff",
        "currentSession", "sessionHistory", "pastSessionStudents", "profiles"
      ].forEach((key) => delete next[key]);
      saveData(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visits, students, classes, clients, caseClients, jobClients, foodClients, appointments,
    customServices, customStaff, disabledServices, disabledStaff,
    currentSession, sessionHistory, pastSessionStudents, profiles
  ]);

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
    session, logout, authLoading,
    kiosk, setKiosk,
    toast, showToast,
    confirmState, requestConfirm, resolveConfirm
  }), [data, setData, config, updateConfig, toggleTheme, lang, session, logout, authLoading, kiosk, toast, showToast, confirmState, requestConfirm, resolveConfirm]);

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
