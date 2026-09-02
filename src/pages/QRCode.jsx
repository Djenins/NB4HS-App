// QRCode.jsx -- the printable "scan to check in" poster. Tailwind/shadcn
// redesign pass (same idiom as Reports.jsx/Dashboard.jsx) matching the
// client-provided "Check-In QR Code" mockup: breadcrumb header, a scan
// card + a link card side by side, and a Secure & Reliable callout.
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Copy, Globe, Home, Printer, QrCode, ShieldCheck } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { DEFAULT_CHECKIN_URL, ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

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
  function saveUrl() {
    updateConfig({ checkInUrl: urlInput.trim() || DEFAULT_CHECKIN_URL });
    showToast(t("linkCopied"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight text-card-foreground">{t("qrTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("qrSubtitle")}</p>
        </div>
        <div className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-muted">
          <Home className="h-4 w-4" />
          <Link to="/dashboard" className="hover:text-card-foreground hover:underline">{t("home")}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-card-foreground">{t("qrTitle")}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="qr-box">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint">
              <QrCode className="h-7 w-7 text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-card-foreground">{t("qrScanHeading")}</h3>
            <p className="mt-1 max-w-xs text-sm text-muted">{t("qrScanDesc")}</p>

            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4">
              <img src={LOGO_DATA_URI} alt={ORG.name} className="h-11 w-auto" />
              <img src={qrImg} alt="QR code" className={imgFailed ? "hidden" : "h-[220px] w-[220px]"} onError={() => setImgFailed(true)} />
              {imgFailed && <div className="max-w-[220px] text-sm text-muted">QR image requires internet access. Link: {url}</div>}
            </div>

            <div className="no-print mt-6 flex w-full items-start gap-3 rounded-xl border border-dashed border-primary bg-primary-tint p-4 text-left">
              <Printer className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-sm font-semibold text-card-foreground">{t("qrDesc").split(".")[0]}.</div>
                <div className="mt-0.5 text-xs text-muted">{t("qrScanDesc")}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="no-print space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center p-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-tint-success">
                <ShieldCheck className="h-7 w-7 text-success" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-card-foreground">{t("qrLinkHeading")}</h3>
              <p className="mt-1 max-w-xs text-sm text-muted">{t("qrLinkDesc")}</p>

              <div className="mt-6 flex w-full items-center gap-2 rounded-xl border border-border bg-tint-neutral px-4 py-3">
                <Globe className="h-4 w-4 shrink-0 text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-card-foreground outline-none"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  aria-label={t("checkInUrl")}
                />
                <button type="button" onClick={copyLink} className="shrink-0 text-muted hover:text-card-foreground" aria-label={t("copyLink")}>
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex w-full flex-col gap-2.5">
                <Button className="w-full gap-2" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                  {t("copyLink")}
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={saveUrl}>
                  <Globe className="h-4 w-4" />
                  {t("saveLink")}
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  {t("printPdf")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 rounded-xl border border-success bg-tint-success p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <div className="text-sm font-bold text-card-foreground">{t("qrSecureTitle")}</div>
              <div className="mt-0.5 text-sm text-muted">{t("qrSecureDesc")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
