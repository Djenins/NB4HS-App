// Every staff route is guarded now (RequireRoute), so a page must never link
// to a page the same person can't open -- they'd be bounced back. This reads
// App.jsx's guarded routes and every page's literal navigate("/x") / to="/x"
// links, and checks each account type (with Workforce access off and on).
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const { navItemsForRole } = await import("./nav.js");
const { routeAllowed } = await import("../components/RequireRoute.jsx");

const SRC = resolvePath(__dirname, "..");
const app = readFileSync(join(SRC, "App.jsx"), "utf8");

// Component name -> page file.
const fileOf = {};
for (const m of app.matchAll(/const (\w+) = lazy\(\(\) => import\("\.\/pages\/(\w+)\.jsx"\)\)/g)) fileOf[m[1]] = m[2];
for (const m of app.matchAll(/import (\w+) from "\.\/pages\/(\w+)\.jsx"/g)) fileOf[m[1]] = m[2];

// Guarded route path -> keys, and page file -> the keys that open it.
const keysOfPath = {};
const keysOfFile = {};
for (const m of app.matchAll(/<Route path="([^"]+)" element=\{<RequireRoute routeKey=(?:"(\w+)"|\{\[([^\]]+)\]\})[^>]*><(\w+)/g)) {
  const keys = m[2] ? [m[2]] : m[3].replace(/"/g, "").split(",").map((s) => s.trim());
  keysOfPath[m[1]] = keys;
  const file = fileOf[m[4]] || m[4];
  keysOfFile[file] = (keysOfFile[file] || []).concat(keys);
}

// "/employers/42" -> the keys of "/employers/:employerId".
function keysForTarget(target) {
  const path = target.split(/[?#]/)[0];
  if (keysOfPath[path]) return keysOfPath[path];
  const parts = path.split("/");
  const match = Object.keys(keysOfPath).find((p) => {
    const q = p.split("/");
    return q.length === parts.length && q.every((seg, i) => seg.startsWith(":") || seg === parts[i]);
  });
  return match ? keysOfPath[match] : null;
}

const pages = readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".jsx") && !f.includes(".test."));
const links = pages.map((f) => {
  const src = readFileSync(join(SRC, "pages", f), "utf8");
  // GuardedLink only renders when its target can be opened, so it's safe.
  const unguarded = src.replace(/<GuardedLink\b[^>]*>/g, "");
  return { file: f.replace(".jsx", ""), targets: [...unguarded.matchAll(/(?:navigate\(|to=\{?)["`](\/[a-z][a-zA-Z0-9/_-]*)/g)].map((m) => m[1]) };
});

describe("guarded routes", () => {
  it("every staff page is behind a guard", () => {
    const staffPages = Object.values(fileOf).filter((f) => !["Login", "StaffLogin", "ResetPassword", "ApptRequest", "ApptRequestSuccess", "AppointmentLookup", "ClientRegister", "ClientRegisterSuccess", "Admin"].includes(f));
    expect(staffPages.filter((f) => !keysOfFile[f])).toEqual([]);
  });

  for (const role of ["administrator", "staff", "receptionist", "case_manager", "job_developer"]) {
    for (const wf of [false, true]) {
      it(`${role}${wf ? " with Workforce access" : ""}: no page links to a page they can't open`, () => {
        const items = navItemsForRole(role, wf ? [role] : [], {});
        const opts = { can: () => true, fromPermissions: false };
        const broken = [];
        links.forEach(({ file, targets }) => {
          if (!keysOfFile[file] || !routeAllowed(keysOfFile[file], items, opts)) return;
          targets.forEach((target) => {
            const keys = keysForTarget(target);
            if (keys && !routeAllowed(keys, items, opts)) broken.push(file + " -> " + target);
          });
        });
        expect(broken).toEqual([]);
      });
    }
  }
});
