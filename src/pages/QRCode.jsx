// QRCode.jsx -- the printable "scan to check in" poster, matching the
// client-provided "Check-In QR Code" mockup: a scan card + a link card side
// by side, a Secure & Reliable callout, and the self-registration code.
// On the NB4HS Operate design system (plans/ui-design-system.md, batch 3e):
// PageHeader (the shell's breadcrumb already shows where you are), surface
// and control radii, tone tokens and Alerts. The QR artwork keeps its
// always-white .qr-plate in both themes so it scans.
import { useRef, useState } from "react";
import { Copy, ExternalLink, Globe, Printer, QrCode, ShieldCheck, UserPlus } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { DEFAULT_CHECKIN_URL, ORG } from "../lib/constants.js";
import { LOGO_URL } from "../lib/logo.js";
import { Alert } from "../components/ui/alert.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";

// The tinted icon disc at the head of each card.
function CardIcon({ icon: Icon, tone }) {
  return (
    <div className={"mb-4 flex h-12 w-12 items-center justify-center rounded-chip " + (tone === "success" ? "bg-tone-success-chip text-tone-success-ink" : "bg-tone-info-chip text-tone-info-ink")}>
      <Icon className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}

function registerUrlFor(checkInUrl) {
  try { return new URL(checkInUrl).origin + "/register"; } catch (e) { return window.location.origin + "/register"; }
}

export default function QRCode() {
  const { config, updateConfig, showToast } = useApp();
  const t = useT();
  const url = config.checkInUrl || DEFAULT_CHECKIN_URL;
  // ecc=H (30% error correction) is required here because the NB4HS logo
  // is overlaid on the center of the code below -- the default (low) error
  // correction level can't tolerate that much of the code being covered,
  // so scanners fail to read it.
  const qrImg = "https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=H&data=" + encodeURIComponent(url);
  const [urlInput, setUrlInput] = useState(url);
  // New-client self-registration (ClientRegister.jsx) lives on the same site
  // as the check-in link, so its address is that origin + /register.
  const registerUrl = registerUrlFor(url);
  const registerQrImg = "https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=H&data=" + encodeURIComponent(registerUrl);
  const [imgFailed, setImgFailed] = useState(false);
  const inputRef = useRef(null);

  function copyLink() {
    const input = inputRef.current;
    if (input) {
      input.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    }
    if (navigator.clipboard) navigator.clipboard.writeText(urlInput).catch(() => {});
    showToast(t("linkCopied"));
  }
  function copyRegisterLink() {
    if (navigator.clipboard) navigator.clipboard.writeText(registerUrl).catch(() => {});
    showToast(t("linkCopied"));
  }
  function saveUrl() {
    updateConfig({ checkInUrl: urlInput.trim() || DEFAULT_CHECKIN_URL });
    showToast(t("linkCopied"));
  }

  return (
    <>
      <PageHeader title={t("qrTitle")} description={t("qrSubtitle")} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col items-center p-6 text-center sm:p-8">
          <CardIcon icon={QrCode} />
          <h2 className="m-0 text-section font-semibold text-card-foreground">{t("qrScanHeading")}</h2>
          <p className="m-0 mt-1 max-w-xs text-body text-muted">{t("qrScanDesc")}</p>

          <div className="qr-plate mt-6 flex flex-col items-center gap-3 rounded-surface border border-border p-4">
            <img src={LOGO_URL} alt={ORG.name} className="h-11 w-auto" />
            <img src={qrImg} alt="QR code" className={imgFailed ? "hidden" : "h-[220px] w-[220px]"} onError={() => setImgFailed(true)} />
            {/* Sits on the always-white .qr-plate, so it can't use --muted: in dark
                mode that's #a2acba on white, ~2.3:1. Navy reads on white in both themes. */}
            {imgFailed && <div className="max-w-[220px] text-meta text-muted dark:text-navy">QR image requires internet access. Link: {url}</div>}
          </div>

          <Alert tone="info" className="no-print mt-6 w-full text-left" title={t("qrDesc").split(".")[0] + "."}>
            {t("qrScanDesc")}
          </Alert>
        </Card>

        <div className="no-print space-y-6">
          <Card className="flex flex-col items-center p-6 text-center sm:p-8">
            <CardIcon icon={ShieldCheck} tone="success" />
            <h2 className="m-0 text-section font-semibold text-card-foreground">{t("qrLinkHeading")}</h2>
            <p className="m-0 mt-1 max-w-xs text-body text-muted">{t("qrLinkDesc")}</p>

            <div className="mt-6 flex w-full items-center gap-2 rounded-control border border-border bg-surface-sunken py-1 pl-3 pr-1 transition-colors duration-fast focus-within:border-primary focus-within:ring-2">
              <Globe className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                className="h-9 min-h-0 min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-ui font-medium text-card-foreground shadow-none outline-none focus:bg-transparent focus:outline-none focus:ring-0"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t("phKioskUrl")}
                aria-label={t("checkInUrl")}
              />
              <IconButton size="sm" label={t("copyLink")} onClick={copyLink}><Copy aria-hidden="true" /></IconButton>
            </div>

            <div className="mt-4 flex w-full flex-col gap-2.5">
              <Button className="w-full" onClick={copyLink}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                {t("copyLink")}
              </Button>
              <Button variant="secondary" className="w-full" onClick={saveUrl}>
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t("saveLink")}
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                {t("printPdf")}
              </Button>
            </div>
          </Card>

          <Alert tone="success" title={t("qrSecureTitle")}>{t("qrSecureDesc")}</Alert>
        </div>
      </div>

      <Card className="mt-6 flex flex-col items-center gap-6 p-6 text-center sm:p-8 md:flex-row md:text-left">
        <div className="qr-plate flex shrink-0 flex-col items-center gap-3 rounded-surface border border-border p-4">
          <img src={LOGO_URL} alt={ORG.name} className="h-11 w-auto" />
          <img src={registerQrImg} alt={t("registerQrHeading")} className={imgFailed ? "hidden" : "h-[200px] w-[200px]"} onError={() => setImgFailed(true)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center md:items-start">
          <CardIcon icon={UserPlus} />
          <h2 className="m-0 text-section font-semibold text-card-foreground">{t("registerQrHeading")}</h2>
          <p className="m-0 mt-1 text-body text-muted">{t("registerQrDesc")}</p>
          <div className="mt-4 flex w-full items-center gap-2 rounded-control border border-border bg-surface-sunken px-3 py-2.5">
            <Globe className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-ui font-medium text-card-foreground">{registerUrl}</span>
          </div>
          <div className="no-print mt-4 flex flex-wrap justify-center gap-2.5 md:justify-start">
            <Button onClick={copyRegisterLink}><Copy className="h-4 w-4" aria-hidden="true" />{t("copyLink")}</Button>
            <Button variant="secondary" asChild>
              <a href={registerUrl} target="_blank" rel="noopener noreferrer" className="no-underline">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />{t("registerQrOpen")}
              </a>
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
