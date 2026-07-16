// constants.js -- static reference data (services, staff, roles, default
// demo accounts, etc). Pure data, no React dependency.
export var ORG = { name: "New Bridges for Haitian Success", shortName: "NB4HS" };
export var STORE_KEY = "nb4hs_checkin_data_v1";
export var CFG_KEY = "nb4hs_checkin_config_v1";
export var DEFAULT_CHECKIN_URL = "https://checkin.nb4hs.org";
export var LANGS = [
  { code: "en", label: "English" },
  { code: "ht", label: "Kreyòl Ayisyen" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" }
];

export var SERVICES = [
  { key: "adult_education", en: "Adult Education", ht: "Edikasyon pou Adilt", es: "Educación para Adultos", fr: "Éducation des Adultes" },
  { key: "workforce_development", en: "Workforce Development", ht: "Devlopman Mendèv", es: "Desarrollo Laboral", fr: "Développement de la Main-d'Œuvre" },
  { key: "immigration", en: "Immigration", ht: "Imigrasyon", es: "Inmigración", fr: "Immigration" },
  { key: "case_manager", en: "Case Management", ht: "Jesyon Ka", es: "Gestión de Casos", fr: "Gestion de Cas" },
  { key: "food_distribution", en: "Food Distribution", ht: "Distribisyon Manje", es: "Distribución de Alimentos", fr: "Distribution de Nourriture" },
  { key: "workshop", en: "Workshop", ht: "Atelye", es: "Taller", fr: "Atelier" },
  { key: "community_event", en: "Community Event", ht: "Evènman Kominotè", es: "Evento Comunitario", fr: "Événement Communautaire" },
  { key: "housing_assistance", en: "Housing Assistance", ht: "Èd Lojman", es: "Asistencia de Vivienda", fr: "Aide au Logement" },
  { key: "benefits_assistance", en: "Benefits Assistance", ht: "Èd pou Benefis", es: "Asistencia de Beneficios", fr: "Aide aux Prestations" },
  { key: "volunteer", en: "Volunteer", ht: "Volontè", es: "Voluntariado", fr: "Bénévolat" },
  { key: "other", en: "Other", ht: "Lòt", es: "Otro", fr: "Autre" }
];

export var STAFF = [
  { key: "bernard_georges", en: "Bernard Georges", ht: "Bernard Georges", es: "Bernard Georges", fr: "Bernard Georges" },
  { key: "case_manager", en: "Case Manager", ht: "Jesyon Ka", es: "Gestor de Casos", fr: "Gestionnaire de Cas" },
  { key: "job_developer", en: "Job Developer", ht: "Devlopè Travay", es: "Desarrollador de Empleo", fr: "Développeur d'Emploi" },
  { key: "immigration_specialist", en: "Immigration Specialist", ht: "Espesyalis Imigrasyon", es: "Especialista en Inmigración", fr: "Spécialiste en Immigration" },
  { key: "computer_instructor", en: "Computer Instructor", ht: "Enstriktè Òdinatè", es: "Instructor de Informática", fr: "Instructeur en Informatique" },
  { key: "esl_instructor", en: "ESL Instructor", ht: "Enstriktè ESL", es: "Instructor de ESL", fr: "Instructeur ESL" },
  { key: "other", en: "Other", ht: "Lòt", es: "Otro", fr: "Autre" }
];

export var US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

/* Case Management service categories (multi-select per client). */
export var CASE_SERVICES = [
  { key: "referrals", en: "Referrals", ht: "Referans", es: "Referencias", fr: "Références" },
  { key: "benefits", en: "Benefits", ht: "Benefis", es: "Beneficios", fr: "Prestations" },
  { key: "childcare", en: "Childcare", ht: "Gadri Timoun", es: "Cuidado Infantil", fr: "Garde d'Enfants" },
  { key: "education", en: "Education", ht: "Edikasyon", es: "Educación", fr: "Éducation" },
  { key: "employment", en: "Employment", ht: "Travay", es: "Empleo", fr: "Emploi" },
  { key: "housing", en: "Housing", ht: "Lojman", es: "Vivienda", fr: "Logement" },
  { key: "immigration", en: "Immigration", ht: "Imigrasyon", es: "Inmigración", fr: "Immigration" },
  { key: "primary_care", en: "Primary Care", ht: "Swen Primè", es: "Atención Primaria", fr: "Soins Primaires" },
  { key: "transportation", en: "Transportation", ht: "Transpò", es: "Transporte", fr: "Transport" },
  { key: "insurance", en: "Insurance", ht: "Asirans", es: "Seguro", fr: "Assurance" }
];

/* Case Management immigration status options (single-select per client). */
export var IMMIGRATION_STATUSES = [
  { key: "tps", en: "TPS", ht: "TPS", es: "TPS", fr: "TPS" },
  { key: "humanitarian_parole", en: "Humanitarian Parole", ht: "Parol Imanitè", es: "Permiso Humanitario", fr: "Libération Conditionnelle Humanitaire" },
  { key: "permanent_resident", en: "Permanent Resident", ht: "Rezidan Pèmanan", es: "Residente Permanente", fr: "Résident Permanent" },
  { key: "citizen", en: "Citizen", ht: "Sitwayen", es: "Ciudadano", fr: "Citoyen" },
  { key: "no_legal_status", en: "No Legal Status", ht: "Pa Gen Estati Legal", es: "Sin Estatus Legal", fr: "Aucun Statut Légal" },
  { key: "pending_case", en: "Pending Case", ht: "Ka an Atant", es: "Caso Pendiente", fr: "Dossier en Attente" }
];

export var WEEKDAYS = {
  en: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
  ht: ["Dimanch","Lendi","Madi","Mèkredi","Jedi","Vandredi","Samdi"],
  es: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  fr: ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"]
};

/* Adult Education classes. Days use JS Date.getDay() convention: Sun=0, Mon=1 ... Sat=6.
   Level 1 & 2 meet Mon/Wed/Fri, Level 3 meets Tue/Thu, per NB4HS's schedule.
   Each class rolls up under the "adult_education" service so it shows up correctly
   in the existing service reports/dashboard; the specific level is tracked separately
   (visit.className) so search/exports can still show which level a student attends. */
export var DEFAULT_CLASSES = [
  { key: "level1", name: "Level 1", days: [1, 3, 5], service: "adult_education", staff: "esl_instructor", active: true },
  { key: "level2", name: "Level 2", days: [1, 3, 5], service: "adult_education", staff: "esl_instructor", active: true },
  { key: "level3", name: "Level 3", days: [2, 4], service: "adult_education", staff: "esl_instructor", active: true },
  // Online has no fixed in-person days, so it never shows up in the physical
  // office check-in roster (classesMeetingToday() only matches real days) --
  // it only appears as a placement column on the Students page.
  { key: "online", name: "Online", days: [], service: "adult_education", staff: "computer_instructor", active: true }
];

export var ROLES = ["administrator", "staff", "receptionist", "case_manager", "job_developer"];

export var DATE_LOCALE = { en: "en-US", ht: "en-US", es: "es-US", fr: "fr-FR" };
export var PAGE_SIZE = 25;
// NB4HS Design System accent set: Blue/Green/Gold/Purple, cycled for however
// many classroom columns exist -- no random hues, and no non-error red.
export var COLUMN_ACCENTS = ["#2563EB", "#1a7f37", "#D99E32", "#6b21a8"];
export var NAV_GROUP = { dashboard: "core", checkin: "core", checkout: "core", search: "core", reports: "core", fooddistribution: "core", calendar: "core", qrcode: "admin", manage: "admin", students: "admin", casemanagement: "admin", jobdeveloper: "admin", users: "admin", settings: "admin", assessments: "admin" };

// Finer-grained sidebar grouping for the Tailwind/shadcn redesign pass
// (Shell.jsx) -- a 5-bucket taxonomy inspired by the client's reference
// mockup ("Overview / Client Management / Programs / Operations /
// Administration"), remapped onto NB4HS's *real* existing nav items only.
// No new pages were invented for this (the mockup's "Immigration Services"/
// "Workshops & Events"/generic "Clients" aren't real NB4HS features).
// NAV_GROUP above is left untouched -- it's still used by nav.js's
// showDividerBefore() (a leftover from the old flat tab-bar layout).
export var NAV_SECTION = {
  dashboard: "overview",
  checkin: "dailyOps", checkout: "dailyOps", search: "dailyOps", calendar: "dailyOps",
  students: "programs", assessments: "programs", casemanagement: "programs", jobdeveloper: "programs", fooddistribution: "programs",
  reports: "operations", qrcode: "operations", manage: "operations",
  users: "administration", settings: "administration"
};
export var NAV_SECTION_ORDER = ["overview", "dailyOps", "programs", "operations", "administration"];

// Max active students per classroom (waiting list is exempt -- it's the
// backlog, not a class). A flat number rather than a per-classroom field
// since every class at NB4HS follows the same room-capacity rule today.
export var CLASS_CAPACITY = 12;
// Every completed student check-in is credited as this many instructional
// hours for NRS/grant reporting totals (their class runs 9:30-12:30, but the
// program counts a full session as 4 hours regardless of actual login/
// logout time). This only affects aggregate "hours" totals -- the real
// Time In/Time Out timestamps are still recorded and displayed as-is.
export var STUDENT_VISIT_HOURS = 4;

// NRS Educational Functioning Level table for ESL, keyed by CASAS Reading
// and Listening STEPS score ranges -- ported from the client's reference
// chart. `min`/`max` are inclusive; use Infinity/-Infinity for open ends.
export var NRS_LEVELS = [
  { key: "beginning_literacy", order: 1, en: "Beginning ESL Literacy", ht: "ESL Alfabetizasyon Debitan", es: "ESL de Alfabetización Principiante", fr: "ESL Alphabétisation Débutant", readingMin: -Infinity, readingMax: 183, listeningMin: -Infinity, listeningMax: 181 },
  { key: "low_beginning", order: 2, en: "Low Beginning ESL", ht: "ESL Debitan Ba", es: "ESL Principiante Bajo", fr: "ESL Débutant Faible", readingMin: 184, readingMax: 196, listeningMin: 182, listeningMax: 191 },
  { key: "high_beginning", order: 3, en: "High Beginning ESL", ht: "ESL Debitan Wo", es: "ESL Principiante Alto", fr: "ESL Débutant Avancé", readingMin: 197, readingMax: 206, listeningMin: 192, listeningMax: 201 },
  { key: "low_intermediate", order: 4, en: "Low Intermediate ESL", ht: "ESL Entèmedyè Ba", es: "ESL Intermedio Bajo", fr: "ESL Intermédiaire Faible", readingMin: 207, readingMax: 216, listeningMin: 202, listeningMax: 211 },
  { key: "high_intermediate", order: 5, en: "High Intermediate ESL", ht: "ESL Entèmedyè Wo", es: "ESL Intermedio Alto", fr: "ESL Intermédiaire Avancé", readingMin: 217, readingMax: 227, listeningMin: 212, listeningMax: 221 },
  { key: "advanced", order: 6, en: "Advanced ESL", ht: "ESL Avanse", es: "ESL Avanzado", fr: "ESL Avancé", readingMin: 228, readingMax: 238, listeningMin: 222, listeningMax: 231 },
  { key: "exit_advanced", order: 7, en: "Exit Advanced ESL", ht: "ESL Avanse pou Sòti", es: "ESL Avanzado de Salida", fr: "ESL Avancé de Sortie", readingMin: 239, readingMax: Infinity, listeningMin: 232, listeningMax: Infinity }
];
