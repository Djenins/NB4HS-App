// FoodSignInFormCard.jsx -- the Food Distribution module's "Sign-in Forms"
// section: staff name the occasion (Thanksgiving, Christmas, ... or their
// own), pick a layout and the form's language, and get a print-ready PDF for
// clients to fill in by hand (name, address, phone, signature). The preview
// is the real PDF, so what staff see is exactly what prints or downloads.
// Building the PDF lives in lib/foodSignInForm.js; jsPDF is loaded on first
// visit to this section only.
import { useEffect, useId, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  FORM_LANGS, OCCASIONS, SHEET_ROWS_PER_PAGE, buildFoodFormPdf, pdfFileName,
} from "../lib/foodSignInForm.js";
import { LOGO_URL } from "../lib/logo.js";
import DatePicker from "./DatePicker.jsx";
import FoodOnlineSignins from "./FoodOnlineSignins.jsx";
import { Button } from "./ui/button.jsx";
import { Field, Input, Select } from "./ui/field.jsx";
import { SectionCard } from "./ui/section-card.jsx";
import { SegmentedControl } from "./ui/segmented-control.jsx";
import { Skeleton } from "./ui/skeleton.jsx";

const OCCASION_LABEL = {
  general: "ffOccGeneral", thanksgiving: "ffOccThanksgiving", christmas: "ffOccChristmas", easter: "ffOccEaster",
  backToSchool: "ffOccBackToSchool", monthly: "ffOccMonthly", custom: "ffOccCustom",
};
const LANG_LABEL = { en: "ffLangEn", ht: "ffLangHt", fr: "ffLangFr", "en+ht": "ffLangEnHt", "en+fr": "ffLangEnFr" };

// The logo as a data URL plus its size, so jsPDF can embed it -- scaled down
// to 600px wide first (it prints about 1.4in wide, so that's still ~400dpi)
// to keep the PDF small. A failure just means a form without the logo.
async function loadLogo() {
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = LOGO_URL;
    });
    const width = Math.min(600, img.naturalWidth);
    const height = Math.round(img.naturalHeight * (width / img.naturalWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } catch (e) {
    return null;
  }
}

// The occasion that fits today's date, so the November form opens on
// Thanksgiving without anyone touching it.
function seasonalOccasion() {
  const m = new Date().getMonth();
  if (m === 10) return "thanksgiving";
  if (m === 11) return "christmas";
  if (m === 2 || m === 3) return "easter";
  if (m === 7) return "backToSchool";
  return "general";
}

export default function FoodSignInFormCard() {
  const { showToast } = useApp();
  const t = useT();
  const idBase = useId();
  const [occasion, setOccasion] = useState(seasonalOccasion);
  const [customOccasion, setCustomOccasion] = useState("");
  const [layout, setLayout] = useState("sheet");
  const [lang, setLang] = useState("en+ht");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [pages, setPages] = useState("1");
  const [ready, setReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const libs = useRef({ JsPDF: null, logo: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("jspdf"), loadLogo()]).then(([mod, logo]) => {
      if (cancelled) return;
      libs.current = { JsPDF: mod.default, logo };
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const opts = { layout, lang, occasion, customOccasion, date, location, pages: Number(pages) || 1 };

  // Synchronous once jsPDF is loaded, so Print can open its window inside
  // the click (pop-up blockers allow that, not one opened after an await).
  function build(override) {
    if (!libs.current.JsPDF) return null;
    return buildFoodFormPdf(libs.current.JsPDF, Object.assign({}, override || opts, { logo: libs.current.logo }));
  }

  // Rebuild the preview shortly after the last change.
  const optsKey = JSON.stringify(opts);
  useEffect(() => {
    if (!ready) return undefined;
    let url = "";
    const timer = setTimeout(() => {
      url = build().output("bloburl").toString();
      setPreviewUrl(url);
    }, 250);
    return () => { clearTimeout(timer); if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, optsKey]);

  function print() {
    if (!ready) return;
    const doc = build();
    doc.autoPrint();
    const win = window.open(doc.output("bloburl").toString(), "_blank");
    if (!win) showToast(t("ffPopupBlocked"));
  }

  function download() {
    if (!ready) return;
    build().save(pdfFileName(opts));
  }

  const pageCount = Number(pages) || 1;
  const pagesHint = layout === "sheet"
    ? t("ffPagesHintSheet").replace("{rows}", SHEET_ROWS_PER_PAGE).replace("{total}", SHEET_ROWS_PER_PAGE * pageCount)
    : t("ffPagesHintIndividual").replace("{total}", 2 * pageCount);

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <SectionCard className="xl:col-span-2" title={t("ffCardTitle")} description={t("ffCardDesc")}>
        <div className="space-y-4">
          <Field label={t("ffOccasionLabel")} htmlFor={idBase + "-occasion"}>
            <Select id={idBase + "-occasion"} value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              {OCCASIONS.map((o) => <option key={o} value={o}>{t(OCCASION_LABEL[o])}</option>)}
            </Select>
          </Field>
          {occasion === "custom" ? (
            <Field label={t("ffCustomOccasionLabel")} htmlFor={idBase + "-custom"}>
              <Input id={idBase + "-custom"} placeholder={t("ffCustomOccasionPlaceholder")} value={customOccasion} onChange={(e) => setCustomOccasion(e.target.value)} maxLength={60} />
            </Field>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-meta font-semibold text-card-foreground">{t("ffLayoutLabel")}</span>
            <SegmentedControl
              label={t("ffLayoutLabel")}
              className="self-start"
              value={layout}
              onChange={setLayout}
              options={[{ value: "sheet", label: t("ffLayoutSheet") }, { value: "individual", label: t("ffLayoutIndividual") }]}
            />
          </div>

          <Field label={t("ffLangLabel")} htmlFor={idBase + "-lang"}>
            <Select id={idBase + "-lang"} value={lang} onChange={(e) => setLang(e.target.value)}>
              {FORM_LANGS.map((l) => <option key={l} value={l}>{t(LANG_LABEL[l])}</option>)}
            </Select>
          </Field>

          <Field label={t("ffDateLabel")} htmlFor={idBase + "-date"} hint={t("ffDateHint")}>
            <div className="ds-control"><DatePicker id={idBase + "-date"} value={date} onChange={setDate} /></div>
          </Field>

          <Field label={t("ffLocationLabel")} htmlFor={idBase + "-location"}>
            <Input id={idBase + "-location"} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} />
          </Field>

          <Field label={t("ffPagesLabel")} htmlFor={idBase + "-pages"} hint={pagesHint}>
            <Select id={idBase + "-pages"} value={pages} onChange={(e) => setPages(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((n) => <option key={n} value={String(n)}>{n}</option>)}
            </Select>
          </Field>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={print} disabled={!ready}><Printer className="h-4 w-4" aria-hidden="true" />{t("ffPrintBtn")}</Button>
            <Button variant="secondary" onClick={download} disabled={!ready}><Download className="h-4 w-4" aria-hidden="true" />{t("ffDownloadBtn")}</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="xl:col-span-3" title={t("ffPreviewLabel")}>
        <div>
          {previewUrl ? (
            <iframe
              title={t("ffPreviewLabel")}
              src={previewUrl + "#toolbar=0&navpanes=0&view=FitH"}
              className="h-[640px] w-full rounded-control border border-border bg-white"
            />
          ) : (
            <div aria-busy="true">
              <span className="sr-only">{t("ffPreviewLoading")}</span>
              <Skeleton className="h-[640px] w-full" />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
    <FoodOnlineSignins formOpts={opts} buildPdf={build} />
    </div>
  );
}
