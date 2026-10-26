// IntakeFormCard.jsx -- fillable "Case Manager / Client Intake Form", built
// from the org's Word intake form. Lives on the Case Management page next to
// AddClientCard/ImportContactsCard (same collapsible-Card idiom). Captures
// the full intake in local state and can render a print-ready copy of the
// filled form in a new tab, so staff can "Save as PDF" or print it.
// Layout mirrors the org's paper form: numbered sections in a two-column
// masonry (1,2,5,6,8 left / 3,4,7 right), with Authorization spanning full
// width at the end.
import { useId, useRef, useState } from "react";
import { loadPdfLibs } from "../lib/pdfLibs.js";
import {
  AlertTriangle, Briefcase, Camera, Check, ChevronDown, FileText,
  Home, MapPin, Phone, Plus, Printer, Save, ShieldCheck, Users, UsersRound,
} from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { Card, CardTitle } from "./ui/card.jsx";
import { BUTTON_RESET, Button } from "./ui/button.jsx";
import { Field, Input } from "./ui/field.jsx";
import { SectionCard } from "./ui/section-card.jsx";
import { cn } from "../lib/cn.js";
import { updateClientRecord } from "../lib/clientsData.js";

const EMPTY_CHILD = { name: "", age: "", gender: "", school: "", grade: "", custody: "" };

const EMPTY_INTAKE = {
  intakeDate: "", usEntryDate: "",
  fullName: "", dob: "", gender: "", address: "", city: "", state: "RI", zip: "", phone: "", email: "",
  raceEthnicity: "", householdIncomeBracket: "", householdSize: "",
  ecName: "", ecPhone: "", primaryLanguage: "", needTranslator: "", education: "",
  ssn: "", working: "", immigrationStatus: "", immigrationStatusOther: "", jobLookingFor: "", jobType: "", skills: "", ownCar: "", licenseType: "",
  maritalStatus: "", identityVerification: "", medicalInsurance: "", medicalHealthCondition: "", medicalHealthOther: "", mentalHealthCondition: "", mentalHealthOther: "",
  barriers: [], benefits: [], referrals: [],
  numChildren: "", children: [EMPTY_CHILD, EMPTY_CHILD], headOfHousehold: "",
  housingType: [], bedroomsNeeded: "", preferredLocation: "", monthlyBudget: "", needFurniture: "",
  authorizeRelease: "", clientName: "", clientSignature: "", clientDate: "", caseManagerName: "", caseManagerSignature: "", caseManagerDate: "",
};

const BARRIER_OPTIONS = ["Income", "Housing", "Transportation", "Employment", "Language", "Legal", "Domestic Violence", "Substance Abuse", "Bad Landlord History", "Previous Eviction", "Criminal Background", "Health insurance", "School"];
const REFERRAL_OPTIONS = ["Counseling", "Primary Care Physician", "Shelter", "Housing", "Job Search", "Education", "Training", "Medical", "Immigration Services", "Childcare", "Parenting/Parenting Aid", "Domestic Violence Specialist", "Food Resources", "Benefits", "DHS", "Healthsource RI", "Other"];
const HOUSING_OPTIONS = ["Apartment Rental", "Housing Authority", "Voucher"];
const IMMIGRATION_OPTIONS = ["US Citizen", "Permanent Resident", "Visa", "TPS", "CBP1", "Humanitarian parole", "Pending Case"];
const RACE_ETHNICITY_OPTIONS = ["American Indian/Alaska Native", "Asian", "Black/African American", "Hispanic/Latino", "Native Hawaiian/Pacific Islander", "White", "Two or More Races", "Prefer not to say"];
const INCOME_BRACKET_OPTIONS = ["Under $15,000", "$15,000-$29,999", "$30,000-$44,999", "$45,000-$59,999", "$60,000+", "Prefer not to say"];

// Local wrappers over the ui Field/Input so the ~60 form questions below
// stay one line each. Ids come from useId: the visible label is wired to its
// control, and the print/PDF export clones the DOM as-is.
function IntakeField({ label, value, onChange, type, placeholder, className, inputMode }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Input id={id} type={type || "text"} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}

// InlineField -- label to the left, input filling the rest of the row.
// Matches the Housing Information section's "question: [box]" layout.
function InlineField({ label, value, onChange, placeholder, className }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4", className)}>
      <label htmlFor={id} className="m-0 text-meta font-semibold text-card-foreground sm:max-w-[60%]">{label}</label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="sm:w-48 sm:shrink-0" />
    </div>
  );
}

// fieldset/legend so a screen reader announces the question with each
// option. main.css leaves fieldset's UA border alone, hence border-0.
const FIELDSET = "m-0 min-w-0 border-0 p-0";
const LEGEND = "mb-2 p-0 text-meta font-semibold text-card-foreground";
const OPTION = "m-0 flex min-h-8 cursor-pointer items-center gap-2 text-ui font-medium text-card-foreground";
const OPTION_INPUT = "h-4 w-4 shrink-0 cursor-pointer accent-primary";

function RadioGroup({ label, name, value, onChange, options, className, vertical }) {
  return (
    <fieldset className={cn(FIELDSET, className)}>
      {label ? <legend className={LEGEND}>{label}</legend> : null}
      <div className={vertical ? "flex flex-col gap-1" : "flex flex-wrap gap-x-5 gap-y-1"}>
        {options.map((opt) => (
          <label key={opt} className={OPTION}>
            <input type="radio" name={name} checked={value === opt} onChange={() => onChange(opt)} className={OPTION_INPUT} />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckboxGroup({ label, values, onToggle, options, className, cols }) {
  const colsClass = cols === 1 ? "" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 md:grid-cols-3";
  return (
    <fieldset className={cn(FIELDSET, className)}>
      {label ? <legend className={LEGEND}>{label}</legend> : null}
      <div className={cn("grid grid-cols-1 gap-x-4 gap-y-1", colsClass)}>
        {options.map((opt) => (
          <label key={opt} className={OPTION}>
            <input type="checkbox" checked={values.indexOf(opt) !== -1} onChange={() => onToggle(opt)} className={OPTION_INPUT} />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Section -- one numbered SectionCard per part of the paper form: the
// number chip + icon keep the paper form's numbering easy to follow.
function Section({ number, icon: Icon, title, children, className }) {
  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-primary text-meta font-bold text-primary-foreground tabular-nums">
            {number}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {title}
        </span>
      }
    >
      <div className="space-y-5">{children}</div>
    </SectionCard>
  );
}

function esc(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Same anatomy as Case Management's other collapsible cards: title on the
// left, a 36px chevron control on the right that turns when open. The whole
// header row is the button, so the target stays large.
function SectionCardHeader({ title, collapsed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={BUTTON_RESET + " group flex w-full items-center justify-between gap-3 rounded-control text-left text-card-foreground focus-visible:outline-none focus-visible:ring-2"}
    >
      <CardTitle className="m-0">{title}</CardTitle>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border bg-card text-card-foreground transition-colors duration-fast group-hover:border-line-strong group-hover:bg-surface-sunken [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11">
        <ChevronDown className={"h-[18px] w-[18px] transition-transform duration-fast" + (collapsed ? "" : " rotate-180")} aria-hidden="true" />
      </span>
    </button>
  );
}

function initialIntake(client) {
  if (!client) return EMPTY_INTAKE;
  if (client.intakeForm) return Object.assign({}, EMPTY_INTAKE, client.intakeForm);
  return Object.assign({}, EMPTY_INTAKE, {
    fullName: [client.firstName, client.lastName].filter(Boolean).join(" "),
    dob: client.dob || "",
    address: client.street || "",
    city: client.city || "",
    zip: client.zip || "",
    phone: client.phone || "",
    email: client.email || "",
    intakeDate: client.intakeDate || "",
  });
}

function formatSavedAt(iso, t) {
  if (!iso) return "";
  const d = new Date(iso);
  return t("intakeSavedAtLabel") + " " + d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function IntakeFormCard({ collapsed, onToggle, client, bare }) {
  const t = useT();
  const [f, setF] = useState(() => initialIntake(client));
  const [savedAt, setSavedAt] = useState(client && client.intakeFormSavedAt ? client.intakeFormSavedAt : null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

  function set(name, value) {
    setF((prev) => Object.assign({}, prev, { [name]: value }));
    setSavedAt(null);
  }
  function toggleIn(name, opt) {
    setF((prev) => {
      const cur = prev[name];
      const next = cur.indexOf(opt) !== -1 ? cur.filter((v) => v !== opt) : cur.concat([opt]);
      return Object.assign({}, prev, { [name]: next });
    });
  }
  function setChild(i, key, value) {
    setF((prev) => {
      const children = prev.children.slice();
      children[i] = Object.assign({}, children[i], { [key]: value });
      return Object.assign({}, prev, { children });
    });
  }
  function addChild() {
    setF((prev) => Object.assign({}, prev, { children: prev.children.concat([Object.assign({}, EMPTY_CHILD)]) }));
  }

  // downloadFilledForm -- prints the form as it actually looks on screen
  // (same section cards/badges/layout), not a plain label:value dump. React
  // controlled inputs don't keep their live value in the DOM's `value`
  // attribute, so it's copied over explicitly onto the clone before it's
  // handed to the print window; everything else (classes, structure) is a
  // straight clone, and the app's own stylesheet is copied into the print
  // window's <head> so the Tailwind utility classes still resolve there.
  function downloadFilledForm() {
    const source = printRef.current;
    if (!source) return;
    const win = window.open("", "_blank");
    if (!win) return;

    const clone = source.cloneNode(true);
    const originalFields = source.querySelectorAll("input, textarea, select");
    const clonedFields = clone.querySelectorAll("input, textarea, select");
    originalFields.forEach((orig, i) => {
      const el = clonedFields[i];
      if (!el) return;
      if (orig.type === "checkbox" || orig.type === "radio") {
        if (orig.checked) el.setAttribute("checked", "checked");
        el.checked = orig.checked;
      } else {
        el.setAttribute("value", orig.value);
        el.value = orig.value;
      }
      el.setAttribute("disabled", "disabled");
    });

    const headHtml = Array.from(document.querySelectorAll("head style, head link[rel='stylesheet']"))
      .map((n) => n.outerHTML)
      .join("");
    const theme = document.documentElement.getAttribute("data-theme") || "";

    win.document.write(
      "<!doctype html><html data-theme=\"" + theme + "\"><head><meta charset=\"utf-8\">" +
      "<title>Client Intake Form - " + esc(f.fullName || "Unnamed") + "</title>" +
      headHtml +
      "<style>body{background:var(--bg);padding:24px}@media print{body{padding:0}}</style>" +
      "</head><body class=\"" + document.body.className + "\">" +
      "<div class=\"mx-auto max-w-5xl space-y-5\">" + clone.innerHTML + "</div>" +
      "</body></html>"
    );
    win.document.close();
    win.focus();
    win.print();
  }

  // exportAsPdf -- screenshots the filled form (as it looks on screen right
  // now) with html2canvas and drops that image into a jsPDF document, sliced
  // across A4 pages. Different from downloadFilledForm above: that one opens
  // the OS print dialog so staff can print or "Save as PDF" manually; this
  // one generates and downloads an actual .pdf file directly, no dialog.
  async function exportAsPdf() {
    const source = printRef.current;
    if (!source) return;
    setExporting(true);
    try {
      const { html2canvas, jsPDF } = await loadPdfLibs();
      const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#ffffff";
      const canvas = await html2canvas(source, { scale: 2, backgroundColor: bg, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("Intake Form - " + (f.fullName || "Unnamed") + ".pdf");
    } catch (err) {
      console.warn("exportAsPdf failed", err);
    } finally {
      setExporting(false);
    }
  }

  function clearForm() {
    setF(initialIntake(client));
    setSavedAt(null);
    setSaveError("");
  }

  async function saveForm() {
    if (!client || !client.id) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateClientRecord(client.id, {
        intakeForm: f, intakeFormSavedAt: new Date().toISOString(),
        raceEthnicity: f.raceEthnicity, gender: f.gender,
        householdIncomeBracket: f.householdIncomeBracket, householdSize: f.householdSize,
      });
      setSavedAt(updated.intakeFormSavedAt);
    } catch (err) {
      console.warn("saveForm failed", err);
      setSaveError(t("intakeSaveError"));
    } finally {
      setSaving(false);
    }
  }

  const showContent = bare || !collapsed;

  return (
    // Not bare (Case Management): the toggle sits in its own Card, matching
    // the page's other collapsible cards, and the open form's section cards
    // stack below it -- never cards inside a card. Bare (Client Profile tab):
    // just the sections.
    <div className={bare ? undefined : "mb-5"}>
      {bare ? null : (
        <Card className="p-5 sm:px-6">
          <SectionCardHeader title={t("intakeFormTitle")} collapsed={collapsed} onToggle={onToggle} />
        </Card>
      )}
      {showContent && (
        <div className={bare ? "space-y-5" : "mt-5 space-y-5"}>
          <div ref={printRef} className="space-y-5">
          <SectionCard>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <IntakeField label="Intake Date" type="date" value={f.intakeDate} onChange={(v) => set("intakeDate", v)} />
              <IntakeField label="U.S Entry Date" type="date" value={f.usEntryDate} onChange={(v) => set("usEntryDate", v)} />
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            {/* Left column: 1 Personal, 2 Emergency Contact, 5 Barrier, 6 Referral, 8 Housing */}
            <div className="space-y-5">
              <Section number={1} icon={MapPin} title="Personal Information">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <IntakeField label="First and Last Name" placeholder="First and last name" value={f.fullName} onChange={(v) => set("fullName", v)} />
                  <IntakeField label="DOB" type="date" value={f.dob} onChange={(v) => set("dob", v)} />
                </div>
                <RadioGroup label="Gender" name="gender" value={f.gender} onChange={(v) => set("gender", v)} options={["Male", "Female"]} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <IntakeField label="Address" placeholder="Street address, apartment, suite, etc." value={f.address} onChange={(v) => set("address", v)} />
                  <IntakeField label="City" placeholder="e.g. Providence" value={f.city} onChange={(v) => set("city", v)} />
                  <IntakeField label="State" placeholder="RI" value={f.state} onChange={(v) => set("state", v)} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <IntakeField label="Zip Code" placeholder="e.g. 02903" value={f.zip} onChange={(v) => set("zip", v)} />
                  <IntakeField label="Telephone" placeholder="(555) 123-4567" value={f.phone} onChange={(v) => set("phone", v)} />
                  <IntakeField label="Email" placeholder="name@example.com" value={f.email} onChange={(v) => set("email", v)} />
                </div>
                <RadioGroup label="Education" name="education" value={f.education} onChange={(v) => set("education", v)} options={["High School", "Associate", "Bachelor", "Masters", "Doctorate"]} />
                <RadioGroup label="Race/Ethnicity" name="raceEthnicity" value={f.raceEthnicity} onChange={(v) => set("raceEthnicity", v)} options={RACE_ETHNICITY_OPTIONS} vertical />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RadioGroup label="Household Income" name="householdIncomeBracket" value={f.householdIncomeBracket} onChange={(v) => set("householdIncomeBracket", v)} options={INCOME_BRACKET_OPTIONS} vertical />
                  <IntakeField label="Household Size" type="text" inputMode="numeric" placeholder="e.g. 4" value={f.householdSize} onChange={(v) => set("householdSize", v)} />
                </div>
              </Section>

              <Section number={2} icon={Phone} title="Emergency Contact">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <IntakeField label="Name" placeholder="Full name" value={f.ecName} onChange={(v) => set("ecName", v)} />
                  <IntakeField label="Telephone" placeholder="(555) 123-4567" value={f.ecPhone} onChange={(v) => set("ecPhone", v)} />
                </div>
                <RadioGroup label="Primary Language" name="primaryLanguage" value={f.primaryLanguage} onChange={(v) => set("primaryLanguage", v)} options={["Creole", "French", "English", "Spanish"]} />
                <RadioGroup label="Need Translator?" name="needTranslator" value={f.needTranslator} onChange={(v) => set("needTranslator", v)} options={["YES", "NO"]} />
              </Section>

              <Section number={5} icon={AlertTriangle} title="Barrier (Check all that apply)">
                <CheckboxGroup values={f.barriers} onToggle={(o) => toggleIn("barriers", o)} options={BARRIER_OPTIONS} />
              </Section>

              <Section number={6} icon={Users} title="Referral (Check all that apply)">
                <CheckboxGroup values={f.referrals} onToggle={(o) => toggleIn("referrals", o)} options={REFERRAL_OPTIONS} />
              </Section>

              <Section number={8} icon={Home} title="Housing Information">
                <CheckboxGroup label="Housing Type" values={f.housingType} onToggle={(o) => toggleIn("housingType", o)} options={HOUSING_OPTIONS} cols={3} />
                <InlineField label="How many bedrooms are you looking for?" value={f.bedroomsNeeded} onChange={(v) => set("bedroomsNeeded", v)} placeholder="e.g. 2" />
                <InlineField label="Where would you prefer to be located?" value={f.preferredLocation} onChange={(v) => set("preferredLocation", v)} placeholder="e.g. Providence, Warwick, Cranston" />
                <InlineField label="How much can you afford for monthly rent and utilities?" value={f.monthlyBudget} onChange={(v) => set("monthlyBudget", v)} placeholder="e.g. $1,200" />
                <RadioGroup label="Do you need furniture?" name="needFurniture" value={f.needFurniture} onChange={(v) => set("needFurniture", v)} options={["YES", "NO"]} />
              </Section>
            </div>

            {/* Right column: 3 Employment, 4 Additional Details, 7 Family Composition */}
            <div className="space-y-5">
              <Section number={3} icon={Briefcase} title="Employment Information">
                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                  <IntakeField label="Social Security Number" placeholder="XXX-XX-XXXX" value={f.ssn} onChange={(v) => set("ssn", v)} />
                  <RadioGroup label="Are you Working?" name="working" value={f.working} onChange={(v) => set("working", v)} options={["YES", "NO"]} />
                </div>
                <RadioGroup label="Immigration Status" name="immigrationStatus" value={f.immigrationStatus} onChange={(v) => set("immigrationStatus", v)} options={IMMIGRATION_OPTIONS} />
                {f.immigrationStatus === "Pending Case" && (
                  <IntakeField label="Pending Case Detail" placeholder="Describe the pending case" value={f.immigrationStatusOther} onChange={(v) => set("immigrationStatusOther", v)} />
                )}
                <IntakeField label="What kind of job are you looking for?" placeholder="e.g. Customer Service, Office Assistant, Driver" value={f.jobLookingFor} onChange={(v) => set("jobLookingFor", v)} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RadioGroup label="Job Type" name="jobType" value={f.jobType} onChange={(v) => set("jobType", v)} options={["Full time", "Part Time"]} />
                </div>
                <IntakeField label="Skills" placeholder="e.g. Microsoft Office, Cleaning, Cooking, etc." value={f.skills} onChange={(v) => set("skills", v)} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RadioGroup label="Do you own a car?" name="ownCar" value={f.ownCar} onChange={(v) => set("ownCar", v)} options={["YES", "NO"]} />
                  <RadioGroup label="License Type" name="licenseType" value={f.licenseType} onChange={(v) => set("licenseType", v)} options={["Permit", "Driver's License"]} />
                </div>
              </Section>

              <Section number={4} icon={FileText} title="Additional Details">
                <RadioGroup label="Marital Status" name="maritalStatus" value={f.maritalStatus} onChange={(v) => set("maritalStatus", v)} options={["Married", "Single", "Divorced", "Separated", "Widowed"]} />
                <IntakeField label="Identity Verification" placeholder="e.g. Passport, State ID, etc." value={f.identityVerification} onChange={(v) => set("identityVerification", v)} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CheckboxGroup label="Benefit" values={f.benefits} onToggle={(o) => toggleIn("benefits", o)} options={["Cash", "SNAP"]} cols={1} />
                  <RadioGroup label="Medical Insurance?" name="medicalInsurance" value={f.medicalInsurance} onChange={(v) => set("medicalInsurance", v)} options={["YES", "NO"]} />
                </div>
                <RadioGroup label="Medical Health Condition" name="medicalHealthCondition" value={f.medicalHealthCondition} onChange={(v) => set("medicalHealthCondition", v)} options={["Good", "Bad", "Other"]} />
                {f.medicalHealthCondition === "Other" && <IntakeField label="Medical Health Condition (Other)" placeholder="Please specify" value={f.medicalHealthOther} onChange={(v) => set("medicalHealthOther", v)} />}
                <RadioGroup label="Mental Health Condition" name="mentalHealthCondition" value={f.mentalHealthCondition} onChange={(v) => set("mentalHealthCondition", v)} options={["Good", "Bad", "Other"]} />
                {f.mentalHealthCondition === "Other" && <IntakeField label="Mental Health Condition (Other)" placeholder="Please specify" value={f.mentalHealthOther} onChange={(v) => set("mentalHealthOther", v)} />}
              </Section>

              <Section number={7} icon={UsersRound} title="Family Composition">
                <IntakeField label="How many Children?" type="text" inputMode="numeric" placeholder="e.g. 3" value={f.numChildren} onChange={(v) => set("numChildren", v)} className="max-w-xs" />
                {f.children.map((c, i) => (
                  <div key={i} className="overflow-hidden rounded-control border border-border">
                    <div className="border-b border-border bg-surface-sunken px-4 py-2 text-ui font-semibold text-card-foreground">{t("intakeChildLabel")} <span className="tabular-nums">{i + 1}</span></div>
                    <div className="space-y-4 p-4">
                      <IntakeField label="Name" placeholder="Child's full name" value={c.name} onChange={(v) => setChild(i, "name", v)} />
                      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                        <IntakeField label="Age" type="text" inputMode="numeric" placeholder="e.g. 8" value={c.age} onChange={(v) => setChild(i, "age", v)} />
                        <RadioGroup label="Gender" name={"childGender" + i} value={c.gender} onChange={(v) => setChild(i, "gender", v)} options={["Male", "Female"]} />
                      </div>
                      <IntakeField label="School" placeholder="e.g. Roosevelt Elementary" value={c.school} onChange={(v) => setChild(i, "school", v)} />
                      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                        <IntakeField label="Grade" placeholder="e.g. 3rd" value={c.grade} onChange={(v) => setChild(i, "grade", v)} />
                        <RadioGroup label="Custody" name={"childCustody" + i} value={c.custody} onChange={(v) => setChild(i, "custody", v)} options={["YES", "NO"]} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-center">
                  <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={addChild}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> {t("intakeAddChildBtn")}
                  </Button>
                </div>
                <RadioGroup label="Are you the head of Household?" name="headOfHousehold" value={f.headOfHousehold} onChange={(v) => set("headOfHousehold", v)} options={["YES", "NO"]} />
              </Section>
            </div>
          </div>

          <Section number={9} icon={ShieldCheck} title="Authorization for Release of Information">
            <RadioGroup label="I authorize the release of my information" name="authorizeRelease" value={f.authorizeRelease} onChange={(v) => set("authorizeRelease", v)} options={["YES", "NO"]} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <IntakeField label="Client Name (Print)" placeholder="Type full name" value={f.clientName} onChange={(v) => set("clientName", v)} />
              <IntakeField label="Client Signature" value={f.clientSignature} onChange={(v) => set("clientSignature", v)} placeholder="Type full name to sign" />
              <IntakeField label="Client Date" type="date" value={f.clientDate} onChange={(v) => set("clientDate", v)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <IntakeField label="Case Manager Name (Print)" placeholder="Type full name" value={f.caseManagerName} onChange={(v) => set("caseManagerName", v)} />
              <IntakeField label="Case Manager Signature" value={f.caseManagerSignature} onChange={(v) => set("caseManagerSignature", v)} placeholder="Type full name to sign" />
              <IntakeField label="Case Manager Date" type="date" value={f.caseManagerDate} onChange={(v) => set("caseManagerDate", v)} />
            </div>
          </Section>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {client && client.id ? (
              <Button onClick={saveForm} loading={saving}>
                <Save className="h-4 w-4" aria-hidden="true" /> {t("intakeSaveFormBtn")}
              </Button>
            ) : null}
            <Button onClick={downloadFilledForm} variant="secondary">
              <Printer className="h-4 w-4" aria-hidden="true" /> {t("intakeDownloadFilledBtn")}
            </Button>
            <Button onClick={exportAsPdf} loading={exporting} variant="secondary">
              <Camera className="h-4 w-4" aria-hidden="true" /> {t("intakeExportPdfBtn")}
            </Button>
            <Button onClick={clearForm} variant="ghost">
              {t("intakeClearFormBtn")}
            </Button>
            {client && client.id ? (
              <span
                aria-live="polite"
                className={cn("flex items-center gap-1.5 text-ui font-semibold sm:ml-auto", saveError ? "text-tone-danger-ink" : "text-tone-success-ink")}
              >
                {saveError ? saveError : savedAt ? (<><Check className="h-4 w-4" aria-hidden="true" /> {formatSavedAt(savedAt, t)}</>) : null}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
