// Search.jsx -- visitor log search/filter. Ported from search.js's
// renderSearch()/renderSearchResults()/attachSearchHandlers(). Filters used
// to live on App.state.searchFilters (global, so filters "remembered"
// across navigating away and back); that's now local component state,
// since nothing else in the app read those filters -- navigating away and
// back simply resets them, which matches how every other page's local
// UI-only state already behaves in this rewrite (e.g. CheckOut's search box).
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { paginateList } from "../lib/pagination.js";
import { serviceDisplay } from "../lib/students.js";
import { fmtDuration, fmtTime, fullServiceList, fullStaffList, labelFor, minutesBetween } from "../lib/utils.js";
import DatePicker from "../components/DatePicker.jsx";
import Pagination from "../components/Pagination.jsx";

export default function Search() {
  const { data, lang } = useApp();
  const t = useT();
  const [filters, setFilters] = useState({ q: "", service: "", staff: "", from: "", to: "" });
  const [page, setPage] = useState(1);

  function setFilter(key, value) {
    setFilters((prev) => Object.assign({}, prev, { [key]: value }));
    setPage(1);
  }

  let list = data.visits.slice();
  if (filters.q) {
    const ql = filters.q.toLowerCase();
    list = list.filter((v) =>
      (v.firstName + " " + v.lastName).toLowerCase().indexOf(ql) !== -1 ||
      (v.phone || "").indexOf(ql) !== -1 ||
      (v.email || "").toLowerCase().indexOf(ql) !== -1 ||
      (v.address || "").toLowerCase().indexOf(ql) !== -1
    );
  }
  if (filters.service) list = list.filter((v) => v.service === filters.service);
  if (filters.staff) list = list.filter((v) => v.staff === filters.staff);
  if (filters.from) list = list.filter((v) => v.date >= filters.from);
  if (filters.to) list = list.filter((v) => v.date <= filters.to);
  list = list.slice().sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));

  const paged = paginateList(list, page);
  const rows = paged.items;
  const services = fullServiceList(data.customServices);
  const staffList = fullStaffList(data.customStaff);

  return (
    <>
      <h1>{t("searchTitle")}</h1>
      <div className="card">
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="f-q">{t("filterName")}/{t("phone")}</label>
            <input type="text" id="f-q" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-service">{t("filterService")}</label>
            <select id="f-service" value={filters.service} onChange={(e) => setFilter("service", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {services.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-staff">{t("filterStaff")}</label>
            <select id="f-staff" value={filters.staff} onChange={(e) => setFilter("staff", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {staffList.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="f-from">{t("filterDateFrom")}</label>
            <DatePicker id="f-from" value={filters.from} onChange={(v) => setFilter("from", v)} />
          </div>
          <div className="field">
            <label htmlFor="f-to">{t("filterDateTo")}</label>
            <DatePicker id="f-to" value={filters.to} onChange={(v) => setFilter("to", v)} />
          </div>
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn-secondary btn-block" onClick={() => { setFilters({ q: "", service: "", staff: "", from: "", to: "" }); setPage(1); }}>
              {t("clearFilters")}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between"><h3 style={{ margin: 0 }}>{list.length} {t("results")}</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("visitorName")}</th><th>{t("phone")}</th><th>{t("date")}</th><th>{t("timeIn")}</th>
                <th>{t("timeOut")}</th><th>{t("visitLength")}</th><th>{t("service")}</th><th>{t("staffMember")}</th><th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={9} className="muted">{t("noOneFound")}</td></tr>
              ) : (
                rows.map((v) => {
                  const dur = v.timeOut ? fmtDuration(minutesBetween(v.timeIn, v.timeOut), lang) : "—";
                  return (
                    <tr key={v.id}>
                      <td>{v.firstName} {v.lastName}</td>
                      <td>{v.phone}</td>
                      <td>{v.date}</td>
                      <td>{fmtTime(v.timeIn)}</td>
                      <td>{fmtTime(v.timeOut)}</td>
                      <td>{dur}</td>
                      <td>{serviceDisplay(v, data.customServices, lang)}</td>
                      <td>{labelFor(staffList, v.staff, lang)}</td>
                      <td>
                        {v.timeOut
                          ? <span className="badge badge-out">{t("checkedOut")}</span>
                          : <span className="badge badge-in">{t("inBuilding")}</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={paged.page} totalPages={paged.totalPages} onChange={(delta) => setPage(paged.page + delta)} />
      </div>
    </>
  );
}
