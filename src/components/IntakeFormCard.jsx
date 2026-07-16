// IntakeFormCard.jsx -- fillable "Case Manager / Client Intake Form", built
// from the org's Word intake form. Lives on the Case Management page next to
// AddClientCard/ImportContactsCard (same collapsible-Card idiom). Captures
// the full intake in local state and can render a print-ready copy of the
// filled form in a new tab, so staff can "Save as PDF" or print it.
// Layout mirrors the org's paper form: numbered sections in a two-column
// masonry (1,2,5,6,8 left / 3,4,7 right), with Authorization spanning full
// width at the end.
import { useState } from "react";
import {
  AlertTriangle, Briefcase, ChevronDown, ChevronUp, ClipboardList, FileText,
  Home, MapPin, Phone, Printer, ShieldCheck, Users, UsersRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { cn } from "../lib/cn.js";

const EMPTY_CHILD = { name: "", age: "", gender: "", school: "", grade: "", custody: "" };

const EMPTY_INTAKE = {
  intakeDate: "", usEntryDate: "",
  fullName: "", dob: "", gender: "", address: "", city: "", state: "RI", zip: "", phone: "", email: "",
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

function Field({ label, value, onChange, type, placeholder, className, inputMode }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-semibold text-card-foreground">{label}</label>
      <input
        type={type || "text"}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 min-h-0 w-full rounded-lg border border-border bg-transparent px-4 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
    </div>
  );
}

// InlineField -- label to the left, input filling the rest of the row.
// Matches the Housing Information section's "question: [box]" layout.
function InlineField({ label, value, onChange, placeholder, className }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <label className="text-sm font-semibold text-card-foreground sm:max-w-[60%]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 min-h-0 w-full rounded-lg border border-border bg-transparent px-4 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 sm:w-48"
      />
    </div>
  );
}

function RadioGroup({ label, name, value, onChange, options, className, vertical }) {
  return (
    <div className={className}>
      {label ? <label className="mb-1 block text-sm font-semibold text-card-foreground">{label}</label> : null}
      <div className={vertical ? "flex flex-col gap-1.5" : "flex flex-wrap gap-x-4 gap-y-1.5"}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
            <input type="radio" name={name} checked={value === opt} onChange={() => onChange(opt)} className="h-3.5 w-3.5 accent-primary" />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckboxGroup({ label, values, onToggle, options, className, cols }) {
  const colsClass = cols === 1 ? "" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 md:grid-cols-3";
  return (
    <div className={className}>
      {label ? <label className="mb-1 block text-sm font-semibold text-card-foreground">{label}</label> : null}
      <div className={cn("grid grid-cols-1 gap-1.5", colsClass)}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
            <input type="checkbox" checked={values.indexOf(opt) !== -1} onChange={() => onToggle(opt)} className="h-3.5 w-3.5 accent-primary" />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

// Section -- a standalone numbered card (number badge + icon chip + title),
// matching the reference form's per-section card treatment.
function Section({ number, icon: Icon, title, children, className }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-6 shadow-card", className)}>
      <div className="mb-5 flex items-center gap-3 rounded-lg bg-primary-tint px-3 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {number}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="m-0 text-sm font-bold uppercase leading-none tracking-wide text-primary">{title}</span>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function esc(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPrintHtml(f) {
  const row = (label, value) => "<div class=\"row\"><span class=\"lbl\">" + esc(label) + ":</span> <span class=\"val\">" + esc(value) + "</span></div>";
  const list = (arr) => (arr && arr.length ? arr.map(esc).join(", ") : "—");
  const childrenRows = f.children
    .filter((c) => c.name.trim())
    .map((c, i) => "<div class=\"row\">Child " + (i + 1) + ": " + esc(c.name) + " &mdash; Age " + esc(c.age) + ", " + esc(c.gender) + ", School: " + esc(c.school) + ", Grade: " + esc(c.grade) + ", Custody: " + esc(c.custody) + "</div>")
    .join("");

  return "<!doctype html><html><head><meta charset=\"utf-8\"><title>Client Intake Form - " + esc(f.fullName || "Unnamed") + "</title>" +
    "<style>body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;padding:32px;max-width:800px;margin:0 auto}" +
    "h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:#2a5;margin:20px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}" +
    ".row{margin:3px 0}.lbl{font-weight:bold}@media print{body{padding:0}}</style></head><body>" +
    "<h1>Case Manager / Client Intake Form</h1>" +
    row("Intake Date", f.intakeDate) + row("U.S Entry Date", f.usEntryDate) +
    "<h2>Personal Information</h2>" +
    row("Name", f.fullName) + row("DOB", f.dob) + row("Gender", f.gender) +
    row("Address", f.address) + row("City", f.city) + row("State", f.state) + row("Zip", f.zip) +
    row("Telephone", f.phone) + row("Email", f.email) +
    "<h2>Emergency Contact</h2>" +
    row("Name", f.ecName) + row("Telephone", f.ecPhone) + row("Primary Language", f.primaryLanguage) +
    row("Need Translator?", f.needTranslator) + row("Education", f.education) +
    "<h2>Employment</h2>" +
    row("Social Security Number", f.ssn) + row("Working?", f.working) +
    row("Immigration Status", f.immigrationStatus + (f.immigrationStatusOther ? " (" + f.immigrationStatusOther + ")" : "")) +
    row("Job Looking For", f.jobLookingFor) + row("Job Type", f.jobType) + row("Skills", f.skills) +
    row("Owns a Car?", f.ownCar) + row("License Type", f.licenseType) +
    "<h2>Additional Details</h2>" +
    row("Marital Status", f.maritalStatus) + row("Identity Verification", f.identityVerification) +
    row("Benefit", list(f.benefits)) + row("Medical Insurance?", f.medicalInsurance) +
    row("Medical Health Condition", f.medicalHealthCondition + (f.medicalHealthOther ? " (" + f.medicalHealthOther + ")" : "")) +
    row("Mental Health Condition", f.mentalHealthCondition + (f.mentalHealthOther ? " (" + f.mentalHealthOther + ")" : "")) +
    "<h2>Barriers</h2>" + row("", list(f.barriers)) +
    "<h2>Referral</h2>" + row("", list(f.referrals)) +
    "<h2>Family Composition</h2>" + row("How many Children?", f.numChildren) + childrenRows +
    row("Head of Household?", f.headOfHousehold) +
    "<h2>Housing</h2>" + row("Housing Type", list(f.housingType)) + row("Bedrooms Needed", f.bedroomsNeeded) +
    row("Preferred Location", f.preferredLocation) + row("Monthly Rent/Utilities Budget", f.monthlyBudget) +
    row("Need Furniture?", f.needFurniture) +
    "<h2>Authorization for Release of Information</h2>" + row("Authorized?", f.authorizeRelease) +
    row("Client Name (Print)", f.clientName) + row("Client Signature", f.clientSignature) + row("Client Date", f.clientDate) +
    row("Case Manager Name (Print)", f.caseManagerName) + row("Case Manager Signature", f.caseManagerSignature) + row("Case Manager Date", f.caseManagerDate) +
    "</body></html>";
}

function SectionCardHeader({ icon: Icon, title, collapsed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex min-h-0 w-full items-center gap-3 border-0 bg-transparent p-0 text-left"
    >
      {collapsed ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronUp className="h-4 w-4 shrink-0 text-muted" />}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <CardTitle className="m-0">{title}</CardTitle>
    </button>
  );
}

function initialIntake(client) {
  if (!client) return EMPTY_INTAKE;
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

export default function IntakeFormCard({ collapsed, onToggle, client, bare }) {
  const [f, setF] = useState(() => initialIntake(client));

  function set(name, value) { setF((prev) => Object.assign({}, prev, { [name]: value })); }
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

  function downloadFilledForm() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintHtml(f));
    win.document.close();
    win.focus();
    win.print();
  }

  function clearForm() {
    setF(initialIntake(client));
  }

  const showContent = bare || !collapsed;

  return (
    <Card className={bare ? "" : "mb-5"}>
      {bare ? null : (
        <CardHeader className="space-y-0">
          <SectionCardHeader icon={ClipboardList} title="Client Intake Form" collapsed={collapsed} onToggle={onToggle} />
        </CardHeader>
      )}
      {showContent && (
        <CardContent className={bare ? "space-y-5" : "space-y-5 pt-0"}>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Intake Date" type="date" value={f.intakeDate} onChange={(v) => set("intakeDate", v)} />
              <Field label="U.S Entry Date" type="date" value={f.usEntryDate} onChange={(v) => set("usEntryDate", v)} />
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            {/* Left column: 1 Personal, 2 Emergency Contact, 5 Barrier, 6 Referral, 8 Housing */}
            <div className="space-y-5">
              <Section number={1} icon={MapPin} title="Personal Information">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="First and Last Name" value={f.fullName} onChange={(v) => set("fullName", v)} />
                  <Field label="DOB" type="date" value={f.dob} onChange={(v) => set("dob", v)} />
                </div>
                <RadioGroup label="Gender" name="gender" value={f.gender} onChange={(v) => set("gender", v)} options={["Male", "Female"]} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Address" value={f.address} onChange={(v) => set("address", v)} />
                  <Field label="City" value={f.city} onChange={(v) => set("city", v)} />
                  <Field label="State" value={f.state} onChange={(v) => set("state", v)} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Zip Code" value={f.zip} onChange={(v) => set("zip", v)} />
                  <Field label="Telephone" value={f.phone} onChange={(v) => set("phone", v)} />
                  <Field label="Email" value={f.email} onChange={(v) => set("email", v)} />
                </div>
                <RadioGroup label="Education" name="education" value={f.education} onChange={(v) => set("education", v)} options={["High School", "Associate", "Bachelor", "Masters", "Doctorate"]} />
              </Section>

              <Section number={2} icon={Phone} title="Emergency Contact">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Name" value={f.ecName} onChange={(v) => set("ecName", v)} />
                  <Field label="Telephone" value={f.ecPhone} onChange={(v) => set("ecPhone", v)} />
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
                  <Field label="Social Security Number" placeholder="XXX-XX-XXXX" value={f.ssn} onChange={(v) => set("ssn", v)} />
                  <RadioGroup label="Are you Working?" name="working" value={f.working} onChange={(v) => set("working", v)} options={["YES", "NO"]} />
                </div>
                <RadioGroup label="Immigration Status" name="immigrationStatus" value={f.immigrationStatus} onChange={(v) => set("immigrationStatus", v)} options={IMMIGRATION_OPTIONS} />
                {f.immigrationStatus === "Pending Case" && (
                  <Field label="Pending Case Detail" value={f.immigrationStatusOther} onChange={(v) => set("immigrationStatusOther", v)} />
                )}
                <Field label="What kind of job are you looking for?" placeholder="e.g. Customer Service, Office Assistant, Driver" value={f.jobLookingFor} onChange={(v) => set("jobLookingFor", v)} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RadioGroup label="Job Type" name="jobType" value={f.jobType} onChange={(v) => set("jobType", v)} options={["Full time", "Part Time"]} />
                </div>
                <Field label="Skills" placeholder="e.g. Microsoft Office, Cleaning, Cooking, etc." value={f.skills} onChange={(v) => set("skills", v)} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RadioGroup label="Do you own a car?" name="ownCar" value={f.ownCar} onChange={(v) => set("ownCar", v)} options={["YES", "NO"]} />
                  <RadioGroup label="License Type" name="licenseType" value={f.licenseType} onChange={(v) => set("licenseType", v)} options={["Permit", "Driver's License"]} />
                </div>
              </Section>

              <Section number={4} icon={FileText} title="Additional Details">
                <RadioGroup label="Marital Status" name="maritalStatus" value={f.maritalStatus} onChange={(v) => set("maritalStatus", v)} options={["Married", "Single", "Divorced", "Separated", "Widowed"]} />
                <Field label="Identity Verification" placeholder="e.g. Passport, State ID, etc." value={f.identityVerification} onChange={(v) => set("identityVerification", v)} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CheckboxGroup label="Benefit" values={f.benefits} onToggle={(o) => toggleIn("benefits", o)} options={["Cash", "SNAP"]} cols={1} />
                  <RadioGroup label="Medical Insurance?" name="medicalInsurance" value={f.medicalInsurance} onChange={(v) => set("medicalInsurance", v)} options={["YES", "NO"]} />
                </div>
                <RadioGroup label="Medical Health Condition" name="medicalHealthCondition" value={f.medicalHealthCondition} onChange={(v) => set("medicalHealthCondition", v)} options={["Good", "Bad", "Other"]} />
                {f.medicalHealthCondition === "Other" && <Field label="Medical Health Condition (Other)" value={f.medicalHealthOther} onChange={(v) => set("medicalHealthOther", v)} />}
                <RadioGroup label="Mental Health Condition" name="mentalHealthCondition" value={f.mentalHealthCondition} onChange={(v) => set("mentalHealthCondition", v)} options={["Good", "Bad", "Other"]} />
                {f.mentalHealthCondition === "Other" && <Field label="Mental Health Condition (Other)" value={f.mentalHealthOther} onChange={(v) => set("mentalHealthOther", v)} />}
              </Section>

              <Section number={7} icon={UsersRound} title="Family Composition">
                <Field label="How many Children?" type="text" inputMode="numeric" placeholder="e.g. 3" value={f.numChildren} onChange={(v) => set("numChildren", v)} className="max-w-xs" />
                {f.children.map((c, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-border">
                    <div className="border-b border-border bg-primary-tint px-3 py-2 text-sm font-semibold text-primary">Child {i + 1}</div>
                    <div className="space-y-3 p-3">
                      <Field label="Name" value={c.name} onChange={(v) => setChild(i, "name", v)} />
                      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                        <Field label="Age" type="text" inputMode="numeric" placeholder="e.g. 8" value={c.age} onChange={(v) => setChild(i, "age", v)} />
                        <RadioGroup label="Gender" name={"childGender" + i} value={c.gender} onChange={(v) => setChild(i, "gender", v)} options={["Male", "Female"]} />
                      </div>
                      <Field label="School" value={c.school} onChange={(v) => setChild(i, "school", v)} />
                      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                        <Field label="Grade" placeholder="e.g. 3rd" value={c.grade} onChange={(v) => setChild(i, "grade", v)} />
                        <RadioGroup label="Custody" name={"childCustody" + i} value={c.custody} onChange={(v) => setChild(i, "custody", v)} options={["YES", "NO"]} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-center">
                  <button type="button" onClick={addChild} className="text-sm font-semibold text-primary hover:underline">
                    + Add Another Child
                  </button>
                </div>
                <RadioGroup label="Are you the head of Household?" name="headOfHousehold" value={f.headOfHousehold} onChange={(v) => set("headOfHousehold", v)} options={["YES", "NO"]} />
              </Section>
            </div>
          </div>

          <Section number={9} icon={ShieldCheck} title="Authorization for Release of Information">
            <RadioGroup label="I authorize the release of my information" name="authorizeRelease" value={f.authorizeRelease} onChange={(v) => set("authorizeRelease", v)} options={["YES", "NO"]} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Client Name (Print)" value={f.clientName} onChange={(v) => set("clientName", v)} />
              <Field label="Client Signature" value={f.clientSignature} onChange={(v) => set("clientSignature", v)} placeholder="Type full name to sign" />
              <Field label="Client Date" type="date" value={f.clientDate} onChange={(v) => set("clientDate", v)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Case Manager Name (Print)" value={f.caseManagerName} onChange={(v) => set("caseManagerName", v)} />
              <Field label="Case Manager Signature" value={f.caseManagerSignature} onChange={(v) => set("caseManagerSignature", v)} placeholder="Type full name to sign" />
              <Field label="Case Manager Date" type="date" value={f.caseManagerDate} onChange={(v) => set("caseManagerDate", v)} />
            </div>
          </Section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={downloadFilledForm}
              variant="secondary"
              className="gap-2 rounded-full border-navy bg-navy px-6 text-navy-foreground hover:bg-navy-dark"
            >
              <Printer className="h-4 w-4" /> Download Filled Form (PDF)
            </Button>
            <button
              type="button"
              onClick={clearForm}
              className="h-10 flex-1 rounded-full border border-border bg-background text-sm font-semibold text-primary hover:bg-primary-tint"
            >
              Clear Form
            </button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
