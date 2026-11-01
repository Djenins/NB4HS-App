// NewsletterLayoutEditor.jsx -- the pieces of the newsletter editor that
// deal with layouts (c3_newsletter_layouts): the layout picker with a small
// drawing of each layout, the form for the layout's blocks (hero image,
// headline, intro, button, sub-heading, sections) and the live preview.
//
// Drag and drop: drop an image file onto any image field to upload it, and
// drag a section by its grip to reorder (the arrow buttons do the same from
// the keyboard). "Build your own" (BlockBuilder) goes further: drag title,
// header, text, image and link blocks from a palette into the email, drop
// them where they belong, and drag them around.
//
// The preview renders with newsletterLayout.js -- the same file the
// send-outbound Edge Function sends with -- in a sandboxed iframe, so it is
// the email, not an approximation. Grey boxes stand in for pictures not
// added yet; the real email simply leaves them out.
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, ArrowDown, ArrowUp, GripVertical, Heading1, Heading2, Image as ImageIcon, ImagePlus, Link2, Monitor, Pilcrow, Plus,
  Smartphone, Trash2
} from "lucide-react";
import { useT } from "../../context/AppContext.jsx";
import { NEWSLETTER_IMAGE_TYPES, newsletterImageProblem, uploadNewsletterImage } from "../../lib/communications.js";
import {
  BLOCK_TYPES, LAYOUTS, LAYOUT_KEYS, MAX_BLOCKS, NEWSLETTER_FOOTER, logoUrl, newBlock, renderNewsletterHtml
} from "../../../supabase/functions/send-outbound/newsletterLayout.js";
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET, Button } from "../ui/button.jsx";
import { Field, Input, Select, Textarea } from "../ui/field.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";

export const PICKER_KEYS = ["plain"].concat(LAYOUT_KEYS);

// ---------- layout drawings ----------

// Little wireframes after the usual layout chart: blue blocks are pictures,
// dark bars headlines, grey bars text, the pill a button.
const PIC = "fill-[#b4c6fc]";
const HEAD = "fill-[#0b1f3a]";
const TEXT = "fill-[#c3cbd8]";
const BTN = "fill-[#1d4ed8]";

function Lines({ x, y, w, n = 2 }) {
  return Array.from({ length: n }).map((_, i) => <rect key={i} x={x} y={y + i * 4} width={i === n - 1 ? w * 0.7 : w} height="2" rx="1" className={TEXT} />);
}
function Row({ y, picLeft = true }) {
  return (
    <g>
      <rect x={picLeft ? 6 : 34} y={y} width="24" height="14" rx="2" className={PIC} />
      <rect x={picLeft ? 34 : 6} y={y + 1} width="22" height="3" rx="1" className={HEAD} />
      <Lines x={picLeft ? 34 : 6} y={y + 7} w={22} />
    </g>
  );
}

export function LayoutThumb({ layout }) {
  const hero = <rect x="6" y="8" width="52" height="18" rx="2" className={PIC} />;
  const headline = (y, centered) => <rect x={centered ? 14 : 6} y={y} width={centered ? 36 : 40} height="3.5" rx="1" className={HEAD} />;
  const button = (y, centered) => <rect x={centered ? 24 : 6} y={y} width="16" height="5" rx="2.5" className={BTN} />;
  let body;
  if (layout === "plain") {
    body = (<g>{headline(10)}<Lines x={6} y={18} w={52} n={4} /><Lines x={6} y={36} w={52} n={4} /><Lines x={6} y={54} w={52} n={3} /></g>);
  } else if (layout === "single") {
    body = (<g>{hero}{headline(30)}<Lines x={6} y={36} w={52} />{button(44)}<rect x="6" y="54" width="34" height="3" rx="1" className={HEAD} /><Lines x={6} y={60} w={52} /><rect x="6" y="70" width="30" height="3" rx="1" className={HEAD} /><Lines x={6} y={76} w={52} /></g>);
  } else if (layout === "f_pattern") {
    body = (<g>{headline(8)}<Lines x={6} y={14} w={52} /><Row y={24} /><Row y={42} /><Row y={60} /></g>);
  } else if (layout === "zigzag") {
    body = (<g>{hero}{headline(30)}<Lines x={6} y={36} w={52} />{button(44)}<Row y={54} picLeft={false} /><Row y={70} /></g>);
  } else if (layout === "multi") {
    body = (<g>{hero}{headline(30, true)}<Lines x={10} y={36} w={44} />{button(44, true)}<rect x="18" y="55" width="28" height="3" rx="1" className={HEAD} />
      {[6, 24, 42].map((x) => <g key={x}><rect x={x} y="62" width="16" height="10" rx="2" className={PIC} /><Lines x={x} y={75} w={16} /></g>)}</g>);
  } else if (layout === "pyramid") {
    body = (<g><rect x="6" y="8" width="52" height="26" rx="2" className={PIC} />{headline(40, true)}<Lines x={10} y={47} w={44} n={3} />{button(62, true)}</g>);
  } else if (layout === "hybrid") {
    body = (<g>{hero}{headline(30)}<Lines x={6} y={36} w={52} />{button(44)}<rect x="6" y="54" width="30" height="3" rx="1" className={HEAD} /><Row y={60} /></g>);
  } else if (layout === "custom") {
    body = (<g>
      {[8, 26, 44].map((y) => <rect key={y} x="6" y={y} width="52" height="14" rx="2" className="fill-none stroke-[#93a8f8]" strokeDasharray="2 1.5" />)}
      <rect x="10" y="12" width="26" height="3" rx="1" className={HEAD} /><Lines x={10} y={30} w={44} /><rect x="10" y="48" width="20" height="6" rx="2" className={PIC} />
      <circle cx="32" cy="72" r="7" className={BTN} /><rect x="31" y="68" width="2" height="8" rx="1" className="fill-white" /><rect x="28" y="71" width="8" height="2" rx="1" className="fill-white" />
    </g>);
  } else {
    body = (<g>{hero}{headline(30)}<Lines x={6} y={36} w={52} /><rect x="6" y="48" width="30" height="3" rx="1" className={HEAD} />
      {[6, 33].map((x) => <g key={x}><rect x={x} y="55" width="25" height="14" rx="2" className={PIC} /><Lines x={x} y={72} w={25} /></g>)}</g>);
  }
  return (
    <svg viewBox="0 0 64 86" className="h-[86px] w-16" aria-hidden="true">
      <rect x="0.5" y="0.5" width="63" height="85" rx="5" className="fill-white stroke-[#e3e8f0]" />
      {body}
    </svg>
  );
}

export function LayoutPicker({ value, onChange }) {
  const t = useT();
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 p-0 text-meta font-semibold text-card-foreground">{t("nlLayoutLabel")}</legend>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label={t("nlLayoutLabel")}>
        {PICKER_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            onClick={() => onChange(key)}
            className={cn(BUTTON_RESET, "flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-control border bg-card p-2 text-center transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2",
              value === key ? "border-primary bg-primary-tint" : "border-border hover:border-line-strong")}
          >
            <LayoutThumb layout={key} />
            <span className={cn("text-meta leading-tight", value === key ? "font-semibold text-primary" : "text-card-foreground")}>{t("nlLayout_" + key)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ---------- block fields ----------

function ImageField({ id, label, value, onChange }) {
  const t = useT();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [dropping, setDropping] = useState(false);

  function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) upload(file);
  }
  // Only file drags light the zone up; a section being dragged passes over.
  const hasFiles = (e) => Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1;
  function onDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDropping(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) upload(file);
  }

  async function upload(file) {
    const p = newsletterImageProblem(file);
    if (p) { setProblem(p); return; }
    setProblem(null);
    setBusy(true);
    try { onChange(Object.assign({}, value, { src: await uploadNewsletterImage(file) })); }
    catch (err) { console.warn("uploadNewsletterImage failed", err); setProblem("nlImageFailed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-meta font-semibold text-card-foreground">{label}</span>
      <div
        className={cn("flex flex-wrap items-start gap-3 rounded-control border border-dashed p-2.5 transition-colors duration-fast",
          dropping ? "border-primary bg-primary-tint" : "border-border")}
        onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDropping(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropping(false); }}
        onDrop={onDrop}
      >
        {value.src ? <img src={value.src} alt="" className="h-16 w-24 rounded-control border border-border object-cover" /> : null}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} id={id} type="file" accept={NEWSLETTER_IMAGE_TYPES.join(",")} className="sr-only" onChange={pick} />
            <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => fileRef.current && fileRef.current.click()}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" /> {value.src ? t("nlImageReplace") : t("nlImageAdd")}
            </Button>
            {value.src ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ src: "", alt: "" })}>{t("nlImageRemove")}</Button> : null}
          </div>
          {!value.src ? <span className="text-meta text-muted">{t(dropping ? "nlImageDropNow" : "nlImageDropHint")}</span> : null}
          {value.src ? (
            <Input aria-label={t("nlImageAlt")} placeholder={t("nlImageAlt")} value={value.alt} maxLength={200}
              onChange={(e) => onChange(Object.assign({}, value, { alt: e.target.value }))} />
          ) : null}
        </div>
      </div>
      <p className={cn("m-0 text-meta", problem ? "text-tone-danger-ink" : "text-muted")} role={problem ? "alert" : undefined}>
        {t(problem || "nlImageHint")}
      </p>
    </div>
  );
}

function LinkFields({ idBase, labelText, value, onChange }) {
  const t = useT();
  const bad = value.url && !/^(https:\/\/|mailto:)/i.test(value.url.trim());
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Field label={labelText} htmlFor={idBase + "-label"}>
        <Input id={idBase + "-label"} value={value.label} maxLength={60} onChange={(e) => onChange(Object.assign({}, value, { label: e.target.value }))} />
      </Field>
      <Field label={t("nlLinkUrl")} htmlFor={idBase + "-url"} error={bad ? t("nlLinkBad") : null} hint={value.label && !value.url ? t("nlLinkNeeded") : null}>
        <Input id={idBase + "-url"} type="url" inputMode="url" placeholder="https://" value={value.url} maxLength={1000}
          onChange={(e) => onChange(Object.assign({}, value, { url: e.target.value }))} />
      </Field>
    </div>
  );
}

export function LayoutFields({ layout, content, onChange }) {
  const t = useT();
  const cfg = LAYOUTS[layout];
  const set = (name, value) => onChange(Object.assign({}, content, { [name]: value }));
  const setSection = (i, value) => set("sections", content.sections.map((s, j) => (j === i ? value : s)));
  const move = (i, d) => {
    const next = content.sections.slice();
    const [s] = next.splice(i, 1);
    next.splice(i + d, 0, s);
    set("sections", next);
  };
  // Dragging starts only from a section's grip, so text in its fields can
  // still be selected with the mouse.
  const [armed, setArmed] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const isSectionDrag = (e) => Array.prototype.indexOf.call(e.dataTransfer.types || [], "application/x-nl-section") !== -1;
  function dropSection(to) {
    if (dragFrom !== null && dragFrom !== to) {
      const next = content.sections.slice();
      const [s] = next.splice(dragFrom, 1);
      next.splice(to, 0, s);
      set("sections", next);
    }
    setDragFrom(null); setDragOver(null); setArmed(null);
  }
  const addSection = () => set("sections", content.sections.concat([{ src: "", alt: "", title: "", text: "", link: { label: "", url: "" } }]));
  const sectionCount = Math.min(content.sections.length, cfg.max);

  return (
    <div className="flex flex-col gap-4">
      {cfg.hero ? <ImageField id="nl-hero" label={t("nlHeroImage")} value={content.hero} onChange={(v) => set("hero", v)} /> : null}
      <Field label={t("nlHeadline")} htmlFor="nl-headline" required>
        <Input id="nl-headline" value={content.headline} maxLength={150} onChange={(e) => set("headline", e.target.value)} />
      </Field>
      <Field label={t("nlIntro")} htmlFor="nl-intro" hint={t("nlBodyHint")}>
        <Textarea id="nl-intro" rows={4} value={content.intro} maxLength={3000} onChange={(e) => set("intro", e.target.value)} />
      </Field>
      {cfg.cta ? <LinkFields idBase="nl-cta" labelText={t("nlButtonText")} value={content.cta} onChange={(v) => set("cta", v)} /> : null}

      {cfg.sections !== "none" ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {cfg.subheading ? (
            <Field label={t("nlSubheading")} htmlFor="nl-subheading">
              <Input id="nl-subheading" value={content.subheading} maxLength={150} onChange={(e) => set("subheading", e.target.value)} />
            </Field>
          ) : null}
          <p className="m-0 text-meta font-semibold text-card-foreground">
            {t("nlSections")} <span className="font-normal tabular-nums text-muted">{sectionCount} / {cfg.max}</span>
          </p>
          {content.sections.slice(0, cfg.max).map((s, i) => (
            <fieldset
              key={i}
              draggable={armed === i}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("application/x-nl-section", String(i)); setDragFrom(i); }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); setArmed(null); }}
              onDragOver={(e) => { if (isSectionDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(i); } }}
              onDrop={(e) => { if (isSectionDrag(e)) { e.preventDefault(); dropSection(i); } }}
              className={cn("m-0 flex flex-col gap-3 rounded-control border bg-surface-sunken p-3 transition-[border-color,opacity] duration-fast",
                dragOver === i && dragFrom !== i ? "border-primary ring-2" : "border-border", dragFrom === i && "opacity-50")}
            >
              <legend className="sr-only">{t("nlSectionN").replace("{n}", i + 1)}</legend>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-meta font-semibold text-card-foreground">
                  <span
                    className="-ml-1 flex h-7 w-6 cursor-grab items-center justify-center rounded text-muted hover:bg-card hover:text-card-foreground active:cursor-grabbing"
                    title={t("nlDragToReorder")}
                    aria-hidden="true"
                    onMouseDown={() => setArmed(i)}
                    onMouseUp={() => setArmed(null)}
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  {t("nlSectionN").replace("{n}", i + 1)}
                </span>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={t("nlMoveUp")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={t("nlMoveDown")} disabled={i === sectionCount - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={t("nlRemoveSection")} onClick={() => set("sections", content.sections.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </div>
              </div>
              <ImageField id={"nl-s" + i + "-img"} label={t("nlSectionImage")} value={{ src: s.src, alt: s.alt }} onChange={(v) => setSection(i, Object.assign({}, s, v))} />
              <Field label={t("nlSectionTitle")} htmlFor={"nl-s" + i + "-title"}>
                <Input id={"nl-s" + i + "-title"} value={s.title} maxLength={150} onChange={(e) => setSection(i, Object.assign({}, s, { title: e.target.value }))} />
              </Field>
              <Field label={t("nlSectionText")} htmlFor={"nl-s" + i + "-text"}>
                <Textarea id={"nl-s" + i + "-text"} rows={2} value={s.text} maxLength={1500} onChange={(e) => setSection(i, Object.assign({}, s, { text: e.target.value }))} />
              </Field>
              <LinkFields idBase={"nl-s" + i + "-link"} labelText={t("nlLinkText")} value={s.link} onChange={(v) => setSection(i, Object.assign({}, s, { link: v }))} />
            </fieldset>
          ))}
          {sectionCount < cfg.max ? (
            <Button type="button" variant="secondary" size="sm" className="self-start" onClick={addSection}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("nlAddSection")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------- preview ----------

// "Desktop" draws the email at a real desktop width (640px) and scales it to
// fit the pane; otherwise the pane's own narrow width would trigger the
// email's phone layout and every layout would look stacked.
const DESKTOP_WIDTH = 640;

export function NewsletterPreview({ layout, content, subject, language, address }) {
  const t = useT();
  const [width, setWidth] = useState("desktop");
  const paneRef = useRef(null);
  const [pane, setPane] = useState({ w: DESKTOP_WIDTH, h: 600 });
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return undefined;
    const measure = () => setPane({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = width === "desktop" ? Math.min(1, pane.w / DESKTOP_WIDTH) : 1;
  const f = NEWSLETTER_FOOTER[language] || NEWSLETTER_FOOTER.en;
  const html = renderNewsletterHtml({
    layout, content, subject, language, logo: logoUrl(window.location.origin),
    footer: { why: f.why, address: address || t("nlPreviewAddress"), stopLabel: f.stop, href: "#" }
  }, { placeholders: true });
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-meta font-semibold text-card-foreground">{t("nlPreviewLabel")}</span>
        <SegmentedControl size="sm" label={t("nlPreviewWidth")} value={width} onChange={setWidth}
          options={[{ value: "desktop", label: t("nlPreviewDesktop"), icon: Monitor }, { value: "phone", label: t("nlPreviewPhone"), icon: Smartphone }]} />
      </div>
      <div ref={paneRef} className="relative flex h-[min(68vh,760px)] min-h-[420px] justify-center overflow-hidden rounded-control border border-border bg-[#f4f6fa]">
        <iframe
          title={t("nlPreviewLabel")}
          srcDoc={html}
          // Same origin so its images load like the page's; scripts, forms,
          // pop-ups and navigation stay blocked by the sandbox.
          sandbox="allow-same-origin"
          className={cn("shrink-0 border-0 bg-transparent", width === "phone" ? "h-full w-[375px] max-w-full" : "origin-top")}
          style={width === "desktop" ? { width: DESKTOP_WIDTH, height: pane.h / scale, transform: "scale(" + scale + ")" } : undefined}
        />
      </div>
    </div>
  );
}

// ---------- Build your own ----------

const BLOCK_ICONS = { title: Heading1, header: Heading2, text: Pilcrow, image: ImageIcon, link: Link2 };
const NEW_BLOCK = "application/x-nl-new-block";
const MOVE_BLOCK = "application/x-nl-move-block";
const hasType = (e, type) => Array.prototype.indexOf.call(e.dataTransfer.types || [], type) !== -1;

function BlockFields({ block, onChange, idBase }) {
  const t = useT();
  const set = (name, value) => onChange(Object.assign({}, block, { [name]: value }));
  if (block.type === "title" || block.type === "header") {
    return (
      <Input aria-label={t("nlBlock_" + block.type)} value={block.text} maxLength={150} onChange={(e) => set("text", e.target.value)}
        className={block.type === "title" ? "text-heading font-bold" : "font-semibold"} />
    );
  }
  if (block.type === "text") {
    return <Textarea aria-label={t("nlBlock_text")} rows={3} value={block.text} maxLength={3000} onChange={(e) => set("text", e.target.value)} />;
  }
  if (block.type === "image") {
    return (
      <div className="flex flex-col gap-3">
        <ImageField id={idBase + "-img"} label={t("nlBlock_image")} value={{ src: block.src, alt: block.alt }} onChange={(v) => onChange(Object.assign({}, block, v))} />
        <Field label={t("nlImageLink")} htmlFor={idBase + "-url"} hint={t("nlImageLinkHint")}>
          <Input id={idBase + "-url"} type="url" placeholder="https://" value={block.url} maxLength={1000} onChange={(e) => set("url", e.target.value)} />
        </Field>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <LinkFields idBase={idBase} labelText={t("nlLinkText")} value={{ label: block.label, url: block.url }} onChange={(v) => onChange(Object.assign({}, block, v))} />
      <Field label={t("nlLinkStyle")} htmlFor={idBase + "-style"}>
        <Select id={idBase + "-style"} value={block.style} onChange={(e) => set("style", e.target.value)}>
          <option value="button">{t("nlLinkStyle_button")}</option>
          <option value="text">{t("nlLinkStyle_text")}</option>
        </Select>
      </Field>
    </div>
  );
}

// The builder: a palette of blocks above the email's block list. Drag a
// block from the palette and drop it anywhere in the list (a blue line shows
// where it will land), or click it to add it at the end. Blocks move by
// their grip, or with the arrows.
export function BlockBuilder({ content, onChange }) {
  const t = useT();
  const blocks = (content && content.blocks) || [];
  const [dropAt, setDropAt] = useState(null); // index the dragged block would land at
  const [armed, setArmed] = useState(null);
  const [moving, setMoving] = useState(null);
  const full = blocks.length >= MAX_BLOCKS;

  const setBlocks = (next) => onChange(Object.assign({}, content, { blocks: next }));
  const insert = (type, at) => {
    if (full) return;
    const next = blocks.slice();
    next.splice(at, 0, newBlock(type));
    setBlocks(next);
  };
  const move = (from, to) => {
    if (from === to || from + 1 === to) return;
    const next = blocks.slice();
    const [b] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, b);
    setBlocks(next);
  };
  const reset = () => { setDropAt(null); setArmed(null); setMoving(null); };

  function overBlock(e, i) {
    if (!hasType(e, NEW_BLOCK) && !hasType(e, MOVE_BLOCK)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = hasType(e, NEW_BLOCK) ? "copy" : "move";
    const r = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
  }
  function drop(e) {
    if (dropAt === null) return;
    e.preventDefault();
    const type = e.dataTransfer.getData(NEW_BLOCK);
    if (type && BLOCK_TYPES.indexOf(type) !== -1) insert(type, dropAt);
    else if (moving !== null) move(moving, dropAt);
    reset();
  }
  const line = <div className="h-1 rounded-full bg-primary" aria-hidden="true" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-control border border-border bg-surface-sunken p-3">
        <p className="m-0 mb-2 text-meta text-muted">{t(full ? "nlBlocksFull" : "nlBlocksPaletteHint")}</p>
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map((type) => {
            const Icon = BLOCK_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                draggable={!full}
                disabled={full}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData(NEW_BLOCK, type); }}
                onDragEnd={reset}
                onClick={() => insert(type, blocks.length)}
                aria-label={t("nlAddBlock").replace("{block}", t("nlBlock_" + type))}
                className={cn(BUTTON_RESET, "flex min-w-[84px] cursor-grab flex-col items-center gap-1 rounded-control border border-border bg-card px-3 py-2 text-meta font-semibold text-card-foreground transition-colors duration-fast hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50")}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {t("nlBlock_" + type)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2" onDrop={drop} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null); }}>
        {blocks.map((b, i) => {
          const Icon = BLOCK_ICONS[b.type];
          const alignable = b.type !== "image";
          return (
            <div key={b.id}>
              {dropAt === i ? line : null}
              <section
                aria-label={t("nlBlock_" + b.type) + " " + (i + 1)}
                draggable={armed === i}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData(MOVE_BLOCK, b.id); setMoving(i); }}
                onDragEnd={reset}
                onDragOver={(e) => overBlock(e, i)}
                className={cn("mt-2 flex flex-col gap-2.5 rounded-control border border-border bg-card p-3 transition-opacity duration-fast", moving === i && "opacity-50")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-meta font-semibold text-card-foreground">
                    <span className="-ml-1 flex h-7 w-6 cursor-grab items-center justify-center rounded text-muted hover:bg-surface-sunken hover:text-card-foreground active:cursor-grabbing"
                      title={t("nlDragToReorder")} aria-hidden="true" onMouseDown={() => setArmed(i)} onMouseUp={() => setArmed(null)}>
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t("nlBlock_" + b.type)}
                  </span>
                  <div className="flex gap-0.5">
                    {alignable ? (
                      <>
                        <Button type="button" size="icon" variant="ghost" aria-label={t("nlAlignLeft")} aria-pressed={b.align !== "center"}
                          className={b.align !== "center" ? "text-primary" : undefined} onClick={() => setBlocks(blocks.map((x, j) => (j === i ? Object.assign({}, x, { align: "left" }) : x)))}>
                          <AlignLeft className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" aria-label={t("nlAlignCenter")} aria-pressed={b.align === "center"}
                          className={b.align === "center" ? "text-primary" : undefined} onClick={() => setBlocks(blocks.map((x, j) => (j === i ? Object.assign({}, x, { align: "center" }) : x)))}>
                          <AlignCenter className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                    <Button type="button" size="icon" variant="ghost" aria-label={t("nlMoveUp")} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={t("nlMoveDown")} disabled={i === blocks.length - 1} onClick={() => move(i, i + 2)}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={t("nlRemoveBlock")} onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                  </div>
                </div>
                <BlockFields block={b} idBase={"nl-b-" + b.id} onChange={(v) => setBlocks(blocks.map((x, j) => (j === i ? v : x)))} />
              </section>
            </div>
          );
        })}
        <div
          onDragOver={(e) => { if (hasType(e, NEW_BLOCK) || hasType(e, MOVE_BLOCK)) { e.preventDefault(); setDropAt(blocks.length); } }}
          className={cn("mt-2 flex items-center justify-center rounded-control border-2 border-dashed px-3 text-center text-meta transition-colors duration-fast",
            blocks.length ? "min-h-[56px]" : "min-h-[140px]",
            dropAt === blocks.length ? "border-primary bg-primary-tint text-primary" : "border-border text-muted")}
        >
          {t(blocks.length ? "nlBlocksDropEnd" : "nlBlocksEmpty")}
        </div>
      </div>
    </div>
  );
}
