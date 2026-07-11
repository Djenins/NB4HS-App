// seed.js -- builds the demo dataset. Pure function now: returns the data
// object instead of mutating a global App.data and calling save() itself.
// The caller (AppContext's init effect) decides whether/when to persist it.
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_PASSWORD, DEFAULT_CASE_MANAGER_EMAIL, DEFAULT_CASE_MANAGER_NAME, DEFAULT_CASE_MANAGER_PASSWORD, DEFAULT_CLASSES, DEFAULT_JOB_DEVELOPER_EMAIL, DEFAULT_JOB_DEVELOPER_NAME, DEFAULT_JOB_DEVELOPER_PASSWORD, SERVICES, STAFF } from "./constants.js";
import { addMonths, dateStrFromDate, todayStr, uid } from "./utils.js";

export function buildSeedData() {
  var firstNames = ["Jean","Marie","Pierre","Wideline","Roseline","Fabiola","Jimmy","Nadège","Emmanuel","Guerline","Sherley","Wilkenson","Darlene","Ronald","Stephanie","Junior","Yolette","Frantz","Carline","Kettly","Michel","Rosemène","Wilson","Naomie","Djems"];
  var lastNames = ["Pierre","Joseph","Jean-Baptiste","Louis","Charles","Alexandre","François","Dorval","Saint-Fleur","Michel","Augustin","Bien-Aimé","Delva","Fleurimond","Innocent"];
  var cities = ["Providence","Pawtucket","Central Falls","Cranston","Woonsocket"];
  var visits = [];
  var phoneUsed = {};
  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randPhone(seedName) {
    if (!phoneUsed[seedName]) phoneUsed[seedName] = "401" + Math.floor(200 + Math.random() * 700) + "" + Math.floor(1000 + Math.random() * 9000);
    return phoneUsed[seedName];
  }
  var now = new Date();
  var startDay = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  var totalDays = Math.round((now - startDay) / 86400000);
  var recurringClients = [];
  for (var c = 0; c < 20; c++) {
    recurringClients.push({ first: rand(firstNames), last: rand(lastNames) });
  }
  for (var d = 0; d <= totalDays; d++) {
    var day = new Date(startDay.getTime() + d * 86400000);
    var wd = day.getDay();
    if (wd === 0) continue; // closed Sundays
    var visitsToday = wd === 6 ? Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 12);
    for (var v = 0; v < visitsToday; v++) {
      var useRecurring = Math.random() < 0.45;
      var person = useRecurring ? rand(recurringClients) : { first: rand(firstNames), last: rand(lastNames) };
      var nameKey = person.first + " " + person.last;
      var svc = rand(SERVICES.filter(function (s) { return s.key !== "other"; }));
      var stf = rand(STAFF.filter(function (s) { return s.key !== "other"; }));
      var hour = 9 + Math.floor(Math.random() * 7);
      var minute = Math.floor(Math.random() * 60);
      var timeIn = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
      var isToday = dateStrFromDate(day) === todayStr();
      var stillIn = isToday && Math.random() < 0.25 && (v === visitsToday - 1 || Math.random() < 0.3);
      var durationMin = 15 + Math.floor(Math.random() * 90);
      var timeOut = stillIn ? null : new Date(timeIn.getTime() + durationMin * 60000);
      visits.push({
        id: uid(),
        firstName: person.first,
        lastName: person.last,
        phone: randPhone(nameKey),
        email: "",
        address: (100 + Math.floor(Math.random() * 900)) + " Main St",
        city: rand(cities),
        state: "RI",
        zip: "02" + (900 + Math.floor(Math.random() * 90)),
        service: svc.key,
        serviceOther: "",
        staff: stf.key,
        staffOther: "",
        notes: "",
        date: dateStrFromDate(day),
        timeIn: timeIn.toISOString(),
        timeOut: timeOut ? timeOut.toISOString() : null
      });
    }
  }

  // Sample Adult Education roster: a handful of students per level.
  var classes = DEFAULT_CLASSES.map(function (c) { return Object.assign({}, c); });
  var studentFirst = ["Widlene","Jean-Robert","Fabiola","Sonson","Manouchka","Wisly","Rose-Marie","Jonas","Claudette","Peterson","Islande","Wilguens","Marie-Ange","Fritznel","Bettina"];
  var studentLast = ["Baptiste","Cadet","Dorsainvil","Estimé","Faustin","Gaspard","Herard","Isaac","Jean-Louis","Cherenfant"];
  var students = [];
  classes.forEach(function (c) {
    var count = 6 + Math.floor(Math.random() * 4);
    for (var i = 0; i < count; i++) {
      var fn = studentFirst[Math.floor(Math.random() * studentFirst.length)];
      var ln = studentLast[Math.floor(Math.random() * studentLast.length)];
      students.push({
        id: uid(), firstName: fn, lastName: ln,
        phone: "401" + Math.floor(200 + Math.random() * 700) + "" + Math.floor(1000 + Math.random() * 9000),
        classKey: c.key, active: true
      });
    }
  });
  // A handful of not-yet-placed students sitting in the Waiting List, for demo purposes.
  for (var w = 0; w < 5; w++) {
    var wfn = studentFirst[Math.floor(Math.random() * studentFirst.length)];
    var wln = studentLast[Math.floor(Math.random() * studentLast.length)];
    students.push({
      id: uid(), firstName: wfn, lastName: wln,
      phone: "401" + Math.floor(200 + Math.random() * 700) + "" + Math.floor(1000 + Math.random() * 9000),
      classKey: null, active: true
    });
  }

  var users = [
    { id: uid(), name: DEFAULT_ADMIN_NAME, email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD, role: "administrator", active: true },
    { id: uid(), name: DEFAULT_CASE_MANAGER_NAME, email: DEFAULT_CASE_MANAGER_EMAIL, password: DEFAULT_CASE_MANAGER_PASSWORD, role: "case_manager", active: true },
    { id: uid(), name: DEFAULT_JOB_DEVELOPER_NAME, email: DEFAULT_JOB_DEVELOPER_EMAIL, password: DEFAULT_JOB_DEVELOPER_PASSWORD, role: "job_developer", active: true }
  ];

  var sessionStart = todayStr();
  var currentSession = { id: uid(), startDate: sessionStart, endDate: addMonths(sessionStart, 3) };

  return {
    visits: visits, customServices: [], customStaff: [], disabledServices: [], disabledStaff: [],
    classes: classes, students: students, nextStudentNumber: 1, users: users, currentSession: currentSession,
    sessionHistory: [], pastSessionStudents: [], caseClients: [], jobClients: [], appointments: []
  };
}
