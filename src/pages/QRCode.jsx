// QRCode.jsx -- the printable "scan to check in" poster. Ported from
// qr.js's renderQRCode()/attachQRHandlers().
import { useRef, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { DEFAULT_CHECKIN_URL, ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";

export default function QRCode() {
  const { config, updateConfig, showToast } = useApp();
  const t = useT();
  const url = config.checkInUrl || DEFAULT_CHECKIN_URL;
  const qrImg = "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" + encodeURIComponent(url);
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
  }

  return (
    <>
      <h1>{t("qrTitle")}</h1>
      <div className="grid grid-2">
        <div className="qr-box">
          <img src={LOGO_DATA_URI} alt={ORG.name} style={{ height: 60, width: "auto", marginBottom: 18 }} />
          <img src={qrImg} alt="QR code" style={imgFailed ? { display: "none" } : undefined} onError={() => setImgFailed(true)} />
          {imgFailed && <div className="muted">QR image requires internet access. Link: {url}</div>}
          <p style={{ marginTop: 14 }}>{t("qrDesc")}</p>
        </div>
        <div className="card no-print">
          <div className="field">
            <label htmlFor="qr-url-input">{t("checkInUrl")}</label>
            <input ref={inputRef} type="text" id="qr-url-input" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
          </div>
          <div className="pill-row">
            <button className="btn-secondary" onClick={copyLink}>{t("copyLink")}</button>
            <button className="btn-primary" onClick={saveUrl}>{t("saveUrl")}</button>
            <button className="btn-secondary" onClick={() => window.print()}>{t("printPdf")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
