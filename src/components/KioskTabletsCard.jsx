// KioskTabletsCard.jsx -- System Settings' "Front-desk tablets" (k1).
// Only a paired tablet gets the kiosk's name lists (class rosters, who is
// checked in); every other signed-out browser is treated as a client's own
// phone. An administrator pairs a tablet from the tablet itself: the device
// key is handed back once, kept in this browser (kioskDevice.js), and the
// administrator is signed out so the tablet opens straight into the kiosk.
// Unpairing a tablet here shuts it out on its next request.
import { useCallback, useEffect, useState } from "react";
import { MonitorSmartphone, Unplug } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { createKioskDevice, fetchKioskDevices, revokeKioskDevice } from "../lib/checkinData.js";
import { forgetKioskDeviceKey, saveKioskDeviceKey } from "../lib/kioskDevice.js";
import { signOut } from "../lib/supabaseAuth.js";
import { fmtTime } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Field, Input } from "./ui/field.jsx";
import { SectionCard } from "./ui/section-card.jsx";

function when(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ", " + fmtTime(iso);
}

export default function KioskTabletsCard({ title }) {
  const { showToast, requestConfirm, kioskPaired } = useApp();
  const t = useT();
  const [devices, setDevices] = useState(null);
  const [name, setName] = useState("");
  const [pairing, setPairing] = useState(false);

  const load = useCallback(() => fetchKioskDevices().then(setDevices).catch(() => setDevices([])), []);
  useEffect(() => { load(); }, [load]);

  async function pairThisDevice() {
    const ok = await requestConfirm(t("kioskPairConfirm"));
    if (!ok) return;
    setPairing(true);
    try {
      const device = await createKioskDevice(name.trim() || t("kioskTabletDefaultName"));
      saveKioskDeviceKey(device.key);
      await signOut();
      // A full load, so the Supabase client picks up the device key header.
      window.location.assign("/kiosk");
    } catch (e) {
      setPairing(false);
      showToast(t("kioskPairFailed"));
    }
  }

  async function unpair(device) {
    const ok = await requestConfirm(t("kioskUnpairConfirm").replace("{name}", device.name), { danger: true });
    if (!ok) return;
    try {
      await revokeKioskDevice(device.id);
      showToast(t("kioskUnpaired"));
      load();
    } catch (e) {
      showToast(t("kioskUnpairFailed"));
    }
  }

  function forgetHere() {
    forgetKioskDeviceKey();
    window.location.reload();
  }

  const active = (devices || []).filter((d) => !d.revoked_at);

  return (
    <SectionCard title={title} description={t("kioskTabletsDesc")}>
      {kioskPaired && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-control bg-tone-info-bg p-3">
          <span className="text-ui text-card-foreground">{t("kioskThisDevicePaired")}</span>
          <Button size="sm" variant="secondary" onClick={forgetHere}>{t("kioskForgetHere")}</Button>
        </div>
      )}
      {devices === null ? null : active.length ? (
        <ul className="m-0 list-none divide-y divide-line-subtle p-0">
          {active.map((d) => (
            <li key={d.id} className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 py-2 first:pt-0">
              <div className="min-w-0">
                <p className="m-0 text-ui font-semibold text-card-foreground">{d.name}</p>
                <p className="m-0 mt-0.5 text-meta text-muted">
                  {t("kioskPairedOn")} {when(d.created_at)}{d.created_by_name ? " · " + d.created_by_name : ""} · {t("kioskLastSeen")} {when(d.last_seen_at)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => unpair(d)}>
                <Unplug className="h-4 w-4" aria-hidden="true" />
                {t("kioskUnpair")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-meta text-muted">{t("kioskNoTablets")}</p>
      )}
      {!kioskPaired && (
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line-subtle pt-5">
          <Field label={t("kioskTabletName")} htmlFor="settings-kiosk-name" className="w-full max-w-[280px]">
            <Input id="settings-kiosk-name" maxLength={80} placeholder={t("kioskTabletDefaultName")} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button onClick={pairThisDevice} loading={pairing}>
            <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
            {t("kioskPairThisDevice")}
          </Button>
        </div>
      )}
      {active.length ? <Badge className="mt-4" variant="neutral">{active.length} {t("kioskPairedCount")}</Badge> : null}
    </SectionCard>
  );
}
